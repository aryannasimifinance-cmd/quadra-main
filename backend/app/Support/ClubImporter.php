<?php

namespace App\Support;

use App\Domain\Catalog;
use App\Domain\Settings;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * ورود داده‌ی باشگاه با همان شکل JSONِ نسخه‌ی قبلی اپ (club) به دیتابیس.
 * برای داده‌ی نمایشی و برای انتقال داده‌ی نسخه‌ی مرورگری (V7) استفاده می‌شود.
 */
final class ClubImporter
{
    private array $idmap = [];

    public function __construct(private string $meId = 'm-me') {}

    private function id($x): ?string
    {
        if ($x === null || $x === '') {
            return null;
        }
        $x = (string) $x;

        return $this->idmap[$x] ?? ($x === 'me' ? $this->meId : $x);
    }

    private static function d($k): ?string
    {
        return $k ? Dates::parse($k) : null;
    }

    private static function t($ms): Carbon
    {
        return $ms ? Dates::fromMs($ms) : now();
    }

    private static function j($v): ?string
    {
        return $v === null ? null : json_encode($v, JSON_UNESCAPED_UNICODE);
    }

    private static function chunks(string $table, array $rows): void
    {
        foreach (array_chunk($rows, 300) as $c) {
            DB::table($table)->insert($c);
        }
    }

    /** کاتالوگ اولیه (کالا، منوی کافه، مربی‌ها) برای نصب واقعی */
    public function catalog(array $cat): void
    {
        foreach ($cat['products'] ?? [] as $p) {
            $this->product($p);
        }
        foreach ($cat['cafeIngs'] ?? [] as $g) {
            $this->cafeIng($g);
        }
        foreach ($cat['cafeItems'] ?? [] as $i) {
            $this->cafeItem($i);
        }
        foreach ($cat['coaches'] ?? [] as $c) {
            $this->coach($c);
        }
    }

    private function product(array $p): void
    {
        $meta = array_diff_key($p, array_flip(['id', 'code', 'cat', 'brand', 'name', 'price', 'was', 'cost', 'active', 'tag', 'variants', 'stock']));
        DB::table('products')->insert(['id' => $p['id'], 'code' => $p['code'], 'cat' => $p['cat'], 'brand' => $p['brand'] ?? '', 'name' => $p['name'], 'price' => (int) $p['price'],
            'was' => isset($p['was']) ? (int) $p['was'] : null, 'cost' => (int) ($p['cost'] ?? 0), 'active' => ($p['active'] ?? true) !== false, 'tag' => $p['tag'] ?? null,
            'meta' => self::j($meta), 'created_at' => now(), 'updated_at' => now()]);
        foreach (array_values($p['variants'] ?? []) as $i => $v) {
            DB::table('product_variants')->insert(['product_id' => $p['id'], 'sku' => $v['sku'], 'size' => $v['size'] ?? null, 'color' => $v['color'] ?? null, 'stock' => max(0, (int) ($v['stock'] ?? 0)), 'pos' => $i]);
        }
    }

