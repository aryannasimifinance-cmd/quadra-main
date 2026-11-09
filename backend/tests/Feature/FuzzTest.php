<?php

namespace Tests\Feature;

use App\Actions\AdminActions;
use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * ورودی خراب: هر دستور مدیر، مربی و بازیکن با انواع داده‌ی بی‌ربط.
 * انتظار: هیچ خطای ۵۰۰، هیچ پول یا موجودی منفی، دفتر کیف پول سالم.
 */
class FuzzTest extends TestCase
{
    use ApiHelpers;

    private static bool $seeded = false;

    protected function setUp(): void
    {
        parent::setUp();
        if (! self::$seeded) {
            Artisan::call('quadra:demo', ['--force' => true]);
            self::$seeded = true;
        }
        Settings::forget();
    }

    private static function junk(): array
    {
        return [
            null, '', 'x', 0, -1, 1.5, 99999999999999, true, false, [], ['a'], ['x' => ['y' => ['z']]],
            str_repeat('ب', 3000), '<script>alert(1)</script>', "' OR 1=1 --", '../../etc/passwd', '2026-13-45', 'NaN',
            ['id' => 'nope', 'date' => 'bad', 'court' => 99, 'start' => -5, 'dur' => 100, 'price' => -100, 'items' => 'x', 'lines' => [['iid' => null]]],
            ['name' => [], 'phone' => ['09120000000'], 'level' => ['A'], 'amount' => '1e9', 'qty' => -3],
        ];
    }

    public function test_admin_commands_survive_garbage(): void
    {
        $A = $this->adminToken();
        $junk = self::junk();
        $count = 0;
        foreach (AdminActions::COMMANDS as $cmd) {
            if ($cmd === 'adminDemoReset') {
                continue;
            }
            foreach ($junk as $i => $a) {
                $b = $junk[($i * 7 + 3) % count($junk)];
                $c = $junk[($i * 5 + 1) % count($junk)];
                foreach ([[], [$a], [$a, $b], [$a, $b, $c], [$a, $b, $c, $a, $b], ['m-me', $a], ['k1', $a, $b]] as $args) {
                    $this->api('POST', '/admin/'.$cmd, $A, ['args' => $args]);
                    $count++;
                }
            }
            // args که لیست نیست
            $this->api('POST', '/admin/'.$cmd, $A, ['args' => ['k' => 1]]);
            $this->api('POST', '/admin/'.$cmd, $A, ['args' => 'str']);
        }
        $this->assertGreaterThan(5000, $count);
        $this->assertWalletLedgerConsistent();
        $this->assertSame(0, DB::table('bookings')->where('dur', '<=', 0)->count());
        $this->assertSame(0, DB::table('bookings')->whereColumn('paid', '>', 'price')->where('source', 'desk')->count());
        // پنل مدیر هنوز سالم بارگذاری می‌شود
        $this->assertSame('admin', $this->api('GET', '/state', $A)['session']['role']);
    }

