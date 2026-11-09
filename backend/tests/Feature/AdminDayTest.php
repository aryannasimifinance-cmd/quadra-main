<?php

namespace Tests\Feature;

use App\Domain\Availability;
use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * یک روز کاری کامل مدیر باشگاه با سناریوهای مختلف و بررسی مستقیم دیتابیس بعد از هر کار.
 * در پایان، داده‌ای که پنل مدیر می‌گیرد در storage/app/admin-state.json ذخیره می‌شود تا
 * با همان کدهای حسابداری و داشبورد اپ بررسی شود (frontend/scripts/check-dashboard.mjs).
 */
class AdminDayTest extends TestCase
{
    use ApiHelpers;

    private static bool $seeded = false;

    private string $A;

    protected function setUp(): void
    {
        parent::setUp();
        if (! self::$seeded) {
            Artisan::call('quadra:demo', ['--force' => true]);
            self::$seeded = true;
        }
        Settings::forget();
        $this->A = $this->adminToken();
    }

    private function cmd(string $cmd, array $args): array
    {
        return $this->admin($cmd, $args, $this->A);
    }

    private function audit(string $action, ?string $subject = null): bool
    {
        return DB::table('audit_logs')->where('action', $action)->when($subject, fn ($q) => $q->where('subject', $subject))->exists();
    }

