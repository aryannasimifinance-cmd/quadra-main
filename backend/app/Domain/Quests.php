<?php

namespace App\Domain;

use App\Support\Dates;
use Carbon\Carbon;
use IntlDateFormatter;
use Illuminate\Support\Facades\DB;

/**
 * چالش‌ها و امتیاز: تعریف‌ها را مدیر در تنظیمات (کلید quests) می‌سازد.
 * پیشرفت هر چالش از داده‌ی خود بازیکن شمرده می‌شود؛ اپ همین شمارش را با داده‌ای که دارد تکرار می‌کند (select.js → quests).
 */
final class Quests
{
    public const MAX = 30;

    /** همه‌ی چالش‌ها (فعال و غیرفعال)؛ اگر مدیر چیزی ذخیره نکرده، همان سه چالش قبلی */
    public static function all(): array
    {
        $list = Settings::get('quests');

        return is_array($list) ? array_values($list) : Catalog::DEFAULT_QUESTS;
    }

    public static function find(string $id, bool $activeOnly = true): ?array
    {
        foreach (self::all() as $q) {
            if (($q['id'] ?? null) === $id && (! $activeOnly || ! empty($q['active']))) {
                return $q;
            }
        }

        return null;
    }

    /** روز اول ماه شمسی جاری (به تاریخ میلادی Y-m-d) */
    public static function monthStart(?Carbon $now = null): string
    {
        $d = ($now ?? Carbon::now())->copy()->startOfDay();
        $f = new IntlDateFormatter('en_US@calendar=persian', IntlDateFormatter::NONE, IntlDateFormatter::NONE, config('app.timezone'), IntlDateFormatter::TRADITIONAL, 'd');
        $day = (int) $f->format($d->copy()->setTime(12, 0)->getTimestamp());

        return $d->subDays(max(0, $day - 1))->format('Y-m-d');
    }

    /** کلید بازه که در ستون week جدول quest_claims ذخیره می‌شود */
    public static function periodKey(string $period): string
    {
        return match ($period) {
            'month' => self::monthStart(),
            'once' => Catalog::QUEST_ONCE,
            default => Dates::weekStart(),
        };
    }

    /** شروع بازه برای شمارش؛ null یعنی از اول */
    public static function from(string $period): ?string
    {
        return $period === 'once' ? null : self::periodKey($period).' 00:00:00';
    }

    /** چند بار این فعالیت از شروع بازه انجام شده */
    public static function progress(string $me, string $metric, ?string $from): int
    {
        $since = fn ($q, string $col) => $from ? $q->where($col, '>=', $from) : $q;
        if (in_array($metric, ['play', 'open', 'coach'], true)) {
            $q = DB::table('bookings')->where('status', 'ok')
                ->where(fn ($x) => $x->where('by', $me)->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $me)));
            if ($metric !== 'play') {
                $q->where('type', $metric);
            }

            return $since($q, 'created_at')->count();
        }

        return match ($metric) {
            // ثبت‌نام در آدینه یا مسابقه (مسابقه‌ی لغوشده یا پیش‌نویس حساب نیست)
            'event' => $since(DB::table('event_registrations')->join('events', 'events.id', '=', 'event_registrations.event_id')
                ->where('event_registrations.by', $me)->whereNotIn('events.status', ['draft', 'cancelled']), 'event_registrations.at')->count(),
            'shop' => $since(DB::table('shop_orders')->where('by', $me), 'at')->count(),
            'cafe' => $since(DB::table('cafe_orders')->where('by', $me), 'at')->count(),
            default => 0,
        };
    }
}
