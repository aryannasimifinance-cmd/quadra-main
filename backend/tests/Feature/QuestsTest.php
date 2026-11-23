<?php

namespace Tests\Feature;

use App\Domain\Quests;
use App\Domain\Settings;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** چالش‌ها و امتیاز: تعریف چالش توسط مدیر، بازه‌ی هفته/ماه/یک‌بار، جایزه‌ی تکراری */
class QuestsTest extends TestCase
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
        $this->travelBack();
        parent::tearDown();
    }

    private function xp(string $me): int
    {
        return (int) DB::table('members')->where('id', $me)->value('xp');
    }

    private function quest(array $over = []): array
    {
        return $over + ['icon' => '🎯', 'name' => 'چالش تست', 'desc' => 'توضیح', 'metric' => 'play', 'goal' => 1, 'xp' => 120, 'period' => 'week', 'active' => true];
    }

    public function test_month_start_is_jalali(): void
    {
        // ۲ آذر ۱۴۰۵ ← اول آذر = ۲۲ نوامبر ۲۰۲۶
        $this->assertSame('2026-11-22', Quests::monthStart(Carbon::parse('2026-11-23 10:00')));
        $this->assertSame('2026-11-22', Quests::monthStart(Carbon::parse('2026-11-22 00:30')));
        $this->assertSame('2026-10-23', Quests::monthStart(Carbon::parse('2026-11-21 23:00')));
    }

    public function test_admin_validates_and_saves_challenges(): void
    {
        $A = $this->adminToken();
        foreach ([
            ['x', $this->quest()], [['a'], $this->quest()], ['q-ok', 'str'], ['q-ok', []],
            ['q-ok', $this->quest(['metric' => 'nope'])], ['q-ok', $this->quest(['period' => 'day'])],
            ['q-ok', $this->quest(['goal' => 0])], ['q-ok', $this->quest(['goal' => 1.5])], ['q-ok', $this->quest(['xp' => 4])],
            ['q-ok', $this->quest(['xp' => 1001])], ['q-ok', $this->quest(['name' => str_repeat('ب', 41)])], ['q-ok', $this->quest(['icon' => ''])],
            ['q-ok', $this->quest(['name' => ['x']])], [str_repeat('a', 21), $this->quest()],
        ] as $args) {
            $this->assertSame('bad', $this->admin('adminQuest', $args, $A)['error'] ?? null, json_encode($args, JSON_UNESCAPED_UNICODE));
        }
        $this->assertTrue($this->admin('adminQuest', ['q-ok', $this->quest(['name' => 'سه بازی ماه', 'goal' => 3, 'period' => 'month'])], $A)['ok']);
        // ویرایش، جای چالش را در فهرست عوض نمی‌کند
        $this->assertTrue($this->admin('adminQuest', ['q-ok', $this->quest(['name' => 'سه بازی این ماه', 'goal' => 3, 'period' => 'month'])], $A)['ok']);
        $ids = array_column(Quests::all(), 'id');
        $this->assertSame(['play2', 'social', 'coach', 'q-ok'], $ids);
        $this->assertSame('سه بازی این ماه', Quests::find('q-ok')['name']);

        // بازیکن هم تعریف‌ها را می‌گیرد
        [$P] = $this->player('09151000001', 'چالشی');
        $st = $this->api('GET', '/state', $P);
        $this->assertContains('q-ok', array_column($st['club']['quests'], 'id'));

        // سقف ۳۰ چالش
        for ($i = count($ids); $i < Quests::MAX; $i++) {
            $this->assertTrue($this->admin('adminQuest', ['fill'.$i, $this->quest()], $A)['ok']);
        }
        $this->assertSame('full', $this->admin('adminQuest', ['onemore', $this->quest()], $A)['error'] ?? null);
        for ($i = count($ids); $i < Quests::MAX; $i++) {
            $this->assertTrue($this->admin('adminQuest', ['fill'.$i, null], $A)['ok']);
        }
        $this->assertTrue($this->admin('adminQuest', ['q-ok', null], $A)['ok']);
        $this->assertSame(['play2', 'social', 'coach'], array_column(Quests::all(), 'id'));
    }

    public function test_claim_custom_challenge_with_periods(): void
    {
        $A = $this->adminToken();
        [$P, $me] = $this->player('09151000002', 'ماهانه');
        $this->fund($me, 20000000);
        // ماهانه: سه بازی، ۱۲۰ XP
        $this->assertTrue($this->admin('adminQuest', ['qmonth3', $this->quest(['metric' => 'play', 'goal' => 3, 'xp' => 120, 'period' => 'month'])], $A)['ok']);
        // یک‌باره: یک بازی باز
        $this->assertTrue($this->admin('adminQuest', ['qonce', $this->quest(['metric' => 'open', 'goal' => 1, 'xp' => 50, 'period' => 'once'])], $A)['ok']);
        // غیرفعال
        $this->assertTrue($this->admin('adminQuest', ['qoff', $this->quest(['active' => false])], $A)['ok']);

        $this->assertSame('bad', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qoff'])['error']);
        $this->assertSame('bad', $this->api('POST', '/player/claimQuest', $P, ['id' => 'nope'])['error']);
        $this->assertSame('notyet', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qmonth3'])['error']);

        for ($n = 0; $n < 3; $n++) {
            [$c, $k, $h] = $this->freeSlot(3 + $n);
            $body = ['court' => $c, 'date' => $k, 'start' => $h, 'dur' => 1, 'players' => [], 'method' => 'wallet'];
            $r = $this->api('POST', '/player/book', $P, $n === 0 ? ['type' => 'open', 'levels' => ['C'], 'visibility' => 'public'] + $body : ['type' => 'private'] + $body);
            $this->assertNotEmpty($r['id'] ?? null, json_encode($r));
        }
        $this->assertSame(3, Quests::progress($me, 'play', Quests::from('month')));

        $x = $this->xp($me);
        $q = $this->api('POST', '/player/claimQuest', $P, ['id' => 'qmonth3']);
        $this->assertSame(120, $q['xp'] ?? null, json_encode($q));
        $this->assertSame($x + 120, $this->xp($me));
        $this->assertSame('done', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qmonth3'])['error']);
        $this->assertSame($x + 120, $this->xp($me));
        $this->assertTrue(DB::table('quest_claims')->where(['member_id' => $me, 'quest' => 'qmonth3', 'week' => Quests::monthStart()])->exists());

        $this->assertSame(50, $this->api('POST', '/player/claimQuest', $P, ['id' => 'qonce'])['xp'] ?? null);
        $this->assertSame('done', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qonce'])['error']);

        // ماه بعد: چالش ماهانه دوباره باز است ولی بازی‌های ماه قبل حساب نیست؛ یک‌باره هنوز گرفته‌شده است
        $this->travel(70)->days();
        $this->assertSame('notyet', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qmonth3'])['error']);
        $this->assertSame('done', $this->api('POST', '/player/claimQuest', $P, ['id' => 'qonce'])['error']);
        // جایزه‌ی یک‌باره با فیلتر ۶۰ روزه حذف نمی‌شود
        $mine = $this->api('GET', '/state', $P)['me']['quests'] ?? [];
        $this->assertContains('qonce', $mine['2000-01-01'] ?? []);
        $this->travelBack();

        foreach (['qmonth3', 'qonce', 'qoff'] as $id) {
            $this->admin('adminQuest', [$id, null], $A);
        }
    }

    public function test_concurrent_double_claim_is_blocked_by_key(): void
    {
        // کلید اصلی جدول (member, week, quest) جلوی ردیف تکراری را می‌گیرد حتی اگر قفل دور زده شود
        [, $me] = $this->player('09151000003', 'دوتایی');
        DB::table('quest_claims')->insert(['member_id' => $me, 'week' => '2000-01-01', 'quest' => 'qx', 'created_at' => now()]);
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('quest_claims')->insert(['member_id' => $me, 'week' => '2000-01-01', 'quest' => 'qx', 'created_at' => now()]);
    }
}