    public function test_a_front_desk_day(): void
    {
        // ۱) عضو تازه در پذیرش، شماره‌ی تکراری رد
        $m = $this->cmd('adminMember', [['id' => 'mDesk1', 'name' => 'رضا پذیرشی', 'phone' => '09125550001', 'level' => 'B', 'side' => 'right', 'gender' => 'm', 'birth' => 1368, 'member' => 'gold', 'note' => 'مشتری ثابت']]);
        $this->assertSame('mDesk1', $m['id']);
        $row = DB::table('members')->where('id', 'mDesk1')->first();
        $this->assertSame(['desk', 'gold', 'B', '09125550001'], [$row->source, $row->vip, $row->level, $row->phone]);
        $this->assertSame('phone_taken', $this->cmd('adminMember', [['name' => 'تکراری', 'phone' => '09125550001']])['error']);
        $this->assertTrue($this->audit('member.create', 'mDesk1'));
        // همان شماره بعداً در اپ وارد می‌شود و همان پرونده است
        [$P, $pid] = $this->player('09125550001');
        $this->assertSame('mDesk1', $pid);

        // ۲) رزرو پذیرش بدون پرداخت → تسویه با کارت → در دفتر تسویه‌ها
        [$c, $k, $h, $ymd] = $this->freeSlot(2, [10, 11, 12]);
        $b = $this->cmd('adminAddBooking', [['id' => 'dDesk1', 'court' => $c, 'date' => $k, 'start' => $h, 'dur' => 2, 'type' => 'private', 'by' => 'mDesk1', 'price' => 2400000, 'paid' => 0, 'note' => 'تلفنی']]);
        $this->assertSame('dDesk1', $b['id'], json_encode($b));
        $this->assertSame([2400000, 0, 'desk'], [(int) DB::table('bookings')->where('id', 'dDesk1')->value('price'), (int) DB::table('bookings')->where('id', 'dDesk1')->value('paid'), DB::table('bookings')->where('id', 'dDesk1')->value('source')]);
        $this->assertTrue($this->cmd('adminSettle', ['dDesk1', 'card'])['ok']);
        $this->assertSame(2400000, (int) DB::table('bookings')->where('id', 'dDesk1')->value('paid'));
        $this->assertSame(['card', 2400000], [DB::table('booking_payments')->where('booking_id', 'dDesk1')->value('method'), (int) DB::table('booking_payments')->where('booking_id', 'dDesk1')->value('amount')]);
        $this->assertTrue($this->cmd('adminSettle', ['dDesk1', 'cash'])['ok']);
        $this->assertSame(1, DB::table('booking_payments')->where('booking_id', 'dDesk1')->count(), 'settle twice = no double payment');
        // دیده شدن رزرو پذیرش در اپ همان عضو
        $this->assertNotNull(collect($this->api('GET', '/state', $P)['club']['bookings'])->firstWhere('id', 'dDesk1'));

        // ۳) انتقال به زمین دیگر؛ به زمین پر نمی‌رود
        $other = collect([1, 2, 3, 4])->first(fn ($x) => $x !== $c && Availability::isFree($ymd, $x, $h, 2));
        if ($other) {
            $this->assertTrue($this->cmd('adminMove', ['dDesk1', ['court' => $other]])['ok']);
            $this->assertSame($other, (int) DB::table('bookings')->where('id', 'dDesk1')->value('court'));
            $this->assertTrue(Availability::isFree($ymd, $c, $h, 2), 'old court freed');
        }
        $busyCourt = collect([1, 2, 3, 4])->first(fn ($x) => ! Availability::isFree($ymd, $x, $h, 2, 'dDesk1') && $x !== ($other ?: $c));
        if ($busyCourt) {
            $this->assertSame('busy', $this->cmd('adminMove', ['dDesk1', ['court' => $busyCourt]])['error']);
        }

        // ۴) لغو بدون استرداد = جریمه (پول می‌ماند)، با استرداد = پول برمی‌گردد
        $this->assertTrue($this->cmd('adminCancel', ['dDesk1', false])['ok']);
        $x = DB::table('bookings')->where('id', 'dDesk1')->first();
        $this->assertSame(['cancelled', 0], [$x->status, (int) $x->refunded]);

        // ۵) تعمیرات: زمین بسته‌شده برای همه پر است
        [$c2, $k2, $h2, $y2] = $this->freeSlot(3, [8, 9]);
        $this->assertTrue($this->cmd('adminAddBooking', [['court' => $c2, 'date' => $k2, 'start' => $h2, 'dur' => 3, 'type' => 'block', 'note' => 'تعویض چمن']])['ok']);
        $this->assertFalse(Availability::isFree($y2, $c2, $h2 + 1, 1));
        $this->assertSame('busy', $this->api('POST', '/player/book', $P, ['type' => 'private', 'court' => $c2, 'date' => $k2, 'start' => $h2 + 1, 'dur' => 1, 'players' => [], 'method' => 'wallet'])['error']);
        // خاموش کردن کامل یک زمین
        $this->assertTrue($this->cmd('adminCourt', [4, true])['ok']);
        $this->assertFalse(Availability::isFree(now()->addDays(10)->format('Y-m-d'), 4, 12, 1));
        $this->assertTrue((bool) $this->api('GET', '/state', $P)['club']['off']['4']);
        $this->cmd('adminCourt', [4, false]);

        // ۶) ساعت کاری: بیرون از ساعت رزرو نمی‌شود (پذیرش هم)
        $this->assertTrue($this->cmd('adminHours', [['open' => 8, 'close' => 22]])['ok']);
        $this->assertSame('busy', $this->cmd('adminAddBooking', [['court' => 1, 'date' => self::day(12), 'start' => 7, 'dur' => 1, 'type' => 'private', 'by' => 'mDesk1', 'price' => 0, 'paid' => 0]])['error']);
        $this->assertSame('busy', $this->cmd('adminAddBooking', [['court' => 1, 'date' => self::day(12), 'start' => 21.5, 'dur' => 1, 'type' => 'private', 'by' => 'mDesk1', 'price' => 0, 'paid' => 0]])['error']);
        $this->assertSame('bad', $this->cmd('adminHours', [['open' => 20, 'close' => 21]])['error']);
        $this->cmd('adminHours', [['open' => 7, 'close' => 24]]);

        // ۷) نرخ‌ها: قیمت تازه فقط برای رزروهای بعدی
        $oldPrice = (int) DB::table('bookings')->where('status', 'ok')->where('date', '>', now()->format('Y-m-d'))->where('source', 'app')->value('price');
        $this->cmd('adminPricing', [['offpeak' => 1500000, 'peak' => 1800000, 'peakFrom' => 18]]);
        $this->assertSame(['offpeak' => 1500000, 'peak' => 1800000, 'peakFrom' => 18], Settings::pricing());
        $this->assertSame($oldPrice, (int) DB::table('bookings')->where('status', 'ok')->where('date', '>', now()->format('Y-m-d'))->where('source', 'app')->value('price'), 'existing bookings unchanged');
        $this->cmd('adminPricing', [['offpeak' => 1200000, 'peak' => 1200000, 'peakFrom' => 17]]);

        // ۸) پرداخت از کیف پول در پذیرش؛ موجودی کافی نیست = رد
        $this->assertSame('wallet', $this->cmd('adminAddBooking', [['court' => 1, 'date' => self::day(14), 'start' => 23, 'dur' => 1, 'type' => 'private', 'by' => 'mDesk1', 'price' => 1200000, 'paid' => 1200000, 'method' => 'wallet']])['error']);
        $this->fund('mDesk1', 2000000);
        [$c3, $k3, $h3] = $this->freeSlot(14, [23, 22]);
        $this->assertTrue($this->cmd('adminAddBooking', [['id' => 'dDesk2', 'court' => $c3, 'date' => $k3, 'start' => $h3, 'dur' => 1, 'type' => 'private', 'by' => 'mDesk1', 'price' => 1200000, 'paid' => 1200000, 'method' => 'wallet']])['ok']);
        $this->assertSame(800000, $this->wallet('mDesk1'));
        $this->assertTrue($this->cmd('adminCancel', ['dDesk2', true])['ok']);
        $this->assertSame(2000000, $this->wallet('mDesk1'), 'wallet paid desk booking refunded to wallet');
        // پرداخت بیش از مبلغ رد می‌شود
        $this->assertSame('bad', $this->cmd('adminAddBooking', [['court' => 1, 'date' => self::day(15), 'start' => 23, 'dur' => 1, 'type' => 'private', 'by' => 'mDesk1', 'price' => 100, 'paid' => 500, 'method' => 'cash']])['error']);

        // ۹) ویرایش و غیرفعال کردن عضو
        $this->assertTrue($this->cmd('adminMemberEdit', ['mDesk1', ['level' => 'A', 'inactive' => true]])['ok']);
        $this->assertSame(['A', 1], [DB::table('members')->where('id', 'mDesk1')->value('level'), (int) DB::table('members')->where('id', 'mDesk1')->value('inactive')]);
        $this->assertTrue((bool) collect($this->api('GET', '/state', $P)['club']['members'])->firstWhere('id', 'mDesk1')['inactive']);
        $this->cmd('adminMemberEdit', ['mDesk1', ['inactive' => false]]);
        $this->assertSame('phone_taken', $this->cmd('adminMemberEdit', ['mDesk1', ['phone' => DB::table('members')->where('id', 'm-me')->value('phone')]])['error']);
    }

