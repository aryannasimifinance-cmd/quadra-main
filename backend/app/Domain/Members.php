<?php

namespace App\Domain;

use App\Support\Ids;
use App\Support\Sync;
use Illuminate\Support\Facades\DB;

/** عضویت، تخفیف، XP، نشان‌ها و اعلان‌ها */
final class Members
{
    /** عضویت فعال (طلایی/بلک) یا null */
    public static function membership(string $member): ?object
    {
        // عضویتی که همین الان در جریان است؛ اگر چند تا هم‌زمان باشد، بیشترین تخفیف
        $rows = DB::table('memberships')->where('member_id', $member)->where('starts_at', '<=', now())->where('ends_at', '>', now())->get();

        return $rows->sortByDesc(fn ($m) => [(float) (Catalog::PACKAGES[$m->package]['off'] ?? 0), $m->ends_at])->first();
    }

    /** پایان آخرین عضویت (برای تمدید از ادامه‌ی آن) */
    public static function membershipEnd(string $member): ?string
    {
        return DB::table('memberships')->where('member_id', $member)->where('ends_at', '>', now())->max('ends_at');
    }

    /** برگرداندن XPِ یک کار لغوشده (نشان‌ها می‌مانند) */
    public static function revokeXp(string $member, string $reason): void
    {
        $sum = (int) DB::table('xp_events')->where('member_id', $member)->where('reason', $reason)->sum('amount');
        if ($sum <= 0) {
            return;
        }
        $xp = (int) DB::table('members')->where('id', $member)->value('xp');
        $take = min($sum, $xp);
        DB::table('members')->where('id', $member)->update(['xp' => $xp - $take]);
        DB::table('xp_events')->insert(['member_id' => $member, 'amount' => -$take, 'reason' => mb_substr($reason, 0, 60), 'created_at' => now()]);
        Sync::touchMember($member);
    }

    /** درصد تخفیف عضویت فعال (۰ تا ۱) */
    public static function off(string $member): float
    {
        $m = self::membership($member);

        return $m ? (float) (Catalog::PACKAGES[$m->package]['off'] ?? 0) : 0.0;
    }

    public static function find(string $id): ?object
    {
        return DB::table('members')->where('id', $id)->first();
    }

    /**
     * امتیاز و نشان؛ عضویت XP را دو برابر می‌کند و هر نشان تازه ۱۵ XP دارد (همان reward اپ).
     * خروجی همان شکلی است که صفحه‌ی موفقیت اپ نشان می‌دهد.
     */
    public static function reward(string $member, int $xp, array $gives, string $reason): array
    {
        $have = DB::table('member_badges')->where('member_id', $member)->pluck('badge')->all();
        $fresh = [];
        foreach (array_filter($gives) as $b) {
            if (in_array($b, Catalog::BADGES, true) && ! in_array($b, $have, true) && ! in_array($b, $fresh, true)) {
                $fresh[] = $b;
            }
        }
        $mult = self::membership($member) ? 2 : 1;
        $gain = $xp * $mult + count($fresh) * 15;
        foreach ($fresh as $b) {
            DB::table('member_badges')->insertOrIgnore(['member_id' => $member, 'badge' => $b, 'created_at' => now()]);
        }
        if ($gain > 0) {
            DB::table('members')->where('id', $member)->increment('xp', $gain);
            DB::table('xp_events')->insert(['member_id' => $member, 'amount' => $gain, 'reason' => mb_substr($reason, 0, 60), 'created_at' => now()]);
        }
        Sync::touchMember($member);

        return ['xp' => $gain, 'badges' => $fresh, 'mult' => $mult];
    }

    /** اعلان؛ داخل تراکنش، بعد از commit نوشته می‌شود تا ردیف عضو دیگری در وسط کار قفل نشود */
    public static function notify(string $member, string $icon, string $title, string $body = ''): void
    {
        if (DB::transactionLevel() > 0) {
            DB::afterCommit(fn () => self::notifyNow($member, $icon, $title, $body));

            return;
        }
        self::notifyNow($member, $icon, $title, $body);
    }

    private static function notifyNow(string $member, string $icon, string $title, string $body): void
    {
        if (! DB::table('members')->where('id', $member)->exists()) {
            return;
        }
        DB::table('notifications')->insert([
            'id' => Ids::make('n'), 'member_id' => $member, 'icon' => mb_substr($icon, 0, 16), 'title' => mb_substr($title, 0, 200),
            'body' => mb_substr($body, 0, 1000), 'read' => false, 'created_at' => now(),
        ]);
        // فقط ۶۰ اعلان آخر نگه داشته می‌شود (مثل اپ)
        $old = DB::table('notifications')->where('member_id', $member)->orderByDesc('created_at')->orderByDesc('id')->skip(60)->take(500)->pluck('id')->all();
        if ($old) {
            DB::table('notifications')->whereIn('id', $old)->delete();
        }
        Sync::touchMember($member);
    }

    /** آیا این شناسه یک عضو واقعی است (نه مهمان f:)؟ */
    public static function isMemberId($id): bool
    {
        return is_string($id) && $id !== '' && ! str_starts_with($id, 'f:');
    }

    /** اعتبارسنجی شناسه‌ی بازیکن: عضو فعال یا مهمان با نام */
    public static function validPlayer($id): bool
    {
        if (! is_string($id) || $id === '') {
            return false;
        }
        if (str_starts_with($id, 'f:')) {
            $n = trim(mb_substr($id, 2));

            return mb_strlen($n) >= 2 && mb_strlen($n) <= 60;
        }

        return DB::table('members')->where('id', $id)->exists();
    }
}
