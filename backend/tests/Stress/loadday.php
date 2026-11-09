<?php

/**
 * «روز شلوغ»: چند پروسس هم‌زمان، هر کدام صدها کار تصادفی واقعی از مسیر خود برنامه.
 *   php tests/Stress/loadday.php work <i> <ops> <t>
 *   php tests/Stress/loadday.php check
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\AdminActions;
use App\Actions\CoachActions;
use App\Actions\PlayerActions;
use App\Support\Fail;
use Illuminate\Support\Facades\DB;

$cmd = $argv[1] ?? '';

if ($cmd === 'work') {
    [$i, $ops, $t] = [(int) $argv[2], (int) $argv[3], (float) $argv[4]];
    mt_srand($i * 7919);
    while (microtime(true) < $t) {
        usleep(300);
    }
    $admin = new AdminActions(DB::table('admins')->first());
    $stat = [];
    $lat = [];
    $items = ['espresso', 'americano', 'cappuccino', 'latte', 'water', 'cola', 'tea', 'iceamericano', 'lemonade'];
    for ($k = 0; $k < $ops; $k++) {
        $m = 'mS2_'.mt_rand(1, 40);
        $a = PlayerActions::forMember($m);
        $d = now()->addDays(mt_rand(1, 20));
        $date = $d->year.'-'.$d->month.'-'.$d->day;
        $op = ['book', 'book', 'open', 'join', 'cancel', 'cafe', 'cafe', 'shop', 'event', 'coach', 'settle', 'acancel', 'cafeStatus', 'quest'][mt_rand(0, 13)];
        $t0 = microtime(true);
        try {
            match ($op) {
                'book' => $a->book(['type' => 'private', 'court' => mt_rand(1, 4), 'date' => $date, 'start' => mt_rand(7, 22), 'dur' => mt_rand(1, 2), 'players' => [], 'method' => 'wallet']),
                'open' => $a->book(['type' => 'open', 'court' => mt_rand(1, 4), 'date' => $date, 'start' => mt_rand(7, 22), 'dur' => 1, 'players' => [], 'levels' => ['C', 'C+'], 'method' => 'wallet']),
                'join' => ($g = DB::table('bookings')->where('type', 'open')->where('status', 'ok')->where('date', '>', now()->format('Y-m-d'))->where(fn ($q) => $q->whereNull('visibility')->orWhere('visibility', 'public'))->inRandomOrder()->value('id'))
                    ? $a->joinGame(['id' => $g, 'method' => 'wallet']) : Fail::with('none'),
                'cancel' => ($b = DB::table('bookings')->where('by', $m)->where('status', 'ok')->where('date', '>', now()->addDay()->format('Y-m-d'))->whereNull('block')->inRandomOrder()->value('id'))
                    ? $a->cancelMine(['id' => $b]) : Fail::with('none'),
                'cafe' => $a->cafeCheckout(['lines' => [['iid' => $items[mt_rand(0, 8)], 'qty' => mt_rand(1, 3), 'big' => (bool) mt_rand(0, 1)]], 'method' => 'wallet']),
                'shop' => ($v = DB::table('product_variants')->join('products', 'products.id', '=', 'product_variants.product_id')->where('products.active', true)->where('stock', '>', 0)->inRandomOrder()->select('product_variants.*')->first())
                    ? $a->checkout(['items' => [['pid' => $v->product_id, 'size' => $v->size, 'color' => $v->color, 'qty' => 1]], 'method' => 'wallet']) : Fail::with('none'),
                'event' => ($e = DB::table('events')->where('status', 'open')->where('date', '>=', now()->format('Y-m-d'))->inRandomOrder()->value('id'))
                    ? $a->registerEvent(['id' => $e, 'method' => 'wallet', 'partner' => mt_rand(0, 1) ? ['solo' => true] : ['id' => 'mS2_'.mt_rand(1, 40)]]) : Fail::with('none'),
                'coach' => (new CoachActions(DB::table('coaches')->where('id', 'kS'.mt_rand(1, 40))->first()))->coachReq(['date' => $date, 'court' => mt_rand(1, 4), 'start' => mt_rand(7, 22), 'dur' => 1]),
                'settle' => ($b = DB::table('bookings')->where('status', 'ok')->whereColumn('paid', '<', 'price')->where('type', '!=', 'block')->inRandomOrder()->value('id'))
                    ? $admin->adminSettle($b, ['cash', 'card'][mt_rand(0, 1)]) : Fail::with('none'),
                'acancel' => ($b = DB::table('bookings')->where('status', 'ok')->where('source', 'app')->where('by', 'like', 'mS2_%')->inRandomOrder()->value('id'))
                    ? $admin->adminCancel($b, (bool) mt_rand(0, 1)) : Fail::with('none'),
                'cafeStatus' => ($o = DB::table('cafe_orders')->where('status', '!=', 'delivered')->inRandomOrder()->first())
                    ? $admin->adminCafeOrder($o->id, ['new' => 'prep', 'prep' => 'ready', 'ready' => 'delivered'][$o->status]) : Fail::with('none'),
                'quest' => $a->claimQuest(['id' => ['play2', 'social', 'coach'][mt_rand(0, 2)]]),
            };
            $stat[$op.':OK'] = ($stat[$op.':OK'] ?? 0) + 1;
        } catch (Fail $f) {
            $stat[$op.':'.$f->err] = ($stat[$op.':'.$f->err] ?? 0) + 1;
        } catch (Throwable $e) {
            $stat['ERR:'.get_class($e).':'.substr($e->getMessage(), 0, 120)] = ($stat['ERR:'.get_class($e).':'.substr($e->getMessage(), 0, 120)] ?? 0) + 1;
        }
        $lat[] = microtime(true) - $t0;
    }
    sort($lat);
    echo json_encode(['stat' => $stat, 'p50' => round($lat[intdiv(count($lat), 2)] * 1000), 'p95' => round($lat[(int) (count($lat) * 0.95)] * 1000), 'max' => round(end($lat) * 1000)]);
    exit;
}

if ($cmd === 'check') {
    $q = fn ($sql) => (int) DB::selectOne($sql)->n;
    $r = [
        'overlaps' => $q("SELECT COUNT(*) n FROM bookings a JOIN bookings b ON a.court = b.court AND a.date = b.date AND a.id < b.id AND a.status = 'ok' AND b.status = 'ok'
            AND a.start < b.start + b.dur AND b.start < a.start + a.dur WHERE a.date >= CURDATE() AND a.id NOT LIKE 'b2%'"),
        'coachDouble' => $q("SELECT COUNT(*) n FROM bookings a JOIN bookings b ON a.coach = b.coach AND a.date = b.date AND a.id < b.id AND a.status = 'ok' AND b.status = 'ok'
            AND a.start < b.start + b.dur AND b.start < a.start + a.dur WHERE a.coach IS NOT NULL AND a.date >= CURDATE() AND a.id NOT LIKE 'b2%'"),
        'over4Players' => $q('SELECT COUNT(*) n FROM (SELECT booking_id FROM booking_players GROUP BY booking_id HAVING COUNT(*) > 4) x'),
        'eventOverCap' => $q('SELECT COUNT(*) n FROM events e WHERE (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) > e.cap'),
        'dupEventMember' => $q('SELECT COUNT(*) n FROM (SELECT event_id, `by` FROM event_registrations WHERE `by` IS NOT NULL GROUP BY event_id, `by` HAVING COUNT(*) > 1) x'),
        'brokenPairs' => $q('SELECT COUNT(*) n FROM (SELECT pair FROM event_registrations WHERE pair IS NOT NULL GROUP BY event_id, pair HAVING COUNT(*) <> 2) x'),
        'openPaidMismatch' => $q("SELECT COUNT(*) n FROM bookings b WHERE b.type = 'open' AND b.status = 'ok' AND b.source = 'app' AND b.id LIKE 'b%' AND b.id NOT LIKE 'b2%'
            AND b.paid <> (SELECT COALESCE(SUM(share),0) FROM booking_players p WHERE p.booking_id = b.id) AND NOT EXISTS (SELECT 1 FROM booking_payments x WHERE x.booking_id = b.id)"),
        'negative' => $q('SELECT (SELECT COUNT(*) FROM members WHERE wallet < 0) + (SELECT COUNT(*) FROM product_variants WHERE stock < 0) + (SELECT COUNT(*) FROM cafe_ingredients WHERE stock < 0) n'),
        'walletVsLedger' => $q('SELECT COUNT(*) n FROM members m WHERE EXISTS (SELECT 1 FROM wallet_transactions w WHERE w.member_id = m.id)
            AND m.wallet <> (SELECT SUM(amount) FROM wallet_transactions w WHERE w.member_id = m.id)'),
        'xpVsLedger' => $q("SELECT COUNT(*) n FROM members m WHERE m.id LIKE 'mS2_%' AND m.xp <> (SELECT COALESCE(SUM(amount),0) FROM xp_events x WHERE x.member_id = m.id)"),
        'questTwice' => $q('SELECT COUNT(*) n FROM (SELECT member_id, week, quest FROM quest_claims GROUP BY member_id, week, quest HAVING COUNT(*) > 1) x'),
        'dupOrderIds' => $q('SELECT (SELECT COUNT(*) - COUNT(DISTINCT id) FROM shop_orders) + (SELECT COUNT(*) - COUNT(DISTINCT id) FROM cafe_orders) n'),
        'salesVsRegs' => $q("SELECT COUNT(*) n FROM events e WHERE e.id LIKE 'ev%' AND (SELECT COALESCE(SUM(price),0) FROM sales s WHERE s.item = e.id AND s.kind = 'event' AND s.refunded_at IS NULL)
            <> (SELECT COALESCE(SUM(paid),0) FROM event_registrations r WHERE r.event_id = e.id AND r.source = 'app')
            + (SELECT COALESCE(SUM(paid),0) FROM event_registrations r WHERE r.event_id = e.id AND r.source = 'desk' AND r.method <> 'free') AND e.created_at > NOW() - INTERVAL 1 DAY"),
    ];
    $r['PASS'] = array_sum($r) === 0;
    $state = (new App\State\StateBuilder('admin', DB::table('admins')->first()))->club();
    file_put_contents(storage_path('app/admin-state.json'), json_encode(['club' => $state], JSON_UNESCAPED_UNICODE));
    $r['counts'] = ['bookings' => DB::table('bookings')->count(), 'cafeOrders' => DB::table('cafe_orders')->count(), 'shopOrders' => DB::table('shop_orders')->count(), 'regs' => DB::table('event_registrations')->count(), 'walletTx' => DB::table('wallet_transactions')->count()];
    echo json_encode($r, JSON_UNESCAPED_UNICODE);
    exit;
}
