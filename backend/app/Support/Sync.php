<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * نسخه‌ی هر بخش از داده. اپ هر چند ثانیه نسخه‌ها را می‌پرسد و فقط بخش‌هایی را
 * که عوض شده‌اند دوباره می‌گیرد.
 */
final class Sync
{
    public const NAMES = [
        'settings', 'members', 'coaches', 'bookings', 'coachReqs', 'events', 'sales', 'reviews',
        'products', 'orders', 'stock', 'cafeMenu', 'cafeOrders', 'cafeStock', 'accounting', 'hr',
    ];

    private static array $pending = [];

    /** علامت‌گذاری بخش‌های تغییرکرده؛ بعد از commit تراکنش اعمال می‌شود */
    public static function touch(string ...$names): void
    {
        foreach ($names as $n) {
            self::$pending[$n] = true;
        }
        if (DB::transactionLevel() > 0) {
            DB::afterCommit(fn () => self::flush());
        } else {
            self::flush();
        }
    }

    public static function flush(): void
    {
        if (! self::$pending) {
            return;
        }
        $names = array_keys(self::$pending);
        self::$pending = [];
        foreach ($names as $n) {
            DB::table('sync_versions')->insertOrIgnore(['name' => $n, 'version' => 1]);
            DB::table('sync_versions')->where('name', $n)->increment('version');
        }
    }

    /** نسخه‌ی داده‌ی شخصی یک عضو */
    public static function touchMember(string $memberId): void
    {
        DB::table('members')->where('id', $memberId)->increment('state_v');
    }

    public static function versions(): array
    {
        $rows = DB::table('sync_versions')->pluck('version', 'name')->all();
        $out = [];
        foreach (self::NAMES as $n) {
            $out[$n] = (int) ($rows[$n] ?? 1);
        }

        return $out;
    }
}