    private function cafeIng(array $g): void
    {
        DB::table('cafe_ingredients')->insert(['id' => $g['id'], 'code' => $g['code'], 'name' => $g['name'], 'cat' => $g['cat'], 'unit' => $g['unit'], 'cost' => (float) ($g['cost'] ?? 0),
            'min' => (float) ($g['min'] ?? 0), 'stock' => max(0, (float) ($g['stock'] ?? 0)), 'active' => ($g['active'] ?? true) !== false, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function cafeItem(array $i): void
    {
        $meta = array_diff_key($i, array_flip(['id', 'code', 'name', 'cat', 'price', 'big', 'active', 'recipe']));
        DB::table('cafe_items')->insert(['id' => $i['id'], 'code' => $i['code'], 'name' => $i['name'], 'cat' => $i['cat'], 'price' => (int) $i['price'], 'big' => (int) ($i['big'] ?? 0),
            'active' => ($i['active'] ?? true) !== false, 'recipe' => self::j($i['recipe'] ?? []), 'meta' => self::j($meta), 'created_at' => now(), 'updated_at' => now()]);
    }

    private function coach(array $c): void
    {
        $login = $c['login'] ?? null;
        DB::table('coaches')->insert([
            'id' => $c['id'], 'name' => $c['name'], 'title' => $c['title'] ?? '', 'level' => $c['level'] ?? 'B', 'exp' => (int) ($c['exp'] ?? 0), 'rating' => $c['rating'] ?? null,
            'price' => (int) ($c['price'] ?? 0), 'img' => $c['img'] ?? null, 'bio' => $c['bio'] ?? '', 'record' => self::j($c['record'] ?? []),
            'packs' => self::j($c['packs'] ?? ['one' => true, 'five' => true, 'ten' => true, 'group' => true]), 'prices' => self::j((object) ($c['prices'] ?? [])),
            'active' => ($c['active'] ?? true) !== false, 'member' => $this->id($c['member'] ?? null), 'phone' => $c['phone'] ?? null, 'since' => $c['since'] ?? null,
            'share' => (int) ($c['share'] ?? 50), 'note' => $c['note'] ?? '',
            'login_on' => (bool) ($login['on'] ?? false), 'username' => ! empty($login['user']) ? strtolower($login['user']) : null,
            'password' => ! empty($login['pass']) ? Hash::make((string) $login['pass']) : null,
            'cap_day' => (int) ($login['day'] ?? 5), 'cap_week' => (int) ($login['week'] ?? $login['hours'] ?? 15),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** داده‌ی کامل باشگاه + فهرست اعضا + حساب «من» (اختیاری) */
    public function club(array $club, array $members, ?array $me = null): void
    {
        $now = now();
        // ---------- اعضا ----------
        $phones = [];
        $rows = [];
        foreach (array_merge($members, $club['members'] ?? []) as $m) {
            $phone = $m['phone'] ?? null;
            if ($phone && isset($phones[$phone])) {
                $phone = null;
            }
            if ($phone) {
                $phones[$phone] = true;
            }
            $edit = $club['memberEdits'][$m['id']] ?? [];
            $m = array_merge($m, $edit);
            $joined = $now->copy()->subDays((int) ($m['joined'] ?? 0));
            $rows[] = [
                'id' => $m['id'], 'name' => $m['name'], 'phone' => $phone, 'level' => Catalog::isLevel($m['level'] ?? null) ? $m['level'] : 'C', 'side' => $m['side'] ?? 'both',
                'gender' => $m['gender'] ?? null, 'birth' => $m['birth'] ?? null, 'xp' => 0, 'wallet' => 0, 'vip' => $m['member'] ?? null, 'note' => $m['note'] ?? null,
                'inactive' => ! empty($m['inactive']), 'source' => $m['source'] ?? null, 'games_base' => (int) ($m['games'] ?? 0), 'wins' => (int) ($m['wins'] ?? 0),
                'points_extra' => isset($m['points']) ? (int) $m['points'] - Catalog::levelBase($m['level'] ?? 'C') : 0,
                'joined_at' => isset($m['at']) ? self::t($m['at']) : $joined, 'created_at' => isset($m['at']) ? self::t($m['at']) : $joined, 'updated_at' => $now,
            ];
        }
        if ($me) {
            $u = $me['user'];
            if (isset($phones[$u['phone']])) {
                foreach ($rows as &$r) {
                    if ($r['phone'] === $u['phone']) {
                        $r['phone'] = null;
                    }
                }
                unset($r);
            }
            $rows[] = [
                'id' => $this->meId, 'name' => $u['name'], 'phone' => $u['phone'], 'level' => $u['level'] ?? 'C', 'side' => $u['side'] ?? 'both', 'gender' => $u['gender'] ?? null,
                'birth' => $u['birth'] ?? null, 'xp' => (int) ($me['xp'] ?? 0), 'wallet' => (int) ($me['wallet'] ?? 0), 'vip' => null, 'note' => null, 'inactive' => false, 'source' => 'app',
                'games_base' => 0, 'wins' => 0, 'points_extra' => 0, 'joined_at' => self::t($u['joined'] ?? null), 'created_at' => self::t($u['joined'] ?? null), 'updated_at' => $now,
            ];
        }
        self::chunks('members', $rows);
        if ($me) {
            foreach ($me['badges'] ?? [] as $b) {
                DB::table('member_badges')->insertOrIgnore(['member_id' => $this->meId, 'badge' => $b, 'created_at' => $now]);
            }
            if ((int) ($me['wallet'] ?? 0) > 0) {
                DB::table('wallet_transactions')->insert(['member_id' => $this->meId, 'amount' => (int) $me['wallet'], 'balance' => (int) $me['wallet'], 'kind' => 'adjust', 'ref' => 'import', 'note' => 'موجودی اولیه', 'created_at' => $now]);
            }
        }
        foreach ($club['logins'] ?? [] as $user => $l) {
            $mid = collect($rows)->firstWhere('phone', $l['phone'] ?? '')['id'] ?? null;
            if ($mid) {
                // رمز نسخه‌ی مرورگری قابل انتقال نیست (هش دیگری داشت)؛ فقط نام کاربری، مگر رمز خام داده شده باشد
                DB::table('members')->where('id', $mid)->update(['username' => strtolower($user), 'password' => ! empty($l['pass']) ? Hash::make((string) $l['pass']) : null]);
            }
        }

        // ---------- تنظیمات و زمین‌ها ----------
        foreach (['pricing', 'hours', 'limits', 'hrCfg', 'opening'] as $k) {
            if (isset($club[$k])) {
                Settings::put($k, $club[$k]);
            }
        }
        foreach ($club['off'] ?? [] as $cid => $off) {
            DB::table('courts')->where('id', (int) $cid)->update(['off' => (bool) $off]);
        }
        foreach ($club['courtEdits'] ?? [] as $cid => $e) {
            if ($e) {
                DB::table('courts')->where('id', (int) $cid)->update(['edits' => self::j($e)]);
            }
        }
        foreach ($club['suppliers'] ?? [] as $s) {
            DB::table('suppliers')->insertOrIgnore(['name' => $s, 'created_at' => $now, 'updated_at' => $now]);
        }

        // ---------- مربی‌ها، کالا، کافه ----------
        foreach ($club['coaches'] ?? [] as $c) {
            $this->coach($c);
        }
        foreach ($club['products'] ?? [] as $p) {
            $this->product($p);
        }
        foreach ($club['cafeIngs'] ?? [] as $g) {
            $this->cafeIng($g);
        }
        foreach ($club['cafeItems'] ?? [] as $i) {
            $this->cafeItem($i);
        }

        // ---------- رزروها ----------
        $b = [];
        $pl = [];
        $inv = [];
        $pay = [];
        foreach ($club['bookings'] ?? [] as $x) {
            if (! empty($x['event'])) {
                continue; // زمین‌های بسته‌ی مسابقه از روی خود مسابقه ساخته می‌شوند
            }
            $created = self::t($x['at'] ?? null);
            $b[] = [
                'id' => $x['id'], 'court' => (int) $x['court'], 'date' => self::d($x['date']), 'start' => $x['start'], 'dur' => $x['dur'], 'type' => $x['type'],
                'status' => $x['status'] ?? 'ok', 'source' => $x['source'] ?? null, 'by' => $this->id($x['by'] ?? null), 'coach' => $x['coach'] ?? null,
                'price' => (int) round($x['price'] ?? 0), 'full' => $x['type'] === 'open' ? (int) round($x['full'] ?? $x['price'] ?? 0) : null, 'paid' => (int) round($x['paid'] ?? 0),
                'method' => $x['method'] ?? null, 'levels' => self::j($x['levels'] ?? null), 'want_side' => $x['wantSide'] ?? null, 'visibility' => $x['visibility'] ?? null,
                'series' => $x['series'] ?? null, 'block' => $x['block'] ?? null, 'note' => isset($x['note']) ? mb_substr($x['note'], 0, 255) : null, 'refunded' => ! empty($x['refunded']),
                'cancelled_at' => ($x['status'] ?? 'ok') === 'cancelled' ? $created : null, 'created_at' => $created, 'updated_at' => $now,
            ];
            $seen = [];
            foreach (array_values($x['players'] ?? []) as $i => $p) {
                $p = $this->id($p);
                if (! $p || isset($seen[$p])) {
                    continue;
                }
                $seen[$p] = true;
                $pl[] = ['booking_id' => $x['id'], 'pos' => $i, 'player' => $p, 'member_id' => str_starts_with($p, 'f:') ? null : $p,
                    'share' => isset($x['shares'][$p === $this->meId ? 'me' : $p]) ? (int) $x['shares'][$p === $this->meId ? 'me' : $p] : null, 'share_method' => null, 'created_at' => $created, 'updated_at' => $now];
            }
            foreach ($x['invited'] ?? [] as $m) {
                $inv[] = ['booking_id' => $x['id'], 'member_id' => $this->id($m)];
            }
            foreach ($x['settled'] ?? [] as $s) {
                $pay[] = ['booking_id' => $x['id'], 'amount' => (int) $s['amt'], 'method' => $s['method'] ?? 'cash', 'at' => self::t($s['at'] ?? null), 'actor' => 'import'];
            }
        }
        self::chunks('bookings', $b);
        self::chunks('booking_players', $pl);
        foreach (array_chunk($inv, 300) as $c) {
            DB::table('booking_invites')->insertOrIgnore($c);
        }
        self::chunks('booking_payments', $pay);

        foreach ($club['coachReqs'] ?? [] as $r) {
            DB::table('coach_requests')->insert(['id' => $r['id'], 'coach' => $r['coach'], 'date' => self::d($r['date']), 'court' => (int) $r['court'], 'start' => $r['start'], 'dur' => $r['dur'],
                'student' => $this->id($r['student'] ?? null), 'note' => $r['note'] ?? '', 'status' => $r['status'], 'decided_at' => isset($r['done']) ? self::t($r['done']) : null,
                'created_at' => self::t($r['at'] ?? null), 'updated_at' => $now]);
        }

        // ---------- فروش، سفارش‌ها، کافه ----------
        self::chunks('sales', array_map(fn ($s) => ['id' => $s['id'], 'kind' => $s['kind'], 'item' => $s['item'] ?? null, 'pack' => $s['pack'] ?? null, 'series' => $s['series'] ?? null,
            'name' => mb_substr($s['name'], 0, 255), 'by' => $this->id($s['by'] ?? null), 'price' => (int) $s['price'], 'method' => $s['method'] ?? null, 'at' => self::t($s['at'] ?? null),
            'created_at' => $now, 'updated_at' => $now], $club['sales'] ?? []));
        self::chunks('shop_orders', array_map(fn ($o) => ['id' => $o['id'], 'by' => $this->id($o['by'] ?? null), 'items' => self::j($o['items']), 'total' => (int) $o['total'],
            'method' => $o['method'] ?? 'cash', 'status' => $o['status'] ?? 'delivered', 'source' => $o['source'] ?? null, 'at' => self::t($o['at'] ?? null), 'created_at' => $now, 'updated_at' => $now], $club['orders'] ?? []));
        self::chunks('cafe_orders', array_map(fn ($o) => ['id' => $o['id'], 'by' => $this->id($o['by'] ?? null), 'items' => self::j($o['items']), 'use' => self::j($o['use'] ?? []), 'total' => (int) $o['total'],
            'method' => $o['method'] ?? 'cash', 'to' => $o['to'] ?? null, 'status' => $o['status'] ?? 'delivered', 'source' => $o['source'] ?? null, 'at' => self::t($o['at'] ?? null), 'created_at' => $now, 'updated_at' => $now], $club['cafeOrders'] ?? []));
        foreach ($club['receipts'] ?? [] as $r) {
            DB::table('stock_receipts')->insert(['id' => $r['id'], 'date' => self::d($r['date']), 'supplier' => $r['supplier'], 'invoice' => $r['invoice'] ?? '', 'pay' => $r['pay'], 'items' => self::j($r['items']), 'total' => (int) $r['total'], 'at' => self::t($r['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['stockMoves'] ?? [] as $m) {
            DB::table('stock_moves')->insert(['id' => $m['id'], 'date' => self::d($m['date']), 'kind' => $m['kind'], 'pid' => $m['pid'], 'code' => $m['code'], 'sku' => $m['sku'], 'qty' => (int) $m['qty'], 'cost' => (int) $m['cost'], 'note' => $m['note'] ?? '', 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['apPays'] ?? [] as $p) {
            DB::table('ap_payments')->insert(['id' => $p['id'], 'date' => self::d($p['date']), 'supplier' => $p['supplier'], 'amount' => (int) $p['amount'], 'pay' => $p['pay'], 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['cafeReceipts'] ?? [] as $r) {
            DB::table('cafe_receipts')->insert(['id' => $r['id'], 'date' => self::d($r['date']), 'supplier' => $r['supplier'], 'invoice' => $r['invoice'] ?? '', 'pay' => $r['pay'], 'items' => self::j($r['items']), 'total' => (int) $r['total'], 'at' => self::t($r['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['cafeMoves'] ?? [] as $m) {
            DB::table('cafe_moves')->insert(['id' => $m['id'], 'date' => self::d($m['date']), 'ing' => $m['ing'], 'code' => $m['code'], 'name' => $m['name'], 'qty' => $m['qty'], 'amount' => (int) $m['amount'], 'note' => $m['note'] ?? '', 'created_at' => $now, 'updated_at' => $now]);
        }

        // ---------- نظرها ----------
        self::chunks('reviews', array_map(fn ($r) => ['id' => $r['id'], 'target' => $r['target'], 'stars' => (int) $r['stars'], 'text' => $r['text'] ?? '', 'ok' => ($r['ok'] ?? true) !== false,
            'hidden' => ! empty($r['hidden']), 'created_at' => self::t($r['at'] ?? null)], $club['reviews'] ?? []));

        // ---------- مسابقه‌ها ----------
        $known = ['id', 'kind', 'title', 'desc', 'format', 'scoring', 'gender', 'ageMin', 'ageMax', 'date', 'start', 'dur', 'courts', 'levels', 'cap', 'fee', 'prize', 'img', 'status', 'note', 'teams', 'groups', 'matches', 'setup', 'regs', 'taken'];
        foreach ($club['events'] ?? [] as $e) {
            DB::table('events')->insert([
                'id' => $e['id'], 'kind' => $e['kind'] ?? 'friday', 'title' => $e['title'], 'desc' => $e['desc'] ?? null, 'format' => $e['format'] ?? 'groups', 'scoring' => $e['scoring'] ?? null,
                'gender' => $e['gender'] ?? 'all', 'age_min' => $e['ageMin'] ?? null, 'age_max' => $e['ageMax'] ?? null, 'date' => self::d($e['date']), 'start' => $e['start'], 'dur' => $e['dur'],
                'courts' => self::j($e['courts'] ?? [1, 2, 3, 4]), 'levels' => self::j($e['levels'] ?? []), 'cap' => (int) ($e['cap'] ?? 16), 'fee' => (int) ($e['fee'] ?? 0),
                'prize' => $e['prize'] ?? null, 'img' => $e['img'] ?? null, 'status' => $e['status'] ?? 'draft', 'note' => $e['note'] ?? '',
                'teams' => self::j($e['teams'] ?? []), 'groups' => self::j($e['groups'] ?? []), 'matches' => self::j($e['matches'] ?? []), 'setup' => self::j($e['setup'] ?? null),
                // مسابقه‌ی برگزارشده‌ی گذشته در نسخه‌ی قبل زمین‌ها را در تقویم نبسته بود؛ همان‌طور می‌ماند
                'extra' => self::j((object) (array_diff_key($e, array_flip($known)) + (($e['status'] ?? '') === 'done' && self::d($e['date']) < now()->format('Y-m-d') ? ['noBlock' => true] : []))), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $regs = [];
            foreach ($e['regs'] ?? [] as $r) {
                $regs[] = ['event_id' => $e['id'], 'rid' => $r['id'], 'by' => $this->id($r['by'] ?? null), 'name' => $r['name'], 'level' => $r['level'] ?? null, 'phone' => $r['phone'] ?? null,
                    'gender' => $r['gender'] ?? null, 'birth' => $r['birth'] ?? null, 'method' => $r['method'] ?? null, 'paid' => (int) ($r['paid'] ?? 0), 'source' => $r['source'] ?? null,
                    'sale' => $r['sale'] ?? null, 'pair' => $r['pair'] ?? null, 'payer' => $this->id($r['payer'] ?? null), 'waiting' => ! empty($r['waiting']), 'at' => self::t($r['at'] ?? null),
                    'created_at' => $now, 'updated_at' => $now];
            }
            self::chunks('event_registrations', $regs);
        }

        // ---------- حسابداری و پرسنل ----------
        foreach ($club['expenses'] ?? [] as $x) {
            DB::table('expenses')->insert(['id' => $x['id'], 'date' => self::d($x['date']), 'acc' => $x['acc'], 'amount' => (int) $x['amount'], 'title' => $x['title'] ?? '', 'vendor' => $x['vendor'] ?? '', 'pay' => $x['pay'] ?? 'bank', 'invoice' => $x['invoice'] ?? '', 'at' => self::t($x['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['journals'] ?? [] as $x) {
            DB::table('journals')->insert(['id' => $x['id'], 'date' => self::d($x['date']), 'title' => $x['title'], 'lines' => self::j($x['lines']), 'at' => self::t($x['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['payins'] ?? [] as $x) {
            DB::table('payins')->insert(['id' => $x['id'], 'date' => self::d($x['date']), 'amount' => (int) $x['amount'], 'method' => $x['method'], 'acc' => $x['acc'] ?? null, 'title' => $x['title'] ?? '', 'note' => $x['note'] ?? '', 'by' => $this->id($x['by'] ?? null), 'name' => $x['name'] ?? null, 'at' => self::t($x['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        $core = ['id', 'name', 'role', 'type', 'base', 'rate', 'children', 'start', 'contractEnd', 'status', 'coach', 'share'];
        foreach ($club['staff'] ?? [] as $s) {
            DB::table('staff')->insert(['id' => $s['id'], 'name' => $s['name'], 'role' => $s['role'], 'type' => $s['type'], 'base' => (int) ($s['base'] ?? 0), 'rate' => (int) ($s['rate'] ?? 0),
                'children' => (int) ($s['children'] ?? 0), 'start' => self::d($s['start'] ?? null), 'contract_end' => self::d($s['contractEnd'] ?? null), 'status' => $s['status'] ?? 'active',
                'coach' => $s['coach'] ?? null, 'share' => $s['share'] ?? null, 'shifts' => self::j($club['shifts'][$s['id']] ?? array_fill(0, 7, 'off')),
                'meta' => self::j(array_diff_key($s, array_flip($core))), 'created_at' => $now, 'updated_at' => $now]);
        }
        $att = [];
        foreach ($club['attendance'] ?? [] as $day => $list) {
            foreach ($list as $sid => $a) {
                if (isset($a['in'])) {
                    $att[] = ['date' => self::d($day), 'staff_id' => $sid, 'in' => $a['in'], 'out' => $a['out'] ?? null, 'created_at' => $now, 'updated_at' => $now];
                }
            }
        }
        self::chunks('attendance', $att);
        foreach ($club['leaves'] ?? [] as $l) {
            DB::table('leaves')->insert(['id' => $l['id'], 'staff' => $l['staff'], 'kind' => $l['kind'], 'from' => self::d($l['from']), 'to' => self::d($l['to']), 'days' => (int) $l['days'], 'status' => $l['status'], 'note' => $l['note'] ?? '', 'at' => self::t($l['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['advances'] ?? [] as $a) {
            DB::table('advances')->insert(['id' => $a['id'], 'staff' => $a['staff'], 'name' => $a['name'], 'date' => self::d($a['date']), 'amount' => (int) $a['amount'], 'pay' => $a['pay'], 'note' => $a['note'] ?? '', 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ($club['payrolls'] ?? [] as $p) {
            DB::table('payrolls')->insert(['id' => $p['id'], 'month' => $p['month'], 'label' => $p['label'], 'date' => self::d($p['date']), 'rows' => self::j($p['rows']), 'paid_at' => self::d($p['paidAt'] ?? null), 'ins_paid_at' => self::d($p['insPaidAt'] ?? null), 'at' => self::t($p['at'] ?? null), 'created_at' => $now, 'updated_at' => $now]);
        }

        // شمارنده‌ها از بزرگ‌ترین شماره‌ی واردشده جلوتر بروند
        $max = fn ($table, $prefix) => (int) DB::table($table)->where('id', 'like', $prefix.'%')->pluck('id')
            ->filter(fn ($x) => preg_match('/^'.preg_quote($prefix, '/').'\d+$/', $x))->map(fn ($x) => (int) substr($x, strlen($prefix)))->max();
        Ids::bump('Q', $max('shop_orders', 'Q-'));
        Ids::bump('K', $max('cafe_orders', 'K-'));
        Ids::bump('S', $max('sales', 'S-'));
        Ids::bump('R', $max('stock_receipts', 'R-'));
        Ids::bump('CR', $max('cafe_receipts', 'CR-'));
    }
}
