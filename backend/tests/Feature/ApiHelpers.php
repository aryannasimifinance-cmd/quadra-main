<?php

namespace Tests\Feature;

use App\Domain\Settings;
use Illuminate\Support\Facades\DB;

/** ابزار مشترک تست‌ها: صدا زدن API به‌جای هر نقش */
trait ApiHelpers
{
    protected function api(string $method, string $path, ?string $token = null, array $body = []): array
    {
        $this->app['auth']->forgetGuards();
        Settings::forget();
        $r = $this->json($method, '/api'.$path, $body, $token ? ['Authorization' => 'Bearer '.$token] : []);
        $this->assertNotSame(500, $r->getStatusCode(), "500 on {$method} {$path}: ".substr($r->getContent(), 0, 600));

        return ['_status' => $r->getStatusCode()] + (json_decode($r->getContent(), true) ?: []);
    }

    protected function adminToken(string $user = 'admin', string $pass = 'quadra'): string
    {
        return $this->api('POST', '/auth/staff', null, ['role' => 'admin', 'username' => $user, 'password' => $pass])['token'];
    }

    protected function admin(string $cmd, array $args, ?string $token = null): array
    {
        return $this->api('POST', '/admin/'.$cmd, $token ?? $this->adminToken(), ['args' => $args]);
    }

    /** ورود یا ثبت‌نام بازیکن با کد پیامکی؛ خروجی [توکن، شناسه‌ی عضو] */
    protected function player(string $phone, string $name = 'بازیکن تست', array $extra = []): array
    {
        DB::table('otp_codes')->where('phone', $phone)->delete();
        $a = $this->api('POST', '/auth/otp', null, ['phone' => $phone]);
        $v = $this->api('POST', '/auth/verify', null, ['phone' => $phone, 'code' => $a['debug_code'] ?? '']);
        if (isset($v['token'])) {
            return [$v['token'], $v['id']];
        }
        $r = $this->api('POST', '/auth/register', null, $extra + ['ticket' => $v['signup'], 'name' => $name, 'level' => 'C', 'side' => 'both', 'gender' => 'm', 'birth' => 1370]);
        $this->assertNotEmpty($r['token'] ?? null, json_encode($r));

        return [$r['token'], $r['id']];
    }

    protected function fund(string $member, int $amount): void
    {
        $r = $this->admin('adminWalletAdjust', [$member, $amount, 'شارژ تست']);
        $this->assertTrue($r['ok'] ?? false, json_encode($r));
    }

    protected function wallet(string $member): int
    {
        return (int) DB::table('members')->where('id', $member)->value('wallet');
    }

    protected static function day(int $n): string
    {
        $d = now()->addDays($n);

        return $d->year.'-'.$d->month.'-'.$d->day;
    }

    /** یک ساعت آزاد روی یکی از زمین‌ها (بر اساس خود سرور) */
    protected function freeSlot(int $dayOffset, array $hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22], float $dur = 1, array $courts = [1, 2, 3, 4]): array
    {
        for ($d = $dayOffset; $d < $dayOffset + 30; $d++) {
            $ymd = now()->addDays($d)->format('Y-m-d');
            foreach ($hours as $h) {
                foreach ($courts as $c) {
                    if (\App\Domain\Availability::isFree($ymd, $c, $h, $dur) && ! \App\Domain\Availability::started($ymd, $h)) {
                        return [$c, self::day($d), $h, $ymd];
                    }
                }
            }
        }
        $this->fail('no free slot');
    }

    /** اینکه مانده‌ی کیف پول هر عضو با آخرین ردیف دفتر کیف پول یکی است */
    protected function assertWalletLedgerConsistent(): void
    {
        $bad = DB::select('SELECT m.id, m.wallet, (SELECT balance FROM wallet_transactions w WHERE w.member_id = m.id ORDER BY id DESC LIMIT 1) b,
            (SELECT COALESCE(SUM(amount),0) FROM wallet_transactions w2 WHERE w2.member_id = m.id) s FROM members m');
        foreach ($bad as $r) {
            if ($r->b !== null) {
                $this->assertSame((int) $r->wallet, (int) $r->b, "wallet != last ledger balance for {$r->id}");
                $this->assertSame((int) $r->wallet, (int) $r->s, "wallet != sum of ledger for {$r->id}");
            }
            $this->assertGreaterThanOrEqual(0, (int) $r->wallet);
        }
        $this->assertSame(0, DB::table('product_variants')->where('stock', '<', 0)->count());
        $this->assertSame(0, DB::table('cafe_ingredients')->where('stock', '<', 0)->count());
    }
}
