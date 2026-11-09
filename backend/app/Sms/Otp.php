<?php

namespace App\Sms;

use App\Support\Fail;
use Illuminate\Support\Facades\DB;

/** کد ورود یک‌بارمصرف: ۴ رقم، ۲ دقیقه اعتبار، ۵ بار تلاش، محدودیت ارسال */
final class Otp
{
    private static function hash(string $phone, string $code): string
    {
        return hash_hmac('sha256', $phone.'|'.$code, (string) config('app.key'));
    }

    /** ارسال کد؛ خروجی: کد (فقط وقتی در حالت تست لازم است) */
    public static function send(string $phone, ?string $ip): string
    {
        $cfg = config('quadra.otp');
        $last = DB::table('otp_codes')->where('phone', $phone)->orderByDesc('id')->first();
        if ($last && now()->diffInSeconds($last->created_at, true) < $cfg['resend']) {
            Fail::with('wait', ['sec' => (int) ceil($cfg['resend'] - now()->diffInSeconds($last->created_at, true))]);
        }
        if (DB::table('otp_codes')->where('phone', $phone)->where('created_at', '>', now()->subHour())->count() >= $cfg['per_hour']) {
            Fail::with('limit');
        }
        $code = (string) random_int(1000, 9999);
        $id = DB::table('otp_codes')->insertGetId([
            'phone' => $phone, 'code_hash' => self::hash($phone, $code), 'attempts' => 0,
            'expires_at' => now()->addSeconds($cfg['ttl']), 'ip' => $ip, 'created_at' => now(),
        ]);
        if (! SmsSender::sendCode($phone, $code)) {
            DB::table('otp_codes')->where('id', $id)->delete();
            Fail::with('sms');
        }
        // پاک‌سازی کدهای قدیمی
        DB::table('otp_codes')->where('created_at', '<', now()->subDays(2))->delete();

        return $code;
    }

    public static function check(string $phone, string $code): bool
    {
        return DB::transaction(function () use ($phone, $code) {
            $row = DB::table('otp_codes')->where('phone', $phone)->whereNull('used_at')->orderByDesc('id')->lockForUpdate()->first();
            if (! $row || now()->gt($row->expires_at) || $row->attempts >= config('quadra.otp.max_attempts')) {
                return false;
            }
            if (! hash_equals($row->code_hash, self::hash($phone, $code))) {
                DB::table('otp_codes')->where('id', $row->id)->increment('attempts');

                return false;
            }
            DB::table('otp_codes')->where('id', $row->id)->update(['used_at' => now()]);

            return true;
        });
    }
}
