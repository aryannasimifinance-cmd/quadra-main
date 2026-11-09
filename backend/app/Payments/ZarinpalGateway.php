<?php

namespace App\Payments;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * زرین‌پال (API نسخه‌ی ۴). کافی است در .env بگذارید:
 *   PAYMENT_DRIVER=zarinpal
 *   ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   ZARINPAL_SANDBOX=false
 * مبلغ به ریال فرستاده می‌شود (تومان × ۱۰).
 */
class ZarinpalGateway implements Gateway
{
    private function base(): string
    {
        return config('quadra.payment.zarinpal.sandbox') ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
    }

    public function enabled(): bool
    {
        return (bool) config('quadra.payment.zarinpal.merchant');
    }

    public function request(string $paymentId, int $amountToman, string $callbackUrl, string $description, ?string $mobile): array
    {
        $res = Http::timeout(20)->acceptJson()->post($this->base().'/pg/v4/payment/request.json', array_filter([
            'merchant_id' => config('quadra.payment.zarinpal.merchant'),
            'amount' => $amountToman * 10,
            'callback_url' => $callbackUrl,
            'description' => $description,
            'metadata' => $mobile ? ['mobile' => $mobile] : null,
        ]));
        $data = $res->json('data') ?: [];
        if (! $res->ok() || (int) ($data['code'] ?? 0) !== 100 || empty($data['authority'])) {
            Log::warning('zarinpal request failed', ['status' => $res->status(), 'body' => $res->json()]);
            throw new \RuntimeException('gateway');
        }

        return ['authority' => $data['authority'], 'url' => $this->base().'/pg/StartPay/'.$data['authority']];
    }

    public function authorityFrom(array $query): ?string
    {
        return isset($query['Authority']) ? (string) $query['Authority'] : null;
    }

    public function verify(object $payment, array $query): array
    {
        if (($query['Status'] ?? '') !== 'OK') {
            return ['ok' => false, 'raw' => ['status' => $query['Status'] ?? null]];
        }
        $res = Http::timeout(20)->acceptJson()->post($this->base().'/pg/v4/payment/verify.json', [
            'merchant_id' => config('quadra.payment.zarinpal.merchant'),
            'amount' => (int) $payment->amount * 10,
            'authority' => $payment->authority,
        ]);
        $data = $res->json('data') ?: [];
        $code = (int) ($data['code'] ?? 0);
        // ۱۰۰ = موفق، ۱۰۱ = قبلاً تأیید شده
        $ok = $res->ok() && in_array($code, [100, 101], true);

        return ['ok' => $ok, 'ref_id' => $data['ref_id'] ?? null, 'card' => $data['card_pan'] ?? null, 'raw' => $res->json()];
    }
}
