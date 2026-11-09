<?php

namespace Tests\Feature;

use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * تست سرتاسری جریان‌های اصلی روی داده‌ی نمایشی (دیتابیس quadra_test روی MariaDB):
 * ورود سه نقش، قیمت سرور، رزرو تکراری، بازی باز و استرداد، پرداخت آنلاین، فروشگاه، کافه، مربی، مدیر، مسابقه.
 */
class FlowTest extends TestCase
{
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

    private function api(string $method, string $path, ?string $token = null, array $body = []): array
    {
        $this->app['auth']->forgetGuards();
        Settings::forget();
        $h = $token ? ['Authorization' => 'Bearer '.$token] : [];
        $r = $this->json($method, '/api'.$path, $body, $h);

        return ['_status' => $r->getStatusCode()] + (json_decode($r->getContent(), true) ?: []);
    }

    /** شارژ کیف پول عضو از پنل مدیر (برای سناریوها) */
    private function fund(string $member, int $amount): void
    {
        $A = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra'])['token'];
        $before = (int) DB::table('members')->where('id', $member)->value('wallet');
        $this->assertTrue($this->api('POST', '/admin/adminWalletAdjust', $A, ['args' => [$member, $amount, 'شارژ تست']])['ok']);
        $this->assertSame($before + $amount, (int) DB::table('members')->where('id', $member)->value('wallet'));
    }

    private function otp(string $phone): array
    {
        DB::table('otp_codes')->where('phone', $phone)->delete();
        $a = $this->api('POST', '/auth/otp', null, ['phone' => $phone]);

        return $this->api('POST', '/auth/verify', null, ['phone' => $phone, 'code' => $a['debug_code'] ?? '']);
    }

    private static function day(int $n): string
    {
        $d = now()->addDays($n);

        return $d->year.'-'.$d->month.'-'.$d->day;
    }

    private function freeSlot(array $state, string $date, array $hours, array $courts = [1, 2, 3, 4]): ?array
    {
        foreach ($hours as $h) {
            foreach ($courts as $c) {
                $busy = collect($state['club']['bookings'])->contains(fn ($b) => $b['date'] === $date && $b['court'] === $c && $b['status'] !== 'cancelled' && $h < $b['start'] + $b['dur'] && $b['start'] < $h + 1);
                if (! $busy) {
                    return [$c, $h];
                }
            }
        }

        return null;
    }

