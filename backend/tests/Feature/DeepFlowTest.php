<?php

namespace Tests\Feature;

use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** جریان‌های کامل بازیکن، مربی و مدیر روی داده‌ی نمایشی */
class DeepFlowTest extends TestCase
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

    protected function tearDown(): void
    {
        $this->assertWalletLedgerConsistent();
        parent::tearDown();
    }

    // ---------- پکیج زمین و پکیج مربی ----------
    public function test_court_series_and_coach_series(): void
    {
        [$P, $me] = $this->player('09131000001', 'پکیجی');
        $this->fund($me, 30000000);
        // ۵ جلسه، هفته‌ای یک بار ساعت ۲۳ (کمتر پر است)
        $list = [];
        $base = 15;
        for ($i = 0, $k = 0; $i < 5 && $k < 40; $k++) {
            $ymd = now()->addDays($base + 7 * $k)->format('Y-m-d');
            if (\App\Domain\Availability::isFree($ymd, 2, 23, 1)) {
                $d = now()->addDays($base + 7 * $k);
                $list[] = ['court' => 2, 'date' => $d->year.'-'.$d->month.'-'.$d->day, 'start' => 23, 'dur' => 1, 'players' => []];
                $i++;
            }
        }
        $this->assertCount(5, $list);
        $w0 = $this->wallet($me);
        $r = $this->api('POST', '/player/bookSeries', $P, ['list' => $list, 'sale' => ['kind' => 'package', 'item' => 'p5'], 'method' => 'wallet']);
        $this->assertSame(5, $r['count'] ?? null, json_encode($r));
        $paid = $w0 - $this->wallet($me);
        $sale = DB::table('sales')->where('series', $r['series'])->first();
        $this->assertSame((int) $sale->price, $paid);
        $this->assertSame(5, DB::table('bookings')->where('series', $r['series'])->where('method', 'package')->count());
        // تعداد اشتباه یا تاریخ تکراری رد می‌شود
        $this->assertSame('bad', $this->api('POST', '/player/bookSeries', $P, ['list' => array_slice($list, 0, 4), 'sale' => ['kind' => 'package', 'item' => 'p5'], 'method' => 'wallet'])['error']);
        $dupList = $list;
        $dupList[1] = $dupList[0];
        $this->assertSame('bad', $this->api('POST', '/player/bookSeries', $P, ['list' => $dupList, 'sale' => ['kind' => 'package', 'item' => 'p5'], 'method' => 'wallet'])['error']);
        // دوباره همان ساعت‌ها = پر
        $this->assertSame('busy', $this->api('POST', '/player/bookSeries', $P, ['list' => $list, 'sale' => ['kind' => 'package', 'item' => 'p5'], 'method' => 'wallet'])['error']);

        // لغو یک جلسه: برگشت مبلغ همان جلسه و کم شدن فروش پکیج
        $one = DB::table('bookings')->where('series', $r['series'])->orderBy('date')->first();
        $wb = $this->wallet($me);
        $this->assertTrue($this->api('POST', '/player/cancelMine', $P, ['id' => $one->id])['ok'] ?? false);
        $this->assertSame($wb + (int) $one->price, $this->wallet($me));
        $this->assertSame((int) $sale->price - (int) $one->price, (int) DB::table('sales')->where('id', $sale->id)->value('price'));

        // پکیج ۵ جلسه‌ی مربی k2
        $coach = DB::table('coaches')->where('id', 'k2')->first();
        $clist = [];
        for ($k = 0; count($clist) < 5 && $k < 60; $k++) {
            $d = now()->addDays(20 + $k);
            $ymd = $d->format('Y-m-d');
            if (\App\Domain\Availability::isFree($ymd, 3, 7, 1) && ! \App\Domain\Availability::coachBusy('k2', $ymd, 7, 1)) {
                $clist[] = ['court' => 3, 'date' => $d->year.'-'.$d->month.'-'.$d->day, 'start' => 7, 'dur' => 1];
            }
        }
        $w1 = $this->wallet($me);
        $cr = $this->api('POST', '/player/bookSeries', $P, ['list' => $clist, 'sale' => ['kind' => 'coach', 'item' => 'k2', 'pack' => 'five'], 'method' => 'wallet']);
        $this->assertSame(5, $cr['count'] ?? null, json_encode($cr));
        $this->assertSame(\App\Domain\Pricing::coachPack($coach, 'five'), $w1 - $this->wallet($me));
        $this->assertSame(5, DB::table('bookings')->where('series', $cr['series'])->where('coach', 'k2')->count());
        // تک‌جلسه‌ی همان مربی در همان ساعت = مربی مشغول
        $this->assertSame('busy', $this->api('POST', '/player/book', $P, ['type' => 'coach', 'coach' => 'k2', 'pack' => 'one', 'court' => 4, 'date' => $clist[0]['date'], 'start' => 7, 'method' => 'wallet'])['error']);
        // پکیج غیرفعال یا مربی ناموجود
        $this->assertSame('bad', $this->api('POST', '/player/bookSeries', $P, ['list' => $clist, 'sale' => ['kind' => 'coach', 'item' => 'nope', 'pack' => 'five'], 'method' => 'wallet'])['error']);
    }

    // ---------- سقف پشت‌سرهم و قیمت پیک/تخفیف عضویت ----------
    public function test_player_run_cap_peak_price_and_membership_discount(): void
    {
        [$P, $me] = $this->player('09131000002', 'سقف');
        $this->fund($me, 40000000);
        // سه ساعت پشت هم مجاز، ساعت چهارم = run
        $ymd = null;
        for ($d = 30; $d < 90; $d++) {
            $y = now()->addDays($d)->format('Y-m-d');
            $ok = true;
            foreach ([8, 9, 10, 11] as $h) {
                $ok = $ok && \App\Domain\Availability::isFree($y, 1, $h, 1);
            }
            if ($ok) {
                $ymd = now()->addDays($d);
                break;
            }
        }
        $key = $ymd->year.'-'.$ymd->month.'-'.$ymd->day;
        $r = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => 1, 'date' => $key, 'start' => 8, 'dur' => 3, 'players' => [], 'method' => 'wallet']);
        $this->assertArrayHasKey('id', $r, json_encode($r));
        $r2 = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => 1, 'date' => $key, 'start' => 11, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        $this->assertSame('run', $r2['error'] ?? null, json_encode($r2));
        $this->assertSame(3, $r2['run']);
        // مدت بیشتر از سقف
        $this->assertSame('bad', $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => 2, 'date' => $key, 'start' => 14, 'dur' => 5, 'players' => [], 'method' => 'wallet'])['error']);

        // قیمت پیک: تنظیم نرخ متفاوت و بررسی
        $this->admin('adminPricing', [['offpeak' => 1000000, 'peak' => 2000000, 'peakFrom' => 17]]);
        [$c, $k2, $h, $y2] = $this->freeSlot(40, [16]);
        $w = $this->wallet($me);
        $r3 = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => $k2, 'start' => 16.5, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        if (isset($r3['id'])) {
            $weekend = \App\Domain\Pricing::isWeekend($y2);
            $expect = $weekend ? 2000000 : 500000 + 1000000; // نیم ساعت عادی + نیم ساعت پیک
            $this->assertSame($expect, $w - $this->wallet($me));
        }

        // عضویت بلک = ۲۵٪ تخفیف و XP دو برابر
        $this->assertArrayHasKey('xp', $this->api('POST', '/player/buyPackage', $P, ['id' => 'black', 'method' => 'wallet']));
        [$c4, $k4, $h4, $y4] = $this->freeSlot(45, [10, 11, 12]);
        $w = $this->wallet($me);
        $r4 = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c4, 'date' => $k4, 'start' => $h4, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        $full = \App\Domain\Pricing::court($y4, $h4, 1);
        $this->assertSame((int) round($full * 0.75), $w - $this->wallet($me));
        $this->assertSame(2, $r4['mult'] ?? null);
        $this->admin('adminPricing', [['offpeak' => 1200000, 'peak' => 1200000, 'peakFrom' => 17]]);
    }

    // ---------- بازی خصوصی با دعوت ----------
    public function test_private_game_invite_accept_decline(): void
    {
        [$P, $me] = $this->player('09131000003', 'میزبان');
        [$Q, $q] = $this->player('09131000004', 'مهمان یک');
        [$R, $r] = $this->player('09131000005', 'مهمان دو');
        foreach ([$me, $q, $r] as $m) {
            $this->fund($m, 5000000);
        }
        [$c, $k] = $this->freeSlot(50);
        [, , $h] = $this->freeSlot(50);
        $g = $this->api('POST', '/player/book', $P, ['type' => 'open', 'court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'players' => [], 'levels' => ['C'], 'visibility' => 'private', 'invited' => [$q, $r], 'method' => 'wallet']);
        $this->assertArrayHasKey('id', $g, json_encode($g));
        $qs = $this->api('GET', '/state', $Q);
        $b = collect($qs['club']['bookings'])->firstWhere('id', $g['id']);
        $this->assertSame([$q], $b['invited']);
        $this->assertTrue(collect($qs['me']['notifications'])->contains(fn ($n) => str_contains($n['title'], 'دعوت')));
        $this->assertArrayHasKey('id', $this->api('POST', '/player/joinGame', $Q, ['id' => $g['id'], 'method' => 'wallet']));
        $this->assertTrue($this->api('POST', '/player/declineInvite', $R, ['id' => $g['id']])['ok']);
        $this->assertSame('full', $this->api('POST', '/player/joinGame', $R, ['id' => $g['id'], 'method' => 'wallet'])['error']);
        // غیردعوتی بازی خصوصی را در فهرست نمی‌بیند (بازیکن‌ها پنهان)
        [$S] = $this->player('09131000006', 'غریبه');
        $sb = collect($this->api('GET', '/state', $S)['club']['bookings'])->firstWhere('id', $g['id']);
        $this->assertNull($sb['by']);
        // بازیکن دوم انصراف می‌دهد → سهمش برمی‌گردد و جا باز می‌شود
        $wq = $this->wallet($q);
        $share = (int) DB::table('booking_players')->where('booking_id', $g['id'])->where('player', $q)->value('share');
        $this->assertTrue($this->api('POST', '/player/cancelMine', $Q, ['id' => $g['id']])['ok']);
        $this->assertSame($wq + $share, $this->wallet($q));
        $this->assertSame(1, DB::table('booking_players')->where('booking_id', $g['id'])->count());
    }

    // ---------- مسابقه: تیم دونفره، مهمان، قواعد سن و جنسیت، حضوری ----------
    public function test_events_pairs_rules_and_desk(): void
    {
        $A = $this->adminToken();
        // روزی بدون مسابقه‌ی دیگر (دو مسابقه‌ی هم‌زمان روی یک زمین مجاز نیست)
        $off = collect(range(25, 90))->first(fn ($d) => ! DB::table('events')->where('date', now()->addDays($d)->format('Y-m-d'))->whereNotIn('status', ['draft', 'cancelled'])->exists());
        $date = self::day($off);
        $ev = $this->admin('adminEventSave', [['title' => 'تست مسابقه بانوان', 'kind' => 'friday', 'date' => $date, 'start' => 9, 'dur' => 3, 'courts' => [1, 2], 'levels' => ['C', 'C+'], 'cap' => 4, 'fee' => 500000, 'gender' => 'f', 'ageMin' => 18, 'status' => 'open']], $A);
        $this->assertTrue($ev['ok'], json_encode($ev));
        $id = $ev['id'];
        // زمین‌های مسابقه در تقویم بسته‌اند
        $this->assertFalse(\App\Domain\Availability::isFree(now()->addDays($off)->format('Y-m-d'), 1, 10, 1));

        [$M, $m] = $this->player('09131000010', 'آقای تست', ['gender' => 'm']);
        [$F, $f] = $this->player('09131000011', 'خانم یک', ['gender' => 'f']);
        [$F2, $f2] = $this->player('09131000012', 'خانم دو', ['gender' => 'f']);
        foreach ([$m, $f, $f2] as $x) {
            $this->fund($x, 5000000);
        }
        $this->assertSame('closed', $this->api('POST', '/player/registerEvent', $M, ['id' => $id, 'method' => 'wallet', 'partner' => ['solo' => true]])['error'], 'men rejected');
        // یار مهمان مرد رد می‌شود؛ یار عضو زن قبول
        $this->assertSame('closed', $this->api('POST', '/player/registerEvent', $F, ['id' => $id, 'method' => 'wallet', 'partner' => ['id' => 'f:علی', 'guest' => true, 'level' => 'C', 'gender' => 'm', 'birth' => 1370]])['error']);
        $w = $this->wallet($f);
        $r = $this->api('POST', '/player/registerEvent', $F, ['id' => $id, 'method' => 'wallet', 'partner' => ['id' => $f2]]);
        $this->assertArrayHasKey('xp', $r, json_encode($r));
        $this->assertSame(1000000, $w - $this->wallet($f), 'payer pays both entries');
        $this->assertSame('closed', $this->api('POST', '/player/registerEvent', $F2, ['id' => $id, 'method' => 'wallet', 'partner' => ['solo' => true]])['error'], 'partner already registered');
        // ظرفیت ۴: یک تیم دیگر جا دارد، بعد پر
        $this->admin('adminEventReg', [$id, ['by' => null, 'name' => 'نسرین حضوری', 'level' => 'C', 'gender' => 'f', 'birth' => 1370], 'cash', 500000, ['by' => null, 'name' => 'مینا حضوری', 'level' => 'C', 'gender' => 'f', 'birth' => 1372]], $A);
        [$F3, $f3] = $this->player('09131000013', 'خانم سه', ['gender' => 'f']);
        $this->fund($f3, 5000000);
        $this->assertSame('closed', $this->api('POST', '/player/registerEvent', $F3, ['id' => $id, 'method' => 'wallet', 'partner' => ['solo' => true]])['error'], 'capacity full');
        // تیم‌بندی مدیر ذخیره می‌شود
        $evs = collect($this->api('GET', '/state', $A)['club']['events'])->firstWhere('id', $id);
        $this->assertCount(4, $evs['regs']);
        $teams = [['id' => 't1', 'players' => [$evs['regs'][0]['id'], $evs['regs'][1]['id']], 'name' => 'الف'], ['id' => 't2', 'players' => [$evs['regs'][2]['id'], $evs['regs'][3]['id']], 'name' => 'ب']];
        $this->assertTrue($this->admin('adminEventSet', [$id, ['teams' => $teams, 'groups' => [], 'matches' => [['id' => 'k2-1', 'stage' => 'ko', 'round' => 2, 'idx' => 0, 'a' => 't1', 'b' => 't2', 'sa' => 1, 'sb' => 0, 'sets' => [[6, 3]]]], 'setup' => null, 'regs' => []]], $A)['ok']);
        $this->assertCount(2, collect($this->api('GET', '/state', $F)['club']['events'])->firstWhere('id', $id)['teams']);
        // حذف تیم اپی = برگشت ورودی هر دو نفر به پرداخت‌کننده
        $wf = $this->wallet($f);
        $rid = collect($evs['regs'])->firstWhere('by', $f)['id'];
        $this->assertTrue($this->admin('adminEventUnreg', [$id, $rid], $A)['ok']);
        $this->assertSame($wf + 1000000, $this->wallet($f));
        $this->assertSame(2, DB::table('event_registrations')->where('event_id', $id)->count());
        // مسابقه‌ی دارای ورودی پاک نمی‌شود
        $this->assertSame('paid', $this->admin('adminEventDel', [$id], $A)['error']);
        // نظر فقط برای شرکت‌کننده‌ی مسابقه‌ی برگزارشده
        $this->admin('adminEventSave', [['id' => $id, 'status' => 'done']], $A);
        $this->assertSame('denied', $this->api('POST', '/player/addReview', $M, ['target' => 'event:'.$id, 'stars' => 5, 'text' => ''])['error']);
    }

    // ---------- فروشگاه: کالا، ورود، اصلاح، فروش حضوری، سفارش ----------
    public function test_shop_admin_lifecycle(): void
    {
        $A = $this->adminToken();
        $save = $this->admin('adminProduct', [['id' => 'pTestShirt1', 'cat' => 'apparel', 'brand' => 'Quadra', 'name' => 'تی‌شرت تست', 'price' => 1000000, 'cost' => 400000, 'sizes' => ['S', 'M'], 'colors' => [['n' => 'مشکی', 'c' => '#141413'], ['n' => 'سفید', 'c' => '#F4F2EC']], 'active' => true]], $A);
        $this->assertTrue($save['ok'], json_encode($save));
        $this->assertSame(4, DB::table('product_variants')->where('product_id', 'pTestShirt1')->count(), 'size × color');
        $sku = DB::table('product_variants')->where('product_id', 'pTestShirt1')->where('size', 'M')->where('color', 'سفید')->value('sku');
        $this->assertTrue($this->admin('adminReceive', [['date' => self::day(0), 'supplier' => 'تولیدی تست', 'invoice' => 'T1', 'pay' => 'payable', 'items' => [['pid' => 'pTestShirt1', 'sku' => $sku, 'qty' => 10, 'cost' => 500000]]]], $A)['ok']);
        $this->assertSame(10, (int) DB::table('product_variants')->where('sku', $sku)->value('stock'));
        $this->assertSame(500000, (int) DB::table('products')->where('id', 'pTestShirt1')->value('cost'), 'weighted cost with zero opening stock');
        $this->admin('adminReceive', [['date' => self::day(0), 'supplier' => 'تولیدی تست', 'invoice' => 'T2', 'pay' => 'bank', 'items' => [['pid' => 'pTestShirt1', 'sku' => $sku, 'qty' => 10, 'cost' => 700000]]]], $A);
        $this->assertSame(600000, (int) DB::table('products')->where('id', 'pTestShirt1')->value('cost'));
        $this->assertTrue(DB::table('suppliers')->where('name', 'تولیدی تست')->exists());
        // کسری انبار بیش از موجودی تا صفر محدود می‌شود
        $this->admin('adminAdjust', ['pTestShirt1', $sku, -25, 'شمارش'], $A);
        $this->assertSame(0, (int) DB::table('product_variants')->where('sku', $sku)->value('stock'));
        $this->admin('adminAdjust', ['pTestShirt1', $sku, 3, 'پیدا شد'], $A);
        // فروش حضوری بیش از موجودی رد، به اندازه قبول
        $this->assertSame('stock', $this->admin('adminPos', [[['pid' => 'pTestShirt1', 'sku' => $sku, 'qty' => 4]], 'cash', null], $A)['error']);
        $pos = $this->admin('adminPos', [[['pid' => 'pTestShirt1', 'sku' => $sku, 'qty' => 3]], 'card', 'walkin'], $A);
        $this->assertStringStartsWith('Q-', $pos['id'] ?? '');
        $this->assertSame(0, (int) DB::table('product_variants')->where('sku', $sku)->value('stock'));
        $this->assertSame('delivered', DB::table('shop_orders')->where('id', $pos['id'])->value('status'));
        // ویرایش کالا: حذف سایز با موجودی صفر، تنوع‌های دارای موجودی می‌مانند
        $this->admin('adminAdjust', ['pTestShirt1', DB::table('product_variants')->where('product_id', 'pTestShirt1')->where('size', 'S')->where('color', 'مشکی')->value('sku'), 2, ''], $A);
        $this->admin('adminProduct', [['id' => 'pTestShirt1', 'cat' => 'apparel', 'brand' => 'Quadra', 'name' => 'تی‌شرت تست', 'price' => 1100000, 'sizes' => ['M'], 'colors' => [['n' => 'سفید', 'c' => '#F4F2EC']], 'active' => true]], $A);
        $vs = DB::table('product_variants')->where('product_id', 'pTestShirt1')->pluck('stock', 'sku')->all();
        $this->assertContains(2, array_values($vs), 'stocked variant kept');
        // کالای غیرفعال در اپ خریدنی نیست
        $this->admin('adminProduct', [['id' => 'pTestShirt1', 'cat' => 'apparel', 'brand' => 'Quadra', 'name' => 'تی‌شرت تست', 'price' => 1100000, 'active' => false]], $A);
        [$P, $me] = $this->player('09131000020', 'خریدار');
        $this->fund($me, 5000000);
        $this->assertSame('stock', $this->api('POST', '/player/checkout', $P, ['items' => [['pid' => 'pTestShirt1', 'size' => 'S', 'color' => 'مشکی', 'qty' => 1]], 'method' => 'wallet'])['error']);
        // پرداخت به تأمین‌کننده
        $this->assertTrue($this->admin('adminApPay', [['supplier' => 'تولیدی تست', 'amount' => 1000000, 'pay' => 'bank']], $A)['ok']);
        // وضعیت سفارش
        $this->assertSame('bad', $this->admin('adminOrder', [$pos['id'], 'lost'], $A)['error']);
    }

    // ---------- کافه: ماده، آیتم، خرید، ضایعات، سفارش حضوری، صف ----------
    public function test_cafe_admin_lifecycle(): void
    {
        $A = $this->adminToken();
        $g = $this->admin('adminCafeIng', [['id' => 'gTestBeans', 'name' => 'قهوه‌ی تست', 'cat' => 'coffee', 'unit' => 'g', 'cost' => 2000, 'min' => 100]], $A);
        $this->assertTrue($g['ok']);
        $i = $this->admin('adminCafeItem', [['id' => 'ciTestEsp', 'name' => 'اسپرسوی تست', 'cat' => 'hotcoffee', 'price' => 100000, 'big' => 30000, 'recipe' => [['gTestBeans', 20]], 'emoji' => '☕']], $A);
        $this->assertTrue($i['ok'], json_encode($i));
        $this->assertSame('bad', $this->admin('adminCafeItem', [['name' => 'خراب', 'cat' => 'hotcoffee', 'price' => 1, 'recipe' => [['nope', 5]]]], $A)['error']);
        $this->admin('adminCafeReceive', [['date' => self::day(0), 'supplier' => 'رست تست', 'invoice' => 'C1', 'pay' => 'cash', 'items' => [['ing' => 'gTestBeans', 'qty' => 100, 'cost' => 3000]]]], $A);
        $this->assertEqualsWithDelta(100, (float) DB::table('cafe_ingredients')->where('id', 'gTestBeans')->value('stock'), 0.001);
        // ۵ اسپرسو = ۱۰۰ گرم؛ ششمی کم می‌آید. بزرگ = ۳۰ گرم
        $this->assertSame('stock', $this->admin('adminCafePos', [[['iid' => 'ciTestEsp', 'qty' => 6]], 'cash', null, null, true], $A)['error']);
        $this->assertSame('stock', $this->admin('adminCafePos', [[['iid' => 'ciTestEsp', 'qty' => 3, 'big' => true], ['iid' => 'ciTestEsp', 'qty' => 1]], 'cash', null, null, true], $A)['error']);
        $o = $this->admin('adminCafePos', [[['iid' => 'ciTestEsp', 'qty' => 2, 'big' => true], ['iid' => 'ciTestEsp', 'qty' => 2]], 'card', null, 2, false], $A);
        $this->assertStringStartsWith('K-', $o['id'] ?? '', json_encode($o));
        $ord = DB::table('cafe_orders')->where('id', $o['id'])->first();
        $this->assertSame(2 * 130000 + 2 * 100000, (int) $ord->total);
        $this->assertSame('prep', $ord->status);
        $this->assertEqualsWithDelta(0, (float) DB::table('cafe_ingredients')->where('id', 'gTestBeans')->value('stock'), 0.001);
        // بهای تمام‌شده = مصرف (سند تراز)
        $use = json_decode($ord->use, true);
        $this->assertSame(array_sum(array_column(json_decode($ord->items, true), 'cost')), array_sum(array_column($use, 2)));
        // ضایعات بیش از موجودی تا صفر
        $this->admin('adminCafeAdjust', ['gTestBeans', -50, 'ریخت'], $A);
        $this->assertEqualsWithDelta(0, (float) DB::table('cafe_ingredients')->where('id', 'gTestBeans')->value('stock'), 0.001);
        foreach (['ready', 'delivered'] as $s) {
            $this->assertTrue($this->admin('adminCafeOrder', [$o['id'], $s], $A)['ok']);
        }
        // آیتم غیرفعال در اپ سفارش داده نمی‌شود
        $this->admin('adminCafeReceive', [['date' => self::day(0), 'supplier' => 'رست تست', 'invoice' => 'C2', 'pay' => 'bank', 'items' => [['ing' => 'gTestBeans', 'qty' => 100, 'cost' => 3000]]]], $A);
        $this->admin('adminCafeItem', [['id' => 'ciTestEsp', 'cat' => 'hotcoffee', 'active' => false]], $A);
        [$P, $me] = $this->player('09131000021', 'قهوه‌خور');
        $this->fund($me, 2000000);
        $this->assertSame('stock', $this->api('POST', '/player/cafeCheckout', $P, ['lines' => [['iid' => 'ciTestEsp', 'qty' => 1]], 'method' => 'wallet'])['error']);
    }

    // ---------- مربی: سقف روزانه، پشت‌سرهم، لغو درخواست ----------
    public function test_coach_quota_and_run_limits(): void
    {
        $A = $this->adminToken();
        foreach (DB::table('coach_requests')->where('status', 'pending')->pluck('id') as $rid) {
            $this->admin('adminCoachReq', [$rid, false], $A);
        }
        $this->admin('adminCoachLogin', ['k4', ['on' => true, 'user' => 'zahra', 'pass' => '111222', 'day' => 3, 'week' => 4]], $A);
        $C = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'zahra', 'password' => '111222'])['token'];
        $this->assertNotEmpty($C);
        // روزی بدون کلاس برای این مربی
        $day = null;
        for ($d = 60; $d < 120; $d++) {
            $y = now()->addDays($d)->format('Y-m-d');
            if (! DB::table('bookings')->where('coach', 'k4')->where('date', $y)->exists() && collect([7, 8, 9, 10])->every(fn ($h) => \App\Domain\Availability::isFree($y, 4, $h, 1))) {
                $day = now()->addDays($d);
                break;
            }
        }
        $key = $day->year.'-'.$day->month.'-'.$day->day;
        $this->assertSame('quota', $this->api('POST', '/coach/coachReq', $C, ['date' => $key, 'court' => 4, 'start' => 7, 'dur' => 4])['error']);
        $this->assertTrue($this->api('POST', '/coach/coachReq', $C, ['date' => $key, 'court' => 4, 'start' => 7, 'dur' => 3])['ok']);
        $r = $this->api('POST', '/coach/coachReq', $C, ['date' => $key, 'court' => 4, 'start' => 10, 'dur' => 1]);
        $this->assertSame('quota', $r['error'], 'day cap 3 used');
        $req = DB::table('coach_requests')->where('coach', 'k4')->where('status', 'pending')->first();
        $this->assertTrue($this->api('POST', '/coach/coachReqCancel', $C, ['id' => $req->id])['ok']);
        $this->assertSame('cancelled', DB::table('coach_requests')->where('id', $req->id)->value('status'));
        // سقف هفتگی ۴: سه ساعت امروز + دو ساعت فردا = quota
        $this->assertTrue($this->api('POST', '/coach/coachReq', $C, ['date' => $key, 'court' => 4, 'start' => 7, 'dur' => 3])['ok']);
        $next = $day->copy()->addDay();
        if (\App\Support\Dates::weekStart($next) === \App\Support\Dates::weekStart($day)) {
            $this->assertSame('quota', $this->api('POST', '/coach/coachReq', $C, ['date' => $next->year.'-'.$next->month.'-'.$next->day, 'court' => 1, 'start' => 22, 'dur' => 2])['error']);
        }
        // سقف پشت‌سرهم مربی‌ها
        $this->admin('adminLimits', [['coachRun' => 2, 'playerRun' => 3]], $A);
        $this->admin('adminCoachLogin', ['k4', ['on' => true, 'user' => 'zahra', 'pass' => '', 'day' => 10, 'week' => 40]], $A);
        $this->assertSame('run', $this->api('POST', '/coach/coachReq', $C, ['date' => $key, 'court' => 4, 'start' => 10, 'dur' => 1])['error']);
        $this->admin('adminLimits', [['coachRun' => 5, 'playerRun' => 3]], $A);
        // ورود با رمز قبلی هنوز کار می‌کند (رمز خالی = بدون تغییر)
        $this->assertNotEmpty($this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'zahra', 'password' => '111222'])['token'] ?? null);
    }

    // ---------- حسابداری و پرسنل ----------
    public function test_accounting_and_hr(): void
    {
        $A = $this->adminToken();
        $this->assertTrue($this->admin('adminExpense', [['id' => 'eTest1', 'date' => self::day(0), 'acc' => '8105', 'amount' => 2500000, 'title' => 'قبض', 'vendor' => 'برق', 'pay' => 'bank']], $A)['ok']);
        $this->assertSame('bad', $this->admin('adminExpense', [['date' => self::day(0), 'acc' => 'xx', 'amount' => 10, 'pay' => 'bank']], $A)['error']);
        $this->assertTrue($this->admin('adminExpenseDel', ['eTest1'], $A)['ok']);
        $this->assertTrue($this->admin('adminJournal', [['id' => 'JTest1', 'date' => self::day(0), 'title' => 'سند', 'lines' => [['acc' => '1101', 'dr' => 500, 'cr' => 0], ['acc' => '5101', 'dr' => 0, 'cr' => 500]]]], $A)['ok']);
        $this->assertTrue($this->admin('adminPayin', [['id' => 'PITest1', 'amount' => 300000, 'method' => 'cash', 'acc' => '6201', 'title' => 'اجاره راکت', 'note' => '', 'by' => null, 'name' => 'مشتری']], $A)['ok']);
        $this->assertTrue($this->admin('adminPayinDel', ['PITest1'], $A)['ok']);
        $sid = $this->admin('adminStaff', [['id' => 'hTest9', 'name' => 'نگهبان تست', 'role' => 'security', 'type' => 'full', 'base' => 12000000, 'children' => 1, 'start' => self::day(-100), 'phone' => '09120000099']], $A)['id'];
        $this->assertSame('hTest9', $sid);
        $this->assertTrue($this->admin('adminShift', ['hTest9', 2, 'n'], $A)['ok']);
        $this->assertSame('n', json_decode(DB::table('staff')->where('id', 'hTest9')->value('shifts'), true)[2]);
        $this->assertTrue($this->admin('adminAttend', [self::day(0), 'hTest9', ['in' => 8.5, 'out' => null]], $A)['ok']);
        $this->assertTrue($this->admin('adminAttend', [self::day(0), 'hTest9', ['out' => 16.25]], $A)['ok']);
        $att = DB::table('attendance')->where('staff_id', 'hTest9')->first();
        $this->assertEqualsWithDelta(16.25, (float) $att->out, 0.001);
        $this->assertTrue($this->admin('adminAttend', [self::day(0), 'hTest9', ['in' => null]], $A)['ok']);
        $this->assertFalse(DB::table('attendance')->where('staff_id', 'hTest9')->exists());
        $this->assertTrue($this->admin('adminAdvance', [['id' => 'ATest1', 'staff' => 'hTest9', 'amount' => 1000000, 'pay' => 'cash', 'note' => '']], $A)['ok']);
        $this->assertTrue($this->admin('adminHrCfg', [['housing' => 1000000, 'otRate' => 1.4]], $A)['ok']);
        $mk = '1499-01';
        $this->assertTrue($this->admin('adminPayroll', [$mk, [['staff' => 'hTest9', 'gross' => 1, 'net' => 1]], 'فروردین ۱۴۹۹'], $A)['ok']);
        $this->admin('adminPayroll', [$mk, [['staff' => 'x']], 'دوباره'], $A);
        $this->assertSame(1, DB::table('payrolls')->where('month', $mk)->count(), 'payroll once per month');
        $this->assertTrue($this->admin('adminPayrollPay', [$mk, 'paidAt'], $A)['ok']);
        $this->admin('adminPayrollUndo', [$mk], $A);
        $this->assertTrue(DB::table('payrolls')->where('month', $mk)->exists(), 'paid payroll cannot be undone');
        $as = $this->api('GET', '/state', $A);
        $this->assertArrayHasKey('hTest9', $as['club']['shifts']);
    }

    // ---------- پروفایل، نام کاربری، چالش، نظر، اعلان ----------
    public function test_profile_login_quests_reviews(): void
    {
        [$P, $me] = $this->player('09131000030', 'پروفایلی');
        $this->assertTrue($this->api('POST', '/player/updateProfile', $P, ['gender' => 'f', 'birth' => 1376])['ok']);
        $this->assertSame('bad', $this->api('POST', '/player/updateProfile', $P, ['birth' => 1200])['error']);
        $this->assertSame('bad', $this->api('POST', '/player/setLogin', $P, ['user' => 'ab', 'pass' => '123456'])['error']);
        $this->assertSame('taken', $this->api('POST', '/player/setLogin', $P, ['user' => 'aryan', 'pass' => '123456'])['error']);
        $this->assertSame('taken', $this->api('POST', '/player/setLogin', $P, ['user' => 'admin', 'pass' => '123456'])['error']);
        $this->assertTrue($this->api('POST', '/player/setLogin', $P, ['user' => 'prof.ile', 'pass' => 'abcdef'])['ok']);
        $this->assertTrue($this->api('GET', '/auth/username?u=prof.ile')['taken']);
        $this->assertNotEmpty($this->api('POST', '/auth/password', null, ['username' => 'PROF.ILE', 'password' => 'abcdef'])['token'] ?? null);
        // تغییر نام کاربری بدون رمز تازه، با همان رمز
        $this->assertTrue($this->api('POST', '/player/setLogin', $P, ['user' => 'prof2', 'pass' => ''])['ok']);
        $this->assertNotEmpty($this->api('POST', '/auth/password', null, ['username' => 'prof2', 'password' => 'abcdef'])['token'] ?? null);
        // چالش هفتگی قبل از شرط
        $this->assertSame('notyet', $this->api('POST', '/player/claimQuest', $P, ['id' => 'play2'])['error']);
        $this->fund($me, 10000000);
        [$c, $k, $h] = $this->freeSlot(3);
        $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        [$c, $k, $h] = $this->freeSlot(4);
        $this->api('POST', '/player/book', $P, ['type' => 'open', 'court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'players' => [], 'levels' => ['C'], 'visibility' => 'public', 'method' => 'wallet']);
        $x = (int) DB::table('members')->where('id', $me)->value('xp');
        $q = $this->api('POST', '/player/claimQuest', $P, ['id' => 'play2']);
        $this->assertSame(60, $q['xp'] ?? null, json_encode($q));
        $this->assertSame('done', $this->api('POST', '/player/claimQuest', $P, ['id' => 'play2'])['error']);
        $this->assertSame(40, $this->api('POST', '/player/claimQuest', $P, ['id' => 'social'])['xp'] ?? null, 'social quest 40 xp');
        $this->assertSame($x + 100, (int) DB::table('members')->where('id', $me)->value('xp'));
        // نظر مربی بدون کلاس رد؛ با کلاس قبول و یک‌بار
        $this->assertSame('denied', $this->api('POST', '/player/addReview', $P, ['target' => 'coach:k3', 'stars' => 5, 'text' => 'عالی'])['error']);
        [$c, $k, $h] = $this->freeSlot(6, [7, 8, 9, 10, 11]);
        $cb = $this->api('POST', '/player/book', $P, ['type' => 'coach', 'coach' => 'k3', 'pack' => 'one', 'court' => $c, 'date' => $k, 'start' => $h, 'method' => 'wallet']);
        if (isset($cb['id'])) {
            $rv = $this->api('POST', '/player/addReview', $P, ['target' => 'coach:k3', 'stars' => 4, 'text' => 'خوب بود']);
            $this->assertSame(10, $rv['xp'] ?? null, json_encode($rv));
            $this->assertSame('dup', $this->api('POST', '/player/addReview', $P, ['target' => 'coach:k3', 'stars' => 5, 'text' => ''])['error']);
            $review = DB::table('reviews')->where('target', 'coach:k3')->orderByDesc('created_at')->first();
            $this->assertFalse((bool) $review->ok, 'text waits for approval');
            $this->assertSame('', collect($this->api('GET', '/state', $P)['club']['reviews'])->firstWhere('id', $review->id)['text']);
            $this->admin('adminReview', [$review->id, ['ok' => true]]);
            $this->assertSame('خوب بود', collect($this->api('GET', '/state', $P)['club']['reviews'])->firstWhere('id', $review->id)['text']);
        }
        // اعلان‌ها
        $this->assertTrue($this->api('POST', '/player/readAll', $P)['ok']);
        $this->assertFalse(collect($this->api('GET', '/state', $P)['me']['notifications'])->contains('read', false));
        // XP لغو برمی‌گردد
        $bk = DB::table('bookings')->where('by', $me)->where('type', 'private')->first();
        $before = (int) DB::table('members')->where('id', $me)->value('xp');
        $this->api('POST', '/player/cancelMine', $P, ['id' => $bk->id]);
        $this->assertLessThan($before, (int) DB::table('members')->where('id', $me)->value('xp'));
    }

    // ---------- پرداخت آنلاین برای همه‌ی کارها و همگام‌سازی بخشی ----------
    public function test_online_payment_for_each_action_and_partial_sync(): void
    {
        [$P, $me] = $this->player('09131000040', 'آنلاینی');
        $gift = $this->wallet($me);
        $pay = function (array $r) use ($P) {
            $this->assertNotEmpty($r['pay']['url'] ?? null, json_encode($r));
            $p = DB::table('payments')->where('id', $r['pay']['id'])->first();
            $this->get('/api/pay/callback/'.$p->id.'?Authority='.urlencode($p->authority).'&Status=OK')->assertRedirect();

            return $this->api('GET', '/pay/'.$p->id, $P);
        };
        $t = $pay($this->api('POST', '/player/topUp', $P, ['amount' => 1000000]));
        $this->assertSame('done', $t['status']);
        $this->assertSame($gift + 1000000, $this->wallet($me));
        $this->assertSame('bad', $this->api('POST', '/player/topUp', $P, ['amount' => 50])['error']);
        $m = $pay($this->api('POST', '/player/buyPackage', $P, ['id' => 'gold', 'method' => 'online']));
        $this->assertArrayHasKey('xp', $m['result']);
        $this->assertSame($gift + 1000000, $this->wallet($me), 'gold paid fully by gateway');
        $prod = DB::table('product_variants')->where('stock', '>', 0)->first();
        $o = $pay($this->api('POST', '/player/checkout', $P, ['items' => [['pid' => $prod->product_id, 'size' => $prod->size, 'color' => $prod->color, 'qty' => 1]], 'method' => 'online']));
        $this->assertStringStartsWith('Q-', $o['result']['order']['id'] ?? '', json_encode($o));
        // پرداخت شد ولی زمین وسط پرداخت پر شد → پول در کیف پول می‌ماند
        [$c, $k, $h, $ymd] = $this->freeSlot(7);
        $start = $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'online']);
        $this->admin('adminAddBooking', [['court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'type' => 'block', 'note' => 'تعمیر']]);
        $w = $this->wallet($me);
        $res = $pay($start);
        $this->assertSame('busy', $res['result']['error'] ?? null, json_encode($res));
        $this->assertTrue($res['result']['kept']);
        $paid = (int) DB::table('payments')->where('id', $start['pay']['id'])->value('amount');
        $this->assertSame(1020000, $paid, 'gold 15% off computed by server');
        $this->assertSame($w + $paid, $this->wallet($me), 'money kept in wallet');
        // همگام‌سازی بخشی: فقط بخش‌های تغییرکرده
        $v = $this->api('GET', '/sync', $P)['v'];
        $part = $this->api('GET', '/state?only=bookings&me=1', $P);
        $this->assertArrayHasKey('bookings', $part['club']);
        $this->assertArrayNotHasKey('products', $part['club']);
        $this->assertArrayHasKey('me', $part);
        $none = $this->api('GET', '/state?only=none', $P);
        $this->assertEmpty((array) $none['club']);
        $this->assertArrayNotHasKey('me', $none);
        $this->assertSame($v['bookings'], $part['v']['bookings']);
    }
}
