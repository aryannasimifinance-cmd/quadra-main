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
            DB::table('booking_players')->where('booking_id', $b->id)->delete();
            foreach ($players as $i => $p) {
                DB::table('booking_players')->insert(['booking_id' => $b->id, 'pos' => $i, 'player' => $p, 'member_id' => Members::isMemberId($p) ? $p : null, 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('bookings')->where('id', $b->id)->update(['by' => $players[0] ?? null, 'updated_at' => now()]);
            Sync::touch('bookings', 'members');

            return ['ok' => true];
        });
    }
}
