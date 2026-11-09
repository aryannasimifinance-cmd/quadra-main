<?php

namespace App\Actions;

use App\Domain\Availability;
use App\Domain\Catalog;
use App\Domain\Members;
use App\Domain\Settings;
use App\Domain\Wallet;
use App\Support\Audit;
use App\Support\Dates;
use App\Support\Fail;
use App\Support\Ids;
use App\Support\Locks;
use App\Support\Sync;
use App\Support\Uploads;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * کارهای پنل مدیر: اعضا، مربی‌ها، رزروها، مسابقه‌ها و تنظیمات.
 * (فروشگاه، کافه، حسابداری و پرسنل در AdminOpsActions)
 * مدیر مورد اعتماد است، ولی ورودی‌ها باز هم بررسی می‌شوند تا داده‌ی خراب ثبت نشود.
 */
class AdminActions
{
    use AdminOpsActions;

    public const COMMANDS = [
        'adminMember', 'adminMemberEdit', 'adminCoachSave', 'adminCoachLogin', 'adminLimits', 'adminCoachReq',
        'adminAddBooking', 'adminReview', 'adminPayin', 'adminPayinDel', 'adminSettle', 'adminCancel', 'adminMove',
        'adminOrder', 'adminProduct', 'adminAdjust', 'adminReceive', 'adminPos', 'adminApPay',
        'adminCafeItem', 'adminCafeIng', 'adminCafeReceive', 'adminCafeAdjust', 'adminCafeOrder', 'adminCafePos',
        'adminEventSave', 'adminEventDel', 'adminEventSet', 'adminEventReg', 'adminEventUnreg',
        'adminHours', 'adminPricing', 'adminCourtEdit', 'adminCourt', 'adminWelcome',
        'adminExpense', 'adminExpenseDel', 'adminJournal', 'adminJournalDel',
        'adminStaff', 'adminShift', 'adminAttend', 'adminLeave', 'adminLeaveStatus', 'adminAdvance', 'adminHrCfg',
        'adminPayroll', 'adminPayrollPay', 'adminPayrollUndo', 'adminWalletAdjust', 'adminDemoReset',
    ];

    public function __construct(protected object $admin) {}

    // ---------- اعتبارسنجی ----------
    protected static function str($v, int $max, int $min = 0, bool $nullable = true): ?string
    {
        if ($v === null || $v === '') {
            if ($nullable && $min === 0) {
                return $v === null ? null : '';
            }
            Fail::with('bad');
        }
        if (! is_scalar($v)) {
            Fail::with('bad');
        }
        $s = trim((string) $v);
        if (mb_strlen($s) < $min || mb_strlen($s) > $max) {
            Fail::with('bad');
        }

        return $s;
    }

    protected static function int($v, int $min, int $max): int
    {
        if (! is_numeric($v) || (float) $v != (int) $v || (int) $v < $min || (int) $v > $max) {
            Fail::with('bad');
        }

        return (int) $v;
    }

    protected static function num($v, float $min, float $max): float
    {
        if (! is_numeric($v) || (float) $v < $min || (float) $v > $max) {
            Fail::with('bad');
        }

        return (float) $v;
    }

    protected static function date($v): string
    {
        $d = Dates::parse($v);
        if (! $d) {
            Fail::with('bad');
        }

        return $d;
    }

