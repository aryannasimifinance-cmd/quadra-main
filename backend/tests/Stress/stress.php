<?php

/**
 * تست فشار هم‌زمانی با پروسس‌های واقعی (روی دیتابیس .env؛ داده‌ی نمایشی لازم است).
 *   php tests/Stress/stress.php setup <n>                 ساخت n عضو تست با کیف پول پر
 *   php tests/Stress/stress.php prep <scenario>           آماده‌سازی سناریو → JSON
 *   php tests/Stress/stress.php work <scenario> <i> <t> <json>   اجرای یک کارگر در لحظه‌ی t
 *   php tests/Stress/stress.php check <scenario> <json>   بررسی نتیجه
 * اجرای کامل: tests/Stress/run.ps1
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\PlayerActions;
use App\Domain\Availability;
use App\Support\Fail;
use Illuminate\Support\Facades\DB;

$cmd = $argv[1] ?? '';
$mid = fn ($i) => 'mStress'.$i;
$key = fn (Carbon\Carbon $d) => $d->year.'-'.$d->month.'-'.$d->day;

function out($x): void
{
    echo json_encode($x, JSON_UNESCAPED_UNICODE);
}

function freeSlot(int $from, array $hours): array
{
    for ($d = $from; $d < $from + 120; $d++) {
        $ymd = now()->addDays($d)->format('Y-m-d');
        foreach ($hours as $h) {
            foreach ([1, 2, 3, 4] as $c) {
                if (Availability::isFree($ymd, $c, $h, 1)) {
                    return [$c, now()->addDays($d), $h];
                }
            }
        }
    }
    throw new RuntimeException('no slot');
}

if ($cmd === 'setup') {
    $n = (int) $argv[2];
    for ($i = 1; $i <= $n; $i++) {
        DB::table('members')->updateOrInsert(['id' => $mid($i)], ['name' => 'استرس '.$i, 'phone' => '0919'.str_pad((string) $i, 7, '0', STR_PAD_LEFT), 'level' => 'C', 'side' => 'both', 'gender' => 'f', 'birth' => 1370, 'source' => 'app', 'created_at' => now(), 'updated_at' => now()]);
        DB::transaction(function () use ($mid, $i) {
            $w = (int) DB::table('members')->where('id', $mid($i))->value('wallet');
            if ($w < 100000000) {
                App\Domain\Wallet::credit($mid($i), 100000000 - $w, 'adjust', 'stress', 'تست فشار');
            }
        });
    }
    out(['ok' => $n]);
    exit;
}

if ($cmd === 'prep') {
    $s = $argv[2];
    $p = [];
    if ($s === 'slot') {
        [$c, $d, $h] = freeSlot(70, [23, 7]);
        $p = ['court' => $c, 'date' => $key($d), 'start' => $h];
    } elseif ($s === 'stock') {
        $v = DB::table('product_variants')->join('products', 'products.id', '=', 'product_variants.product_id')->where('products.active', true)->where('products.price', '<', 3000000)->select('product_variants.*')->first();
        DB::table('product_variants')->where('id', $v->id)->update(['stock' => 3]);
        $p = ['pid' => $v->product_id, 'size' => $v->size, 'color' => $v->color, 'sku' => $v->sku, 'expect' => 3];
    } elseif ($s === 'cafe') {
        // آب معدنی: ۱ عدد برای هر سفارش؛ موجودی ۵
        DB::table('cafe_ingredients')->where('id', 'water')->update(['stock' => 5]);
        DB::table('cafe_items')->where('id', 'water')->update(['active' => true]);
        $p = ['expect' => 5];
    } elseif ($s === 'event') {
        $id = 'evStress'.time();
        DB::table('events')->insert(['id' => $id, 'kind' => 'friday', 'title' => 'مسابقه‌ی استرس', 'format' => 'groups', 'gender' => 'all', 'date' => now()->addDays(80)->format('Y-m-d'),
            'start' => 9, 'dur' => 3, 'courts' => '[]', 'levels' => '[]', 'cap' => 4, 'fee' => 100000, 'status' => 'open', 'teams' => '[]', 'groups' => '[]', 'matches' => '[]', 'created_at' => now(), 'updated_at' => now()]);
        $p = ['id' => $id, 'expect' => 4];
    } elseif ($s === 'join') {
        [$c, $d, $h] = freeSlot(75, [23, 22, 7]);
        $r = PlayerActions::forMember($mid(1))->book(['type' => 'open', 'court' => $c, 'date' => $key($d), 'start' => $h, 'dur' => 1, 'players' => [], 'levels' => ['C'], 'visibility' => 'public', 'method' => 'wallet']);
        $p = ['id' => $r['id'], 'expect' => 3];
    } elseif ($s === 'wallet') {
        // یک عضو با موجودی دقیقاً یک زمین؛ کارگرها هم‌زمان رزروهای مختلف و خرید می‌زنند
        DB::transaction(function () use ($mid) {
            $w = (int) DB::table('members')->where('id', $mid(99))->value('wallet');
            DB::table('members')->updateOrInsert(['id' => $mid(99)], ['name' => 'کیف‌پول', 'phone' => '09199999999', 'level' => 'C', 'side' => 'both', 'source' => 'app', 'created_at' => now(), 'updated_at' => now()]);
            if ($w > 0) {
                App\Domain\Wallet::debit($mid(99), $w, 'stress', 'صفر');
            }
            App\Domain\Wallet::credit($mid(99), 1200000, 'adjust', 'stress', 'یک زمین');
        });
        $slots = [];
        for ($i = 0; $i < 12; $i++) {
            [$c, $d, $h] = freeSlot(85 + $i, [10, 11, 12, 13, 14]);
            $slots[] = ['court' => $c, 'date' => $key($d), 'start' => $h];
        }
        $p = ['slots' => $slots];
    }
    out($p);
    exit;
}

if ($cmd === 'work') {
    [$s, $i, $t] = [$argv[2], (int) $argv[3], (float) $argv[4]];
    $p = json_decode(base64_decode($argv[5]), true);
    while (microtime(true) < $t) {
        usleep(500);
    }
    try {
        $m = $s === 'wallet' ? $mid(99) : $mid($i);
        $a = PlayerActions::forMember($m);
        $r = match ($s) {
            'slot' => $a->book(['type' => 'private', 'court' => $p['court'], 'date' => $p['date'], 'start' => $p['start'], 'dur' => 1, 'players' => [], 'method' => 'wallet']),
            'stock' => $a->checkout(['items' => [['pid' => $p['pid'], 'size' => $p['size'], 'color' => $p['color'], 'qty' => 1]], 'method' => 'wallet']),
            'cafe' => $a->cafeCheckout(['lines' => [['iid' => 'water', 'qty' => 1]], 'method' => 'wallet']),
            'event' => $a->registerEvent(['id' => $p['id'], 'method' => 'wallet', 'partner' => ['solo' => true]]),
            'join' => $a->joinGame(['id' => $p['id'], 'method' => 'wallet']),
            'wallet' => $a->book(['type' => 'private', 'court' => $p['slots'][$i % 12]['court'], 'date' => $p['slots'][$i % 12]['date'], 'start' => $p['slots'][$i % 12]['start'], 'dur' => 1, 'players' => [], 'method' => 'wallet']),
            'mixed' => (function () use ($a, $i, $p) {
                $k = $i % 4;
                $slot = $p['slots'][$i % count($p['slots'])];

                return match ($k) {
                    0 => $a->book(['type' => 'private', 'court' => $slot['court'], 'date' => $slot['date'], 'start' => $slot['start'], 'dur' => 1, 'players' => [], 'method' => 'wallet']),
                    1 => $a->cafeCheckout(['lines' => [['iid' => 'water', 'qty' => 1]], 'method' => 'wallet']),
                    2 => $a->checkout(['items' => [['pid' => $p['pid'], 'size' => $p['size'], 'color' => $p['color'], 'qty' => 1]], 'method' => 'wallet']),
                    3 => $a->book(['type' => 'open', 'court' => $slot['court'], 'date' => $slot['date'], 'start' => $slot['start'], 'dur' => 1, 'players' => [], 'levels' => ['C'], 'method' => 'wallet']),
                };
            })(),
        };
        echo 'OK';
    } catch (Fail $f) {
        echo 'FAIL:'.$f->err;
    } catch (Throwable $e) {
        echo 'ERR:'.get_class($e).':'.substr($e->getMessage(), 0, 160);
    }
    exit;
}

if ($cmd === 'check') {
    $s = $argv[2];
    $p = json_decode(base64_decode($argv[3]), true);
    $res = [];
    // ثابت‌های کل سیستم: هیچ دو رزرو فعالی روی یک زمین هم‌پوشانی ندارند
    $overlap = DB::select("SELECT COUNT(*) n FROM bookings a JOIN bookings b ON a.court = b.court AND a.date = b.date AND a.id < b.id
        AND a.status = 'ok' AND b.status = 'ok' AND a.start < b.start + b.dur AND b.start < a.start + a.dur WHERE a.date >= ?", [now()->format('Y-m-d')])[0]->n;
    $res['overlaps'] = (int) $overlap;
    $bad = 0;
    foreach (DB::table('members')->where('id', 'like', 'mStress%')->get() as $m) {
        $sum = (int) DB::table('wallet_transactions')->where('member_id', $m->id)->sum('amount');
        if ($sum !== (int) $m->wallet || $m->wallet < 0) {
            $bad++;
        }
    }
    $res['walletMismatch'] = $bad;
    $res['negStock'] = DB::table('product_variants')->where('stock', '<', 0)->count() + DB::table('cafe_ingredients')->where('stock', '<', 0)->count();
    if ($s === 'stock') {
        $res['stockLeft'] = (int) DB::table('product_variants')->where('sku', $p['sku'])->value('stock');
    } elseif ($s === 'cafe') {
        $res['waterLeft'] = (float) DB::table('cafe_ingredients')->where('id', 'water')->value('stock');
    } elseif ($s === 'event') {
        $res['regs'] = DB::table('event_registrations')->where('event_id', $p['id'])->count();
    } elseif ($s === 'join') {
        $res['players'] = DB::table('booking_players')->where('booking_id', $p['id'])->count();
        $b = DB::table('bookings')->where('id', $p['id'])->first();
        $res['paidMatchesShares'] = (int) $b->paid === (int) DB::table('booking_players')->where('booking_id', $p['id'])->sum('share');
    } elseif ($s === 'wallet') {
        $res['wallet'] = (int) DB::table('members')->where('id', 'mStress99')->value('wallet');
        $res['booked'] = DB::table('bookings')->where('by', 'mStress99')->where('status', 'ok')->count();
    }
    out($res);
    exit;
}

echo "usage: setup|prep|work|check\n";
