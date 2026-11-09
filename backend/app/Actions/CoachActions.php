<?php

namespace App\Actions;

use App\Domain\Availability;
use App\Domain\Catalog;
use App\Domain\Members;
use App\Support\Dates;
use App\Support\Fail;
use App\Support\Ids;
use App\Support\Locks;
use App\Support\Sync;
use Illuminate\Support\Facades\DB;

/** پنل مربی: درخواست زمین (تا سقف) و شاگردگذاری ساعت‌های تأییدشده */
final class CoachActions
{
    public function __construct(private object $coach) {}

    private function refresh(): object
    {
        $c = DB::table('coaches')->where('id', $this->coach->id)->first();
        if (! $c || ! $c->login_on) {
            Fail::with('off');
        }

        return $this->coach = $c;
    }

    public function coachReq(array $r): array
    {
        $date = Dates::parse($r['date'] ?? null);
        $court = $r['court'] ?? null;
        $start = $r['start'] ?? null;
        $dur = $r['dur'] ?? null;
        if (! $date || ! is_numeric($court) || ! in_array((int) $court, Catalog::COURT_IDS, true) || ! is_numeric($start) || fmod((float) $start, 1) != 0
            || ! is_numeric($dur) || (int) $dur != $dur || (int) $dur < 1 || (int) $dur > 12) {
            Fail::with('bad');
        }
        [$court, $start, $dur] = [(int) $court, (float) $start, (float) $dur];
        $note = mb_substr(trim(\App\Support\In::str($r['note'] ?? '')), 0, 200);
        $student = $r['student'] ?? null;
        if ($student !== null && ! Members::validPlayer($student)) {
            $student = null;
        }

        return Locks::run(['booking'], function () use ($date, $court, $start, $dur, $note, $student) {
            $c = $this->refresh();
            if (Availability::openHours($c->id) > 0) {
                Fail::with('open');
            }
            $lim = Availability::coachLeft($c, $date);
            if ($dur > $lim['day'] || $dur > $lim['week']) {
                Fail::with('quota', ['left' => min($lim['day'], $lim['week'])]);
            }
            if (Availability::coachRun($c->id, $date, $start, $dur) > $lim['run'] + 1e-6) {
                Fail::with('run', ['run' => $lim['run']]);
            }
            if (Availability::started($date, $start) || ! Availability::isFree($date, $court, $start, $dur) || Availability::coachBusy($c->id, $date, $start, $dur)) {
                Fail::with('busy');
            }
            // ساعتی که مربی دیگری برایش درخواست منتظر داده هم نگه داشته می‌شود
            $clash = DB::table('coach_requests')->where('status', 'pending')->where('date', $date)
                ->where(fn ($q) => $q->where('coach', $c->id)->orWhere('court', $court))->get(['start', 'dur'])
                ->contains(fn ($x) => $start < (float) $x->start + (float) $x->dur && (float) $x->start < $start + $dur);
            if ($clash) {
                Fail::with('busy');
            }
            DB::table('coach_requests')->insert([
                'id' => Ids::make('CR'), 'coach' => $c->id, 'date' => $date, 'court' => $court, 'start' => $start, 'dur' => $dur,
                'student' => $student, 'note' => $note, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
            ]);
            Sync::touch('coachReqs');

            return ['ok' => true];
        });
    }

    public function coachReqCancel(array $a): array
    {
        $c = $this->refresh();
        $n = DB::table('coach_requests')->where('id', $a['id'] ?? '')->where('coach', $c->id)->where('status', 'pending')
            ->update(['status' => 'cancelled', 'decided_at' => now(), 'updated_at' => now()]);
        if ($n) {
            Sync::touch('coachReqs');
        }

        return ['ok' => (bool) $n];
    }

    /**
     * پرداخت ساعت‌های تأییدشده‌ای که شاگرد دارند:
     * payer=coach → از کیف پول عضوِ متناظر مربی یا آنلاین؛
     * payer=student → به شاگرد اول هر ساعت فرستاده می‌شود تا خودش در اپ بپردازد.
     */
    public function coachPay(array $a): array
    {
        $ids = array_values(array_unique(array_filter((array) ($a['ids'] ?? []), fn ($x) => is_string($x) && $x !== '')));
        $payer = $a['payer'] ?? null;
        if (! $ids || count($ids) > 60 || ! in_array($payer, ['coach', 'student'], true)) {
            Fail::with('bad');
        }
        $method = ($a['method'] ?? 'wallet') === 'online' ? 'online' : 'wallet';
        $c = $this->refresh();

        if ($payer === 'coach') {
            $c = $this->walletMember($c);
            Locks::run(['booking'], function () use ($ids, $c) {
                foreach ($this->payable($ids, $c) as $b) {
                    DB::table('bookings')->where('id', $b->id)->update(['pay_by' => $c->member, 'updated_at' => now()]);
                }
            });

            return PlayerActions::forMember($c->member)->payBooking(['ids' => $ids, 'method' => $method]);
        }

        return Locks::run(['booking'], function () use ($ids, $c) {
            $sent = [];
            foreach ($this->payable($ids, $c) as $b) {
                $first = DB::table('booking_players')->where('booking_id', $b->id)->orderBy('pos')->value('player');
                if (! $first || ! Members::isMemberId($first)) {
                    Fail::with('guest');
                }
                DB::table('bookings')->where('id', $b->id)->update(['pay_by' => $first, 'updated_at' => now()]);
                $sent[$first] = ($sent[$first] ?? 0) + (int) $b->price - (int) $b->paid;
            }
            foreach ($sent as $m => $amt) {
                Members::notify($m, '💳', 'پرداخت جلسه‌ی مربی', 'مربی '.$c->name.' هزینه‌ی جلسه را برای شما فرستاد: '.\App\Support\Jalali::fa(number_format($amt)).' تومان. از صفحه‌ی خانه پرداخت کنید.');
            }
            Sync::touch('bookings');

            return ['ok' => true, 'sent' => count($sent)];
        });
    }

