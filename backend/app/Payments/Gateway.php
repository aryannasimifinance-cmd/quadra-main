<?php

namespace App\Payments;

/**
 * درگاه پرداخت. برای اضافه کردن درگاه تازه (مثلاً بانک ملت) کافی است این رابط
 * پیاده شود و در PaymentService::gateway() ثبت شود.
 */
interface Gateway
{
    /** آیا درگاه آماده‌ی دریافت پول واقعی است؟ */
    public function enabled(): bool;

    /** شروع پرداخت: ['authority' => ..., 'url' => آدرس صفحه‌ی بانک] */
    public function request(string $paymentId, int $amountToman, string $callbackUrl, string $description, ?string $mobile): array;

    /** تأیید پرداخت بعد از برگشت از بانک: ['ok' => bool, 'ref_id' => ..., 'card' => ..., 'raw' => [...]] */
    public function verify(object $payment, array $query): array;

    /** شناسه‌ی پرداخت از پارامترهای برگشتی بانک */
    public function authorityFrom(array $query): ?string;
}
