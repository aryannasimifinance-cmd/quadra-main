<?php

namespace Tests\Feature;

use App\Domain\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * تقویم بازیکن: رزرو بازیکن بدون تأیید مدیر است؛ هر ساعتی که به هر دلیل پر شده
 * (رزرو دستی مدیر، تعمیرات، آدینه، کلاس مربی، رزرو بازیکن دیگر) برای بقیه‌ی بازیکن‌ها پر دیده می‌شود
 * و رزرو آن رد می‌شود. تأیید مدیر فقط برای درخواست زمینِ مربی‌هاست.
 */
class CalendarVisibilityTest extends TestCase
{
    use ApiHelpers;

    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('quadra:demo', ['--force' => true]);
        Settings::forget();
    }

    /** آیا این ساعت در تقویمی که بازیکن از سرور می‌گیرد پر است؟ (همان isFree اپ) */
    private function looksBusy(array $state, string $date, int $court, float $h): bool
    {
        return collect($state['club']['bookings'])->contains(fn ($b) => $b['date'] === $date && $b['court'] === $court && $b['status'] !== 'cancelled' && $h < $b['start'] + $b['dur'] && $b['start'] < $h + 1)
            || ! empty($state['club']['off'][(string) $court]);
    }

    public function test_every_kind_of_occupied_slot_is_busy_for_other_players(): void
    {
        $A = $this->adminToken();
        [$P1, $p1] = $this->player('09151000001', 'بازیکن اول');
        [$P2, $p2] = $this->player('09151000002', 'بازیکن دوم');
        $this->fund($p1, 20000000);
        $this->fund($p2, 20000000);

        // ۱) بازیکن مستقیم رزرو می‌کند؛ هیچ تأیید مدیری لازم نیست و همان لحظه قطعی است
        [$c1, $k1, $h1] = $this->freeSlot(30);
        $r = $this->api('POST', '/player/book', $P1, ['type' => 'private', 'court' => $c1, 'date' => $k1, 'start' => $h1, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        $this->assertArrayHasKey('id', $r, json_encode($r));
        $this->assertSame('ok', DB::table('bookings')->where('id', $r['id'])->value('status'), 'confirmed immediately');
        $this->assertSame(0, DB::table('coach_requests')->where('status', 'pending')->where('date', DB::table('bookings')->where('id', $r['id'])->value('date'))->where('court', $c1)->count());

        // ۲) رزرو دستی مدیر  ۳) تعمیرات  ۴) کلاس مربی (تأییدشده)
        [$c2, $k2, $h2] = $this->freeSlot(31);
        $this->admin('adminAddBooking', [['court' => $c2, 'date' => $k2, 'start' => $h2, 'dur' => 1, 'type' => 'private', 'by' => 'm5', 'price' => 1200000, 'paid' => 0]], $A);
        [$c3, $k3, $h3] = $this->freeSlot(32);
        $this->admin('adminAddBooking', [['court' => $c3, 'date' => $k3, 'start' => $h3, 'dur' => 2, 'type' => 'block', 'note' => 'تعمیر']], $A);
        [$c4, $k4, $h4] = $this->freeSlot(33);
        $this->admin('adminAddBooking', [['court' => $c4, 'date' => $k4, 'start' => $h4, 'dur' => 1, 'type' => 'coach', 'coach' => 'k2', 'by' => 'm6', 'price' => 1900000, 'paid' => 0]], $A);
        // ۵) آدینه روی دو زمین
        $off = collect(range(34, 90))->first(fn ($d) => ! DB::table('events')->where('date', now()->addDays($d)->format('Y-m-d'))->exists());
        $ek = self::day($off);
        $this->admin('adminEventSave', [['id' => 'evCal', 'kind' => 'friday', 'title' => 'آدینه', 'date' => $ek, 'start' => 9, 'dur' => 3, 'courts' => [1, 2], 'levels' => [], 'cap' => 8, 'fee' => 0, 'status' => 'open']], $A);
        // ۶) زمین خاموش
        $this->admin('adminCourt', [3, true], $A);

        $s2 = $this->api('GET', '/state', $P2);
        $cases = [
            'رزرو بازیکن دیگر' => [$k1, $c1, $h1],
            'رزرو دستی مدیر' => [$k2, $c2, $h2],
            'تعمیرات (ساعت اول)' => [$k3, $c3, $h3],
            'تعمیرات (ساعت دوم)' => [$k3, $c3, $h3 + 1],
            'کلاس مربی' => [$k4, $c4, $h4],
            'آدینه زمین ۱' => [$ek, 1, 10],
            'آدینه زمین ۲' => [$ek, 2, 11],
            'زمین خاموش' => [self::day(40), 3, 12],
        ];
        foreach ($cases as $name => [$date, $court, $h]) {
            if ($name !== 'زمین خاموش' && $court === 3) {
                continue; // زمین ۳ خاموش است و جداگانه بررسی می‌شود
            }
            $this->assertTrue($this->looksBusy($s2, $date, $court, $h), "تقویم بازیکن دوم: «{$name}» باید پر دیده شود");
            $try = $this->api('POST', '/player/book', $P2, ['type' => 'private', 'court' => $court, 'date' => $date, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
            $this->assertSame('busy', $try['error'] ?? null, "رزرو «{$name}» باید رد شود: ".json_encode($try));
        }
        // آدینه فقط زمین‌های خودش را می‌بندد؛ زمین ۴ همان ساعت آزاد و قابل رزرو است
        $this->assertFalse($this->looksBusy($s2, $ek, 4, 10));
        $ok = $this->api('POST', '/player/book', $P2, ['type' => 'private', 'court' => 4, 'date' => $ek, 'start' => 10, 'dur' => 1, 'players' => [], 'method' => 'wallet']);
        $this->assertArrayHasKey('id', $ok, json_encode($ok));
        // بازیکن دوم اطلاعات خصوصی رزروهای دیگران را نمی‌بیند (فقط پر بودن)
        $other = collect($s2['club']['bookings'])->firstWhere('id', $r['id']);
        $this->assertNull($other['by']);
        $this->assertSame([], $other['players']);
        $this->assertSame(0, $other['price']);

        // لغو = همان لحظه برای بقیه آزاد می‌شود
        $this->admin('adminCourt', [3, false], $A);
        $this->api('POST', '/player/cancelMine', $P1, ['id' => $r['id']]);
        $s2 = $this->api('GET', '/state', $P2);
        $this->assertFalse($this->looksBusy($s2, $k1, $c1, $h1), 'cancelled slot is free again');
        $this->assertArrayHasKey('id', $this->api('POST', '/player/book', $P2, ['type' => 'private', 'court' => $c1, 'date' => $k1, 'start' => $h1, 'dur' => 1, 'players' => [], 'method' => 'wallet']));

        // تأیید مدیر فقط برای مربی: درخواست مربی تا تأیید، رزرو قطعی نیست
        $C = $this->api('POST', '/auth/staff', null, ['role' => 'coach', 'username' => 'faraz', 'password' => '123456'])['token'];
        foreach (DB::table('coach_requests')->where('status', 'pending')->pluck('id') as $id) {
            $this->admin('adminCoachReq', [$id, false], $A);
        }
        [$c5, $k5, $h5, $y5] = $this->freeSlot(45, [8, 9, 10]);
        $req = $this->api('POST', '/coach/coachReq', $C, ['date' => $k5, 'court' => $c5, 'start' => $h5, 'dur' => 1]);
        if (($req['error'] ?? null) !== 'open') {
            $this->assertTrue($req['ok'] ?? false, json_encode($req));
            $this->assertSame(0, DB::table('bookings')->where('date', $y5)->where('court', $c5)->where('start', $h5)->where('status', 'ok')->count(), 'coach request is not a booking until approved');
            $id = DB::table('coach_requests')->where('status', 'pending')->where('date', $y5)->value('id');
            $this->admin('adminCoachReq', [$id, true], $A);
            $this->assertTrue($this->looksBusy($this->api('GET', '/state', $P2), $k5, $c5, $h5), 'approved coach hour is busy for players');
        }
    }
}
