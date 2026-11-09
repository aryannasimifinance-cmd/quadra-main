<?php

namespace App\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ارسال کد ورود. سرویس با SMS_DRIVER در .env انتخاب می‌شود:
 *   log       فقط در storage/logs/laravel.log می‌نویسد (برای تست)
 *   kavenegar KAVENEGAR_API_KEY و KAVENEGAR_TEMPLATE (الگوی Verify Lookup با %token)
 *   smsir     SMSIR_API_KEY و SMSIR_TEMPLATE_ID (پارامتر قالب: SMSIR_PARAM، پیش‌فرض CODE)
 */
final class SmsSender
{
    public static function driver(): string
    {
        return (string) config('quadra.sms.driver', 'log');
    }

    public static function sendCode(string $phone, string $code): bool
    {
        try {
            return match (self::driver()) {
                'kavenegar' => self::kavenegar($phone, $code),
                'smsir' => self::smsir($phone, $code),
                default => self::log($phone, $code),
            };
        } catch (\Throwable $e) {
            Log::error('sms send failed', ['driver' => self::driver(), 'e' => $e->getMessage()]);

            return false;
        }
    }

    private static function log(string $phone, string $code): bool
    {
        Log::info("OTP for {$phone}: {$code}");

        return true;
    }

    private static function kavenegar(string $phone, string $code): bool
    {
        $key = config('quadra.sms.kavenegar.key');
        if (! $key) {
            return false;
        }
        $res = Http::timeout(15)->asForm()->post("https://api.kavenegar.com/v1/{$key}/verify/lookup.json", [
            'receptor' => $phone, 'token' => $code, 'template' => config('quadra.sms.kavenegar.template'),
        ]);

        return $res->ok() && (int) $res->json('return.status') === 200;
    }

    private static function smsir(string $phone, string $code): bool
    {
        $key = config('quadra.sms.smsir.key');
        if (! $key) {
            return false;
        }
        $res = Http::timeout(15)->withHeaders(['x-api-key' => $key])->acceptJson()->post('https://api.sms.ir/v1/send/verify', [
            'mobile' => $phone, 'templateId' => (int) config('quadra.sms.smsir.template_id'),
            'parameters' => [['name' => config('quadra.sms.smsir.param', 'CODE'), 'value' => $code]],
        ]);

        return $res->ok() && (int) $res->json('status') === 1;
    }
}