    protected static function phone($v): string
    {
        $p = strtr((string) $v, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
        $p = preg_replace('/\D/', '', $p);
        if (! preg_match('/^09\d{9}$/', $p)) {
            Fail::with('phone');
        }

        return $p;
    }

    protected static function deskMethod($m, bool $allowNull = false): ?string
    {
        if ($allowNull && ($m === null || $m === '')) {
            return null;
        }
        if (! in_array($m, Catalog::DESK_METHODS, true)) {
            Fail::with('bad');
        }

        return $m;
    }

    protected static function json($v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = json_encode($v, JSON_UNESCAPED_UNICODE);
        if ($s === false || strlen($s) > 2_000_000) {
            Fail::with('bad');
        }

        return $s;
    }

    /** پرداخت از کیف پول عضو در پذیرش */
    protected function deskWallet(?string $method, $by, int $amount, string $ref): void
    {
        if ($method === 'wallet' && $amount > 0) {
            if (! Members::isMemberId($by) || ! DB::table('members')->where('id', $by)->exists()) {
                Fail::with('wallet');
            }
            Wallet::debit($by, $amount, $ref, 'پرداخت در پذیرش');
        }
    }

    // ---------- اعضا ----------
    private function memberPatch(array $m, bool $create): array
    {
        $p = [];
        if ($create || array_key_exists('name', $m)) {
            $p['name'] = self::str($m['name'] ?? '', 120, 2, false);
        }
        if ($create || array_key_exists('phone', $m)) {
            $p['phone'] = self::phone($m['phone'] ?? '');
        }
        if (array_key_exists('level', $m) || $create) {
            $p['level'] = Catalog::isLevel($m['level'] ?? null) ? $m['level'] : 'C';
        }
        if (array_key_exists('side', $m) || $create) {
            $p['side'] = in_array($m['side'] ?? null, Catalog::SIDES, true) ? $m['side'] : 'both';
        }
        if (array_key_exists('gender', $m)) {
            $p['gender'] = in_array($m['gender'], ['f', 'm'], true) ? $m['gender'] : null;
        }
        if (array_key_exists('birth', $m)) {
            $p['birth'] = $m['birth'] ? self::int($m['birth'], 1300, 1500) : null;
        }
        if (array_key_exists('member', $m)) {
            $p['vip'] = in_array($m['member'], ['gold', 'black'], true) ? $m['member'] : null;
        }
        if (array_key_exists('note', $m)) {
            $p['note'] = self::str($m['note'], 2000);
        }
        if (array_key_exists('inactive', $m)) {
            $p['inactive'] = (bool) $m['inactive'];
        }

        return $p;
    }

    public function adminMember(array $m): array
    {
        $p = $this->memberPatch($m, true);
        if (DB::table('members')->where('phone', $p['phone'])->exists()) {
            Fail::with('phone_taken');
        }
        $id = Ids::accept($m['id'] ?? null, 'members', 'm');
        try {
            DB::table('members')->insert($p + ['id' => $id, 'source' => 'desk', 'created_at' => now(), 'updated_at' => now()]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            Fail::with('phone_taken');
        }
        Audit::log('member.create', $id, ['name' => $p['name']]);
        Sync::touch('members');

        return ['ok' => true, 'id' => $id];
    }

    public function adminMemberEdit(string $id, array $patch): array
    {
        if (! DB::table('members')->where('id', $id)->exists()) {
            Fail::with('gone');
        }
        $p = $this->memberPatch($patch, false);
        if (isset($p['phone']) && DB::table('members')->where('phone', $p['phone'])->where('id', '!=', $id)->exists()) {
            Fail::with('phone_taken');
        }
        if ($p) {
            DB::table('members')->where('id', $id)->update($p + ['updated_at' => now()]);
            Sync::touchMember($id);
        }
        Audit::log('member.edit', $id, $p);
        Sync::touch('members');

        return ['ok' => true];
    }

    /** اصلاح دستی کیف پول عضو (مثلاً شارژ نقدی در پذیرش) */
    public function adminWalletAdjust(string $id, $amount, $note = ''): array
    {
        $amount = self::int($amount, -100_000_000, 100_000_000);
        if ($amount === 0) {
            return ['ok' => true];
        }
        DB::transaction(function () use ($id, $amount, $note) {
            if ($amount > 0) {
                Wallet::credit($id, $amount, 'adjust', 'admin', self::str($note, 200) ?? '');
            } else {
                Wallet::debit($id, -$amount, 'admin', self::str($note, 200) ?? '');
            }
            Audit::log('wallet.adjust', $id, ['amount' => $amount, 'note' => $note]);
        });

        return ['ok' => true];
    }

    // ---------- مربی‌ها ----------
    public function adminCoachSave(array $co): array
    {
        $old = isset($co['id']) ? DB::table('coaches')->where('id', $co['id'])->first() : null;
        $known = ['id', 'name', 'title', 'level', 'exp', 'rating', 'price', 'img', 'bio', 'record', 'packs', 'prices', 'active', 'member', 'phone', 'since', 'share', 'note', 'login'];
        $p = [];
        if (! $old || array_key_exists('name', $co)) {
            $p['name'] = self::str($co['name'] ?? '', 120, 2, false);
        }
        foreach (['title' => 120, 'bio' => 3000, 'since' => 12, 'note' => 2000] as $k => $max) {
            if (array_key_exists($k, $co)) {
                $p[$k] = self::str($co[$k], $max) ?? '';
            }
        }
        if (array_key_exists('level', $co)) {
            $p['level'] = Catalog::isLevel($co['level']) ? $co['level'] : 'B';
        }
        if (array_key_exists('exp', $co)) {
            $p['exp'] = self::int($co['exp'] ?: 0, 0, 80);
        }
        if (array_key_exists('price', $co)) {
            $p['price'] = self::int($co['price'] ?: 0, 0, 1_000_000_000);
        }
        if (array_key_exists('share', $co)) {
            $p['share'] = self::int($co['share'] ?: 0, 0, 100);
        }
        if (array_key_exists('img', $co)) {
            $p['img'] = Uploads::image($co['img']);
        }
        if (array_key_exists('record', $co)) {
            $p['record'] = self::json(array_values(array_map(fn ($x) => mb_substr((string) $x, 0, 200), (array) $co['record'])));
        }
        if (array_key_exists('packs', $co)) {
            $p['packs'] = self::json(array_map(fn ($x) => (bool) $x, array_intersect_key((array) $co['packs'], Catalog::COACH_PACKS)));
        }
        if (array_key_exists('prices', $co)) {
            $prices = [];
            foreach (array_intersect_key((array) $co['prices'], Catalog::COACH_PACKS) as $k => $v) {
                if ($v !== null && $v !== '' && (int) $v > 0) {
                    $prices[$k] = self::int($v, 1, 2_000_000_000);
                }
            }
            $p['prices'] = self::json((object) $prices);
        }
        if (array_key_exists('active', $co)) {
            $p['active'] = (bool) $co['active'];
        }
        if (array_key_exists('member', $co)) {
            $p['member'] = $co['member'] && DB::table('members')->where('id', $co['member'])->exists() ? $co['member'] : null;
        }
        if (array_key_exists('phone', $co)) {
            $p['phone'] = $co['phone'] ? self::phone($co['phone']) : null;
        }
        $extra = array_diff_key($co, array_flip($known));
        if ($extra) {
            $meta = array_merge($old ? (json_decode($old->meta ?? '[]', true) ?: []) : [], $extra);
            $p['meta'] = self::json($meta);
        }
        if ($old) {
            DB::table('coaches')->where('id', $old->id)->update($p + ['updated_at' => now()]);
            $id = $old->id;
        } else {
            $id = Ids::accept($co['id'] ?? null, 'coaches', 'k');
            DB::table('coaches')->insert($p + ['id' => $id, 'packs' => $p['packs'] ?? self::json(['one' => true, 'five' => true, 'ten' => true, 'group' => true]),
                'prices' => $p['prices'] ?? '{}', 'record' => $p['record'] ?? '[]', 'active' => $p['active'] ?? true, 'created_at' => now(), 'updated_at' => now()]);
        }
        Audit::log('coach.save', $id);
        Sync::touch('coaches');

        return ['ok' => true, 'id' => $id];
    }

    public function adminCoachLogin(string $id, array $login): array
    {
        $c = DB::table('coaches')->where('id', $id)->first();
        if (! $c) {
            Fail::with('gone');
        }
        $on = (bool) ($login['on'] ?? false);
        $user = strtolower(trim((string) ($login['user'] ?? '')));
        $pass = (string) ($login['pass'] ?? '');
        $p = ['login_on' => $on, 'cap_day' => self::int($login['day'] ?? $c->cap_day, 0, 24), 'cap_week' => self::int($login['week'] ?? $c->cap_week, 0, 100)];
        if ($user !== '') {
            if (! preg_match('/^[a-z0-9._-]{3,40}$/', $user)) {
                Fail::with('bad');
            }
            if (PlayerActions::usernameTaken($user, null, $id)) {
                Fail::with('taken');
            }
            $p['username'] = $user;
        } elseif ($on) {
            Fail::with('bad');
        } else {
            $p['username'] = null;
        }
        if ($pass !== '') {
            if (strlen($pass) < 6 || strlen($pass) > 72) {
                Fail::with('weak');
            }
            $p['password'] = Hash::make($pass);
        } elseif ($on && ! $c->password) {
            Fail::with('weak');
        }
        DB::table('coaches')->where('id', $id)->update($p + ['updated_at' => now()]);
        if (! $on || $pass !== '') {
            // بستن دسترسی یا تغییر رمز: نشست‌های قبلی مربی باطل می‌شود
            DB::table('personal_access_tokens')->where('tokenable_type', \App\Models\Coach::class)->where('tokenable_id', $id)->delete();
        }
        Audit::log('coach.login', $id, ['on' => $on, 'user' => $user]);
        Sync::touch('coaches');

        return ['ok' => true];
    }

    public function adminLimits(array $l): array
    {
        $cur = Settings::limits();
        Settings::put('limits', [
            'coachRun' => self::int($l['coachRun'] ?? $cur['coachRun'], 1, 12),
            'playerRun' => self::int($l['playerRun'] ?? $cur['playerRun'], 1, 8),
        ]);
        Sync::touch('settings');

        return ['ok' => true];
    }

    public function adminCoachReq(string $id, $ok): array
    {
        return Locks::run(['booking'], function () use ($id, $ok) {
            $r = DB::table('coach_requests')->where('id', $id)->first();
            if (! $r || $r->status !== 'pending') {
                Fail::with('gone');
            }
            if (! $ok) {
                DB::table('coach_requests')->where('id', $id)->update(['status' => 'rejected', 'decided_at' => now(), 'updated_at' => now()]);
                Sync::touch('coachReqs');

                return ['ok' => true];
            }
            $c = DB::table('coaches')->where('id', $r->coach)->first();
            if (! Availability::isFree($r->date, (int) $r->court, (float) $r->start, (float) $r->dur) || Availability::coachBusy($r->coach, $r->date, (float) $r->start, (float) $r->dur)) {
                Fail::with('busy');
            }
            DB::table('coach_requests')->where('id', $id)->update(['status' => 'ok', 'decided_at' => now(), 'updated_at' => now()]);
            // هر ساعت یک رزرو جدا تا مربی برای هر ساعت شاگرد بگذارد
            for ($i = 0; $i < (int) $r->dur; $i++) {
                $bid = Ids::make('cb');
                DB::table('bookings')->insert([
                    'id' => $bid, 'court' => $r->court, 'date' => $r->date, 'start' => (float) $r->start + $i, 'dur' => 1, 'type' => 'coach', 'status' => 'ok',
                    'source' => 'coach', 'by' => $r->student, 'coach' => $r->coach, 'price' => (int) ($c->price ?? 0), 'paid' => 0, 'note' => $r->note, 'block' => $r->id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                if ($r->student) {
                    DB::table('booking_players')->insert(['booking_id' => $bid, 'pos' => 0, 'player' => $r->student, 'member_id' => Members::isMemberId($r->student) ? $r->student : null, 'created_at' => now(), 'updated_at' => now()]);
                }
            }
            Audit::log('coachreq.approve', $id);
            Sync::touch('coachReqs', 'bookings');

            return ['ok' => true];
        });
    }

    // ---------- رزرو ----------
    public function adminAddBooking(array $b): array
    {
        $type = $b['type'] ?? null;
        if (! in_array($type, Catalog::BOOKING_TYPES, true)) {
            Fail::with('bad');
        }
        $date = self::date($b['date'] ?? null);
        $court = self::int($b['court'] ?? 0, 1, 4);
        $start = self::num($b['start'] ?? -1, 0, 23.5);
        $dur = self::num($b['dur'] ?? 0, 0.5, 17);
        if (fmod($start * 2, 1) != 0 || fmod($dur * 2, 1) != 0) {
            Fail::with('bad');
        }
        $price = $type === 'block' ? 0 : self::int($b['price'] ?? 0, 0, 2_000_000_000);
        $paid = $type === 'block' ? 0 : self::int($b['paid'] ?? 0, 0, $price);
        $method = $paid > 0 ? self::deskMethod($b['method'] ?? null) : null;
        $by = $type === 'block' ? null : ($b['by'] ?? null);
        if ($by !== null && ! Members::validPlayer($by)) {
            Fail::with('bad');
        }
        $coach = null;
        if ($type === 'coach') {
            $coach = DB::table('coaches')->where('id', $b['coach'] ?? '')->first();
            if (! $coach) {
                Fail::with('bad');
            }
        }
        $levels = $type === 'open' ? array_values(array_filter((array) ($b['levels'] ?? []), fn ($l) => Catalog::isLevel($l))) : null;
        $note = self::str($b['note'] ?? null, 255);

        return Locks::run(['booking'], function () use ($b, $type, $date, $court, $start, $dur, $price, $paid, $method, $by, $coach, $levels, $note) {
            if (! Availability::isFree($date, $court, $start, $dur) || ($coach && Availability::coachBusy($coach->id, $date, $start, $dur))) {
                Fail::with('busy');
            }
            $id = Ids::accept($b['id'] ?? null, 'bookings', 'd');
            $this->deskWallet($method, $by, $paid, 'booking:'.$id);
            DB::table('bookings')->insert([
                'id' => $id, 'court' => $court, 'date' => $date, 'start' => $start, 'dur' => $dur, 'type' => $type, 'status' => 'ok', 'source' => 'desk',
                'by' => $by, 'coach' => $coach->id ?? null, 'price' => $price, 'full' => $type === 'open' ? $price : null, 'paid' => $paid, 'method' => $method,
                'levels' => $levels ? json_encode($levels) : null, 'visibility' => $type === 'open' ? 'public' : null, 'note' => $note,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($by) {
                DB::table('booking_players')->insert(['booking_id' => $id, 'pos' => 0, 'player' => $by, 'member_id' => Members::isMemberId($by) ? $by : null,
                    'share' => $method === 'wallet' ? $paid : null, 'share_method' => $method === 'wallet' ? 'wallet' : null, 'created_at' => now(), 'updated_at' => now()]);
            }
            Audit::log('booking.add', $id, ['type' => $type, 'date' => $date, 'court' => $court]);
            Sync::touch('bookings');

            return ['ok' => true, 'id' => $id];
        });
    }

    public function adminSettle(string $id, $method): array
    {
        $method = self::deskMethod($method);

        return Locks::run(['booking'], function () use ($id, $method) {
            $b = DB::table('bookings')->where('id', $id)->first();
            if (! $b || $b->status !== 'ok' || (int) $b->paid >= (int) $b->price) {
                return ['ok' => true];
            }
            $amt = (int) $b->price - (int) $b->paid;
            $this->deskWallet($method, $b->by, $amt, 'booking:'.$id);
            if ($method === 'wallet') {
                // پرداخت از کیف پول عضو: به سهم او اضافه می‌شود تا در لغو با استرداد برگردد
                $row = DB::table('booking_players')->where('booking_id', $id)->where('player', $b->by)->first();
                if ($row) {
                    DB::table('booking_players')->where('id', $row->id)->update(['share' => (int) $row->share + $amt, 'share_method' => 'wallet', 'updated_at' => now()]);
                } else {
                    DB::table('booking_players')->insert(['booking_id' => $id, 'pos' => 9, 'player' => $b->by, 'member_id' => $b->by, 'share' => $amt, 'share_method' => 'wallet', 'created_at' => now(), 'updated_at' => now()]);
                }
            }
            DB::table('booking_payments')->insert(['booking_id' => $id, 'amount' => $amt, 'method' => $method, 'at' => now(), 'actor' => Audit::$actor]);
            DB::table('bookings')->where('id', $id)->update(['paid' => (int) $b->price, 'method' => $b->method ?: $method, 'updated_at' => now()]);
            Audit::log('booking.settle', $id, ['amount' => $amt, 'method' => $method]);
            Sync::touch('bookings');

            return ['ok' => true];
        });
    }

    /** لغو؛ با استرداد، هر پولی که از اپ (کیف پول/درگاه) پرداخت شده به کیف پول همان عضو برمی‌گردد */
    public function adminCancel(string $id, $refund): array
    {
        return Locks::run(['booking'], function () use ($id, $refund) {
            $b = DB::table('bookings')->where('id', $id)->first();
            if (! $b || $b->status !== 'ok') {
                return ['ok' => true];
            }
            $refund = (bool) $refund && (int) $b->paid > 0;
            DB::table('bookings')->where('id', $id)->update(['status' => 'cancelled', 'refunded' => $refund, 'cancelled_at' => now(), 'updated_at' => now()]);
            $rows = DB::table('booking_players')->where('booking_id', $id)->orderBy('member_id')->get();
            $label = \App\Support\Jalali::label($b->date).'، ساعت '.\App\Support\Jalali::hour((float) $b->start);
            $cap = $b->series ? (int) (DB::table('sales')->where('series', $b->series)->whereNull('refunded_at')->value('price') ?? 0) : PHP_INT_MAX;
            $refunded = 0;
            foreach ($rows as $r) {
                if (! $r->member_id) {
                    continue;
                }
                $amt = min((int) $r->share, max(0, $cap - $refunded));
                $app = in_array($r->share_method, ['wallet', 'online', 'package'], true) || ($r->share_method === null && $amt > 0 && $b->source === 'app');
                if ($refund && $amt > 0 && $app) {
                    Wallet::credit($r->member_id, $amt, 'refund', 'booking:'.$id, 'لغو رزرو توسط باشگاه');
                    $refunded += $amt;
                    Members::notify($r->member_id, '↩️', 'رزرو شما لغو شد', 'باشگاه رزرو '.$label.' را لغو کرد؛ مبلغ پرداختی به کیف پول برگشت.');
                } elseif ($b->type !== 'block') {
                    Members::notify($r->member_id, '↩️', 'رزرو شما لغو شد', 'باشگاه رزرو '.$label.' را لغو کرد.');
                }
            }
            if ($refund) {
                PlayerActions::shrinkSeriesSale($b, $refunded);
            }
            Audit::log('booking.cancel', $id, ['refund' => $refund, 'wallet' => $refunded]);
            Sync::touch('bookings');

            return ['ok' => true];
        });
    }

    public function adminMove(string $id, array $patch): array
    {
        $court = self::int($patch['court'] ?? 0, 1, 4);

        return Locks::run(['booking'], function () use ($id, $court) {
            $b = DB::table('bookings')->where('id', $id)->first();
            if (! $b || $b->status !== 'ok') {
                Fail::with('gone');
            }
            if (! Availability::isFree($b->date, $court, (float) $b->start, (float) $b->dur, $id)) {
                Fail::with('busy');
            }
            DB::table('bookings')->where('id', $id)->update(['court' => $court, 'updated_at' => now()]);
            Audit::log('booking.move', $id, ['court' => $court]);
            Sync::touch('bookings');

            return ['ok' => true];
        });
    }

    public function adminReview(string $id, array $patch): array
    {
        $p = [];
        if (array_key_exists('ok', $patch)) {
            $p['ok'] = (bool) $patch['ok'];
        }
        if (array_key_exists('hidden', $patch)) {
            $p['hidden'] = (bool) $patch['hidden'];
        }
        if ($p) {
            DB::table('reviews')->where('id', $id)->update($p);
            Sync::touch('reviews');
        }

        return ['ok' => true];
    }

    // ---------- مسابقه‌ها ----------
    private const EVENT_COLS = ['kind', 'title', 'desc', 'format', 'scoring', 'gender', 'ageMin', 'ageMax', 'date', 'start', 'dur', 'courts', 'levels', 'cap', 'fee', 'prize', 'img', 'status', 'note', 'teams', 'groups', 'matches', 'setup', 'regs', 'id'];

    private function eventPatch(array $ev, ?object $old): array
    {
        $p = [];
        $has = fn ($k) => ! $old || array_key_exists($k, $ev);
        if ($has('kind')) {
            $p['kind'] = in_array($ev['kind'] ?? 'friday', ['friday', 'official'], true) ? ($ev['kind'] ?? 'friday') : 'friday';
        }
        if ($has('title')) {
            $p['title'] = self::str($ev['title'] ?? '', 200, 1, false);
        }
        if (array_key_exists('desc', $ev)) {
            $p['desc'] = self::str($ev['desc'], 2000);
        }
        if ($has('format')) {
            $p['format'] = in_array($ev['format'] ?? 'groups', ['groups', 'knockout'], true) ? ($ev['format'] ?? 'groups') : 'groups';
        }
        if (array_key_exists('scoring', $ev)) {
            $p['scoring'] = in_array($ev['scoring'], ['set6', 'pro9', 'bo3'], true) ? $ev['scoring'] : null;
        }
        if (array_key_exists('gender', $ev)) {
            $p['gender'] = in_array($ev['gender'], ['all', 'f', 'm'], true) ? $ev['gender'] : 'all';
        }
        foreach (['ageMin' => 'age_min', 'ageMax' => 'age_max'] as $k => $col) {
            if (array_key_exists($k, $ev)) {
                $p[$col] = $ev[$k] ? self::int($ev[$k], 1, 99) : null;
            }
        }
        if ($has('date')) {
            $p['date'] = self::date($ev['date'] ?? null);
        }
        if ($has('start')) {
            $p['start'] = self::num($ev['start'] ?? 9, 0, 23.5);
        }
        if ($has('dur')) {
            $p['dur'] = self::num($ev['dur'] ?? 3, 0.5, 18);
        }
        if ($has('courts')) {
            $courts = array_values(array_unique(array_map('intval', array_filter((array) ($ev['courts'] ?? [1, 2, 3, 4]), fn ($c) => in_array((int) $c, Catalog::COURT_IDS, true)))));
            sort($courts);
            $p['courts'] = json_encode($courts);
        }
        if ($has('levels')) {
            $p['levels'] = json_encode(array_values(array_filter((array) ($ev['levels'] ?? []), fn ($l) => Catalog::isLevel($l))));
        }
        if ($has('cap')) {
            $p['cap'] = self::int($ev['cap'] ?? 16, 2, 512);
        }
        if ($has('fee')) {
            $p['fee'] = self::int($ev['fee'] ?? 0, 0, 1_000_000_000);
        }
        if (array_key_exists('prize', $ev)) {
            $p['prize'] = self::str($ev['prize'], 255);
        }
        if (array_key_exists('img', $ev)) {
            $p['img'] = Uploads::image($ev['img']);
        }
        if ($has('status')) {
            $p['status'] = in_array($ev['status'] ?? 'draft', ['draft', 'open', 'closed', 'done', 'cancelled'], true) ? ($ev['status'] ?? 'draft') : 'draft';
        }
        if (array_key_exists('note', $ev)) {
            $p['note'] = self::str($ev['note'], 2000);
        }
        foreach (['teams', 'groups', 'matches', 'setup'] as $k) {
            if (array_key_exists($k, $ev)) {
                $p[$k] = self::json($ev[$k]);
            }
        }
        $extra = array_diff_key($ev, array_flip(self::EVENT_COLS));
        if ($extra) {
            $p['extra'] = self::json(array_merge($old ? (json_decode($old->extra ?? '[]', true) ?: []) : [], $extra));
        }

        return $p;
    }

    public function adminEventSave(array $ev): array
    {
        return Locks::run(['booking', 'event'], function () use ($ev) {
            $old = isset($ev['id']) ? DB::table('events')->where('id', $ev['id'])->first() : null;
            $p = $this->eventPatch($ev, $old);
            if ($old) {
                DB::table('events')->where('id', $old->id)->update($p + ['updated_at' => now()]);
                $id = $old->id;
                if (($p['status'] ?? null) === 'cancelled' && $old->status !== 'cancelled') {
                    $this->refundEvent($id);
                }
            } else {
                $id = Ids::accept($ev['id'] ?? null, 'events', 'ev');
                DB::table('events')->insert($p + ['id' => $id, 'teams' => '[]', 'groups' => '[]', 'matches' => '[]', 'courts' => $p['courts'] ?? '[1,2,3,4]', 'created_at' => now(), 'updated_at' => now()]);
            }
            Audit::log('event.save', $id, array_intersect_key($p, array_flip(['title', 'status', 'date'])));
            Sync::touch('events', 'bookings');

            return ['ok' => true, 'id' => $id];
        });
    }

    /** لغو مسابقه: ورودی‌هایی که از اپ پرداخت شده‌اند به کیف پول پرداخت‌کننده برمی‌گردد */
    private function refundEvent(string $id): void
    {
        $ev = DB::table('events')->where('id', $id)->first();
        $sales = DB::table('event_registrations')->where('event_id', $id)->whereNotNull('sale')->distinct()->pluck('sale')->all();
        foreach ($sales as $sid) {
            $s = DB::table('sales')->where('id', $sid)->whereNull('refunded_at')->first();
            if (! $s) {
                continue;
            }
            $app = in_array($s->method, ['wallet', 'online'], true);
            if ($app && Members::isMemberId($s->by) && DB::table('members')->where('id', $s->by)->exists()) {
                Wallet::credit($s->by, (int) $s->price, 'refund', 'event:'.$id, 'لغو '.$ev->title);
                Members::notify($s->by, '↩️', $ev->title.' لغو شد', 'ورودی پرداختی شما به کیف پول برگشت.');
            }
            DB::table('sales')->where('id', $sid)->update(['refunded_at' => now(), 'updated_at' => now()]);
        }
        Sync::touch('sales');
    }

    public function adminEventDel(string $id): array
    {
        return Locks::run(['event'], function () use ($id) {
            if (DB::table('event_registrations')->where('event_id', $id)->where('paid', '>', 0)->exists()) {
                Fail::with('paid');
            }
            DB::table('events')->where('id', $id)->delete();
            Audit::log('event.delete', $id);
            Sync::touch('events', 'bookings');

            return ['ok' => true];
        });
    }

    /** تیم‌ها، گروه‌ها و نتیجه‌ها (محاسبه در پنل مدیر با events.js) */
    public function adminEventSet(string $id, array $data): array
    {
        return Locks::run(['event'], function () use ($id, $data) {
            if (! DB::table('events')->where('id', $id)->exists()) {
                Fail::with('gone');
            }
            $p = [];
            foreach (['teams', 'groups', 'matches', 'setup'] as $k) {
                if (array_key_exists($k, $data)) {
                    $p[$k] = self::json($data[$k]);
                }
            }
            if ($p) {
                DB::table('events')->where('id', $id)->update($p + ['updated_at' => now()]);
            }
            foreach ((array) ($data['regs'] ?? []) as $r) {
                if (! isset($r['id'])) {
                    continue;
                }
                DB::table('event_registrations')->where('event_id', $id)->where('rid', $r['id'])->update([
                    'pair' => isset($r['pair']) && $r['pair'] ? mb_substr((string) $r['pair'], 0, 60) : null,
                    'waiting' => ! empty($r['waiting']), 'updated_at' => now(),
                ]);
            }
            Sync::touch('events');

            return ['ok' => true];
        });
    }

    /** ثبت‌نام حضوری؛ با یار، نفر اول ورودی هر دو را می‌دهد */
    public function adminEventReg(string $id, array $pa, $method, $each, $partner = null): array
    {
        $method = $method === 'free' ? 'free' : self::deskMethod($method);
        $each = $method === 'free' ? 0 : self::int($each ?: 0, 0, 1_000_000_000);
        $people = array_values(array_filter([$pa, $partner ? (array) $partner : null]));
        $clean = [];
        foreach ($people as $x) {
            $by = $x['by'] ?? null;
            if ($by !== null && ! Members::validPlayer($by)) {
                Fail::with('bad');
            }
            $m = Members::isMemberId($by) ? DB::table('members')->where('id', $by)->first() : null;
            $clean[] = [
                'by' => $by, 'name' => self::str($x['name'] ?? ($m->name ?? ''), 120, 1, false), 'level' => Catalog::isLevel($x['level'] ?? null) ? $x['level'] : ($m->level ?? null),
                'phone' => isset($x['phone']) && $x['phone'] ? self::phone($x['phone']) : ($m->phone ?? null),
                'gender' => in_array($x['gender'] ?? ($m->gender ?? null), ['f', 'm'], true) ? ($x['gender'] ?? $m->gender) : null,
                'birth' => isset($x['birth']) && is_numeric($x['birth']) ? (int) $x['birth'] : ($m->birth ?? null),
            ];
        }

        return Locks::run(['event'], function () use ($id, $method, $each, $clean) {
            $ev = DB::table('events')->where('id', $id)->first();
            if (! $ev) {
                Fail::with('gone');
            }
            $regs = DB::table('event_registrations')->where('event_id', $id)->get();
            foreach ($clean as $c) {
                if ($c['by'] && $regs->contains('by', $c['by'])) {
                    Fail::with('dup');
                }
            }
            $total = $each * count($clean);
            $first = fn ($s) => explode(' ', trim($s))[0];
            $saleId = null;
            if ($total > 0) {
                $saleId = 'S-'.Ids::seq('S', 1000);
                $this->deskWallet($method, $clean[0]['by'], $total, 'event:'.$id);
                DB::table('sales')->insert(['id' => $saleId, 'kind' => 'event', 'item' => $id,
                    'name' => count($clean) > 1 ? $ev->title.'، تیم '.$first($clean[0]['name']).' و '.$first($clean[1]['name']) : $ev->title,
                    'by' => $clean[0]['by'], 'price' => $total, 'method' => $method, 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            }
            $rid = 'r'.Ids::make('');
            $pair = count($clean) > 1 ? 'p'.Ids::make('') : null;
            foreach ($clean as $i => $c) {
                DB::table('event_registrations')->insert($c + [
                    'event_id' => $id, 'rid' => $rid.($i ? 'b' : ''), 'at' => now(), 'method' => $total > 0 ? $method : 'free', 'paid' => $each, 'source' => 'desk',
                    'sale' => $saleId, 'pair' => $pair, 'payer' => $pair ? $clean[0]['by'] : null, 'waiting' => false, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            Audit::log('event.reg', $id, ['n' => count($clean), 'total' => $total]);
            Sync::touch('events', 'sales');

            return ['ok' => true];
        });
    }

    /** حذف شرکت‌کننده = برگرداندن ورودی؛ اگر با یار ثبت‌نام کرده، هر دو با هم */
    public function adminEventUnreg(string $id, string $rid): array
    {
        return Locks::run(['event'], function () use ($id, $rid) {
            $reg = DB::table('event_registrations')->where('event_id', $id)->where('rid', $rid)->first();
            if (! $reg) {
                return ['ok' => true];
            }
            $gone = DB::table('event_registrations')->where('event_id', $id)
                ->where(fn ($q) => $q->where('rid', $rid)->when($reg->pair, fn ($w) => $w->orWhere('pair', $reg->pair)))->get();
            $amount = (int) $gone->sum('paid');
            DB::table('event_registrations')->whereIn('id', $gone->pluck('id')->all())->delete();
            DB::table('events')->where('id', $id)->update(['teams' => '[]', 'groups' => '[]', 'matches' => '[]', 'updated_at' => now()]);
            if ($reg->sale && $s = DB::table('sales')->where('id', $reg->sale)->whereNull('refunded_at')->first()) {
                $still = DB::table('event_registrations')->where('event_id', $id)->where('sale', $reg->sale)->exists();
                $refund = min($amount, (int) $s->price);
                if ($still) {
                    DB::table('sales')->where('id', $s->id)->update(['price' => (int) $s->price - $refund, 'updated_at' => now()]);
                } else {
                    DB::table('sales')->where('id', $s->id)->update(['refunded_at' => now(), 'updated_at' => now()]);
                    $refund = (int) $s->price;
                }
                $payer = $reg->payer ?: $s->by;
                if (in_array($s->method, ['wallet', 'online'], true) && Members::isMemberId($payer) && DB::table('members')->where('id', $payer)->exists() && $refund > 0) {
                    Wallet::credit($payer, $refund, 'refund', 'event:'.$id, 'برگشت ورودی مسابقه');
                }
            }
            Audit::log('event.unreg', $id, ['rid' => $rid, 'amount' => $amount]);
            Sync::touch('events', 'sales');

            return ['ok' => true];
        });
    }

    // ---------- تنظیمات ----------
    public function adminHours(array $h): array
    {
        $open = self::int($h['open'] ?? 7, 0, 22);
        $close = self::int($h['close'] ?? 24, 2, 24);
        if ($close - $open < 2) {
            Fail::with('bad');
        }
        Settings::put('hours', ['open' => $open, 'close' => $close]);
        Sync::touch('settings');

        return ['ok' => true];
    }

    public function adminPricing(array $p): array
    {
        $cur = Settings::pricing();
        Settings::put('pricing', [
            'offpeak' => self::int($p['offpeak'] ?? $cur['offpeak'], 1000, 1_000_000_000),
            'peak' => self::int($p['peak'] ?? $cur['peak'], 1000, 1_000_000_000),
            'peakFrom' => self::int($p['peakFrom'] ?? $cur['peakFrom'], 0, 24),
        ]);
        Audit::log('settings.pricing', null, $p);
        Sync::touch('settings');

        return ['ok' => true];
    }

    public function adminWelcome(array $w): array
    {
        Settings::put('welcome', ['wallet' => self::int($w['wallet'] ?? 0, 0, 100_000_000), 'xp' => self::int($w['xp'] ?? 0, 0, 1000)]);
        Audit::log('settings.welcome', null, $w);
        Sync::touch('settings');

        return ['ok' => true];
    }

    public function adminCourtEdit($id, $edit): array
    {
        $id = self::int($id, 1, 4);
        $val = null;
        if ($edit) {
            $edit = (array) $edit;
            $val = ['name' => self::str($edit['name'] ?? '', 24, 2, false)];
            if (array_key_exists('img', $edit)) {
                $val['img'] = Uploads::image($edit['img']);
            }
            foreach (['kind' => 30] as $k => $max) {
                if (isset($edit[$k])) {
                    $val[$k] = self::str($edit[$k], $max);
                }
            }
            if (isset($edit['indoor'])) {
                $val['indoor'] = (bool) $edit['indoor'];
            }
        }
        DB::table('courts')->where('id', $id)->update(['edits' => $val ? json_encode($val, JSON_UNESCAPED_UNICODE) : null, 'updated_at' => now()]);
        Sync::touch('settings');

        return ['ok' => true];
    }

    /** فقط در حالت نمایشی: برگرداندن داده‌ی نمایشی */
    public function adminDemoReset(): array
    {
        if (! config('quadra.demo')) {
            Fail::with('denied');
        }
        \Illuminate\Support\Facades\Artisan::call('quadra:demo', ['--force' => true]);

        return ['ok' => true];
    }

    public function adminCourt($id, $off): array
    {
        DB::table('courts')->where('id', self::int($id, 1, 4))->update(['off' => (bool) $off, 'updated_at' => now()]);
        Audit::log('court.off', (string) $id, ['off' => (bool) $off]);
        Sync::touch('settings', 'bookings');

        return ['ok' => true];
    }
}
