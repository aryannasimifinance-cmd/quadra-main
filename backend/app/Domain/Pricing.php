<?php

namespace App\Domain;

use App\Support\Dates;

/** قیمت‌گذاری — همان قواعد اپ (data.js)، ولی این‌جا تصمیم نهایی با سرور است */
final class Pricing
{
    /** پنجشنبه و جمعه تمام روز پیک است */
    public static function isWeekend(string $ymd): bool
    {
        $d = Dates::dow($ymd);

        return $d === 4 || $d === 5;
    }

    public static function isPeak(string $ymd, float $h, ?array $pricing = null): bool
    {
        $p = $pricing ?? Settings::pricing();

        return self::isWeekend($ymd) || $h >= (float) $p['peakFrom'];
    }

    /** قیمت کل زمین برای یک بازه؛ هر نیم‌ساعت جدا حساب می‌شود */
    public static function court(string $ymd, float $start, float $dur, ?array $pricing = null): int
    {
        $p = $pricing ?? Settings::pricing();
        $sum = 0.0;
        for ($t = $start; $t < $start + $dur - 1e-9; $t += 0.5) {
            $sum += (self::isPeak($ymd, $t, $p) ? (float) $p['peak'] : (float) $p['offpeak']) / 2;
        }

        return (int) round($sum);
    }

    /** قیمت پکیج مربی: قیمت دستی مدیر، وگرنه از نرخ جلسه و تخفیف پکیج */
    public static function coachPack(object|array $coach, string $packId): ?int
    {
        $coach = (array) $coach;
        $pack = Catalog::COACH_PACKS[$packId] ?? null;
        if (! $pack) {
            return null;
        }
        $prices = is_string($coach['prices'] ?? null) ? json_decode($coach['prices'], true) : ($coach['prices'] ?? []);
        if (! empty($prices[$packId])) {
            return (int) $prices[$packId];
        }

        return (int) (round(((int) $coach['price']) * $pack['sessions'] * (1 - $pack['off']) * ($pack['mult'] ?? 1) / 10000) * 10000);
    }

    /** پکیج‌هایی که برای این مربی فعال‌اند */
    public static function coachPackOn(object|array $coach, string $packId): bool
    {
        $coach = (array) $coach;
        $packs = is_string($coach['packs'] ?? null) ? json_decode($coach['packs'], true) : ($coach['packs'] ?? []);

        return isset(Catalog::COACH_PACKS[$packId]) && (($packs[$packId] ?? true) !== false);
    }
}