    public function test_b_coaches_reviews_and_events(): void
    {
        // مربی تازه با عکس آپلودی (data URL ← فایل)
        $png = 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('brand/quadra-logo-transparent.png')));
        $co = $this->cmd('adminCoachSave', [['id' => 'kNew1', 'name' => 'مربی تازه', 'title' => 'مربی پایه', 'level' => 'B', 'exp' => 3, 'price' => 1500000, 'img' => $png, 'bio' => 'معرفی', 'record' => ['سابقه'], 'packs' => ['one' => true, 'five' => true, 'ten' => false, 'group' => true], 'prices' => ['five' => 6500000], 'phone' => '09125550002', 'share' => 55]]);
        $this->assertSame('kNew1', $co['id'], json_encode($co));
        $img = DB::table('coaches')->where('id', 'kNew1')->value('img');
        $this->assertStringStartsWith('./uploads/', $img);
        $this->assertFileExists(public_path(substr($img, 2)));
        $this->assertSame(6500000, \App\Domain\Pricing::coachPack(DB::table('coaches')->where('id', 'kNew1')->first(), 'five'));
        $this->assertFalse(\App\Domain\Pricing::coachPackOn(DB::table('coaches')->where('id', 'kNew1')->first(), 'ten'));
        $this->assertSame('image', $this->cmd('adminCoachSave', [['id' => 'kNew1', 'img' => 'data:image/png;base64,AAAA']])['error']);
        // بازیکن مشخصات خصوصی مربی را نمی‌بیند
        [$P] = $this->player('09120000000');
        $pc = collect($this->api('GET', '/state', $P)['club']['coaches'])->firstWhere('id', 'kNew1');
        $this->assertArrayNotHasKey('phone', $pc);
        $this->assertArrayNotHasKey('share', $pc);
        // دسترسی مربی و ورود
        $this->assertSame('weak', $this->cmd('adminCoachLogin', ['kNew1', ['on' => true, 'user' => 'newcoach', 'pass' => '123', 'day' => 4, 'week' => 10]])['error']);
        $this->assertSame('taken', $this->cmd('adminCoachLogin', ['kNew1', ['on' => true, 'user' => 'aryan', 'pass' => '123456', 'day' => 4, 'week' => 10]])['error']);
        $this->assertTrue($this->cmd('adminCoachLogin', ['kNew1', ['on' => true, 'user' => 'newcoach', 'pass' => '123456', 'day' => 4, 'week' => 10]])['ok']);
        $this->assertNotSame('123456', DB::table('coaches')->where('id', 'kNew1')->value('password'), 'password hashed');
        $this->assertNotEmpty($this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'newcoach', 'password' => '123456'])['token'] ?? null);

        // تأیید نظرها
        $rv = DB::table('reviews')->first();
        $this->assertTrue($this->cmd('adminReview', [$rv->id, ['ok' => false, 'hidden' => true]])['ok']);
        $this->assertSame([0, 1], [(int) DB::table('reviews')->where('id', $rv->id)->value('ok'), (int) DB::table('reviews')->where('id', $rv->id)->value('hidden')]);

        // آدینه از تقویم: زمین‌های پر را نمی‌گیرد ولی در تقویم بسته می‌شود
        $date = self::day(33);
        $ev = $this->cmd('adminEventSave', [['id' => 'evDay1', 'kind' => 'friday', 'title' => 'آدینه‌ی تست مدیر', 'desc' => 'تیم دونفره', 'format' => 'groups', 'date' => $date, 'start' => 9, 'dur' => 3, 'courts' => [1, 2, 3], 'levels' => ['B', 'C'], 'cap' => 8, 'fee' => 600000, 'prize' => 'راکت', 'status' => 'draft', 'note' => '', 'showResults' => true]]);
        $this->assertSame('evDay1', $ev['id']);
        $this->assertTrue(Availability::isFree(now()->addDays(33)->format('Y-m-d'), 1, 10, 1), 'draft does not block');
        $this->cmd('adminEventSave', [['id' => 'evDay1', 'status' => 'open']]);
        $this->assertFalse(Availability::isFree(now()->addDays(33)->format('Y-m-d'), 1, 10, 1), 'open event blocks its courts');
        $this->assertTrue(Availability::isFree(now()->addDays(33)->format('Y-m-d'), 4, 10, 1), 'other court stays free');
        $this->assertSame(true, json_decode(DB::table('events')->where('id', 'evDay1')->value('extra'), true)['showResults']);
        // مسابقه‌ی دوم هم‌زمان روی زمین مشترک رد می‌شود؛ روی زمین دیگر قبول
        $clash = $this->cmd('adminEventSave', [['id' => 'evDay2', 'kind' => 'official', 'title' => 'هم‌زمان', 'date' => $date, 'start' => 10, 'dur' => 2, 'courts' => [3, 4], 'levels' => [], 'cap' => 8, 'fee' => 0, 'status' => 'open']]);
        $this->assertSame('event_clash', $clash['error'] ?? null, json_encode($clash));
        $this->assertFalse(DB::table('events')->where('id', 'evDay2')->exists(), 'rolled back');
        $this->assertTrue($this->cmd('adminEventSave', [['id' => 'evDay3', 'kind' => 'official', 'title' => 'زمین ۴', 'date' => $date, 'start' => 10, 'dur' => 2, 'courts' => [4], 'levels' => [], 'cap' => 8, 'fee' => 0, 'status' => 'open']])['ok']);
        $this->assertSame('event_clash', $this->cmd('adminEventSave', [['id' => 'evDay3', 'courts' => [3, 4]]])['error'] ?? null, 'editing into a clash rejected');
        $this->assertSame([4], json_decode(DB::table('events')->where('id', 'evDay3')->value('courts'), true));
        $this->cmd('adminEventSave', [['id' => 'evDay3', 'status' => 'cancelled']]);
        // ثبت‌نام حضوری رایگان و پولی
        $this->assertTrue($this->cmd('adminEventReg', ['evDay1', ['by' => 'm0', 'name' => 'x', 'level' => 'B'], 'free', 600000, ['by' => 'm1', 'name' => 'y', 'level' => 'C']])['ok']);
        $this->assertSame(0, (int) DB::table('event_registrations')->where('event_id', 'evDay1')->sum('paid'));
        $this->assertSame(0, DB::table('sales')->where('item', 'evDay1')->count(), 'free reg = no sale');
        $this->assertTrue($this->cmd('adminEventReg', ['evDay1', ['by' => 'm2', 'name' => 'z', 'level' => 'B'], 'cash', 600000, null])['ok']);
        $this->assertSame(600000, (int) DB::table('sales')->where('item', 'evDay1')->sum('price'));
        $this->assertSame('dup', $this->cmd('adminEventReg', ['evDay1', ['by' => 'm2', 'name' => 'z'], 'cash', 600000, null])['error']);
        // لغو مسابقه: زمین‌ها آزاد، فروش حضوری نقدی برگشت‌خورده علامت می‌خورد
        $this->cmd('adminEventSave', [['id' => 'evDay1', 'status' => 'cancelled']]);
        $this->assertTrue(Availability::isFree(now()->addDays(33)->format('Y-m-d'), 1, 10, 1));
        $this->assertNotNull(DB::table('sales')->where('item', 'evDay1')->value('refunded_at'));
        $this->assertTrue($this->audit('event.save', 'evDay1'));
    }

    public function test_c_stock_cafe_accounting_and_hr(): void
    {
        // فروشگاه: ورود نسیه، پرداخت به تأمین‌کننده، فروش حضوری با مشتری عضو
        $p = DB::table('products')->where('code', 'like', '14%')->first();
        $sku = DB::table('product_variants')->where('product_id', $p->id)->value('sku');
        $st0 = (int) DB::table('product_variants')->where('sku', $sku)->value('stock');
        $this->assertTrue($this->cmd('adminReceive', [['date' => self::day(0), 'supplier' => 'پخش آریا', 'invoice' => 'F-9', 'pay' => 'payable', 'items' => [['pid' => $p->id, 'sku' => $sku, 'qty' => 24, 'cost' => 400000]]]])['ok']);
        $this->assertSame($st0 + 24, (int) DB::table('product_variants')->where('sku', $sku)->value('stock'));
        $rec = DB::table('stock_receipts')->orderByDesc('at')->first();
        $this->assertSame([9600000, 'payable'], [(int) $rec->total, $rec->pay]);
        $this->assertStringStartsWith('R-', $rec->id);
        $pos = $this->cmd('adminPos', [[['pid' => $p->id, 'sku' => $sku, 'qty' => 2]], 'cash', 'm3']);
        $this->assertSame('m3', DB::table('shop_orders')->where('id', $pos['id'])->value('by'));
        $this->assertSame($st0 + 22, (int) DB::table('product_variants')->where('sku', $sku)->value('stock'));
        $this->assertTrue($this->cmd('adminApPay', [['supplier' => 'پخش آریا', 'amount' => 9600000, 'pay' => 'bank']])['ok']);
        $this->assertTrue($this->cmd('adminOrder', [$pos['id'], 'ready'])['ok']);

        // کافه: سفارش حضوری سر زمین → صف → آماده → تحویل
        $o = $this->cmd('adminCafePos', [[['iid' => 'water', 'qty' => 2], ['iid' => 'cola', 'qty' => 1]], 'card', 'm4', 3, false]);
        $this->assertStringStartsWith('K-', $o['id'] ?? '', json_encode($o));
        $ord = DB::table('cafe_orders')->where('id', $o['id'])->first();
        $this->assertSame(['prep', 3, 'desk', 2 * 25000 + 45000], [$ord->status, (int) $ord->to, $ord->source, (int) $ord->total]);
        foreach (['ready', 'delivered'] as $s) {
            $this->cmd('adminCafeOrder', [$o['id'], $s]);
        }
        $this->assertSame('delivered', DB::table('cafe_orders')->where('id', $o['id'])->value('status'));
        $instant = $this->cmd('adminCafePos', [[['iid' => 'water', 'qty' => 1]], 'cash', null, null, true]);
        $this->assertSame(['delivered', 'walkin'], [DB::table('cafe_orders')->where('id', $instant['id'])->value('status'), DB::table('cafe_orders')->where('id', $instant['id'])->value('by')]);
        // شماره‌ی سفارش‌ها پشت سر هم و بی‌تکرار
        $this->assertSame((int) substr($o['id'], 2) + 1, (int) substr($instant['id'], 2));

        // حسابداری: هزینه، دریافت دستی، سند دستی
        $this->assertTrue($this->cmd('adminExpense', [['date' => self::day(0), 'acc' => '8106', 'amount' => 5000000, 'title' => 'تعمیر توری', 'vendor' => 'تأسیسات مهر', 'pay' => 'payable', 'invoice' => 'M-1']])['ok']);
        $this->assertTrue(DB::table('suppliers')->where('name', 'تأسیسات مهر')->exists(), 'payable vendor becomes supplier');
        $this->assertTrue($this->cmd('adminPayin', [['amount' => 450000, 'method' => 'card', 'acc' => '6201', 'title' => 'اجاره‌ی راکت', 'note' => '', 'by' => 'm5', 'name' => null]])['ok']);
        $this->assertTrue($this->cmd('adminJournal', [['date' => self::day(0), 'title' => 'اصلاح صندوق', 'lines' => [['acc' => '1101', 'dr' => 0, 'cr' => 100000], ['acc' => '8199', 'dr' => 100000, 'cr' => 0, 'desc' => 'کسری صندوق']]]])['ok']);

        // پرسنل: شیفت، حضور، مرخصی، مساعده، حقوق، تنظیمات قانون کار
        $sid = 'h1';
        $this->cmd('adminShift', [$sid, 0, 'e']);
        $this->cmd('adminAttend', [self::day(0), $sid, ['in' => 15.0, 'out' => 23.5]]);
        $this->assertSame('15.000', DB::table('attendance')->where('staff_id', $sid)->where('date', now()->format('Y-m-d'))->value('in'));
        $this->cmd('adminLeave', [['id' => 'LDay1', 'staff' => $sid, 'kind' => 'sick', 'from' => self::day(5), 'to' => self::day(5), 'days' => 1, 'note' => 'گواهی']]);
        $this->cmd('adminLeaveStatus', ['LDay1', 'ok']);
        $this->assertSame('ok', DB::table('leaves')->where('id', 'LDay1')->value('status'));
        $this->assertSame('bad', $this->cmd('adminLeave', [['staff' => $sid, 'kind' => 'annual', 'from' => self::day(9), 'to' => self::day(7), 'days' => 1]])['error'], 'to before from');
        $this->cmd('adminAdvance', [['staff' => $sid, 'amount' => 2000000, 'pay' => 'bank', 'note' => '']]);
        $this->assertSame('bad', $this->cmd('adminHrCfg', [['emp' => 5]])['error']);
        $this->assertTrue($this->cmd('adminHrCfg', [['housing' => 950000]])['ok']);
        $this->assertSame(950000, Settings::hr()['housing']);

        // هیچ داده‌ی بدون صاحب یا ناسازگار در دیتابیس
        $this->assertDatabaseIntegrity();

        // داده‌ی پنل مدیر برای بررسی با کدهای داشبورد
        $state = $this->api('GET', '/state', $this->A);
        file_put_contents(storage_path('app/admin-state.json'), json_encode($state, JSON_UNESCAPED_UNICODE));
        $this->assertGreaterThan(100000, filesize(storage_path('app/admin-state.json')));
    }

    private function assertDatabaseIntegrity(): void
    {
        $q = fn ($sql) => (int) DB::selectOne($sql)->n;
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM booking_players p LEFT JOIN bookings b ON b.id = p.booking_id WHERE b.id IS NULL'), 'orphan players');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM booking_players p LEFT JOIN members m ON m.id = p.member_id WHERE p.member_id IS NOT NULL AND m.id IS NULL'), 'players pointing to missing members');
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM bookings b LEFT JOIN coaches c ON c.id = b.coach WHERE b.coach IS NOT NULL AND c.id IS NULL"), 'bookings with missing coach');
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM bookings WHERE type = 'coach' AND coach IS NULL"), 'coach booking without coach');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM bookings WHERE paid > price + 5 AND status = \'ok\''), 'overpaid bookings');
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM bookings WHERE dur <= 0 OR start < 0 OR start + dur > 24"), 'bad times');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM event_registrations r LEFT JOIN events e ON e.id = r.event_id WHERE e.id IS NULL'), 'orphan regs');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM product_variants v LEFT JOIN products p ON p.id = v.product_id WHERE p.id IS NULL'), 'orphan variants');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM members WHERE wallet < 0'), 'negative wallet');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM product_variants WHERE stock < 0'), 'negative stock');
        $this->assertSame(0, $q('SELECT COUNT(*) n FROM cafe_ingredients WHERE stock < 0'), 'negative cafe stock');
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM sales s WHERE s.series IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.series = s.series)"), 'series sale without sessions');
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM attendance a LEFT JOIN staff s ON s.id = a.staff_id WHERE s.id IS NULL"), 'orphan attendance');
        // هم‌پوشانی رزروهای فعال آینده روی یک زمین
        $this->assertSame(0, $q("SELECT COUNT(*) n FROM bookings a JOIN bookings b ON a.court = b.court AND a.date = b.date AND a.id < b.id AND a.status = 'ok' AND b.status = 'ok'
            AND a.start < b.start + b.dur AND b.start < a.start + a.dur WHERE a.date >= CURDATE() AND a.source <> 'import' AND a.id NOT LIKE 'b%-%'"), 'overlapping new bookings');
        // دفتر کیف پول
        $this->assertWalletLedgerConsistent();
        // هر سند دستی تراز است
        foreach (DB::table('journals')->get() as $j) {
            $l = json_decode($j->lines, true);
            $this->assertSame(array_sum(array_column($l, 'dr')), array_sum(array_column($l, 'cr')), "journal {$j->id} balanced");
        }
        // لاگ کارهای حساس
        $this->assertGreaterThan(10, DB::table('audit_logs')->where('actor', 'like', 'admin:%')->count());
    }
}
