<?php

/**
 * تست فشار هم‌زمانی بخش‌ها: مربی، کافه، اعضا، آدینه، حسابداری (پروسس‌های واقعی هم‌زمان).
 * اجرا: powershell -File tests\Stress\run2.ps1
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\AdminActions;
use App\Actions\CoachActions;
use App\Actions\PlayerActions;
use App\Domain\Availability;
use App\Support\Fail;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$cmd = $argv[1] ?? '';
$mid = fn ($i) => 'mS2_'.$i;
$key = fn ($d) => $d->year.'-'.$d->month.'-'.$d->day;
$admin = fn () => new AdminActions(DB::table('admins')->first());
function out($x): void
{
    echo json_encode($x, JSON_UNESCAPED_UNICODE);
}
function slot(int $from, array $hours, array $courts = [1, 2, 3, 4]): array
{
    for ($d = $from; $d < $from + 150; $d++) {
        $ymd = now()->addDays($d)->format('Y-m-d');
        if (DB::table('events')->where('date', $ymd)->exists()) {
            continue;
        }
        foreach ($hours as $h) {
            foreach ($courts as $c) {
                if (Availability::isFree($ymd, $c, $h, 1) && ! DB::table('coach_requests')->where('date', $ymd)->where('status', 'pending')->exists()) {
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
        DB::table('members')->updateOrInsert(['id' => $mid($i)], ['name' => 'فشار '.$i, 'phone' => '0917'.str_pad((string) $i, 7, '0', STR_PAD_LEFT), 'level' => 'C', 'side' => 'both', 'gender' => 'f', 'birth' => 1370, 'source' => 'app', 'created_at' => now(), 'updated_at' => now()]);
        DB::transaction(function () use ($mid, $i) {
            $w = (int) DB::table('members')->where('id', $mid($i))->value('wallet');
            if ($w < 100000000) {
                App\Domain\Wallet::credit($mid($i), 100000000 - $w, 'adjust', 'stress2', '');
            }
        });
        DB::table('coaches')->updateOrInsert(['id' => 'kS'.$i], ['name' => 'مربی فشار '.$i, 'title' => '', 'level' => 'B', 'price' => 1000000, 'active' => true, 'login_on' => true, 'username' => 'ks'.$i, 'password' => 'x', 'cap_day' => 10, 'cap_week' => 50, 'packs' => '{}', 'prices' => '{}', 'record' => '[]', 'created_at' => now(), 'updated_at' => now()]);
    }
    out(['ok' => $n]);
    exit;
}

if ($cmd === 'prep') {
    $s = $argv[2];
    $n = (int) ($argv[3] ?? 30);
    $p = ['s' => $s];
    if (in_array($s, ['coachSlot', 'coachApprove'], true)) {
        DB::table('coach_requests')->where('status', 'pending')->update(['status' => 'rejected']);
        [$c, $d, $h] = slot(40, [7, 8, 23]);
        $p += ['court' => $c, 'date' => $key($d), 'ymd' => $d->format('Y-m-d'), 'start' => $h];
        if ($s === 'coachApprove') {
            DB::table('coach_requests')->insert(['id' => 'CRs2'.time(), 'coach' => 'kS1', 'date' => $d->format('Y-m-d'), 'court' => $c, 'start' => $h, 'dur' => 1, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
            $p['req'] = 'CRs2'.time();
        }
    } elseif ($s === 'cafeShared') {
        DB::table('cafe_ingredients')->where('id', 'beans')->update(['stock' => 180]);
        DB::table('cafe_ingredients')->where('id', 'milk')->update(['stock' => 100000]);
        DB::table('cafe_ingredients')->where('id', 'cup')->update(['stock' => 100000]);
        DB::table('cafe_items')->whereIn('id', ['espresso', 'cappuccino', 'latte'])->update(['active' => true]);
        $p['before'] = DB::table('cafe_orders')->max('at');
        $p['t0'] = now()->format('Y-m-d H:i:s');
        $p['beans0'] = 180.0;
    } elseif ($s === 'signup') {
        $phone = '0916'.str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
        DB::table('members')->where('phone', $phone)->delete();
        $p += ['phone' => $phone, 'ticket' => Crypt::encryptString(json_encode(['phone' => $phone, 'exp' => time() + 1800]))];
    } elseif ($s === 'deskMember') {
        $phone = '0915'.str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
        $p['phone'] = $phone;
    } elseif ($s === 'username') {
        DB::table('members')->where('username', 'like', 'race%')->update(['username' => null]);
        $p['user'] = 'race'.random_int(1000, 9999);
    } elseif ($s === 'friday') {
        $id = 'evS2'.time();
        DB::table('events')->insert(['id' => $id, 'kind' => 'friday', 'title' => 'آدینه‌ی فشار', 'format' => 'groups', 'gender' => 'all', 'date' => now()->addDays(100)->format('Y-m-d'),
            'start' => 9, 'dur' => 3, 'courts' => '[]', 'levels' => '["C"]', 'cap' => 7, 'fee' => 300000, 'status' => 'open', 'teams' => '[]', 'groups' => '[]', 'matches' => '[]', 'created_at' => now(), 'updated_at' => now()]);
        $p += ['id' => $id, 'cap' => 7];
    } elseif ($s === 'unreg') {
        $id = 'evS2u'.time();
        DB::table('events')->insert(['id' => $id, 'kind' => 'friday', 'title' => 'آدینه‌ی حذف', 'format' => 'groups', 'gender' => 'all', 'date' => now()->addDays(101)->format('Y-m-d'),
            'start' => 9, 'dur' => 3, 'courts' => '[]', 'levels' => '[]', 'cap' => 12, 'fee' => 200000, 'status' => 'open', 'teams' => '[]', 'groups' => '[]', 'matches' => '[]', 'created_at' => now(), 'updated_at' => now()]);
        $rids = [];
        for ($i = 1; $i <= 10; $i++) {
            PlayerActions::forMember($mid($i))->registerEvent(['id' => $id, 'method' => 'wallet', 'partner' => ['solo' => true]]);
            $rids[$i] = DB::table('event_registrations')->where('event_id', $id)->where('by', $mid($i))->value('rid');
        }
        $p += ['id' => $id, 'rids' => $rids, 'cap' => 12];
    } elseif ($s === 'books') {
        $p['before'] = [
            'expenses' => DB::table('expenses')->count(), 'payins' => DB::table('payins')->count(), 'journals' => DB::table('journals')->count(), 'orders' => DB::table('shop_orders')->count(),
        ];
        $v = DB::table('product_variants')->join('products', 'products.id', '=', 'product_variants.product_id')->select('product_variants.*')->first();
        DB::table('product_variants')->where('id', $v->id)->update(['stock' => 1000]);
        $p += ['pid' => $v->product_id, 'sku' => $v->sku];
    }
    out($p);
    exit;
}

if ($cmd === 'work') {
    [$s, $i, $t] = [$argv[2], (int) $argv[3], (float) $argv[4]];
    $p = json_decode(base64_decode($argv[5]), true);
    while (microtime(true) < $t) {
        usleep(300);
    }
    try {
        $r = match ($s) {
            // نیمی مربی درخواست می‌دهند، نیمی بازیکن همان ساعت را رزرو می‌کنند
            'coachSlot' => $i % 2
                ? (new CoachActions(DB::table('coaches')->where('id', 'kS'.$i)->first()))->coachReq(['date' => $p['date'], 'court' => $p['court'], 'start' => $p['start'], 'dur' => 1])
                : PlayerActions::forMember($mid($i))->book(['type' => 'private', 'court' => $p['court'], 'date' => $p['date'], 'start' => $p['start'], 'dur' => 1, 'players' => [], 'method' => 'wallet']),
            'coachApprove' => $i === 1
                ? $admin()->adminCoachReq($p['req'], true)
                : PlayerActions::forMember($mid($i))->book(['type' => 'private', 'court' => $p['court'], 'date' => $p['date'], 'start' => $p['start'], 'dur' => 1, 'players' => [], 'method' => 'wallet']),
            'cafeShared' => match ($i % 6) {
                0 => $admin()->adminCafeReceive(['date' => now()->year.'-'.now()->month.'-'.now()->day, 'supplier' => 'رست فشار', 'invoice' => 'S'.$i, 'pay' => 'bank', 'items' => [['ing' => 'beans', 'qty' => 36, 'cost' => 2700]]]),
                1 => $admin()->adminCafeAdjust('beans', -18, 'ضایعات فشار'),
                2 => $admin()->adminCafePos([['iid' => 'cappuccino', 'qty' => 1], ['iid' => 'espresso', 'qty' => 1]], 'cash', null, null, true),
                default => PlayerActions::forMember($mid($i))->cafeCheckout(['lines' => [['iid' => ['espresso', 'latte', 'cappuccino'][$i % 3], 'qty' => 1 + $i % 2]], 'method' => 'wallet']),
            },
            'signup' => (function () use ($p) {
                $res = app(App\Http\Controllers\AuthController::class)->register(Illuminate\Http\Request::create('/api/auth/register', 'POST', ['ticket' => $p['ticket'], 'name' => 'هم‌زمان', 'level' => 'C', 'side' => 'both', 'gender' => 'm', 'birth' => 1370]));

                return isset($res['token']) ? ['ok' => true] : $res;
            })(),
            'deskMember' => $admin()->adminMember(['name' => 'پذیرش هم‌زمان', 'phone' => $p['phone'], 'level' => 'C']),
            'username' => PlayerActions::forMember($mid($i))->setLogin(['user' => $p['user'], 'pass' => 'secret12']),
            // زنجیره‌ی یارها: i با i+1؛ بعضی تکی
            'friday' => PlayerActions::forMember($mid($i))->registerEvent(['id' => $p['id'], 'method' => 'wallet', 'partner' => $i % 5 === 0 ? ['solo' => true] : ['id' => $mid($i + 1)]]),
            'unreg' => $i <= 10
                ? $admin()->adminEventUnreg($p['id'], $p['rids'][$i])
                : PlayerActions::forMember($mid($i))->registerEvent(['id' => $p['id'], 'method' => 'wallet', 'partner' => ['solo' => true]]),
            'books' => match ($i % 4) {
                0 => $admin()->adminExpense(['date' => now()->year.'-'.now()->month.'-'.now()->day, 'acc' => '8109', 'amount' => 100000 + $i, 'title' => 'فشار', 'vendor' => 'v', 'pay' => 'cash']),
                1 => $admin()->adminPayin(['amount' => 50000 + $i, 'method' => 'cash', 'acc' => '6201', 'title' => 'فشار']),
                2 => $admin()->adminJournal(['date' => now()->year.'-'.now()->month.'-'.now()->day, 'title' => 'فشار '.$i, 'lines' => [['acc' => '1101', 'dr' => 1000 + $i, 'cr' => 0], ['acc' => '5101', 'dr' => 0, 'cr' => 1000 + $i]]]),
                3 => $admin()->adminPos([['pid' => $p['pid'], 'sku' => $p['sku'], 'qty' => 1]], 'card', 'walkin'),
            },
        };
        echo 'OK';
    } catch (Fail $f) {
        echo 'FAIL:'.$f->err;
    } catch (Throwable $e) {
        echo 'ERR:'.get_class($e).':'.substr($e->getMessage(), 0, 200);
    }
    exit;
}

if ($cmd === 'check') {
    $s = $argv[2];
    $n = (int) $argv[3];
    $p = json_decode(base64_decode($argv[4]), true);
    $r = [];
    $r['overlaps'] = (int) DB::selectOne("SELECT COUNT(*) n FROM bookings a JOIN bookings b ON a.court = b.court AND a.date = b.date AND a.id < b.id AND a.status = 'ok' AND b.status = 'ok'
        AND a.start < b.start + b.dur AND b.start < a.start + a.dur WHERE a.date >= CURDATE() AND a.id NOT LIKE 'b2%'")->n;
    $bad = 0;
    foreach (DB::table('members')->get(['id', 'wallet']) as $m) {
        $rows = DB::table('wallet_transactions')->where('member_id', $m->id);
        if ((clone $rows)->exists() && (int) (clone $rows)->sum('amount') !== (int) $m->wallet) {
            $bad++;
        }
    }
    $r['walletMismatch'] = $bad;
    $r['negative'] = DB::table('members')->where('wallet', '<', 0)->count() + DB::table('cafe_ingredients')->where('stock', '<', 0)->count() + DB::table('product_variants')->where('stock', '<', 0)->count();
    $ok = true;
    if (in_array($s, ['coachSlot', 'coachApprove'], true)) {
        $bk = DB::table('bookings')->where('date', $p['ymd'])->where('court', $p['court'])->where('start', $p['start'])->where('status', 'ok')->count();
        $req = DB::table('coach_requests')->where('date', $p['ymd'])->where('court', $p['court'])->where('start', $p['start'])->whereIn('status', ['pending', 'ok'])->count();
        $r += ['bookings' => $bk, 'liveReqs' => $req];
        if ($s === 'coachSlot') {
            // درخواست منتظر مربی فقط جلوی مربی‌های دیگر را می‌گیرد (مثل اپ قبلی)؛ اگر بازیکن زودتر رزرو کرد، تأیید مدیر باید رد شود
            $pend = DB::table('coach_requests')->where('date', $p['ymd'])->where('court', $p['court'])->where('start', $p['start'])->where('status', 'pending')->first();
            $approve = null;
            if ($pend && $bk) {
                try {
                    $admin()->adminCoachReq($pend->id, true);
                    $approve = 'approved';
                } catch (Fail $f) {
                    $approve = $f->err;
                }
            }
            $r['approveAfter'] = $approve;
            $ok = $bk <= 1 && $req <= 1 && ($bk + $req) >= 1 && (! ($pend && $bk) || $approve === 'busy');
        } else {
            // یا مدیر زودتر تأیید کرد (رزرو = بلوک مربی) یا بازیکن زودتر رزرو کرد و تأیید رد شد (درخواست منتظر می‌ماند)
            $st = DB::table('coach_requests')->where('id', $p['req'])->value('status');
            $blocks = DB::table('bookings')->where('block', $p['req'])->where('status', 'ok')->count();
            $r += ['reqStatus' => $st, 'coachBlocks' => $blocks];
            $ok = $bk === 1 && (($st === 'ok' && $blocks === 1) || ($st === 'pending' && $blocks === 0));
        }
    } elseif ($s === 'cafeShared') {
        $beans = (float) DB::table('cafe_ingredients')->where('id', 'beans')->value('stock');
        $used = 0.0;
        foreach (DB::table('cafe_orders')->where('at', '>', $p['before'] ?? '2000-01-01')->get() as $o) {
            foreach (json_decode($o->use, true) as [$code, $q]) {
                if ($code === DB::table('cafe_ingredients')->where('id', 'beans')->value('code')) {
                    $used += $q;
                }
            }
        }
        $recv = 36.0 * DB::table('cafe_receipts')->where('supplier', 'رست فشار')->where('created_at', '>=', $p['t0'])->count();
        $adj = -18.0 * DB::table('cafe_moves')->where('note', 'ضایعات فشار')->where('created_at', '>=', $p['t0'])->count();
        $expect = $p['beans0'] + $recv + $adj - $used;
        $r += ['beans' => $beans, 'used' => $used, 'received' => $recv, 'adjusted' => $adj, 'expected' => round($expect, 3)];
        $ok = abs($beans - $expect) < 0.01 && $beans >= 0;
    } elseif ($s === 'signup') {
        $r['membersWithPhone'] = DB::table('members')->where('phone', $p['phone'])->count();
        $ok = $r['membersWithPhone'] === 1;
    } elseif ($s === 'deskMember') {
        $r['membersWithPhone'] = DB::table('members')->where('phone', $p['phone'])->count();
        $ok = $r['membersWithPhone'] === 1;
    } elseif ($s === 'username') {
        $r['owners'] = DB::table('members')->where('username', $p['user'])->count();
        $ok = $r['owners'] === 1;
    } elseif (in_array($s, ['friday', 'unreg'], true)) {
        $regs = DB::table('event_registrations')->where('event_id', $p['id'])->get();
        $dup = $regs->whereNotNull('by')->groupBy('by')->filter(fn ($g) => $g->count() > 1)->count();
        $brokenPairs = $regs->whereNotNull('pair')->groupBy('pair')->filter(fn ($g) => $g->count() !== 2)->count();
        $sales = (int) DB::table('sales')->where('item', $p['id'])->whereNull('refunded_at')->sum('price');
        $paid = (int) $regs->sum('paid');
        $r += ['regs' => $regs->count(), 'cap' => $p['cap'], 'dupMembers' => $dup, 'brokenPairs' => $brokenPairs, 'salesSum' => $sales, 'paidSum' => $paid];
        $ok = $regs->count() <= $p['cap'] && ! $dup && ! $brokenPairs && $sales === $paid;
    } elseif ($s === 'books') {
        $b = $p['before'];
        $per = intdiv($n, 4) + 0;
        $r['added'] = ['expenses' => DB::table('expenses')->count() - $b['expenses'], 'payins' => DB::table('payins')->count() - $b['payins'], 'journals' => DB::table('journals')->count() - $b['journals'], 'orders' => DB::table('shop_orders')->count() - $b['orders']];
        $r['dupOrderIds'] = (int) DB::selectOne('SELECT COUNT(*) - COUNT(DISTINCT id) n FROM shop_orders')->n;
        $unbal = 0;
        foreach (DB::table('journals')->get() as $j) {
            $l = json_decode($j->lines, true);
            $unbal += array_sum(array_column($l, 'dr')) !== array_sum(array_column($l, 'cr')) ? 1 : 0;
        }
        $r['unbalanced'] = $unbal;
        $ok = ! $unbal && array_sum($r['added']) === $n;
    }
    $r['PASS'] = $ok && ! $r['overlaps'] && ! $r['walletMismatch'] && ! $r['negative'];
    out($r);
    exit;
}