    public function test_player_and_coach_actions_survive_garbage(): void
    {
        [$P, $me] = $this->player('09141000001', 'فازی');
        $this->fund($me, 50000000);
        // تست قبلی ممکن است ورود مربی را با داده‌ی خراب بسته باشد؛ دوباره باز می‌شود
        $this->assertTrue($this->admin('adminCoachLogin', ['k1', ['on' => true, 'user' => 'faraz', 'pass' => '123456', 'day' => 5, 'week' => 15]])['ok'] ?? false);
        $C = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'faraz', 'password' => '123456'])['token'];
        $actions = ['book', 'joinGame', 'declineInvite', 'cancelMine', 'registerEvent', 'bookSeries', 'buyPackage', 'topUp', 'checkout', 'cafeCheckout', 'claimQuest', 'addReview', 'notify', 'readAll', 'updateProfile', 'setLogin'];
        $bodies = [
            [], ['method' => 'cash'], ['method' => ['wallet']], ['id' => ['x']], ['type' => 'open', 'court' => '1', 'date' => '2026-1-1', 'start' => '10', 'dur' => '1', 'players' => 'me', 'method' => 'wallet'],
            ['type' => 'private', 'court' => 1, 'date' => self::day(5), 'start' => 10.25, 'dur' => 1, 'players' => [], 'method' => 'wallet'],
            ['type' => 'private', 'court' => 1, 'date' => self::day(5), 'start' => 10, 'dur' => 1, 'players' => ['m0', 'm0'], 'method' => 'wallet'],
            ['type' => 'private', 'court' => 1, 'date' => self::day(5), 'start' => 10, 'dur' => 1, 'players' => ['m0', 'm1', 'm2', 'm3', 'm4'], 'method' => 'wallet'],
            ['type' => 'coach', 'coach' => 'k1', 'pack' => 'ten', 'court' => 1, 'date' => self::day(5), 'start' => 10, 'method' => 'wallet'],
            ['list' => 'x', 'sale' => 'y'], ['list' => [[]], 'sale' => ['kind' => 'package', 'item' => 'gold']], ['id' => 'gold', 'method' => 'wallet', 'extra' => str_repeat('x', 10000)],
            ['items' => [['pid' => 'r1', 'qty' => 0]]], ['items' => [['pid' => 'r1', 'qty' => 1.5]]], ['items' => array_fill(0, 50, ['pid' => 'r1', 'qty' => 1])],
            ['lines' => [['iid' => 'water', 'qty' => -1]]], ['lines' => [['iid' => 'water', 'qty' => 1]], 'to' => 9], ['lines' => [['iid' => 'water', 'qty' => 1, 'big' => 'yes', 'note' => ['x']]]],
            ['target' => 'coach:k1; DROP TABLE members', 'stars' => 9], ['target' => 'event:', 'stars' => 3], ['icon' => ['x'], 'title' => str_repeat('ع', 500)],
            ['gender' => 'x', 'birth' => 'abc', 'side' => 'up'], ['user' => 'Ab C', 'pass' => '1'], ['user' => str_repeat('a', 30), 'pass' => str_repeat('p', 100)],
            ['amount' => 'lots'], ['id' => 'play2', 'xp' => 1000000], ['partner' => 'solo', 'id' => 'x', 'method' => 'wallet'],
        ];
        foreach ($actions as $a) {
            foreach ($bodies as $b) {
                $this->api('POST', '/player/'.$a, $P, $b);
            }
        }
        foreach (['coachReq', 'coachReqCancel', 'coachSetPlayers'] as $a) {
            foreach ($bodies as $b) {
                $this->api('POST', '/coach/'.$a, $C, $b);
            }
            $this->api('POST', '/coach/'.$a, $C, ['date' => self::day(3), 'court' => 1, 'start' => 9.5, 'dur' => 1]);
            $this->api('POST', '/coach/'.$a, $C, ['id' => 'x', 'players' => ['a', 'b', 'c']]);
        }
        // مسیرهای ناشناخته و نقش اشتباه
        $this->assertSame(404, $this->api('POST', '/player/adminPricing', $P)['_status']);
        $this->assertSame(401, $this->api('POST', '/coach/coachReq', $P)['_status']);
        $this->assertSame(401, $this->api('GET', '/state', 'garbage-token')['_status']);
        $this->assertSame(401, $this->api('GET', '/state')['_status']);
        // ورودی‌های بد ورود
        foreach ([['phone' => '0912'], ['phone' => ['x']], ['phone' => '+989121234567'], []] as $b) {
            $this->api('POST', '/auth/otp', null, $b);
        }
        $this->api('POST', '/auth/verify', null, ['phone' => '09120000000', 'code' => ['1']]);
        $this->api('POST', '/auth/register', null, ['ticket' => 'forged', 'name' => 'x']);
        $this->api('POST', '/auth/password', null, ['username' => ['a'], 'password' => null]);
        $this->api('POST', '/auth/staff', null, ['role' => 'root', 'username' => 'admin', 'password' => 'quadra']);
        $this->api('GET', '/pay/doesnotexist', $P);
        $this->get('/api/pay/callback/doesnotexist')->assertStatus(404);
        $this->assertWalletLedgerConsistent();
        // هیچ رزرو نیم‌ساعتی ناجور یا بیش از ۴ بازیکن ثبت نشده
        $this->assertSame(0, DB::table('booking_players')->selectRaw('booking_id, count(*) n')->groupBy('booking_id')->havingRaw('n > 4')->get()->count());
        $this->assertSame(0, DB::table('bookings')->where('by', $me)->whereRaw('MOD(start * 2, 1) <> 0')->count());
        $this->assertSame((int) DB::table('members')->where('id', $me)->value('xp'), (int) DB::table('xp_events')->where('member_id', $me)->sum('amount'), 'xp equals ledger');
    }

    public function test_brute_force_is_throttled(): void
    {
        $seen = [];
        for ($i = 0; $i < 12; $i++) {
            $seen[] = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'wrong'.$i])['error'] ?? null;
        }
        $this->assertContains('slow', $seen, 'login attempts are throttled');
        // کد پیامکی: بعد از چند حدس اشتباه، حتی کد درست هم پذیرفته نمی‌شود
        DB::table('otp_codes')->where('phone', '09141000099')->delete();
        $a = $this->api('POST', '/auth/otp', null, ['phone' => '09141000099']);
        for ($i = 0; $i < 5; $i++) {
            $this->api('POST', '/auth/verify', null, ['phone' => '09141000099', 'code' => sprintf('%04d', ($a['debug_code'] + 1 + $i) % 10000)]);
        }
        $this->assertSame('code', $this->api('POST', '/auth/verify', null, ['phone' => '09141000099', 'code' => $a['debug_code']])['error']);
    }
}
