<?php

namespace App\Domain;

use App\Support\Dates;
use Illuminate\Support\Facades\DB;

/**
 * خالی بودن زمین و مربی و سقف‌های پشت‌سرهم.
 * همیشه بعد از گرفتن قفل «booking» صدا زده می‌شود تا نتیجه تا پایان تراکنش معتبر بماند.
 */
final class Availability
{
    private const EPS = 1e-6;

    private static function overlaps(float $s1, float $d1, float $s2, float $d2): bool
    {
        return $s1 < $s2 + $d2 - self::EPS && $s2 < $s1 + $d1 - self::EPS;
    }

    /** بازه‌های اشغال یک زمین در یک روز: رزروهای فعال + زمین‌های بسته‌ی مسابقه */
    public static function busy(string $ymd, int $court, ?string $except = null): array
    {
        $spans = DB::table('bookings')->where('date', $ymd)->where('court', $court)->where('status', '!=', 'cancelled')
            ->when($except, fn ($q) => $q->where('id', '!=', $except))
            ->get(['start', 'dur'])->map(fn ($b) => [(float) $b->start, (float) $b->dur])->all();

        foreach (self::eventBlocks($ymd) as $e) {
            if (in_array($court, $e['courts'], true)) {
                $spans[] = [$e['start'], $e['dur']];
            }
        }

        return $spans;
    }

    /** مسابقه‌های منتشرشده‌ی یک روز که زمین‌هایشان در تقویم بسته است */
    public static function eventBlocks(string $ymd, ?string $exceptEvent = null): array
    {
        return DB::table('events')->where('date', $ymd)->whereNotIn('status', ['draft', 'cancelled'])
            ->when($exceptEvent, fn ($q) => $q->where('id', '!=', $exceptEvent))
            ->get(['id', 'start', 'dur', 'courts'])
            ->map(fn ($e) => ['id' => $e->id, 'start' => (float) $e->start, 'dur' => (float) $e->dur, 'courts' => array_map('intval', json_decode($e->courts, true) ?: [])])
            ->all();
    }

    public static function inHours(float $start, float $dur): bool
    {
        $h = Settings::hours();

        return $start >= (float) $h['open'] - self::EPS && $start + $dur <= (float) $h['close'] + self::EPS;
    }

    public static function courtOff(int $court): bool
    {
        return (bool) DB::table('courts')->where('id', $court)->value('off');
    }

    /** همان isFree اپ: زمین فعال، داخل ساعت کاری و بدون هم‌پوشانی */
    public static function isFree(string $ymd, int $court, float $start, float $dur, ?string $except = null): bool
    {
        if (! in_array($court, Catalog::COURT_IDS, true) || self::courtOff($court) || ! self::inHours($start, $dur)) {
            return false;
        }
        foreach (self::busy($ymd, $court, $except) as [$s, $d]) {
            if (self::overlaps($start, $dur, $s, $d)) {
                return false;
            }
        }

        return true;
    }

    /** مربی در این بازه کلاس دیگری دارد؟ */
    public static function coachBusy(string $coach, string $ymd, float $start, float $dur, ?string $except = null): bool
    {
        return DB::table('bookings')->where('coach', $coach)->where('date', $ymd)->where('status', '!=', 'cancelled')
            ->when($except, fn ($q) => $q->where('id', '!=', $except))
            ->get(['start', 'dur'])->contains(fn ($b) => self::overlaps($start, $dur, (float) $b->start, (float) $b->dur));
    }

    /** طول بلوک پشت‌سرهم اگر این بازه به بازه‌های داده‌شده اضافه شود */
    public static function run(array $spans, float $start, float $dur): float
    {
        $a = $start;
        $z = $start + $dur;
        $grew = true;
        while ($grew) {
            $grew = false;
            foreach ($spans as [$s, $e]) {
                if ($s <= $z + self::EPS && $e >= $a - self::EPS && ($s < $a - self::EPS || $e > $z + self::EPS)) {
                    $a = min($a, $s);
                    $z = max($z, $e);
                    $grew = true;
                }
            }
        }

        return $z - $a;
    }

    /** رزروهای خود بازیکن در آن روز (به‌جز کلاس مربی) — برای سقف پشت‌سرهم */
    public static function playerRun(string $member, string $ymd, float $start, float $dur): float
    {
        $spans = DB::table('bookings')->where('date', $ymd)->where('status', '!=', 'cancelled')->where('type', '!=', 'coach')
            ->where(function ($q) use ($member) {
                $q->where('by', $member)->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $member));
            })
            ->get(['start', 'dur'])->map(fn ($b) => [(float) $b->start, (float) $b->start + (float) $b->dur])->all();

        return self::run($spans, $start, $dur);
    }

    /** بلوک پشت‌سرهم مربی: کلاس‌ها + درخواست‌های منتظر */
    public static function coachRun(string $coach, string $ymd, float $start, float $dur): float
    {
        $spans = DB::table('bookings')->where('coach', $coach)->where('date', $ymd)->where('status', '!=', 'cancelled')
            ->get(['start', 'dur'])->map(fn ($b) => [(float) $b->start, (float) $b->start + (float) $b->dur])->all();
        $reqs = DB::table('coach_requests')->where('coach', $coach)->where('date', $ymd)->where('status', 'pending')
            ->get(['start', 'dur'])->map(fn ($r) => [(float) $r->start, (float) $r->start + (float) $r->dur])->all();

        return self::run(array_merge($spans, $reqs), $start, $dur);
    }

    /** باقی‌مانده‌ی سقف روزانه و هفتگی مربی (درخواست‌های منتظر و تأییدشده کم می‌شوند) */
    public static function coachLeft(object $coach, string $ymd): array
    {
        $from = Dates::weekStart(\Carbon\Carbon::parse($ymd));
        $to = \Carbon\Carbon::parse($from)->addDays(6)->format('Y-m-d');
        $live = DB::table('coach_requests')->where('coach', $coach->id)->whereIn('status', ['pending', 'ok']);
        $day = (float) (clone $live)->where('date', $ymd)->sum('dur');
        $week = (float) (clone $live)->whereBetween('date', [$from, $to])->sum('dur');

        return [
            'day' => max(0, (int) $coach->cap_day - $day),
            'week' => max(0, (int) $coach->cap_week - $week),
            'run' => (int) Settings::limits()['coachRun'],
        ];
    }

    /** ساعت‌های تأییدشده‌ی آینده‌ی مربی که هنوز شاگرد ندارند */
    public static function openHours(string $coach): int
    {
        $now = now();

        return DB::table('bookings')->where('coach', $coach)->whereNotNull('block')->where('status', '!=', 'cancelled')
            ->where('date', '>=', $now->copy()->subDay()->format('Y-m-d'))
            ->whereNotExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id'))
            ->get(['date', 'start', 'dur'])
            ->filter(fn ($b) => Dates::at($b->date, (float) $b->start + (float) $b->dur)->gt($now))
            ->count();
    }

    /** لحظه‌ی شروع رزرو گذشته است؟ */
    public static function started(string $ymd, float $start): bool
    {
        return Dates::at($ymd, $start)->lte(now());
    }
}
