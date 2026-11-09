<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** ساخت شناسه‌ها: شناسه‌ی داخلی تصادفی و شماره‌ی ترتیبی برای کدهایی که مشتری می‌بیند */
final class Ids
{
    /** مثل b-lq3k9x2a7f — یکتا و غیرقابل‌حدس */
    public static function make(string $prefix): string
    {
        $time = base_convert((string) (int) (microtime(true) * 1000), 10, 36);

        return $prefix.$time.bin2hex(random_bytes(4));
    }

    /**
     * شماره‌ی ترتیبی بی‌تکرار (Q-1201، K-5003 …). باید داخل تراکنش صدا زده شود.
     * $start: اولین عدد اگر شمارنده هنوز ساخته نشده
     */
    public static function seq(string $name, int $start = 1000): int
    {
        $row = DB::table('sequences')->where('name', $name)->lockForUpdate()->first();
        if (! $row) {
            DB::table('sequences')->insertOrIgnore(['name' => $name, 'value' => $start - 1]);
            $row = DB::table('sequences')->where('name', $name)->lockForUpdate()->first();
        }
        $next = (int) $row->value + 1;
        DB::table('sequences')->where('name', $name)->update(['value' => $next]);

        return $next;
    }

    /** شمارنده را جلو می‌برد تا از عدد داده‌شده عقب‌تر نباشد (بعد از ورود داده‌ی قدیمی) */
    public static function bump(string $name, int $atLeast): void
    {
        DB::table('sequences')->insertOrIgnore(['name' => $name, 'value' => 0]);
        DB::table('sequences')->where('name', $name)->where('value', '<', $atLeast)->update(['value' => $atLeast]);
    }

    /** شناسه‌ای که اپِ مدیر پیشنهاد داده، اگر معتبر و آزاد باشد؛ وگرنه شناسه‌ی تازه */
    public static function accept(?string $proposed, string $table, string $prefix): string
    {
        if (is_string($proposed) && preg_match('/^[A-Za-z][A-Za-z0-9_-]{3,38}$/', $proposed)
            && ! DB::table($table)->where('id', $proposed)->exists()) {
            return $proposed;
        }

        return self::make($prefix);
    }
}
