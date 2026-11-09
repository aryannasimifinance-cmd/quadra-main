<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * تبدیل تاریخ بین دیتابیس و اپ.
 * اپ روزها را به شکل «2026-11-9» (بدون صفر) و زمان‌ها را میلی‌ثانیه نگه می‌دارد.
 */
final class Dates
{
    /** کلید روز اپ از تاریخ دیتابیس یا Carbon */
    public static function key($d): ?string
    {
        if ($d === null || $d === '') {
            return null;
        }
        $c = $d instanceof CarbonInterface ? $d : Carbon::parse($d);

        return $c->year.'-'.$c->month.'-'.$c->day;
    }

    /** کلید روز اپ ← Y-m-d برای دیتابیس؛ کلید نامعتبر null */
    public static function parse($key): ?string
    {
        if (! is_string($key) || ! preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $key, $m)) {
            return null;
        }
        [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
        if (! checkdate($mo, $d, $y) || $y < 2000 || $y > 2100) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $y, $mo, $d);
    }

    public static function ms($ts): ?int
    {
        if ($ts === null || $ts === '') {
            return null;
        }

        return ($ts instanceof CarbonInterface ? $ts : Carbon::parse($ts))->getTimestampMs();
    }

    /** میلی‌ثانیه‌ی اپ ← Carbon */
    public static function fromMs($ms): Carbon
    {
        return Carbon::createFromTimestampMs((int) $ms)->setTimezone(config('app.timezone'));
    }

    public static function today(): string
    {
        return Carbon::now()->format('Y-m-d');
    }

    public static function todayKey(): string
    {
        return self::key(Carbon::now());
    }

    /** لحظه‌ی شروع یک بازه در یک روز (ساعت اعشاری مثل 17.5) */
    public static function at(string $ymd, float $hour): Carbon
    {
        return Carbon::parse($ymd)->startOfDay()->addMinutes((int) round($hour * 60));
    }

    /** شنبه‌ی هفته‌ی جاری (هفته‌ی ایرانی از شنبه) به شکل Y-m-d */
    public static function weekStart(?Carbon $now = null): string
    {
        $d = ($now ?? Carbon::now())->copy()->startOfDay();
        // dayOfWeek: یکشنبه=0 … شنبه=6 ؛ فاصله تا شنبه‌ی قبل
        $back = ($d->dayOfWeek + 1) % 7;

        return $d->subDays($back)->format('Y-m-d');
    }

    /** شماره‌ی روز هفته مثل جاوااسکریپت (یکشنبه=0) */
    public static function dow(string $ymd): int
    {
        return Carbon::parse($ymd)->dayOfWeek;
    }
}