    /**
     * کیف پول مربی همان کیف پول عضوِ متناظر اوست. اگر مربی هنوز به عضوی وصل نیست:
     * عضوی با همان موبایل پیدا و وصل می‌شود، وگرنه یک حساب عضو تازه برایش ساخته می‌شود.
     */
    private function walletMember(object $c): object
    {
        if ($c->member && DB::table('members')->where('id', $c->member)->exists()) {
            return $c;
        }

        return DB::transaction(function () use ($c) {
            $c = DB::table('coaches')->where('id', $c->id)->lockForUpdate()->first();
            if ($c->member && DB::table('members')->where('id', $c->member)->exists()) {
                return $c;
            }
            $mid = $c->phone ? DB::table('members')->where('phone', $c->phone)->value('id') : null;
            if (! $mid) {
                $mid = Ids::make('m');
                DB::table('members')->insert([
                    'id' => $mid, 'name' => $c->name, 'phone' => $c->phone ?: null, 'level' => $c->level ?: 'B', 'source' => 'desk',
                    'note' => 'حساب کیف پول مربی', 'joined_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('coaches')->where('id', $c->id)->update(['member' => $mid, 'updated_at' => now()]);
            Sync::touch('coaches', 'members');

            return $this->coach = DB::table('coaches')->where('id', $c->id)->first();
        });
    }

    /** ساعت‌های همین مربی که شاگرد دارند، تمام نشده‌اند و هنوز کامل پرداخت نشده‌اند */
    private function payable(array $ids, object $c): array
    {
        $rows = DB::table('bookings')->whereIn('id', $ids)->where('coach', $c->id)->whereNotNull('block')->where('status', 'ok')->get();
        if (count($rows) !== count($ids)) {
            Fail::with('gone');
        }
        foreach ($rows as $b) {
            if ((int) $b->paid >= (int) $b->price || Dates::at($b->date, (float) $b->start + (float) $b->dur)->lte(now())
                || ! DB::table('booking_players')->where('booking_id', $b->id)->exists()) {
                Fail::with('gone');
            }
        }

        return $rows->all();
    }

    /** شاگردهای یک ساعتِ تأییدشده (۱ یا ۲ نفر، عضو یا مهمان) */
    public function coachSetPlayers(array $a): array
    {
        $players = array_values(array_filter((array) ($a['players'] ?? []), fn ($x) => is_string($x) && $x !== ''));
        if (count($players) > 2 || count(array_unique($players)) !== count($players)) {
            Fail::with('bad');
        }
        foreach ($players as $p) {
            if (! Members::validPlayer($p)) {
                Fail::with('bad');
            }
        }

        return Locks::run(['booking'], function () use ($a, $players) {
            $c = $this->refresh();
            $b = DB::table('bookings')->where('id', $a['id'] ?? '')->where('coach', $c->id)->whereNotNull('block')->where('status', 'ok')->first();
            if (! $b || Dates::at($b->date, (float) $b->start + (float) $b->dur)->lte(now())) {
                Fail::with('gone');
            }
            // شاگردی که پول این جلسه را داده حذف نمی‌شود (سهمش برای استرداد لازم است)
            $old = DB::table('booking_players')->where('booking_id', $b->id)->get()->keyBy('player');
            foreach ($old as $p => $row) {
                if ((int) $row->share > 0 && ! in_array($p, $players, true)) {
                    Fail::with('paid');
                }
            }
            DB::table('booking_players')->where('booking_id', $b->id)->delete();
            foreach ($players as $i => $p) {
                DB::table('booking_players')->insert(['booking_id' => $b->id, 'pos' => $i, 'player' => $p, 'member_id' => Members::isMemberId($p) ? $p : null,
                    'share' => isset($old[$p]) ? $old[$p]->share : null, 'share_method' => isset($old[$p]) ? $old[$p]->share_method : null, 'created_at' => now(), 'updated_at' => now()]);
            }
            $up = ['by' => $players[0] ?? null, 'updated_at' => now()];
            // پرداختی که به شاگردی سپرده شده بود که دیگر در جلسه نیست، دوباره بی‌پرداخت‌کننده می‌شود
            if ($b->pay_by && (int) $b->paid < (int) $b->price && $b->pay_by !== $c->member && ! in_array($b->pay_by, $players, true)) {
                $up['pay_by'] = null;
            }
            DB::table('bookings')->where('id', $b->id)->update($up);
            Sync::touch('bookings', 'members');

            return ['ok' => true];
        });
    }
}
