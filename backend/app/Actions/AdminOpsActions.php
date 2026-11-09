<?php

namespace App\Actions;

use App\Domain\Cafe;
use App\Domain\Members;
use App\Domain\Settings;
use App\Domain\Shop;
use App\Support\Audit;
use App\Support\Dates;
use App\Support\Fail;
use App\Support\Ids;
use App\Support\Locks;
use App\Support\Sync;
use App\Support\Uploads;
use Illuminate\Support\Facades\DB;

/** پنل مدیر: فروشگاه و انبار، کافه، حسابداری و منابع انسانی */
trait AdminOpsActions
{
    private const PAY_FROM = ['cash', 'bank', 'payable'];

    private const ACC_RE = '/^[1-8]\d{3}$/';

    private function supplier(string $name): void
    {
        DB::table('suppliers')->insertOrIgnore(['name' => $name, 'created_at' => now(), 'updated_at' => now()]);
    }

    private static function by($by): ?string
    {
        if ($by === null || $by === '' || $by === 'walkin') {
            return $by === 'walkin' ? 'walkin' : null;
        }
        if (! Members::validPlayer($by)) {
            Fail::with('bad');
        }

        return $by;
    }

    // ---------- فروشگاه ----------
    public function adminOrder(string $id, $status): array
    {
        if (! in_array($status, ['new', 'ready', 'delivered'], true)) {
            Fail::with('bad');
        }
        DB::table('shop_orders')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]);
        Sync::touch('orders');

        return ['ok' => true];
    }

    public function adminProduct(array $p): array
    {
        return Locks::run(['shop'], function () use ($p) {
            $old = isset($p['id']) ? DB::table('products')->where('id', $p['id'])->first() : null;
            $cat = $old->cat ?? (in_array($p['cat'] ?? null, array_keys(Shop::CAT_CODE), true) ? $p['cat'] : null);
            if (! $cat) {
                Fail::with('bad');
            }
            $row = [
                'name' => self::str($p['name'] ?? '', 200, 1, false),
                'brand' => self::str($p['brand'] ?? '', 60) ?? '',
                'price' => self::int($p['price'] ?? 0, 1, 2_000_000_000),
                'was' => isset($p['was']) && (int) $p['was'] > (int) ($p['price'] ?? 0) ? self::int($p['was'], 1, 2_000_000_000) : null,
                'active' => (bool) ($p['active'] ?? true),
                'tag' => isset($p['tag']) && $p['tag'] !== '' ? self::str($p['tag'], 20) : null,
            ];
            if (! $old || array_key_exists('cost', $p)) {
                $row['cost'] = self::int($p['cost'] ?? 0, 0, 2_000_000_000);
            }
            $meta = array_diff_key($p, array_flip(['id', 'code', 'cat', 'brand', 'name', 'price', 'was', 'cost', 'active', 'tag', 'variants', 'stock']));
            if (array_key_exists('img', $meta)) {
                $meta['img'] = Uploads::image($meta['img']);
            }
            $meta = array_merge($old ? (json_decode($old->meta ?? '[]', true) ?: []) : [], $meta);
            $row['meta'] = self::json($meta);
            if ($old) {
                $id = $old->id;
                $code = $old->code;
                DB::table('products')->where('id', $id)->update($row + ['updated_at' => now()]);
            } else {
                $id = Ids::accept($p['id'] ?? null, 'products', 'p');
                $code = Shop::nextCode($cat);
                DB::table('products')->insert($row + ['id' => $id, 'code' => $code, 'cat' => $cat, 'created_at' => now(), 'updated_at' => now()]);
            }
            $variants = Shop::makeVariants($code, $meta, DB::table('product_variants')->where('product_id', $id)->get()->all());
            Shop::saveVariants($id, $variants);
            Audit::log('product.save', $id, ['price' => $row['price']]);
            Sync::touch('products');

            return ['ok' => true, 'id' => $id, 'code' => $code];
        });
    }

    /** اصلاح موجودی یک SKU (کسری یا اضافه) */
    public function adminAdjust(string $pid, string $sku, $delta, $note = ''): array
    {
        $delta = self::int($delta, -100000, 100000);

        return Locks::run(['shop'], function () use ($pid, $sku, $delta, $note) {
            $p = DB::table('products')->where('id', $pid)->first();
            $v = DB::table('product_variants')->where('product_id', $pid)->where('sku', $sku)->first();
            if (! $p || ! $v) {
                Fail::with('gone');
            }
            $qty = max(-(int) $v->stock, $delta);
            if (! $qty) {
                return ['ok' => true];
            }
            DB::table('product_variants')->where('id', $v->id)->update(['stock' => (int) $v->stock + $qty]);
            DB::table('stock_moves')->insert(['id' => Ids::make('M'), 'date' => Dates::today(), 'kind' => 'adjust', 'pid' => $pid, 'code' => $p->code, 'sku' => $sku,
                'qty' => $qty, 'cost' => (int) $p->cost, 'note' => self::str($note, 255) ?? '', 'created_at' => now(), 'updated_at' => now()]);
            Audit::log('stock.adjust', $sku, ['qty' => $qty]);
            Sync::touch('products', 'stock');

            return ['ok' => true];
        });
    }

    /** ورود کالا با فاکتور خرید؛ بهای هر کالا به روش میانگین موزون */
    public function adminReceive(array $r): array
    {
        $date = self::date($r['date'] ?? Dates::todayKey());
        $supplier = self::str($r['supplier'] ?? '', 120, 1, false);
        $invoice = self::str($r['invoice'] ?? '', 60) ?? '';
        $pay = in_array($r['pay'] ?? null, self::PAY_FROM, true) ? $r['pay'] : Fail::with('bad');
        $lines = (array) ($r['items'] ?? []);
        if (! $lines || count($lines) > 200) {
            Fail::with('bad');
        }

        return Locks::run(['shop'], function () use ($date, $supplier, $invoice, $pay, $lines) {
            $items = [];
            $byProduct = [];
            foreach ($lines as $l) {
                $p = DB::table('products')->where('id', $l['pid'] ?? '')->first();
                $v = $p ? DB::table('product_variants')->where('product_id', $p->id)->where('sku', $l['sku'] ?? '')->first() : null;
                if (! $v) {
                    Fail::with('bad');
                }
                $qty = self::int($l['qty'] ?? 0, 1, 100000);
                $cost = self::int($l['cost'] ?? 0, 0, 2_000_000_000);
                $items[] = ['pid' => $p->id, 'code' => $p->code, 'sku' => $v->sku, 'name' => $p->name, 'qty' => $qty, 'cost' => $cost];
                $byProduct[$p->id][] = ['sku' => $v->sku, 'qty' => $qty, 'cost' => $cost];
            }
            foreach ($byProduct as $pid => $ls) {
                $p = DB::table('products')->where('id', $pid)->first();
                $have = (int) DB::table('product_variants')->where('product_id', $pid)->sum('stock');
                $add = array_sum(array_column($ls, 'qty'));
                $val = array_sum(array_map(fn ($x) => $x['qty'] * $x['cost'], $ls));
                $cost = (int) round(($have * (int) $p->cost + $val) / ($have + $add));
                DB::table('products')->where('id', $pid)->update(['cost' => $cost, 'updated_at' => now()]);
                foreach ($ls as $x) {
                    DB::table('product_variants')->where('sku', $x['sku'])->increment('stock', $x['qty']);
                }
            }
            $id = 'R-'.Ids::seq('R', 400);
            DB::table('stock_receipts')->insert(['id' => $id, 'date' => $date, 'supplier' => $supplier, 'invoice' => $invoice, 'pay' => $pay,
                'items' => json_encode($items, JSON_UNESCAPED_UNICODE), 'total' => array_sum(array_map(fn ($x) => $x['qty'] * $x['cost'], $items)), 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $this->supplier($supplier);
            Audit::log('stock.receive', $id);
            Sync::touch('products', 'stock', 'settings');

            return ['ok' => true, 'id' => $id];
        });
    }

    /** فروش حضوری فروشگاه — تحویل همان لحظه */
    public function adminPos(array $items, $method, $by = null): array
    {
        $method = self::deskMethod($method);
        $by = self::by($by);

        return Locks::run(['shop'], function () use ($items, $method, $by) {
            $lines = Shop::resolve($items, false);
            Shop::take($lines);
            $total = array_sum(array_map(fn ($x) => $x['qty'] * $x['price'], $lines));
            $id = 'Q-'.Ids::seq('Q', 1300);
            $this->deskWallet($method, $by, $total, 'order:'.$id);
            DB::table('shop_orders')->insert(['id' => $id, 'by' => $by ?: 'walkin', 'items' => json_encode(Shop::strip($lines), JSON_UNESCAPED_UNICODE), 'total' => $total,
                'method' => $method, 'status' => 'delivered', 'source' => 'desk', 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            Sync::touch('orders', 'products');

            return ['ok' => true, 'id' => $id];
        });
    }

    public function adminApPay(array $p): array
    {
        DB::table('ap_payments')->insert(['id' => Ids::make('AP'), 'date' => Dates::today(), 'supplier' => self::str($p['supplier'] ?? '', 120, 1, false),
            'amount' => self::int($p['amount'] ?? 0, 1, 10_000_000_000), 'pay' => in_array($p['pay'] ?? null, ['cash', 'bank'], true) ? $p['pay'] : 'bank', 'created_at' => now(), 'updated_at' => now()]);
        Sync::touch('stock');

        return ['ok' => true];
    }

    // ---------- کافه ----------
    public function adminCafeItem(array $it): array
    {
        $cats = ['hotcoffee' => '31', 'coldcoffee' => '32', 'hotdrink' => '33', 'colddrink' => '34', 'mocktail' => '35', 'sandwich' => '36', 'food' => '37'];

        return Locks::run(['cafe'], function () use ($it, $cats) {
            $old = isset($it['id']) ? DB::table('cafe_items')->where('id', $it['id'])->first() : null;
            $cat = in_array($it['cat'] ?? ($old->cat ?? null), array_keys($cats), true) ? ($it['cat'] ?? $old->cat) : Fail::with('bad');
            $row = ['cat' => $cat, 'active' => (bool) ($it['active'] ?? ($old->active ?? true))];
            if (! $old || array_key_exists('name', $it)) {
                $row['name'] = self::str($it['name'] ?? '', 120, 1, false);
            }
            if (! $old || array_key_exists('price', $it)) {
                $row['price'] = self::int($it['price'] ?? 0, 0, 1_000_000_000);
            }
            if (array_key_exists('big', $it)) {
                $row['big'] = self::int($it['big'] ?: 0, 0, 1_000_000_000);
            }
            if (! $old || array_key_exists('recipe', $it)) {
                $recipe = [];
                foreach ((array) ($it['recipe'] ?? []) as $r) {
                    if (! is_array($r) || count($r) < 2 || ! is_numeric($r[1]) || (float) $r[1] <= 0) {
                        continue;
                    }
                    if (! DB::table('cafe_ingredients')->where('id', $r[0])->exists()) {
                        Fail::with('bad');
                    }
                    $recipe[] = [(string) $r[0], round((float) $r[1], 3)];
                }
                $row['recipe'] = json_encode($recipe);
            }
            $meta = array_diff_key($it, array_flip(['id', 'code', 'name', 'cat', 'price', 'big', 'active', 'recipe']));
            if (array_key_exists('img', $meta)) {
                $meta['img'] = Uploads::image($meta['img']);
            }
            $row['meta'] = self::json(array_merge($old ? (json_decode($old->meta ?? '[]', true) ?: []) : [], $meta));
            if ($old) {
                DB::table('cafe_items')->where('id', $old->id)->update($row + ['updated_at' => now()]);
                $id = $old->id;
            } else {
                $id = Ids::accept($it['id'] ?? null, 'cafe_items', 'ci');
                $pre = $cats[$cat];
                $n = DB::table('cafe_items')->where('code', 'like', $pre.'%')->pluck('code')->map(fn ($c) => (int) substr($c, 2))->max() ?? 0;
                DB::table('cafe_items')->insert($row + ['id' => $id, 'code' => $pre.str_pad((string) ($n + 1), 3, '0', STR_PAD_LEFT), 'big' => $row['big'] ?? 0, 'created_at' => now(), 'updated_at' => now()]);
            }
            Sync::touch('cafeMenu');

            return ['ok' => true, 'id' => $id];
        });
    }

    public function adminCafeIng(array $g): array
    {
        $cats = ['coffee' => '21', 'dairy' => '22', 'syrup' => '23', 'fruit' => '24', 'bakery' => '25', 'protein' => '26', 'dry' => '27', 'drinks' => '28', 'pack' => '29'];

        return Locks::run(['cafe'], function () use ($g, $cats) {
            $old = isset($g['id']) ? DB::table('cafe_ingredients')->where('id', $g['id'])->first() : null;
            $cat = in_array($g['cat'] ?? ($old->cat ?? null), array_keys($cats), true) ? ($g['cat'] ?? $old->cat) : Fail::with('bad');
            $unit = in_array($g['unit'] ?? ($old->unit ?? null), ['g', 'ml', 'pc'], true) ? ($g['unit'] ?? $old->unit) : Fail::with('bad');
            $row = [
                'name' => self::str($g['name'] ?? ($old->name ?? ''), 120, 1, false), 'cat' => $cat, 'unit' => $unit,
                'min' => self::num($g['min'] ?? ($old->min ?? 0), 0, 100_000_000), 'active' => (bool) ($g['active'] ?? ($old->active ?? true)),
            ];
            // بها فقط هنگام ساخت تعیین می‌شود؛ بعد از آن با خریدها (میانگین موزون) عوض می‌شود
            if (! $old) {
                $row['cost'] = self::num($g['cost'] ?? 0, 0, 1_000_000_000);
            }
            if ($old) {
                DB::table('cafe_ingredients')->where('id', $old->id)->update($row + ['updated_at' => now()]);
                $id = $old->id;
            } else {
                $id = Ids::accept($g['id'] ?? null, 'cafe_ingredients', 'g');
                $pre = $cats[$cat];
                $n = DB::table('cafe_ingredients')->where('code', 'like', $pre.'%')->pluck('code')->map(fn ($c) => (int) substr($c, 2))->max() ?? 0;
                DB::table('cafe_ingredients')->insert($row + ['id' => $id, 'code' => $pre.str_pad((string) ($n + 1), 3, '0', STR_PAD_LEFT), 'stock' => 0, 'created_at' => now(), 'updated_at' => now()]);
            }
            Sync::touch('cafeMenu');

            return ['ok' => true, 'id' => $id];
        });
    }

    public function adminCafeReceive(array $r): array
    {
        $date = self::date($r['date'] ?? Dates::todayKey());
        $supplier = self::str($r['supplier'] ?? '', 120, 1, false);
        $invoice = self::str($r['invoice'] ?? '', 60) ?? '';
        $pay = in_array($r['pay'] ?? null, self::PAY_FROM, true) ? $r['pay'] : Fail::with('bad');
        $lines = (array) ($r['items'] ?? []);
        if (! $lines || count($lines) > 200) {
            Fail::with('bad');
        }

        return Locks::run(['cafe'], function () use ($date, $supplier, $invoice, $pay, $lines) {
            $items = [];
            foreach ($lines as $l) {
                $g = DB::table('cafe_ingredients')->where('id', $l['ing'] ?? '')->first();
                if (! $g) {
                    Fail::with('bad');
                }
                $items[] = ['ing' => $g->id, 'code' => $g->code, 'name' => $g->name, 'qty' => self::num($l['qty'] ?? 0, 0.001, 100_000_000), 'cost' => self::num($l['cost'] ?? 0, 0, 1_000_000_000)];
            }
            Cafe::receive($items);
            $id = 'CR-'.Ids::seq('CR', 800);
            DB::table('cafe_receipts')->insert(['id' => $id, 'date' => $date, 'supplier' => $supplier, 'invoice' => $invoice, 'pay' => $pay,
                'items' => json_encode($items, JSON_UNESCAPED_UNICODE), 'total' => array_sum(array_map(fn ($x) => (int) round($x['qty'] * $x['cost']), $items)), 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $this->supplier($supplier);
            Sync::touch('cafeMenu', 'cafeStock', 'settings');

            return ['ok' => true, 'id' => $id];
        });
    }

    /** ضایعات (منفی) یا اضافه‌ی شمارش (مثبت) به واحد پایه */
    public function adminCafeAdjust(string $id, $delta, $note = ''): array
    {
        $delta = self::num($delta, -100_000_000, 100_000_000);

        return Locks::run(['cafe'], function () use ($id, $delta, $note) {
            $g = DB::table('cafe_ingredients')->where('id', $id)->first();
            if (! $g) {
                Fail::with('gone');
            }
            $qty = max(-(float) $g->stock, $delta);
            if (abs($qty) < 1e-9) {
                return ['ok' => true];
            }
            $amount = (int) round($qty * (float) $g->cost);
            DB::table('cafe_ingredients')->where('id', $id)->update(['stock' => max(0, round((float) $g->stock + $qty, 3)), 'updated_at' => now()]);
            if ($amount) {
                DB::table('cafe_moves')->insert(['id' => Ids::make('CM'), 'date' => Dates::today(), 'ing' => $id, 'code' => $g->code, 'name' => $g->name,
                    'qty' => $qty, 'amount' => $amount, 'note' => self::str($note, 255) ?? '', 'created_at' => now(), 'updated_at' => now()]);
            }
            Sync::touch('cafeMenu', 'cafeStock');

            return ['ok' => true];
        });
    }

    public function adminCafeOrder(string $id, $status): array
    {
        if (! in_array($status, ['new', 'prep', 'ready', 'delivered'], true)) {
            Fail::with('bad');
        }
        $o = DB::table('cafe_orders')->where('id', $id)->first();
        if (! $o) {
            return ['ok' => true];
        }
        DB::table('cafe_orders')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]);
        if ($status === 'ready' && $o->status !== 'ready' && Members::isMemberId($o->by)) {
            $body = $o->to ? 'داریم میاریم سر زمین '.\App\Support\Jalali::fa((string) $o->to).'.' : 'از کافه تحویل بگیرید.';
            Members::notify($o->by, '☕', 'سفارش '.$id.' آماده‌ست', $body);
        }
        Sync::touch('cafeOrders');

        return ['ok' => true];
    }

    /** سفارش حضوری کافه؛ now = تحویل همان لحظه */
    public function adminCafePos(array $lines, $method, $by = null, $to = null, $now = false): array
    {
        $method = self::deskMethod($method);
        $by = self::by($by);
        $to = $to ? self::int($to, 1, 4) : null;

        return Locks::run(['cafe'], function () use ($lines, $method, $by, $to, $now) {
            [$items, $ings] = Cafe::load();
            $clean = Cafe::clean($items, $lines);
            $r = Cafe::place($ings, $items, $clean);
            Cafe::saveStock($r['stock']);
            $id = 'K-'.Ids::seq('K', 6000);
            $this->deskWallet($method, $by, $r['total'], 'cafe:'.$id);
            DB::table('cafe_orders')->insert(['id' => $id, 'by' => $by ?: 'walkin', 'items' => json_encode($r['lines'], JSON_UNESCAPED_UNICODE), 'use' => json_encode($r['use']),
                'total' => $r['total'], 'method' => $method, 'to' => $to, 'status' => $now ? 'delivered' : 'prep', 'source' => 'desk', 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            Sync::touch('cafeOrders', 'cafeMenu');

            return ['ok' => true, 'id' => $id];
        });
    }

    // ---------- حسابداری ----------
    public function adminPayin(array $p): array
    {
        $id = Ids::accept($p['id'] ?? null, 'payins', 'PI');
        DB::table('payins')->insert([
            'id' => $id, 'date' => Dates::today(), 'amount' => self::int($p['amount'] ?? 0, 1, 10_000_000_000), 'method' => self::deskMethod($p['method'] ?? null),
            'acc' => isset($p['acc']) && preg_match(self::ACC_RE, \App\Support\In::str($p['acc'])) ? $p['acc'] : '6201', 'title' => self::str($p['title'] ?? '', 255),
            'note' => self::str($p['note'] ?? '', 255), 'by' => self::by($p['by'] ?? null), 'name' => self::str($p['name'] ?? '', 120), 'at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        Audit::log('payin.add', $id, ['amount' => $p['amount'] ?? 0]);
        Sync::touch('accounting');

        return ['ok' => true, 'id' => $id];
    }

    public function adminPayinDel(string $id): array
    {
        DB::table('payins')->where('id', $id)->delete();
        Audit::log('payin.delete', $id);
        Sync::touch('accounting');

        return ['ok' => true];
    }

    public function adminExpense(array $e): array
    {
        $id = Ids::accept($e['id'] ?? null, 'expenses', 'e');
        $pay = in_array($e['pay'] ?? null, self::PAY_FROM, true) ? $e['pay'] : Fail::with('bad');
        $vendor = self::str($e['vendor'] ?? '', 120);
        DB::table('expenses')->insert([
            'id' => $id, 'date' => self::date($e['date'] ?? Dates::todayKey()), 'acc' => preg_match(self::ACC_RE, \App\Support\In::str($e['acc'] ?? '')) ? $e['acc'] : Fail::with('bad'),
            'amount' => self::int($e['amount'] ?? 0, 1, 100_000_000_000), 'title' => self::str($e['title'] ?? '', 255), 'vendor' => $vendor, 'pay' => $pay,
            'invoice' => self::str($e['invoice'] ?? '', 60), 'at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        if ($pay === 'payable' && $vendor) {
            $this->supplier($vendor);
        }
        Audit::log('expense.add', $id);
        Sync::touch('accounting', 'settings');

        return ['ok' => true, 'id' => $id];
    }

    public function adminExpenseDel(string $id): array
    {
        DB::table('expenses')->where('id', $id)->delete();
        Audit::log('expense.delete', $id);
        Sync::touch('accounting');

        return ['ok' => true];
    }

    /** سند دستی؛ جمع بدهکار و بستانکار باید برابر باشد */
    public function adminJournal(array $j): array
    {
        $lines = [];
        $dr = 0;
        $cr = 0;
        foreach ((array) ($j['lines'] ?? []) as $l) {
            $a = \App\Support\In::str($l['acc'] ?? '');
            if (! preg_match(self::ACC_RE, $a)) {
                Fail::with('bad');
            }
            $d = self::int($l['dr'] ?? 0, 0, 100_000_000_000);
            $c = self::int($l['cr'] ?? 0, 0, 100_000_000_000);
            if (! $d && ! $c) {
                continue;
            }
            $dr += $d;
            $cr += $c;
            $lines[] = array_filter(['acc' => $a, 'dr' => $d, 'cr' => $c, 'sub' => isset($l['sub']) ? mb_substr((string) $l['sub'], 0, 60) : null, 'desc' => isset($l['desc']) ? mb_substr((string) $l['desc'], 0, 120) : null], fn ($v) => $v !== null);
        }
        if (! $lines || $dr !== $cr || $dr === 0) {
            Fail::with('unbalanced');
        }
        $id = Ids::accept($j['id'] ?? null, 'journals', 'J');
        DB::table('journals')->insert(['id' => $id, 'date' => self::date($j['date'] ?? null), 'title' => self::str($j['title'] ?? '', 255, 1, false), 'lines' => json_encode($lines, JSON_UNESCAPED_UNICODE), 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        Audit::log('journal.add', $id, ['amount' => $dr]);
        Sync::touch('accounting');

        return ['ok' => true, 'id' => $id];
    }

    public function adminJournalDel(string $id): array
    {
        DB::table('journals')->where('id', $id)->delete();
        Audit::log('journal.delete', $id);
        Sync::touch('accounting');

        return ['ok' => true];
    }

    // ---------- منابع انسانی ----------
    public function adminStaff(array $p): array
    {
        $old = isset($p['id']) ? DB::table('staff')->where('id', $p['id'])->first() : null;
        $row = [];
        $has = fn ($k) => ! $old || array_key_exists($k, $p);
        if ($has('name')) {
            $row['name'] = self::str($p['name'] ?? '', 120, 1, false);
        }
        if ($has('role')) {
            $row['role'] = self::str($p['role'] ?? 'service', 20, 1, false);
        }
        if ($has('type')) {
            $row['type'] = in_array($p['type'] ?? 'full', ['full', 'part', 'hourly', 'commission'], true) ? ($p['type'] ?? 'full') : 'full';
        }
        foreach (['base' => 10_000_000_000, 'rate' => 1_000_000_000] as $k => $max) {
            if (array_key_exists($k, $p)) {
                $row[$k] = self::int($p[$k] ?: 0, 0, $max);
            }
        }
        if (array_key_exists('children', $p)) {
            $row['children'] = self::int($p['children'] ?: 0, 0, 20);
        }
        if (array_key_exists('start', $p)) {
            $row['start'] = $p['start'] ? self::date($p['start']) : null;
        }
        if (array_key_exists('contractEnd', $p)) {
            $row['contract_end'] = $p['contractEnd'] ? self::date($p['contractEnd']) : null;
        }
        if (array_key_exists('status', $p)) {
            $row['status'] = in_array($p['status'], ['active', 'ended', 'paused'], true) ? $p['status'] : 'active';
        }
        if (array_key_exists('coach', $p)) {
            $row['coach'] = $p['coach'] ?: null;
        }
        if (array_key_exists('share', $p)) {
            $row['share'] = $p['share'] === null || $p['share'] === '' ? null : self::num($p['share'], 0, 1);
        }
        $meta = array_diff_key($p, array_flip(['id', 'name', 'role', 'type', 'base', 'rate', 'children', 'start', 'contractEnd', 'status', 'coach', 'share']));
        $row['meta'] = self::json(array_merge($old ? (json_decode($old->meta ?? '[]', true) ?: []) : ['docs' => (object) []], $meta));
        if ($old) {
            DB::table('staff')->where('id', $old->id)->update($row + ['updated_at' => now()]);
            $id = $old->id;
        } else {
            $id = Ids::accept($p['id'] ?? null, 'staff', 'h');
            DB::table('staff')->insert($row + ['id' => $id, 'status' => $row['status'] ?? 'active', 'shifts' => json_encode(array_fill(0, 7, 'off')), 'created_at' => now(), 'updated_at' => now()]);
        }
        Audit::log('staff.save', $id);
        Sync::touch('hr');

        return ['ok' => true, 'id' => $id];
    }

    public function adminShift(string $staffId, $day, $code): array
    {
        $day = self::int($day, 0, 6);
        if (! in_array($code, ['m', 'e', 'f', 'n', 'off'], true)) {
            Fail::with('bad');
        }
        DB::transaction(function () use ($staffId, $day, $code) {
            $s = DB::table('staff')->where('id', $staffId)->lockForUpdate()->first();
            if (! $s) {
                Fail::with('gone');
            }
            $shifts = json_decode($s->shifts, true) ?: array_fill(0, 7, 'off');
            $shifts[$day] = $code;
            DB::table('staff')->where('id', $staffId)->update(['shifts' => json_encode(array_values($shifts)), 'updated_at' => now()]);
        });
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminAttend($date, string $staffId, array $patch): array
    {
        $date = self::date($date);
        DB::transaction(function () use ($date, $staffId, $patch) {
            $cur = DB::table('attendance')->where('date', $date)->where('staff_id', $staffId)->lockForUpdate()->first();
            $in = array_key_exists('in', $patch) ? $patch['in'] : ($cur->in ?? null);
            $out = array_key_exists('out', $patch) ? $patch['out'] : ($cur->out ?? null);
            if ($in === null) {
                DB::table('attendance')->where('date', $date)->where('staff_id', $staffId)->delete();

                return;
            }
            $in = self::num($in, 0, 24);
            $out = $out === null ? null : self::num($out, 0, 24);
            if (! DB::table('staff')->where('id', $staffId)->exists()) {
                Fail::with('gone');
            }
            DB::table('attendance')->updateOrInsert(['date' => $date, 'staff_id' => $staffId], ['in' => $in, 'out' => $out, 'updated_at' => now(), 'created_at' => $cur->created_at ?? now()]);
        });
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminLeave(array $l): array
    {
        $from = self::date($l['from'] ?? null);
        $to = self::date($l['to'] ?? null);
        if ($to < $from || ! DB::table('staff')->where('id', $l['staff'] ?? '')->exists()) {
            Fail::with('bad');
        }
        DB::table('leaves')->insert(['id' => Ids::accept($l['id'] ?? null, 'leaves', 'L'), 'staff' => $l['staff'], 'kind' => in_array($l['kind'] ?? null, ['annual', 'sick', 'unpaid'], true) ? $l['kind'] : 'annual',
            'from' => $from, 'to' => $to, 'days' => self::int($l['days'] ?? 1, 1, 400), 'status' => 'pending', 'note' => self::str($l['note'] ?? '', 255), 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminLeaveStatus(string $id, $status): array
    {
        // پنل مدیر «رد» را با no می‌فرستد
        if (! in_array($status, ['ok', 'no', 'rejected', 'pending'], true)) {
            Fail::with('bad');
        }
        DB::table('leaves')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]);
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminAdvance(array $a): array
    {
        $s = DB::table('staff')->where('id', $a['staff'] ?? '')->first();
        if (! $s) {
            Fail::with('bad');
        }
        DB::table('advances')->insert(['id' => Ids::accept($a['id'] ?? null, 'advances', 'A'), 'staff' => $s->id, 'name' => $s->name, 'date' => isset($a['date']) ? self::date($a['date']) : Dates::today(),
            'amount' => self::int($a['amount'] ?? 0, 1, 10_000_000_000), 'pay' => in_array($a['pay'] ?? null, ['cash', 'bank'], true) ? $a['pay'] : 'cash', 'note' => self::str($a['note'] ?? '', 255), 'created_at' => now(), 'updated_at' => now()]);
        Audit::log('advance.add', $s->id, ['amount' => $a['amount'] ?? 0]);
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminHrCfg(array $p): array
    {
        $cur = Settings::hr();
        foreach (['housing', 'bon', 'child', 'monthHours', 'dayHours', 'annualLeave'] as $k) {
            if (array_key_exists($k, $p)) {
                $cur[$k] = self::int($p[$k], 0, 1_000_000_000);
            }
        }
        foreach (['otRate' => 5, 'emp' => 1, 'er' => 1] as $k => $max) {
            if (array_key_exists($k, $p)) {
                $cur[$k] = self::num($p[$k], 0, $max);
            }
        }
        Settings::put('hrCfg', $cur);
        Sync::touch('settings', 'hr');

        return ['ok' => true];
    }

    /** ثبت سند حقوق یک ماه با تصویر محاسبه‌ی پنل در همان لحظه */
    public function adminPayroll($mk, $rows = null, $label = null): array
    {
        if (! is_string($mk) || ! preg_match('/^\d{4}-\d{2}$/', $mk) || ! is_array($rows)) {
            Fail::with('bad');
        }
        DB::table('payrolls')->insertOrIgnore(['id' => 'PR-'.$mk, 'month' => $mk, 'label' => self::str($label ?: $mk, 40, 1, false), 'date' => Dates::today(),
            'rows' => self::json(array_values($rows)), 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        Audit::log('payroll.add', $mk);
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminPayrollPay($mk, $field): array
    {
        $col = ['paidAt' => 'paid_at', 'insPaidAt' => 'ins_paid_at'][$field] ?? Fail::with('bad');
        DB::table('payrolls')->where('month', $mk)->whereNull($col)->update([$col => Dates::today(), 'updated_at' => now()]);
        Audit::log('payroll.pay', (string) $mk, ['field' => $field]);
        Sync::touch('hr');

        return ['ok' => true];
    }

    public function adminPayrollUndo($mk): array
    {
        DB::table('payrolls')->where('month', $mk)->whereNull('paid_at')->delete();
        Sync::touch('hr');

        return ['ok' => true];
    }
}
