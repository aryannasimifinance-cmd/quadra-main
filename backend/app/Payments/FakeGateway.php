<?php

namespace App\Payments;

/**
 * درگاه آزمایشی: یک صفحه با دو دکمه‌ی «پرداخت موفق» و «انصراف».
 * روی سرور اصلی (APP_ENV=production) خاموش است مگر در حالت نمایشی.
 */
class FakeGateway implements Gateway
{
    public function enabled(): bool
    {
        // فقط روی کامپیوتر برنامه‌نویس (local/testing) یا در حالت نمایشی؛ هر محیط دیگری = خاموش
        return app()->environment(['local', 'testing']) || config('quadra.demo');
    }

    public function request(string $paymentId, int $amountToman, string $callbackUrl, string $description, ?string $mobile): array
    {
        return ['authority' => 'FAKE-'.$paymentId, 'url' => url('/api/pay/fake/'.$paymentId)];
    }

    public function authorityFrom(array $query): ?string
    {
        return isset($query['Authority']) ? (string) $query['Authority'] : null;
    }

    public function verify(object $payment, array $query): array
    {
        $ok = ($query['Status'] ?? '') === 'OK' && ($query['Authority'] ?? '') === $payment->authority;

        return ['ok' => $ok, 'ref_id' => $ok ? 'TEST-'.random_int(100000, 999999) : null, 'card' => $ok ? '6037-99**-****-1234' : null, 'raw' => ['fake' => true]];
    }
}
