<?php

namespace Tests\Feature;

use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** نصب واقعی (بدون داده‌ی نمایشی) و موارد اصلاح‌شده بعد از بازبینی */
class FreshInstallTest extends TestCase
{
    private static bool $ready = false;

    protected function setUp(): void
    {
        parent::setUp();
        if (! self::$ready) {
            Artisan::call('migrate:fresh', ['--force' => true]);
            Artisan::call('quadra:install', ['--admin' => 'boss', '--password' => 'secret-pass-1']);
            self::$ready = true;
        }
        Settings::forget();
    }

    private function api(string $method, string $path, ?string $token = null, array $body = []): array
    {
        $this->app['auth']->forgetGuards();
        Settings::forget();
        $r = $this->json($method, '/api'.$path, $body, $token ? ['Authorization' => 'Bearer '.$token] : []);

        return ['_status' => $r->getStatusCode()] + (json_decode($r->getContent(), true) ?: []);
    }

    private function admin(): string
    {
        return $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'boss', 'password' => 'secret-pass-1'])['token'];
    }

    private function player(string $phone, string $name): array
    {
        DB::table('otp_codes')->where('phone', $phone)->delete();
        $a = $this->api('POST', '/auth/otp', null, ['phone' => $phone]);
        $v = $this->api('POST', '/auth/verify', null, ['phone' => $phone, 'code' => $a['debug_code']]);
        if (isset($v['token'])) {
            return [$v['token'], $v['id']];
        }
        $r = $this->api('POST', '/auth/register', null, ['ticket' => $v['signup'], 'name' => $name, 'level' => 'C', 'side' => 'both', 'gender' => 'm', 'birth' => 1370]);

        return [$r['token'], $r['id']];
    }

    private static function day(int $n): string
    {
        $d = now()->addDays($n);

        return $d->year.'-'.$d->month.'-'.$d->day;
    }

    public function test_fresh_install_has_catalog_and_zero_stock_and_no_gift(): void
    {
        $A = $this->admin();
        $s = $this->api('GET', '/state', $A);
        $this->assertSame([], $s['club']['bookings']);
        $this->assertSame([], $s['club']['members']);
        $this->assertNotEmpty($s['club']['products']);
        $this->assertNotEmpty($s['club']['cafeItems']);
        $this->assertSame(0, collect($s['club']['products'])->sum(fn ($p) => collect($p['variants'])->sum('stock')));
        $this->assertSame(0, $s['club']['welcome']['wallet']);
        $this->assertSame('bad', $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra'])['error']);
        // هدیه‌ی پیش‌فرض صفر
        [$P] = $this->player('09121000001', 'بازیکن یک');
        $this->assertSame(0, $this->api('GET', '/state', $P)['me']['wallet']);
    }

    public function test_settle_with_wallet_is_refunded_on_cancel(): void
    {
        $A = $this->admin();
        [, $mid] = $this->player('09121000002', 'بازیکن دو');
        $this->api('POST', '/admin/adminWalletAdjust', $A, ['args' => [$mid, 3000000, 'شارژ']]);
        $add = $this->api('POST', '/admin/adminAddBooking', $A, ['args' => [['court' => 2, 'date' => self::day(3), 'start' => 10, 'dur' => 1, 'type' => 'private', 'by' => $mid, 'price' => 1200000, 'paid' => 0]]]);
        $this->assertTrue($add['ok'], json_encode($add));
        $this->assertTrue($this->api('POST', '/admin/adminSettle', $A, ['args' => [$add['id'], 'wallet']])['ok']);
        $this->assertSame(1800000, (int) DB::table('members')->where('id', $mid)->value('wallet'));
        $this->assertTrue($this->api('POST', '/admin/adminCancel', $A, ['args' => [$add['id'], true]])['ok']);
        $this->assertSame(3000000, (int) DB::table('members')->where('id', $mid)->value('wallet'));
    }

    public function test_membership_stacking_keeps_better_discount(): void
    {
        $A = $this->admin();
        [$P, $mid] = $this->player('09121000003', 'بازیکن سه');
        $this->api('POST', '/admin/adminWalletAdjust', $A, ['args' => [$mid, 20000000, 'شارژ']]);
        $this->assertArrayHasKey('xp', $this->api('POST', '/player/buyPackage', $P, ['id' => 'black', 'method' => 'wallet']));
        $this->assertArrayHasKey('xp', $this->api('POST', '/player/buyPackage', $P, ['id' => 'gold', 'method' => 'wallet']));
        $me = $this->api('GET', '/state', $P)['me'];
        $this->assertSame('black', $me['membership']['id'], 'black stays active; gold starts after it');
        $this->assertSame(0.25, \App\Domain\Members::off($mid));
    }

    public function test_players_never_see_costs_and_coach_cannot_harvest_phones(): void
    {
        $A = $this->admin();
        [$P, $mid] = $this->player('09121000004', 'بازیکن چهار');
        $this->api('POST', '/admin/adminWalletAdjust', $A, ['args' => [$mid, 5000000, 'شارژ']]);
        $p = DB::table('products')->first();
        $sku = DB::table('product_variants')->where('product_id', $p->id)->value('sku');
        $this->api('POST', '/admin/adminReceive', $A, ['args' => [['date' => self::day(0), 'supplier' => 'تأمین‌کننده', 'invoice' => '1', 'pay' => 'bank', 'items' => [['pid' => $p->id, 'sku' => $sku, 'qty' => 5, 'cost' => 1000]]]]]);
        $v = DB::table('product_variants')->where('sku', $sku)->first();
        $co = $this->api('POST', '/player/checkout', $P, ['items' => [['pid' => $p->id, 'size' => $v->size, 'color' => $v->color, 'qty' => 1]], 'method' => 'wallet']);
        $this->assertArrayNotHasKey('cost', $co['order']['items'][0] ?? [], json_encode($co));
        $orders = $this->api('GET', '/state', $P)['club']['orders'];
        $this->assertArrayNotHasKey('cost', $orders[0]['items'][0]);

        // مربی با گذاشتن عضو در ساعت خودش موبایل او را نمی‌بیند
        $this->api('POST', '/admin/adminCoachLogin', $A, ['args' => ['k1', ['on' => true, 'user' => 'coach1', 'pass' => '654321', 'day' => 5, 'week' => 15]]]);
        $C = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'coach1', 'password' => '654321'])['token'];
        $this->assertTrue($this->api('POST', '/coach/coachReq', $C, ['date' => self::day(4), 'court' => 3, 'start' => 9, 'dur' => 1])['ok']);
        $req = DB::table('coach_requests')->where('coach', 'k1')->where('status', 'pending')->first();
        $this->api('POST', '/admin/adminCoachReq', $A, ['args' => [$req->id, true]]);
        $b = DB::table('bookings')->where('block', $req->id)->first();
        $this->assertTrue($this->api('POST', '/coach/coachSetPlayers', $C, ['id' => $b->id, 'players' => [$mid]])['ok']);
        $m = collect($this->api('GET', '/state', $C)['club']['members'])->firstWhere('id', $mid);
        $this->assertArrayNotHasKey('phone', $m);
        // و بازیکن نمی‌تواند ساعت مربی را لغو کند
        $this->assertSame('gone', $this->api('POST', '/player/cancelMine', $P, ['id' => $b->id])['error']);
        // رد مرخصی با «no»
        $this->api('POST', '/admin/adminStaff', $A, ['args' => [['id' => 'hTest1', 'name' => 'پرسنل', 'role' => 'service', 'type' => 'full', 'base' => 10000000]]]);
        $this->api('POST', '/admin/adminLeave', $A, ['args' => [['id' => 'LTest1', 'staff' => 'hTest1', 'kind' => 'annual', 'from' => self::day(2), 'to' => self::day(3), 'days' => 2, 'note' => '']]]);
        $this->assertTrue($this->api('POST', '/admin/adminLeaveStatus', $A, ['args' => ['LTest1', 'no']])['ok']);
        $this->assertSame('no', DB::table('leaves')->where('id', 'LTest1')->value('status'));
    }
}