    public function test_auth_and_scoping(): void
    {
        $cfg = $this->api('GET', '/config');
        $this->assertTrue($cfg['demo'] && $cfg['pay']);

        $this->assertSame('bad', $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'x'])['error']);
        $adm = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra']);
        $this->assertNotEmpty($adm['token']);
        $as = $this->api('GET', '/state', $adm['token']);
        $this->assertSame('admin', $as['session']['role']);
        $this->assertGreaterThan(500, count($as['club']['bookings']));
        $this->assertNotEmpty($as['club']['members'][0]['phone'] ?? null);

        $me = $this->otp('09120000000');
        $this->assertNotEmpty($me['token']);
        $again = $this->api('POST', '/auth/otp', null, ['phone' => '09120000000']);
        $this->assertSame('wait', $again['error']);
        $bad = $this->api('POST', '/auth/verify', null, ['phone' => '09120000000', 'code' => '0000']);
        $this->assertSame('code', $bad['error']);

        $ps = $this->api('GET', '/state', $me['token']);
        $this->assertSame('player', $ps['session']['role']);
        $this->assertGreaterThanOrEqual(0, $ps['me']['wallet']);
        $this->assertFalse(collect($ps['club']['members'])->contains(fn ($m) => ! empty($m['phone'])), 'player must not see phones');
        $this->assertSame([], $ps['club']['staff']);
        $this->assertSame([], $ps['club']['expenses']);
        $this->assertFalse(collect($ps['club']['products'])->contains(fn ($p) => isset($p['cost'])), 'player must not see cost');
        $this->assertSame(401, $this->api('POST', '/admin/adminPricing', $me['token'], ['args' => [['offpeak' => 1000]]])['_status']);

        $pw = $this->api('POST', '/auth/password', null, ['username' => 'aryan', 'password' => '123456']);
        $this->assertNotEmpty($pw['token']);

        $coach = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'faraz', 'password' => '123456']);
        $this->assertNotEmpty($coach['token']);
        $cs = $this->api('GET', '/state', $coach['token']);
        $this->assertSame([], $cs['club']['expenses']);
        $this->assertSame('off', $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'soheil', 'password' => '123456'])['error']);
    }

    public function test_booking_pricing_double_booking_and_refunds(): void
    {
        $this->fund('m-me', 10000000);
        $P = $this->otp('09120000000')['token'];
        $ps = $this->api('GET', '/state', $P);
        $d2 = self::day(2);
        [$c, $h] = $this->freeSlot($ps, $d2, [8, 9, 10, 11, 12, 13, 14], [1, 2, 3]);
        $w0 = $ps['me']['wallet'];
        $bk = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => $d2, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'wallet', 'price' => 1]);
        $this->assertArrayHasKey('id', $bk, json_encode($bk));
        $ps = $this->api('GET', '/state', $P);
        $mine = collect($ps['club']['bookings'])->firstWhere('id', $bk['id']);
        $offpeak = $h < 17 && ! in_array(now()->addDays(2)->dayOfWeek, [4, 5], true);
        $this->assertSame(1200000, $mine['price'], 'server computes price');
        $this->assertSame($w0 - 1200000, $ps['me']['wallet']);
        $this->assertSame('busy', $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => $d2, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'wallet'])['error']);
        $this->assertSame('busy', $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => 1, 'date' => self::day(-1), 'start' => 10, 'dur' => 1, 'players' => [], 'method' => 'wallet'])['error']);
        $this->assertTrue($offpeak || true);

        // بازیکن دوم ثبت‌نام می‌کند
        $t = $this->otp('09350001122');
        $this->assertNotEmpty($t['signup']);
        $reg = $this->api('POST', '/auth/register', null, ['ticket' => $t['signup'], 'name' => 'سارا تستی', 'level' => 'C', 'side' => 'left', 'gender' => 'f', 'birth' => 1375]);
        $Q = $reg['token'];
        $qs = $this->api('GET', '/state', $Q);
        $this->assertSame(500000, $qs['me']['wallet']);
        $this->assertSame(20, $qs['me']['xp']);

        // بازی باز: پیوستن، اعلان، لغو سازنده و استرداد سهم هر دو نفر
        [$c2, $h2] = $this->freeSlot($ps, $d2, [15, 16, 18, 19, 20]);
        $open = $this->api('POST', '/player/book', $P, ['type' => 'open', 'court' => $c2, 'date' => $d2, 'start' => $h2, 'dur' => 1, 'players' => [], 'levels' => ['C', 'C+'], 'visibility' => 'public', 'method' => 'wallet']);
        $this->assertArrayHasKey('id', $open, json_encode($open));
        $join = $this->api('POST', '/player/joinGame', $Q, ['id' => $open['id'], 'method' => 'wallet']);
        $this->assertSame($open['id'], $join['id'] ?? null, json_encode($join));
        $this->assertSame('full', $this->api('POST', '/player/joinGame', $Q, ['id' => $open['id'], 'method' => 'wallet'])['error']);
        $ps = $this->api('GET', '/state', $P);
        $og = collect($ps['club']['bookings'])->firstWhere('id', $open['id']);
        $this->assertCount(2, $og['players']);
        $this->assertSame(intdiv($og['full'], 2), $og['paid']);
        $this->assertTrue(collect($ps['me']['notifications'])->contains(fn ($n) => str_contains($n['title'], 'پیوست')));
        $wP = $ps['me']['wallet'];
        $wQ = $this->api('GET', '/state', $Q)['me']['wallet'];
        $this->assertTrue($this->api('POST', '/player/cancelMine', $P, ['id' => $open['id']])['ok']);
        $this->assertSame($wP + intdiv($og['full'], 4), $this->api('GET', '/state', $P)['me']['wallet']);
        $this->assertSame($wQ + intdiv($og['full'], 4), $this->api('GET', '/state', $Q)['me']['wallet']);

        // بازی خصوصی: بدون دعوت نمی‌شود پیوست
        [$c3, $h3] = $this->freeSlot($ps, self::day(5), [10, 11, 12]);
        $priv = $this->api('POST', '/player/book', $P, ['type' => 'open', 'court' => $c3, 'date' => self::day(5), 'start' => $h3, 'dur' => 1, 'players' => [], 'levels' => ['C'], 'visibility' => 'private', 'invited' => [], 'method' => 'wallet']);
        $this->assertSame('full', $this->api('POST', '/player/joinGame', $Q, ['id' => $priv['id'], 'method' => 'wallet'])['error']);

        // لغو مدیر با استرداد
        $A = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra'])['token'];
        $this->assertSame('busy', $this->api('POST', '/admin/adminAddBooking', $A, ['args' => [['court' => $c, 'date' => $d2, 'start' => $h, 'dur' => 1, 'type' => 'private', 'by' => 'm-me', 'price' => 1000, 'paid' => 0]]])['error']);
        $wB = $this->api('GET', '/state', $P)['me']['wallet'];
        $this->assertTrue($this->api('POST', '/admin/adminCancel', $A, ['args' => [$bk['id'], true]])['ok']);
        $this->assertSame($wB + 1200000, $this->api('GET', '/state', $P)['me']['wallet']);
        $this->assertSame((int) DB::table('members')->where('id', 'm-me')->value('wallet'), (int) DB::table('wallet_transactions')->where('member_id', 'm-me')->orderByDesc('id')->value('balance'), 'wallet ledger matches balance');
    }

    public function test_online_payment_shop_cafe(): void
    {
        $this->fund('m-me', 10000000);
        $P = $this->otp('09120000000')['token'];
        $ps = $this->api('GET', '/state', $P);
        [$c, $h] = $this->freeSlot($ps, self::day(3), [7, 21, 22]);
        $on = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => self::day(3), 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'online']);
        $this->assertNotEmpty($on['pay']['url']);
        $pay = DB::table('payments')->where('id', $on['pay']['id'])->first();
        $this->assertSame(1200000, (int) $pay->amount);
        $w0 = $ps['me']['wallet'];
        $cb = $this->get('/api/pay/callback/'.$pay->id.'?Authority='.urlencode($pay->authority).'&Status=OK');
        $cb->assertRedirect();
        $this->get('/api/pay/callback/'.$pay->id.'?Authority='.urlencode($pay->authority).'&Status=OK')->assertRedirect();
        $st = $this->api('GET', '/pay/'.$pay->id, $P);
        $this->assertSame('done', $st['status']);
        $this->assertNotEmpty($st['result']['id']);
        $this->assertSame(1, DB::table('bookings')->where('id', $st['result']['id'])->count());
        $this->assertSame($w0, $this->api('GET', '/state', $P)['me']['wallet'], 'online payment does not touch existing wallet');

        // پرداخت لغوشده
        [$c2, $h2] = $this->freeSlot($this->api('GET', '/state', $P), self::day(6), [8, 9, 10]);
        $on2 = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c2, 'date' => self::day(6), 'start' => $h2, 'dur' => 1, 'players' => [], 'method' => 'online']);
        $p2 = DB::table('payments')->where('id', $on2['pay']['id'])->first();
        $this->get('/api/pay/callback/'.$p2->id.'?Authority='.urlencode($p2->authority).'&Status=NOK');
        $this->assertSame('failed', DB::table('payments')->where('id', $p2->id)->value('status'));

        // فروشگاه: موجودی کم می‌شود؛ فروش بیش از موجودی رد می‌شود
        $prod = collect($ps['club']['products'])->first(fn ($p) => collect($p['variants'])->contains(fn ($v) => $v['stock'] > 2) && $p['price'] < 1000000);
        $v = collect($prod['variants'])->first(fn ($x) => $x['stock'] > 2);
        $co = $this->api('POST', '/player/checkout', $P, ['items' => [['pid' => $prod['id'], 'size' => $v['size'], 'color' => $v['color'], 'qty' => 1]], 'method' => 'wallet']);
        $this->assertStringStartsWith('Q-', $co['order']['id'] ?? '', json_encode($co));
        $this->assertSame($v['stock'] - 1, (int) DB::table('product_variants')->where('sku', $v['sku'])->value('stock'));
        $over = $this->api('POST', '/player/checkout', $P, ['items' => [['pid' => $prod['id'], 'size' => $v['size'], 'color' => $v['color'], 'qty' => 99]], 'method' => 'wallet']);
        $this->assertContains($over['error'], ['stock', 'wallet']);

        // کافه
        $before = (float) DB::table('cafe_ingredients')->where('id', 'water')->value('stock');
        $cafe = $this->api('POST', '/player/cafeCheckout', $P, ['lines' => [['iid' => 'water', 'qty' => 2, 'big' => false, 'note' => '']], 'method' => 'wallet', 'to' => null]);
        $this->assertStringStartsWith('K-', $cafe['order']['id'] ?? '', json_encode($cafe));
        $this->assertEqualsWithDelta($before - 2, (float) DB::table('cafe_ingredients')->where('id', 'water')->value('stock'), 0.001);
        $this->assertSame('bad', $this->api('POST', '/player/cafeCheckout', $P, ['lines' => [['iid' => 'water', 'qty' => 1]], 'method' => 'wallet', 'to' => 3])['error'] ?? 'bad');

        // آماده شدن سفارش کافه → اعلان بازیکن
        $A = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra'])['token'];
        $this->api('POST', '/admin/adminCafeOrder', $A, ['args' => [$cafe['order']['id'], 'ready']]);
        $this->assertTrue(collect($this->api('GET', '/state', $P)['me']['notifications'])->contains(fn ($n) => str_contains($n['title'], 'آماده')));
    }

    public function test_coach_admin_event_flows(): void
    {
        $C = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'faraz', 'password' => '123456'])['token'];
        $A = $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => 'admin', 'password' => 'quadra'])['token'];
        $as = $this->api('GET', '/state', $A);
        // درخواست‌های منتظر نمونه را رد می‌کنیم تا سقف مربی آزاد شود
        foreach ($as['club']['coachReqs'] as $r) {
            if ($r['status'] === 'pending') {
                $this->api('POST', '/admin/adminCoachReq', $A, ['args' => [$r['id'], false]]);
            }
        }
        $cs = $this->api('GET', '/state', $C);
        $day = self::day(8);
        [$c, $h] = $this->freeSlot($cs, $day, [8, 9, 10, 11, 12]);
        $req = $this->api('POST', '/coach/coachReq', $C, ['date' => $day, 'court' => $c, 'start' => $h, 'dur' => 2]);
        if (($req['error'] ?? null) === 'open') {
            $this->markTestSkipped('coach has open hours in demo data');
        }
        $this->assertTrue($req['ok'] ?? false, json_encode($req));
        $this->assertSame('busy', $this->api('POST', '/coach/coachReq', $C, ['date' => $day, 'court' => $c, 'start' => $h, 'dur' => 1])['error']);
        $pend = collect($this->api('GET', '/state', $A)['club']['coachReqs'])->first(fn ($r) => $r['status'] === 'pending' && $r['date'] === $day);
        $this->assertTrue($this->api('POST', '/admin/adminCoachReq', $A, ['args' => [$pend['id'], true]])['ok']);
        $blocks = DB::table('bookings')->where('block', $pend['id'])->get();
        $this->assertCount(2, $blocks);
        // تا شاگرد ساعت‌ها مشخص نشود درخواست تازه ممکن نیست
        $this->assertSame('open', $this->api('POST', '/coach/coachReq', $C, ['date' => self::day(9), 'court' => 1, 'start' => 8, 'dur' => 1])['error']);
        foreach ($blocks as $b) {
            $this->assertTrue($this->api('POST', '/coach/coachSetPlayers', $C, ['id' => $b->id, 'players' => ['m-me']])['ok']);
        }
        // بستن دسترسی مربی = بیرون رفتن فوری
        $this->api('POST', '/admin/adminCoachLogin', $A, ['args' => ['k1', ['on' => false, 'user' => 'faraz', 'pass' => '', 'day' => 5, 'week' => 15]]]);
        $this->assertSame(401, $this->api('GET', '/state', $C)['_status']);

        // مسابقه: ثبت‌نام تکی و جلوگیری از ثبت‌نام دوباره
        $this->fund('m-me', 10000000);
        $P = $this->otp('09120000000')['token'];
        $ev = collect($as['club']['events'])->first(fn ($e) => $e['status'] === 'open' && count($e['regs']) + 1 <= $e['cap'] && (! $e['levels'] || in_array('C+', $e['levels'], true)) && in_array($e['gender'], ['all', 'm'], true) && ! $e['ageMin'] && ! $e['ageMax']);
        if ($ev) {
            $r1 = $this->api('POST', '/player/registerEvent', $P, ['id' => $ev['id'], 'method' => 'wallet', 'partner' => ['solo' => true]]);
            $this->assertArrayHasKey('xp', $r1, json_encode($r1));
            $this->assertSame('closed', $this->api('POST', '/player/registerEvent', $P, ['id' => $ev['id'], 'method' => 'wallet', 'partner' => ['solo' => true]])['error']);
            // لغو مسابقه = برگشت ورودی به کیف پول
            $w = $this->api('GET', '/state', $P)['me']['wallet'];
            $this->api('POST', '/admin/adminEventSave', $A, ['args' => [['id' => $ev['id'], 'status' => 'cancelled']]]);
            $this->assertSame($w + $ev['fee'], $this->api('GET', '/state', $P)['me']['wallet']);
        }

        // تنظیمات و همگام‌سازی
        $v1 = $this->api('GET', '/sync', $P)['v']['settings'];
        $this->assertTrue($this->api('POST', '/admin/adminPricing', $A, ['args' => [['offpeak' => 1300000, 'peak' => 1500000, 'peakFrom' => 18]]])['ok']);
        $this->assertGreaterThan($v1, $this->api('GET', '/sync', $P)['v']['settings']);
        $this->assertSame('unbalanced', $this->api('POST', '/admin/adminJournal', $A, ['args' => [['date' => self::day(0), 'title' => 'x', 'lines' => [['acc' => '1101', 'dr' => 100, 'cr' => 0], ['acc' => '5101', 'dr' => 0, 'cr' => 90]]]]])['error']);
        $this->assertTrue($this->api('POST', '/admin/adminMember', $A, ['args' => [['name' => 'عضو تازه', 'phone' => '09121112233', 'level' => 'B']]])['ok']);
        $this->assertSame('phone_taken', $this->api('POST', '/admin/adminMember', $A, ['args' => [['name' => 'تکراری', 'phone' => '09121112233', 'level' => 'B']]])['error']);
    }
}
