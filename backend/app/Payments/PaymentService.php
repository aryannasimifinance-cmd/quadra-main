<?php

namespace App\Payments;

use App\Actions\PlayerActions;
use App\Domain\Wallet;
use App\Support\Fail;
use App\Support\Ids;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * پرداخت آنلاین به روش «اول کیف پول»:
 * ۱) مبلغ را سرور حساب می‌کند و کاربر به بانک می‌رود؛
 * ۲) بعد از تأیید بانک، مبلغ به کیف پول اضافه می‌شود؛
 * ۳) همان کار (رزرو، خرید…) با کیف پول انجام می‌شود.
 * اگر وسط پرداخت زمین پر شود یا موجودی تمام شود، پول در کیف پول می‌ماند و گم نمی‌شود.
 */
final class PaymentService
{
    public static function gateway(?string $driver = null): Gateway
    {
        return match ($driver ?? config('quadra.payment.driver')) {
            'zarinpal' => new ZarinpalGateway,
            default => new FakeGateway,
        };
    }

    public static function enabled(): bool
    {
        return self::gateway()->enabled();
    }

    /** شروع پرداخت؛ خروجی برای اپ: ['pay' => ['url' => …, 'id' => …]] */
    public static function start(object $member, int $amount, string $purpose, array $payload, string $description): array
    {
        $gw = self::gateway();
        if (! $gw->enabled()) {
            Fail::with('payment_off');
        }
        if ($amount < 1000) {
            Fail::with('bad');
        }
        $id = Ids::make('pay');
        DB::table('payments')->insert([
            'id' => $id, 'member_id' => $member->id, 'amount' => $amount, 'purpose' => $purpose,
            'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE), 'status' => 'pending', 'driver' => config('quadra.payment.driver'),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        try {
            $r = $gw->request($id, $amount, url('/api/pay/callback/'.$id), mb_substr($description, 0, 200), $member->phone ?? null);
        } catch (\Throwable $e) {
            DB::table('payments')->where('id', $id)->update(['status' => 'failed', 'result' => json_encode(['error' => 'gateway']), 'updated_at' => now()]);
            Log::warning('payment request error', ['id' => $id, 'e' => $e->getMessage()]);
            Fail::with('gateway');
        }
        DB::table('payments')->where('id', $id)->update(['authority' => $r['authority'], 'updated_at' => now()]);

        return ['pay' => ['url' => $r['url'], 'id' => $id]];
    }

    /** برگشت از بانک: تأیید، شارژ کیف پول و انجام کار. خروجی: وضعیت نهایی پرداخت */
    public static function complete(string $id, array $query): object
    {
        $p = DB::table('payments')->where('id', $id)->first();
        if (! $p) {
            abort(404);
        }
        if ($p->status !== 'pending') {
            return $p; // قبلاً رسیدگی شده (رفرش صفحه یا برگشت دوباره)
        }
        $gw = self::gateway($p->driver);
        // درگاهی که الان خاموش است (مثلاً درگاه آزمایشی روی سرور اصلی) هیچ پرداختی را تأیید نمی‌کند
        // (درگاه واقعی همیشه با خود بانک تأیید می‌شود تا پول پرداخت‌شده گم نشود)
        if ($p->driver === 'fake' && ! (new FakeGateway)->enabled()) {
            $query['Status'] = 'NOK';
        }
        $auth = $gw->authorityFrom($query);
        if ($auth !== null && $auth !== $p->authority) {
            $query['Status'] = 'NOK';
        }
        $v = ['ok' => false, 'raw' => []];
        try {
            $v = $gw->verify($p, $query);
        } catch (\Throwable $e) {
            Log::warning('payment verify error', ['id' => $id, 'e' => $e->getMessage()]);
        }

        // مرحله‌ی ۱: علامت پرداخت و شارژ کیف پول (یک بار، با قفل ردیف پرداخت)
        $paid = DB::transaction(function () use ($id, $v) {
            $row = DB::table('payments')->where('id', $id)->lockForUpdate()->first();
            if ($row->status !== 'pending') {
                return null;
            }
            if (! $v['ok']) {
                DB::table('payments')->where('id', $id)->update(['status' => 'failed', 'result' => json_encode(['error' => 'cancelled']), 'updated_at' => now()]);

                return null;
            }
            DB::table('payments')->where('id', $id)->update(['status' => 'paid', 'ref_id' => $v['ref_id'] ?? null, 'card' => $v['card'] ?? null, 'verified_at' => now(), 'updated_at' => now()]);
            Wallet::credit($row->member_id, (int) $row->amount, 'topup', 'pay:'.$id, 'پرداخت آنلاین '.($v['ref_id'] ?? ''));

            return $row;
        });
        if (! $paid) {
            return DB::table('payments')->where('id', $id)->first();
        }

        // مرحله‌ی ۲: انجام همان کار با کیف پول
        $payload = json_decode($paid->payload, true) ?: [];
        try {
            $result = $paid->purpose === 'topup'
                ? ['ok' => true, 'wallet' => Wallet::balance($paid->member_id)]
                : PlayerActions::forMember($paid->member_id)->run($payload['action'] ?? '', $payload['args'] ?? [], true);
        } catch (Fail $f) {
            $result = ['error' => $f->err, 'kept' => true] + $f->extra;
        } catch (\Throwable $e) {
            Log::error('payment action error', ['id' => $id, 'e' => $e->getMessage()]);
            $result = ['error' => 'server', 'kept' => true];
        }
        DB::table('payments')->where('id', $id)->update(['status' => 'done', 'result' => json_encode($result, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);

        return DB::table('payments')->where('id', $id)->first();
    }
}
