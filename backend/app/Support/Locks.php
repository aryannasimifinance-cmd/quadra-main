<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * قفل‌های نام‌دار داخل تراکنش. هر عملیات حساس اولین کاری که می‌کند گرفتن قفل است،
 * پس دو درخواست هم‌زمان (مثلاً دو رزرو یک ساعت) پشت سر هم اجرا می‌شوند، نه با هم.
 * ترتیب ثابت قفل‌ها: booking → event → shop → cafe → ردیف عضو (کیف پول)
 */
final class Locks
{
    public static function take(string ...$names): void
    {
        if (DB::transactionLevel() < 1) {
            throw new RuntimeException('Locks::take must run inside a transaction');
        }
        foreach ($names as $name) {
            $row = DB::table('mutexes')->where('name', $name)->lockForUpdate()->first();
            if (! $row) {
                DB::table('mutexes')->insertOrIgnore(['name' => $name]);
                DB::table('mutexes')->where('name', $name)->lockForUpdate()->first();
            }
        }
    }

    /** تراکنش با قفل؛ در صورت بن‌بست دیتابیس چند بار دوباره تلاش می‌کند */
    public static function run(array $names, callable $fn)
    {
        return DB::transaction(function () use ($names, $fn) {
            self::take(...$names);

            return $fn();
        }, 3);
    }
}
