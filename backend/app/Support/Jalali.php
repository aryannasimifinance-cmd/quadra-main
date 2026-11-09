<?php

namespace App\Support;

use Carbon\Carbon;
use IntlDateFormatter;

/** سال شمسی (برای سن بازیکن‌ها) با کتابخانه‌ی intl */
final class Jalali
{
    public static function year(?Carbon $d = null): int
    {
        $d = $d ?? Carbon::now();
        $f = new IntlDateFormatter('en_US@calendar=persian', IntlDateFormatter::NONE, IntlDateFormatter::NONE, config('app.timezone'), IntlDateFormatter::TRADITIONAL, 'y');

        return (int) $f->format($d->getTimestamp());
    }

    public static function fa(string $s): string
    {
        return strtr($s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }

    /** «یکشنبه ۱۸ آبان» */
    public static function label(string $ymd): string
    {
        $f = new IntlDateFormatter('fa_IR@calendar=persian', IntlDateFormatter::NONE, IntlDateFormatter::NONE, config('app.timezone'), IntlDateFormatter::TRADITIONAL, 'EEEE d MMMM');

        return (string) $f->format(Carbon::parse($ymd, config('app.timezone'))->setTime(12, 0)->getTimestamp());
    }

    /** «۱۷:۳۰» */
    public static function hour(float $h): string
    {
        $hh = (int) floor($h) % 24;

        return self::fa(str_pad((string) $hh, 2, '0', STR_PAD_LEFT)).':'.(fmod($h, 1) > 0 ? '۳۰' : '۰۰');
    }

    public static function age(?int $birth): ?int
    {
        return $birth ? self::year() - $birth : null;
    }
}
