<?php

namespace App\Domain;

use App\Support\Audit;
use App\Support\Fail;
use App\Support\Sync;
use Illuminate\Support\Facades\DB;

/**
 * کیف پول. موجودی فقط از این‌جا عوض می‌شود: ردیف عضو قفل می‌شود، موجودی بررسی و
 * به‌روز می‌شود و یک ردیف در دفتر کیف پول با مانده‌ی جدید ثبت می‌شود.
 */
final class Wallet
{
    public static function balance(string $member): int
    {
        return (int) DB::table('members')->where('id', $member)->value('wallet');
    }

    public static function debit(string $member, int $amount, string $ref, string $note = ''): int
    {
        if ($amount < 0) {
            Fail::with('bad');
        }

        return self::change($member, -$amount, 'pay', $ref, $note);
    }

    public static function credit(string $member, int $amount, string $kind, string $ref, string $note = ''): int
    {
        if ($amount < 0) {
            Fail::with('bad');
        }

        return self::change($member, $amount, $kind, $ref, $note);
    }

    private static function change(string $member, int $delta, string $kind, string $ref, string $note): int
    {
        if (DB::transactionLevel() < 1) {
            throw new \RuntimeException('Wallet change must run inside a transaction');
        }
        $row = DB::table('members')->where('id', $member)->lockForUpdate()->first(['wallet']);
        if (! $row) {
            Fail::with('member');
        }
        if ($delta === 0) {
            return (int) $row->wallet;
        }
        $next = (int) $row->wallet + $delta;
        if ($next < 0) {
            Fail::with('wallet', ['have' => (int) $row->wallet]);
        }
        DB::table('members')->where('id', $member)->update(['wallet' => $next, 'updated_at' => now()]);
        DB::table('wallet_transactions')->insert([
            'member_id' => $member, 'amount' => $delta, 'balance' => $next, 'kind' => $kind,
            'ref' => mb_substr($ref, 0, 80), 'note' => mb_substr($note, 0, 255), 'actor' => Audit::$actor, 'created_at' => now(),
        ]);
        Sync::touchMember($member);

        return $next;
    }
}
