<?php

namespace App\Domain;

/** ثابت‌های باشگاه — دقیقاً همان مقادیر src/data.js در اپ */
final class Catalog
{
    /** سطح‌ها با امتیاز پایه‌ی رنکینگ (ترتیب از قوی به ضعیف) */
    public const LEVELS = ['A' => 2200, 'B+' => 1950, 'B' => 1750, 'B-' => 1550, 'C+' => 1400, 'C' => 1250, 'C-' => 1100, 'D+' => 950, 'D' => 800];

    public const SIDES = ['right', 'left', 'both'];

    public const COURT_IDS = [1, 2, 3, 4];

    public const DEFAULT_COURTS = [
        1 => ['name' => 'زمین ۱', 'kind' => 'پانورامیک', 'indoor' => true, 'img' => './img/court-pano.jpg'],
        2 => ['name' => 'زمین ۲', 'kind' => 'پانورامیک', 'indoor' => true, 'img' => './img/court-indoor.jpg'],
        3 => ['name' => 'زمین ۳', 'kind' => 'استاندارد', 'indoor' => true, 'img' => './img/court-blue.jpg'],
        4 => ['name' => 'زمین ۴', 'kind' => 'روباز', 'indoor' => false, 'img' => './img/court-outdoor.jpg'],
    ];

    public const DEFAULT_PRICING = ['offpeak' => 1200000, 'peak' => 1200000, 'peakFrom' => 17];

    public const DEFAULT_HOURS = ['open' => 7, 'close' => 24];

    public const DEFAULT_LIMITS = ['coachRun' => 5, 'playerRun' => 3];

    public const DEFAULT_HR = ['housing' => 900000, 'bon' => 2200000, 'child' => 1040000, 'otRate' => 1.4, 'emp' => 0.07, 'er' => 0.23, 'monthHours' => 176, 'dayHours' => 8, 'annualLeave' => 26];

    /** هدیه‌ی ثبت‌نام (مدیر در تنظیمات عوض می‌کند) */
    public const DEFAULT_WELCOME = ['wallet' => 0, 'xp' => 20];

    public const COACH_PACKS = [
        'one' => ['name' => 'تک جلسه', 'sessions' => 1, 'off' => 0, 'mult' => 1],
        'five' => ['name' => 'پکیج ۵ جلسه', 'sessions' => 5, 'off' => 0.1, 'mult' => 1],
        'ten' => ['name' => 'پکیج ۱۰ جلسه', 'sessions' => 10, 'off' => 0.15, 'mult' => 1],
        'group' => ['name' => 'گروهی ۴ نفره', 'sessions' => 1, 'off' => 0, 'mult' => 0.4],
    ];

    /** پکیج‌های زمین (series) و عضویت (member) */
    public const PACKAGES = [
        'p5' => ['kind' => 'series', 'name' => 'پکیج ۵ جلسه زمین', 'sessions' => 5, 'off' => 0.1],
        'p10' => ['kind' => 'series', 'name' => 'پکیج ۱۰ جلسه زمین', 'sessions' => 10, 'off' => 0.15],
        'gold' => ['kind' => 'member', 'name' => 'عضویت طلایی', 'off' => 0.15, 'price' => 2900000, 'days' => 30],
        'black' => ['kind' => 'member', 'name' => 'عضویت بلک', 'off' => 0.25, 'price' => 7400000, 'days' => 90],
    ];

    public const BADGES = ['first', 'host', 'social', 'squad', 'quad', 'early', 'night', 'student', 'champ', 'shopper', 'loyal'];

    /** چالش‌های هفتگی: هدف و جایزه */
    public const QUESTS = [
        'play2' => ['goal' => 2, 'xp' => 60],
        'social' => ['goal' => 1, 'xp' => 40],
        'coach' => ['goal' => 1, 'xp' => 40],
    ];

    public const BOOKING_TYPES = ['private', 'open', 'coach', 'event', 'block'];

    public const PAY_METHODS = ['online', 'card', 'cash', 'wallet', 'package', 'coach-pack', 'free', 'bank', 'payable'];

    public const DESK_METHODS = ['card', 'cash', 'online', 'wallet', 'bank', 'free'];

    public static function levelBase(?string $id): int
    {
        return self::LEVELS[$id] ?? self::LEVELS['C'];
    }

    public static function isLevel($id): bool
    {
        return is_string($id) && array_key_exists($id, self::LEVELS);
    }

    public static function levelIndex(string $id): int
    {
        $i = array_search($id, array_keys(self::LEVELS), true);

        return $i === false ? 5 : $i;
    }
}
