<?php

namespace App\Domain;

use Illuminate\Support\Facades\DB;

/** تنظیمات باشگاه در جدول settings با مقدار پیش‌فرض */
final class Settings
{
    private static array $cache = [];

    public static function get(string $key, $default = null)
    {
        if (array_key_exists($key, self::$cache)) {
            return self::$cache[$key];
        }
        $row = DB::table('settings')->where('key', $key)->value('value');

        return self::$cache[$key] = $row === null ? $default : json_decode($row, true);
    }

    public static function put(string $key, $value): void
    {
        DB::table('settings')->updateOrInsert(['key' => $key], ['value' => json_encode($value, JSON_UNESCAPED_UNICODE), 'updated_at' => now(), 'created_at' => now()]);
        self::$cache[$key] = $value;
    }

    public static function forget(): void
    {
        self::$cache = [];
    }

    public static function pricing(): array
    {
        return array_merge(Catalog::DEFAULT_PRICING, self::get('pricing', []) ?: []);
    }

    public static function hours(): array
    {
        return array_merge(Catalog::DEFAULT_HOURS, self::get('hours', []) ?: []);
    }

    public static function limits(): array
    {
        return array_merge(Catalog::DEFAULT_LIMITS, self::get('limits', []) ?: []);
    }

    public static function hr(): array
    {
        return array_merge(Catalog::DEFAULT_HR, self::get('hrCfg', []) ?: []);
    }

    public static function welcome(): array
    {
        return array_merge(Catalog::DEFAULT_WELCOME, self::get('welcome', []) ?: []);
    }
}
