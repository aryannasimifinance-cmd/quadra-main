<?php

/**
 * تست حجم: یک سال داده با ۲۰۰۰ عضو، بعد اندازه‌گیری سرعت و حجم داده‌ی هر نقش.
 *   php tests/Stress/volume.php fill     (روی دیتابیس .env — داده‌ی فعلی می‌ماند و اضافه می‌شود)
 *   php tests/Stress/volume.php measure
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\State\StateBuilder;
use Illuminate\Support\Facades\DB;

$cmd = $argv[1] ?? 'measure';
mt_srand(42);

if ($cmd === 'fill') {
    $t = microtime(true);
    $members = [];
    for ($i = 1; $i <= 2000; $i++) {
        $members[] = ['id' => 'mVol'.$i, 'name' => 'عضو حجمی '.$i, 'phone' => '0918'.str_pad((string) $i, 7, '0', STR_PAD_LEFT), 'level' => array_rand(App\Domain\Catalog::LEVELS),
            'side' => 'both', 'xp' => mt_rand(0, 3000), 'source' => 'app', 'created_at' => now()->subDays(mt_rand(1, 400)), 'updated_at' => now()];
    }
    foreach (array_chunk($members, 500) as $c) {
        DB::table('members')->insertOrIgnore($c);
    }
    $bk = [];
    $pl = [];
    $n = 0;
    for ($d = -365; $d <= 30; $d++) {
        $date = now()->addDays($d)->format('Y-m-d');
        foreach ([1, 2, 3, 4] as $c) {
            for ($h = 7; $h < 23; $h += mt_rand(1, 2)) {
                if (mt_rand(0, 100) > 70) {
                    continue;
                }
                $id = 'bVol'.(++$n);
                $type = ['private', 'private', 'open', 'coach'][mt_rand(0, 3)];
                $by = 'mVol'.mt_rand(1, 2000);
                $bk[] = ['id' => $id, 'court' => $c, 'date' => $date, 'start' => $h, 'dur' => 1, 'type' => $type, 'status' => mt_rand(0, 30) ? 'ok' : 'cancelled', 'source' => 'app',
                    'by' => $by, 'coach' => $type === 'coach' ? 'k'.mt_rand(1, 4) : null, 'price' => 1200000, 'full' => $type === 'open' ? 1200000 : null, 'paid' => 1200000, 'method' => 'wallet',
                    'levels' => $type === 'open' ? '["C"]' : null, 'visibility' => $type === 'open' ? 'public' : null, 'created_at' => now()->addDays($d - 1), 'updated_at' => now()];
                $np = $type === 'open' ? mt_rand(1, 4) : 1;
                for ($k = 0; $k < $np; $k++) {
                    $p = $k === 0 ? $by : 'mVol'.mt_rand(1, 2000);
                    $pl[$id.$p] = ['booking_id' => $id, 'pos' => $k, 'player' => $p, 'member_id' => $p, 'share' => 300000, 'share_method' => 'wallet', 'created_at' => now(), 'updated_at' => now()];
                }
                $h += 1;
            }
        }
    }
    foreach (array_chunk($bk, 500) as $c) {
        DB::table('bookings')->insertOrIgnore($c);
    }
    foreach (array_chunk(array_values($pl), 1000) as $c) {
        DB::table('booking_players')->insertOrIgnore($c);
    }
    $orders = [];
    for ($i = 1; $i <= 12000; $i++) {
        $orders[] = ['id' => 'K-V'.$i, 'by' => 'mVol'.mt_rand(1, 2000), 'items' => '[{"iid":"water","code":"34001","name":"آب معدنی","cat":"colddrink","qty":1,"big":false,"note":"","price":25000,"cost":9000}]',
            'use' => '[["28001",1,9000]]', 'total' => 25000, 'method' => 'wallet', 'status' => 'delivered', 'source' => 'app', 'at' => now()->subMinutes(mt_rand(1, 525600)), 'created_at' => now(), 'updated_at' => now()];
    }
    foreach (array_chunk($orders, 1000) as $c) {
        DB::table('cafe_orders')->insertOrIgnore($c);
    }
    App\Support\Sync::touch(...App\Support\Sync::NAMES);
    printf("filled: %d members, %d bookings, %d players, %d cafe orders in %.1fs\n", 2000, count($bk), count($pl), count($orders), microtime(true) - $t);
    exit;
}

$counts = ['members' => DB::table('members')->count(), 'bookings' => DB::table('bookings')->count(), 'cafe_orders' => DB::table('cafe_orders')->count()];
echo json_encode($counts), PHP_EOL;
$cases = [
    'admin' => DB::table('admins')->first(),
    'player' => DB::table('members')->where('id', 'mVol7')->first() ?? DB::table('members')->first(),
    'coach' => DB::table('coaches')->where('id', 'k1')->first(),
];
foreach ($cases as $role => $u) {
    $times = [];
    $size = 0;
    for ($r = 0; $r < 3; $r++) {
        App\Domain\Settings::forget();
        $t = microtime(true);
        $b = new StateBuilder($role, $u);
        $j = json_encode(['club' => $b->club(), 'me' => $b->me()], JSON_UNESCAPED_UNICODE);
        $times[] = microtime(true) - $t;
        $size = strlen($j);
    }
    $gz = strlen(gzencode($j, 6));
    printf("%-6s full state: %.2fs (best of 3), %.1f MB raw, %.2f MB gzip\n", $role, min($times), $size / 1048576, $gz / 1048576);
}
// همگام‌سازی کوچک (پرتکرارترین درخواست)
$t = microtime(true);
for ($i = 0; $i < 200; $i++) {
    StateBuilder::versions($cases['player'], 'player');
}
printf("sync check: %.1f ms avg\n", (microtime(true) - $t) / 200 * 1000);
// بخش رزروها برای بازیکن (بعد از هر رزرو جدید)
$t = microtime(true);
for ($i = 0; $i < 10; $i++) {
    (new StateBuilder('player', $cases['player']))->club(['bookings']);
}
printf("player bookings refresh: %.0f ms avg\n", (microtime(true) - $t) / 10 * 1000);
// زمان یک رزرو کامل زیر بار داده
$m = $cases['player'];
DB::transaction(fn () => App\Domain\Wallet::credit($m->id, 5000000, 'adjust', 'vol', ''));
$slot = null;
for ($d = 100; $d < 200 && ! $slot; $d++) {
    $y = now()->addDays($d);
    if (App\Domain\Availability::isFree($y->format('Y-m-d'), 1, 10, 1)) {
        $slot = $y;
    }
}
$t = microtime(true);
$r = App\Actions\PlayerActions::forMember($m->id)->book(['type' => 'private', 'court' => 1, 'date' => $slot->year.'-'.$slot->month.'-'.$slot->day, 'start' => 10, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
printf("one booking (lock + checks + write): %.0f ms\n", (microtime(true) - $t) * 1000);
