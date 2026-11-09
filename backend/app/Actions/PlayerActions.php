<?php

namespace App\Actions;

use App\Domain\Availability;
use App\Domain\Cafe;
use App\Domain\Catalog;
use App\Domain\Members;
use App\Domain\Pricing;
use App\Domain\Rules;
use App\Domain\Settings;
use App\Domain\Shop;
use App\Domain\Wallet;
use App\Payments\PaymentService;
use App\Support\Dates;
use App\Support\Fail;
use App\Support\Ids;
use App\Support\Locks;
use App\Support\Sync;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * کارهای بازیکن در اپ. هر کار: ورودی را کامل بررسی می‌کند، قیمت را خودش حساب می‌کند،
 * با قفل دیتابیس اجرا می‌شود و همان خروجی‌ای را برمی‌گرداند که اپ قبلاً از store می‌گرفت.
 */
final class PlayerActions
{
    /** کارهایی که پرداخت آنلاین دارند */
    public const PAYABLE = ['book', 'joinGame', 'bookSeries', 'registerEvent', 'buyPackage', 'checkout', 'cafeCheckout'];

    public function __construct(private object $me) {}

    public static function forMember(string $id): self
    {
        $m = DB::table('members')->where('id', $id)->first();
        if (! $m) {
            Fail::with('member');
        }

        return new self($m);
    }

    private function id(): string
    {
        return $this->me->id;
    }

    private function fresh(): void
    {
        $this->me = DB::table('members')->where('id', $this->id())->first();
    }

    /** اجرای یک کار با نام؛ prepaid یعنی پول از درگاه به کیف پول آمده و کار باید انجام شود */
    public function run(string $action, array $args, bool $prepaid = false): array
    {
        if (! in_array($action, self::PAYABLE, true)) {
            Fail::with('bad');
        }
        if ($prepaid) {
            $args['method'] = 'online';
        }

        return $this->{$action}($args, $prepaid);
    }

    // ---------- پرداخت ----------
    private static function method(array $a): string
    {
        $m = $a['method'] ?? 'wallet';
        if (! in_array($m, ['wallet', 'online'], true)) {
            Fail::with('bad');
        }

        return $m;
    }

    /** اگر آنلاین است و هنوز پرداخت نشده، کاربر به درگاه می‌رود */
    private function gate(string $action, array $a, bool $prepaid, int $total, string $desc): ?array
    {
        if (self::method($a) === 'online' && ! $prepaid && $total > 0) {
            unset($a['method']);

            return PaymentService::start($this->me, $total, $action, ['action' => $action, 'args' => $a + ['method' => 'online']], $desc);
        }

        return null;
    }

    private function charge(int $amount, string $ref, string $note): void
    {
        if ($amount > 0) {
            Wallet::debit($this->id(), $amount, $ref, $note);
        }
    }

    // ---------- ورودی‌ها ----------
    private static function date($k): string
    {
        $d = Dates::parse($k);
        if (! $d) {
            Fail::with('bad');
        }

        return $d;
    }

    private static function hour($v, float $min = 0, float $max = 24): float
    {
        if (! is_numeric($v)) {
            Fail::with('bad');
        }
        $h = (float) $v;
        if ($h < $min || $h > $max || fmod($h * 2, 1) != 0) {
            Fail::with('bad');
        }

        return $h;
    }

    private static function court($v): int
    {
        if (! is_numeric($v) || ! in_array((int) $v, Catalog::COURT_IDS, true)) {
            Fail::with('bad');
        }

        return (int) $v;
    }

    /** بازیکن‌ها: خود کاربر اول، بقیه عضو یا مهمان، بدون تکرار، حداکثر ۴ */
    private function players($list, int $max = 4): array
    {
        $list = is_array($list) ? array_values(array_filter($list, fn ($x) => $x !== null && $x !== '')) : [];
        $out = [$this->id()];
        foreach ($list as $p) {
            if ($p === $this->id() || $p === 'me') {
                continue;
            }
            if (! Members::validPlayer($p) || in_array($p, $out, true)) {
                Fail::with('bad');
            }
            $out[] = str_starts_with($p, 'f:') ? 'f:'.trim(mb_substr($p, 2)) : $p;
        }
        if (count($out) > $max) {
            Fail::with('bad');
        }

        return $out;
    }

    private function myCourtsCount(?int $plus = null): int
    {
        $me = $this->id();
        $courts = DB::table('bookings')->where('status', 'ok')
            ->where(fn ($q) => $q->where('by', $me)->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $me)))
            ->distinct()->pluck('court')->map(fn ($c) => (int) $c)->all();
        if ($plus) {
            $courts[] = $plus;
        }

        return count(array_unique($courts));
    }

    private function insertBooking(array $row, array $players, array $invited = []): string
    {
        $id = $row['id'] ?? Ids::make('b');
        DB::table('bookings')->insert($row + ['id' => $id, 'created_at' => now(), 'updated_at' => now()]);
        foreach (array_values($players) as $i => $p) {
            $pid = is_array($p) ? $p['player'] : $p;
            DB::table('booking_players')->insert([
                'booking_id' => $id, 'pos' => $i, 'player' => $pid, 'member_id' => Members::isMemberId($pid) ? $pid : null,
                'share' => is_array($p) ? ($p['share'] ?? null) : null, 'share_method' => is_array($p) ? ($p['method'] ?? null) : null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        foreach ($invited as $m) {
            DB::table('booking_invites')->insertOrIgnore(['booking_id' => $id, 'member_id' => $m]);
        }

        return $id;
    }

    // ---------- رزرو تکی (زمین، بازی باز، کلاس مربی) ----------
    private function bookPlan(array $a): array
    {
        $type = $a['type'] ?? null;
        if (! in_array($type, ['private', 'open', 'coach'], true)) {
            Fail::with('bad');
        }
        $date = self::date($a['date'] ?? null);
        $court = self::court($a['court'] ?? null);
        $start = self::hour($a['start'] ?? null, 0, 23.5);
        $limits = Settings::limits();
        $dur = $type === 'coach' ? 1.0 : self::hour($a['dur'] ?? null, 0.5, max(1, (int) $limits['playerRun']));
        $off = Members::off($this->id());
        $plan = compact('type', 'date', 'court', 'start', 'dur');

        if ($type === 'coach') {
            $coach = DB::table('coaches')->where('id', $a['coach'] ?? '')->first();
            $pack = $a['pack'] ?? 'one';
            if (! $coach || ! $coach->active || ! in_array($pack, ['one', 'group'], true) || ! Pricing::coachPackOn($coach, $pack)) {
                Fail::with('bad');
            }
            $plan += ['coach' => $coach, 'price' => Pricing::coachPack($coach, $pack), 'players' => [$this->id()]];
            $plan['amount'] = $plan['price'];

            return $plan;
        }

        $players = $this->players($a['players'] ?? []);
        $base = Pricing::court($date, $start, $dur);
        if ($type === 'private') {
            $price = (int) round($base * (1 - $off));
            $plan += ['players' => $players, 'price' => $price, 'amount' => $price, 'full' => null];

            return $plan;
        }
        // بازی باز: هر نفر سهم خودش (یک‌چهارم زمین) را می‌دهد؛ تخفیف عضویت فقط روی سهم خودش
        if (count($players) >= 4) {
            Fail::with('bad');
        }
        $levels = array_values(array_unique(array_filter((array) ($a['levels'] ?? []), fn ($l) => Catalog::isLevel($l))));
        if (! $levels) {
            $levels = [$this->me->level];
        }
        $vis = ($a['visibility'] ?? 'public') === 'private' ? 'private' : 'public';
        $invited = [];
        if ($vis === 'private') {
            foreach ((array) ($a['invited'] ?? []) as $m) {
                if (Members::isMemberId($m) && $m !== $this->id() && ! in_array($m, $players, true) && ! in_array($m, $invited, true)
                    && DB::table('members')->where('id', $m)->where('inactive', false)->exists()) {
                    $invited[] = $m;
                }
            }
            if (count($invited) > 20) {
                Fail::with('bad');
            }
        }
        $want = in_array($a['wantSide'] ?? null, ['right', 'left'], true) ? $a['wantSide'] : 'any';
        $unit = (int) round($base / 4);
        $share = (int) round($unit * (1 - $off));
        $plan += ['players' => $players, 'full' => $base, 'price' => $base - ($unit - $share), 'amount' => $share,
            'levels' => $levels, 'visibility' => $vis, 'invited' => $invited, 'wantSide' => $want];

        return $plan;
    }

    public function book(array $a, bool $prepaid = false): array
    {
        $plan = $this->bookPlan($a);
        $desc = $plan['type'] === 'coach' ? 'کلاس مربی' : ($plan['type'] === 'open' ? 'بازی باز' : 'رزرو زمین');
        if ($go = $this->gate('book', $a, $prepaid, $plan['amount'], $desc)) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['booking'], function () use ($a, $method) {
            $this->fresh();
            $p = $this->bookPlan($a); // دوباره داخل قفل با داده‌ی تازه
            if (Availability::started($p['date'], $p['start']) || ! Availability::isFree($p['date'], $p['court'], $p['start'], $p['dur'])) {
                Fail::with('busy');
            }
            if ($p['type'] === 'coach' && Availability::coachBusy($p['coach']->id, $p['date'], $p['start'], $p['dur'])) {
                Fail::with('busy');
            }
            $runCap = (int) Settings::limits()['playerRun'];
            if ($p['type'] !== 'coach' && Availability::playerRun($this->id(), $p['date'], $p['start'], $p['dur']) > $runCap + 1e-6) {
                Fail::with('run', ['run' => $runCap]);
            }
            $id = Ids::make('b');
            $this->charge($p['amount'], 'booking:'.$id, 'رزرو');
            $players = [];
            foreach ($p['players'] as $i => $pl) {
                $players[] = ['player' => $pl, 'share' => $i === 0 ? $p['amount'] : null, 'method' => $i === 0 ? $method : null];
            }
            $this->insertBooking([
                'id' => $id, 'court' => $p['court'], 'date' => $p['date'], 'start' => $p['start'], 'dur' => $p['dur'], 'type' => $p['type'],
                'status' => 'ok', 'source' => 'app', 'by' => $this->id(), 'coach' => $p['type'] === 'coach' ? $p['coach']->id : null,
                'price' => $p['price'], 'full' => $p['full'] ?? null, 'paid' => $p['amount'], 'method' => $method,
                'levels' => isset($p['levels']) ? json_encode($p['levels']) : null, 'want_side' => $p['wantSide'] ?? null,
                'visibility' => $p['visibility'] ?? null,
            ], $players, $p['invited'] ?? []);

            foreach ($p['invited'] ?? [] as $m) {
                Members::notify($m, '✉️', 'دعوت به بازی خصوصی', $this->me->name.' شما را به بازی '.$this->when($p['date'], $p['start']).' دعوت کرده است.');
            }
            $full = count(array_filter($p['players'])) === 4;
            $r = Members::reward($this->id(), $p['type'] === 'coach' ? 40 : ($p['type'] === 'open' ? 70 : 50), [
                'first', $p['type'] === 'open' ? 'host' : null, $p['start'] < 9 ? 'early' : null, $p['start'] + $p['dur'] > 22 ? 'night' : null,
                $p['type'] === 'coach' ? 'student' : null, $full && $p['type'] !== 'coach' ? 'squad' : null, $this->myCourtsCount() >= 4 ? 'quad' : null,
            ], 'book:'.$id);
            Sync::touch('bookings');

            return $r + ['id' => $id];
        });
    }

    private function when(string $date, float $start): string
    {
        return \App\Support\Jalali::label($date).'، ساعت '.\App\Support\Jalali::hour($start);
    }

    // ---------- پیوستن به بازی باز ----------
    private function joinPlan(array $a): array
    {
        $b = DB::table('bookings')->where('id', $a['id'] ?? '')->first();
        if (! $b || $b->status !== 'ok' || $b->type !== 'open' || Availability::started($b->date, (float) $b->start)) {
            Fail::with('full');
        }
        $players = DB::table('booking_players')->where('booking_id', $b->id)->pluck('player')->all();
        if (in_array($this->id(), $players, true) || count($players) >= 4) {
            Fail::with('full');
        }
        if ($b->visibility === 'private' && ! DB::table('booking_invites')->where('booking_id', $b->id)->where('member_id', $this->id())->exists()) {
            Fail::with('full');
        }
        $base = (int) ($b->full ?? $b->price);
        $unit = (int) round($base / 4);
        $share = (int) round($unit * (1 - Members::off($this->id())));

        return ['b' => $b, 'players' => $players, 'share' => $share, 'disc' => $unit - $share];
    }

    public function joinGame(array $a, bool $prepaid = false): array
    {
        $plan = $this->joinPlan($a);
        if ($go = $this->gate('joinGame', $a, $prepaid, $plan['share'], 'سهم بازی باز')) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['booking'], function () use ($a, $method) {
            $this->fresh();
            $p = $this->joinPlan($a);
            $b = $p['b'];
            $this->charge($p['share'], 'booking:'.$b->id, 'سهم بازی باز');
            DB::table('booking_players')->insert([
                'booking_id' => $b->id, 'pos' => count($p['players']), 'player' => $this->id(), 'member_id' => $this->id(),
                'share' => $p['share'], 'share_method' => $method, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('booking_invites')->where('booking_id', $b->id)->where('member_id', $this->id())->delete();
            DB::table('bookings')->where('id', $b->id)->update([
                'paid' => (int) $b->paid + $p['share'], 'price' => max(0, (int) $b->price - $p['disc']), 'updated_at' => now(),
            ]);
            $n = count($p['players']) + 1;
            if ($b->by && Members::isMemberId($b->by)) {
                Members::notify($b->by, '🙋', 'بازیکن تازه به بازی شما پیوست', $this->me->name.' (سطح '.$this->me->level.') به بازی '.$this->when($b->date, (float) $b->start).' پیوست؛ '.(4 - $n ? (4 - $n).' جای خالی مانده.' : 'بازی کامل شد.'));
            }
            $r = Members::reward($this->id(), 40, ['first', 'social', $n === 4 ? 'squad' : null, $this->myCourtsCount((int) $b->court) >= 4 ? 'quad' : null], 'join:'.$b->id);
            Sync::touch('bookings');

            return $r + ['id' => $b->id];
        });
    }

    public function declineInvite(array $a): array
    {
        return DB::transaction(function () use ($a) {
            DB::table('booking_invites')->where('booking_id', $a['id'] ?? '')->where('member_id', $this->id())->delete();
            Sync::touch('bookings');

            return ['ok' => true];
        });
    }

    // ---------- لغو ----------
    public function cancelMine(array $a): array
    {
        return Locks::run(['booking'], function () use ($a) {
            $b = DB::table('bookings')->where('id', $a['id'] ?? '')->first();
            // ساعت‌های مربی (بلوک تأییدشده) را فقط مربی و مدیر عوض می‌کنند
            if (! $b || $b->status !== 'ok' || in_array($b->type, ['block', 'event'], true) || $b->block) {
                Fail::with('gone');
            }
            // ترتیب ثابت قفل ردیف اعضا (جلوگیری از بن‌بست)
            $rows = DB::table('booking_players')->where('booking_id', $b->id)->orderBy('member_id')->get();
            $mine = $b->by === $this->id();
            $inGame = $rows->contains('player', $this->id());
            if (! $mine && ! $inGame) {
                Fail::with('gone');
            }
            // لغو کمتر از ۶ ساعت مانده پذیرفته نمی‌شود
            if (Dates::at($b->date, (float) $b->start)->diffInSeconds(now(), false) > -6 * 3600) {
                Fail::with('late');
            }
            $when = $this->when($b->date, (float) $b->start);
            if ($mine) {
                DB::table('bookings')->where('id', $b->id)->update(['status' => 'cancelled', 'refunded' => true, 'cancelled_at' => now(), 'updated_at' => now()]);
                $refunded = 0;
                // جلسه‌ی پکیج: برگشتی از مانده‌ی فروش پکیج بیشتر نمی‌شود
                $cap = $b->series ? (int) (DB::table('sales')->where('series', $b->series)->whereNull('refunded_at')->value('price') ?? 0) : PHP_INT_MAX;
                foreach ($rows as $r) {
                    $amt = min((int) $r->share, max(0, $cap - $refunded));
                    if ($r->member_id && $amt > 0) {
                        Wallet::credit($r->member_id, $amt, 'refund', 'booking:'.$b->id, 'لغو رزرو');
                        $refunded += $amt;
                        if ($r->member_id !== $this->id()) {
                            Members::notify($r->member_id, '↩️', 'بازی لغو شد', 'سازنده‌ی بازی '.$when.' آن را لغو کرد؛ سهم شما به کیف پول برگشت.');
                        }
                    } elseif ($r->member_id && $r->member_id !== $this->id()) {
                        Members::notify($r->member_id, '↩️', 'بازی لغو شد', 'سازنده‌ی بازی '.$when.' آن را لغو کرد.');
                    }
                }
                // رزرو اپیِ قدیمی بدون سهم ثبت‌شده: مبلغ به رزروکننده برمی‌گردد؛ پول نقدی/کارتی پذیرش را پذیرش برمی‌گرداند
                if ($refunded === 0 && (int) $b->paid > 0 && $b->source === 'app') {
                    Wallet::credit($this->id(), (int) $b->paid, 'refund', 'booking:'.$b->id, 'لغو رزرو');
                    $refunded = (int) $b->paid;
                }
                self::shrinkSeriesSale($b, $refunded);
                Members::revokeXp($this->id(), 'book:'.$b->id);
            } else {
                $r = $rows->firstWhere('player', $this->id());
                $share = (int) ($r->share ?? 0);
                DB::table('booking_players')->where('id', $r->id)->delete();
                $base = (int) ($b->full ?? $b->price);
                $disc = $r->share !== null && $b->type === 'open' ? max(0, (int) round($base / 4) - $share) : 0;
                DB::table('bookings')->where('id', $b->id)->update(['paid' => max(0, (int) $b->paid - $share), 'price' => (int) $b->price + $disc, 'updated_at' => now()]);
                if ($share > 0) {
                    Wallet::credit($this->id(), $share, 'refund', 'booking:'.$b->id, 'انصراف از بازی');
                }
                Members::revokeXp($this->id(), 'join:'.$b->id);
                if ($b->by && Members::isMemberId($b->by)) {
                    Members::notify($b->by, '👋', 'یک بازیکن انصراف داد', $this->me->name.' از بازی '.$when.' انصراف داد؛ یک جای خالی باز شد.');
                }
            }
            Sync::touch('bookings');
            Sync::touchMember($this->id());

            return ['ok' => true];
        });
    }

    /** جلسه‌ی پکیجی که پولش برگشت: فروش پکیج همان‌قدر کم می‌شود تا درآمد دوبار حساب نشود */
    public static function shrinkSeriesSale(object $b, int $refunded): void
    {
        if (! $b->series || $refunded <= 0) {
            return;
        }
        $s = DB::table('sales')->where('series', $b->series)->whereNull('refunded_at')->first();
        if ($s) {
            DB::table('sales')->where('id', $s->id)->update(['price' => max(0, (int) $s->price - $refunded), 'updated_at' => now()]);
            Sync::touch('sales');
        }
    }

    // ---------- پکیج چندجلسه‌ای (زمین یا مربی) ----------
    private function seriesPlan(array $a): array
    {
        $sale = (array) ($a['sale'] ?? []);
        $list = $a['list'] ?? null;
        if (! is_array($list) || ! $list || count($list) > 12) {
            Fail::with('bad');
        }
        $kind = $sale['kind'] ?? null;
        $sessions = [];
        $dates = [];
        foreach ($list as $x) {
            $s = ['court' => self::court($x['court'] ?? null), 'date' => self::date($x['date'] ?? null), 'start' => self::hour($x['start'] ?? null, 0, 23.5)];
            if (in_array($s['date'], $dates, true)) {
                Fail::with('bad');
            }
            $dates[] = $s['date'];
            $sessions[] = $s;
        }
        if ($kind === 'package') {
            $pkg = Catalog::PACKAGES[$sale['item'] ?? ''] ?? null;
            if (! $pkg || $pkg['kind'] !== 'series' || count($sessions) !== $pkg['sessions']) {
                Fail::with('bad');
            }
            $dur = self::hour($list[0]['dur'] ?? null, 1, 3);
            foreach ($list as $x) {
                if ((float) ($x['dur'] ?? 0) !== $dur) {
                    Fail::with('bad');
                }
            }
            $players = $this->players($list[0]['players'] ?? []);
            $sum = 0;
            foreach ($sessions as &$s) {
                $s['dur'] = $dur;
                $court = Pricing::court($s['date'], $s['start'], $dur);
                $sum += $court;
                $s['price'] = (int) round($court * (1 - $pkg['off']));
            }
            unset($s);
            $total = (int) (round($sum * (1 - $pkg['off']) / 1000) * 1000);

            return ['kind' => 'package', 'item' => $sale['item'], 'pack' => null, 'name' => $pkg['name'].' زمین', 'sessions' => $sessions, 'total' => $total,
                'type' => 'private', 'coach' => null, 'players' => $players];
        }
        if ($kind === 'coach') {
            $coach = DB::table('coaches')->where('id', $sale['item'] ?? '')->first();
            $packId = $sale['pack'] ?? '';
            $pack = Catalog::COACH_PACKS[$packId] ?? null;
            if (! $coach || ! $coach->active || ! $pack || $pack['sessions'] < 2 || ! Pricing::coachPackOn($coach, $packId) || count($sessions) !== $pack['sessions']) {
                Fail::with('bad');
            }
            $total = Pricing::coachPack($coach, $packId);
            $each = (int) round($total / count($sessions));
            foreach ($sessions as &$s) {
                $s['dur'] = 1.0;
                $s['price'] = $each;
            }
            unset($s);

            return ['kind' => 'coach', 'item' => $coach->id, 'pack' => $packId, 'name' => $pack['name'].'، '.$coach->name, 'sessions' => $sessions, 'total' => $total,
                'type' => 'coach', 'coach' => $coach, 'players' => [$this->id()]];
        }
        Fail::with('bad');
    }

    public function bookSeries(array $a, bool $prepaid = false): array
    {
        $plan = $this->seriesPlan($a);
        if ($go = $this->gate('bookSeries', $a, $prepaid, $plan['total'], $plan['name'])) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['booking'], function () use ($a, $method) {
            $this->fresh();
            $p = $this->seriesPlan($a);
            foreach ($p['sessions'] as $s) {
                if (Availability::started($s['date'], $s['start']) || ! Availability::isFree($s['date'], $s['court'], $s['start'], $s['dur'])
                    || ($p['coach'] && Availability::coachBusy($p['coach']->id, $s['date'], $s['start'], $s['dur']))) {
                    Fail::with('busy', ['at' => Dates::key($s['date'])]);
                }
            }
            $sid = Ids::make('P');
            $this->charge($p['total'], 'series:'.$sid, $p['name']);
            foreach ($p['sessions'] as $k => $s) {
                $pl = [];
                foreach ($p['players'] as $i => $x) {
                    $pl[] = ['player' => $x, 'share' => $i === 0 ? $s['price'] : null, 'method' => $i === 0 ? 'package' : null];
                }
                $this->insertBooking([
                    'id' => $sid.'-'.$k, 'court' => $s['court'], 'date' => $s['date'], 'start' => $s['start'], 'dur' => $s['dur'], 'type' => $p['type'],
                    'status' => 'ok', 'source' => 'app', 'by' => $this->id(), 'coach' => $p['coach']->id ?? null, 'price' => $s['price'], 'paid' => $s['price'],
                    'method' => 'package', 'series' => $sid,
                ], $pl);
            }
            $saleId = 'S-'.Ids::seq('S', 1000);
            DB::table('sales')->insert([
                'id' => $saleId, 'kind' => $p['kind'], 'item' => $p['item'], 'pack' => $p['pack'], 'series' => $sid, 'name' => $p['name'],
                'by' => $this->id(), 'price' => $p['total'], 'method' => $method, 'at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $early = collect($p['sessions'])->contains(fn ($s) => $s['start'] < 9);
            $night = collect($p['sessions'])->contains(fn ($s) => $s['start'] + $s['dur'] > 22);
            $r = Members::reward($this->id(), 40 + count($p['sessions']) * 15, [
                'first', 'loyal', $p['kind'] === 'coach' ? 'student' : null, $early ? 'early' : null, $night ? 'night' : null, $this->myCourtsCount() >= 4 ? 'quad' : null,
            ], 'series');
            Sync::touch('bookings', 'sales');

            return $r + ['count' => count($p['sessions']), 'series' => $sid];
        });
    }

    // ---------- عضویت ----------
    public function buyPackage(array $a, bool $prepaid = false): array
    {
        $pkg = Catalog::PACKAGES[$a['id'] ?? ''] ?? null;
        if (! $pkg || $pkg['kind'] !== 'member') {
            Fail::with('bad');
        }
        if ($go = $this->gate('buyPackage', $a, $prepaid, $pkg['price'], $pkg['name'])) {
            return $go;
        }
        $method = self::method($a);

        return DB::transaction(function () use ($a, $pkg, $method) {
            $this->charge($pkg['price'], 'package:'.$a['id'], $pkg['name']);
            // عضویت تازه بعد از پایان عضویت‌های فعلی شروع می‌شود (روزهای باقی‌مانده و تخفیف فعلی سوخت نمی‌شود)
            $end = Members::membershipEnd($this->id());
            $from = $end ? \Carbon\Carbon::parse($end) : now();
            $saleId = 'S-'.Ids::seq('S', 1000);
            DB::table('memberships')->insert(['member_id' => $this->id(), 'package' => $a['id'], 'starts_at' => $from, 'ends_at' => $from->copy()->addDays($pkg['days']), 'sale' => $saleId, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('sales')->insert(['id' => $saleId, 'kind' => 'package', 'item' => $a['id'], 'name' => $pkg['name'], 'by' => $this->id(), 'price' => $pkg['price'], 'method' => $method, 'at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $r = Members::reward($this->id(), 60, ['loyal'], 'package');
            Sync::touch('sales', 'members');

            return $r;
        }, 3);
    }

    // ---------- مسابقه ----------
    private function eventPlan(array $a): array
    {
        $ev = DB::table('events')->where('id', $a['id'] ?? '')->first();
        $partner = (array) ($a['partner'] ?? []);
        if (! $ev || $ev->status !== 'open' || $ev->date < Dates::today() || ! $partner) {
            Fail::with('closed');
        }
        $solo = ! empty($partner['solo']);
        $n = $solo ? 1 : 2;
        $regs = DB::table('event_registrations')->where('event_id', $ev->id)->get();
        if ($regs->count() + $n > (int) $ev->cap || $regs->contains('by', $this->id())) {
            Fail::with('closed');
        }
        if (Rules::whyNot($ev, ['level' => $this->me->level, 'gender' => $this->me->gender, 'birth' => $this->me->birth])) {
            Fail::with('closed');
        }
        $mate = null;
        if (! $solo) {
            $pid = $partner['id'] ?? '';
            if (is_string($pid) && str_starts_with($pid, 'f:')) {
                $name = trim(mb_substr($pid, 2));
                $lv = $partner['level'] ?? null;
                if (mb_strlen($name) < 2 || ! Catalog::isLevel($lv)) {
                    Fail::with('closed');
                }
                $birth = isset($partner['birth']) && is_numeric($partner['birth']) ? (int) $partner['birth'] : null;
                $gender = in_array($partner['gender'] ?? null, ['f', 'm'], true) ? $partner['gender'] : null;
                $mate = ['by' => 'f:'.$name, 'name' => $name, 'level' => $lv, 'gender' => $gender, 'birth' => $birth];
            } else {
                $m = DB::table('members')->where('id', $pid)->where('inactive', false)->first();
                if (! $m || $m->id === $this->id()) {
                    Fail::with('closed');
                }
                $mate = ['by' => $m->id, 'name' => $m->name, 'level' => $m->level, 'gender' => $m->gender, 'birth' => $m->birth];
            }
            if ($regs->contains('by', $mate['by']) || Rules::whyNot($ev, $mate)) {
                Fail::with('closed');
            }
        }

        return ['ev' => $ev, 'solo' => $solo, 'n' => $n, 'mate' => $mate, 'total' => (int) $ev->fee * $n];
    }

    public function registerEvent(array $a, bool $prepaid = false): array
    {
        $plan = $this->eventPlan($a);
        if ($go = $this->gate('registerEvent', $a, $prepaid, $plan['total'], 'ثبت‌نام '.$plan['ev']->title)) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['event'], function () use ($a, $method) {
            $this->fresh();
            $p = $this->eventPlan($a);
            $ev = $p['ev'];
            $saleId = $p['total'] > 0 ? 'S-'.Ids::seq('S', 1000) : null;
            $this->charge($p['total'], 'event:'.$ev->id, 'ثبت‌نام '.$ev->title);
            $first = fn ($s) => explode(' ', trim($s))[0];
            $meName = $this->me->name;
            if ($saleId) {
                DB::table('sales')->insert([
                    'id' => $saleId, 'kind' => 'event', 'item' => $ev->id,
                    'name' => $p['solo'] ? $ev->title.'، '.$first($meName).' (منتظر یار)' : $ev->title.'، تیم '.$first($meName).' و '.$first($p['mate']['name']),
                    'by' => $this->id(), 'price' => $p['total'], 'method' => $method, 'at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $rid = 'r'.Ids::make('');
            $pair = $p['solo'] ? null : 'p'.Ids::make('');
            $base = ['event_id' => $ev->id, 'at' => now(), 'method' => $method, 'paid' => (int) $ev->fee, 'source' => 'app', 'sale' => $saleId,
                'waiting' => $p['solo'], 'pair' => $pair, 'payer' => $p['solo'] ? null : $this->id(), 'created_at' => now(), 'updated_at' => now()];
            DB::table('event_registrations')->insert($base + ['rid' => $rid, 'by' => $this->id(), 'name' => $meName, 'level' => $this->me->level, 'phone' => $this->me->phone, 'gender' => $this->me->gender, 'birth' => $this->me->birth]);
            if (! $p['solo']) {
                DB::table('event_registrations')->insert($base + ['rid' => $rid.'b', 'by' => $p['mate']['by'], 'name' => $p['mate']['name'], 'level' => $p['mate']['level'], 'gender' => $p['mate']['gender'], 'birth' => $p['mate']['birth']]);
                if (Members::isMemberId($p['mate']['by'])) {
                    Members::notify($p['mate']['by'], '🏆', 'ثبت‌نام در '.$ev->title, $meName.' شما را به‌عنوان یار تیمش ثبت‌نام کرد.');
                }
            }
            $r = Members::reward($this->id(), 80, ['champ'], 'event');
            Sync::touch('events', 'sales');

            return $r;
        });
    }

    // ---------- فروشگاه ----------
    public function checkout(array $a, bool $prepaid = false): array
    {
        $items = Shop::resolve((array) ($a['items'] ?? []), true);
        $total = array_sum(array_map(fn ($x) => $x['qty'] * $x['price'], $items));
        if ($go = $this->gate('checkout', $a, $prepaid, $total, 'خرید از فروشگاه')) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['shop'], function () use ($a, $method) {
            $items = Shop::resolve((array) ($a['items'] ?? []), true);
            $total = array_sum(array_map(fn ($x) => $x['qty'] * $x['price'], $items));
            Shop::take($items);
            $id = 'Q-'.Ids::seq('Q', 1300);
            $this->charge($total, 'order:'.$id, 'خرید از فروشگاه');
            $order = ['id' => $id, 'by' => $this->id(), 'items' => Shop::strip($items), 'total' => $total, 'method' => $method, 'status' => 'new', 'source' => 'app', 'at' => now()];
            DB::table('shop_orders')->insert(array_merge($order, ['items' => json_encode($order['items'], JSON_UNESCAPED_UNICODE), 'created_at' => now(), 'updated_at' => now()]));
            $r = Members::reward($this->id(), max(10, (int) round($total / 200000)), ['shopper'], 'shop');
            Sync::touch('orders', 'products');

            return $r + ['order' => \App\State\Shape::publicOrder(array_merge($order, ['at' => Dates::ms($order['at'])]))];
        });
    }

    // ---------- کافه ----------
    private function cafeTo($to): ?int
    {
        if ($to === null || $to === '' || $to === false) {
            return null;
        }
        $court = self::court($to);
        // فقط زمینی که همین الان (یا تا ۳ ساعت دیگر) رزرو خود کاربر است
        $me = $this->id();
        $ok = DB::table('bookings')->where('date', Dates::today())->where('court', $court)->where('status', 'ok')->where('type', '!=', 'block')
            ->where(fn ($q) => $q->where('by', $me)->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $me)))
            ->get(['date', 'start', 'dur'])
            ->contains(fn ($b) => Dates::at($b->date, (float) $b->start + (float) $b->dur)->gt(now()->subMinutes(30)) && Dates::at($b->date, (float) $b->start)->lt(now()->addHours(3)));
        if (! $ok) {
            Fail::with('bad');
        }

        return $court;
    }

    public function cafeCheckout(array $a, bool $prepaid = false): array
    {
        [$items, $ings] = Cafe::load();
        $lines = Cafe::clean($items, $a['lines'] ?? null);
        $quote = Cafe::place($ings, $items, $lines);
        $this->cafeTo($a['to'] ?? null);
        if ($go = $this->gate('cafeCheckout', $a, $prepaid, $quote['total'], 'سفارش کافه')) {
            return $go;
        }
        $method = self::method($a);

        return Locks::run(['cafe'], function () use ($a, $method) {
            [$items, $ings] = Cafe::load();
            $lines = Cafe::clean($items, $a['lines'] ?? null);
            $r = Cafe::place($ings, $items, $lines);
            $to = $this->cafeTo($a['to'] ?? null);
            Cafe::saveStock($r['stock']);
            $id = 'K-'.Ids::seq('K', 6000);
            $this->charge($r['total'], 'cafe:'.$id, 'سفارش کافه');
            $order = ['id' => $id, 'by' => $this->id(), 'items' => $r['lines'], 'use' => $r['use'], 'total' => $r['total'], 'method' => $method, 'to' => $to, 'status' => 'new', 'source' => 'app', 'at' => now()];
            DB::table('cafe_orders')->insert(array_merge($order, ['items' => json_encode($r['lines'], JSON_UNESCAPED_UNICODE), 'use' => json_encode($r['use']), 'created_at' => now(), 'updated_at' => now()]));
            $g = Members::reward($this->id(), max(5, (int) round($r['total'] / 100000)), [], 'cafe');
            Sync::touch('cafeOrders', 'cafeMenu');

            return $g + ['order' => \App\State\Shape::publicOrder(array_merge($order, ['at' => Dates::ms($order['at'])]))];
        });
    }

    // ---------- کیف پول ----------
    public function topUp(array $a): array
    {
        $n = $a['amount'] ?? null;
        $min = (int) config('quadra.payment.topup_min');
        $max = (int) config('quadra.payment.topup_max');
        if (! is_numeric($n) || (int) $n != $n || (int) $n < $min || (int) $n > $max) {
            Fail::with('bad');
        }

        return PaymentService::start($this->me, (int) $n, 'topup', ['action' => 'topup', 'args' => []], 'شارژ کیف پول');
    }

    // ---------- چالش هفتگی ----------
    public function claimQuest(array $a): array
    {
        $q = Catalog::QUESTS[$a['id'] ?? ''] ?? null;
        if (! $q) {
            Fail::with('bad');
        }

        return DB::transaction(function () use ($a, $q) {
            DB::table('members')->where('id', $this->id())->lockForUpdate()->first(['id']);
            $week = Dates::weekStart();
            if (DB::table('quest_claims')->where(['member_id' => $this->id(), 'week' => $week, 'quest' => $a['id']])->exists()) {
                Fail::with('done');
            }
            $me = $this->id();
            $mine = DB::table('bookings')->where('status', 'ok')->where('created_at', '>=', $week.' 00:00:00')
                ->where(fn ($x) => $x->where('by', $me)->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $me)))
                ->get(['type']);
            $have = match ($a['id']) {
                'play2' => $mine->count(),
                'social' => $mine->where('type', 'open')->count(),
                'coach' => $mine->where('type', 'coach')->count(),
            };
            if ($have < $q['goal']) {
                Fail::with('notyet');
            }
            DB::table('quest_claims')->insert(['member_id' => $me, 'week' => $week, 'quest' => $a['id'], 'created_at' => now()]);

            return Members::reward($me, $q['xp'], [], 'quest:'.$a['id']);
        }, 3);
    }

    // ---------- نظر ناشناس ----------
    public function addReview(array $a): array
    {
        $target = $a['target'] ?? '';
        $stars = $a['stars'] ?? null;
        $text = trim(mb_substr(\App\Support\In::str($a['text'] ?? ''), 0, 300));
        if (! is_string($target) || ! preg_match('/^(coach|event):([A-Za-z0-9_.-]{1,60})$/', $target, $m) || ! is_numeric($stars) || (int) $stars < 1 || (int) $stars > 5) {
            Fail::with('bad');
        }
        if ($m[1] === 'coach') {
            $studied = DB::table('bookings')->where('coach', $m[2])->where('status', 'ok')
                ->where(fn ($q) => $q->where('by', $this->id())->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $this->id())))
                ->exists();
            if (! $studied) {
                Fail::with('denied');
            }
        } elseif (! DB::table('events')->where('id', $m[2])->where('status', 'done')->exists()
            || ! DB::table('event_registrations')->where('event_id', $m[2])->where('by', $this->id())->exists()) {
            Fail::with('denied');
        }

        return DB::transaction(function () use ($target, $stars, $text) {
            if (! DB::table('review_marks')->insertOrIgnore(['member_id' => $this->id(), 'target' => $target])) {
                Fail::with('dup');
            }
            // متن نظر منتظر تأیید مدیر می‌ماند؛ ستاره همان لحظه حساب می‌شود. نام نویسنده ذخیره نمی‌شود.
            DB::table('reviews')->insert(['id' => Ids::make('r'), 'target' => $target, 'stars' => (int) $stars, 'text' => $text, 'ok' => $text === '', 'hidden' => false, 'created_at' => now()]);
            $r = Members::reward($this->id(), 10, [], 'review');
            Sync::touch('reviews');

            return $r;
        });
    }

    // ---------- اعلان‌ها ----------
    public function notify(array $a): array
    {
        Members::notify($this->id(), \App\Support\In::str($a['icon'] ?? '🔔'), \App\Support\In::str($a['title'] ?? ''), \App\Support\In::str($a['body'] ?? ''));

        return ['ok' => true];
    }

    public function readAll(): array
    {
        DB::table('notifications')->where('member_id', $this->id())->where('read', false)->update(['read' => true]);
        Sync::touchMember($this->id());

        return ['ok' => true];
    }

    // ---------- پروفایل ----------
    public function updateProfile(array $a): array
    {
        $patch = [];
        if (array_key_exists('gender', $a)) {
            $patch['gender'] = in_array($a['gender'], ['f', 'm'], true) ? $a['gender'] : null;
        }
        if (array_key_exists('birth', $a)) {
            if ($a['birth'] !== null && $a['birth'] !== '' && ! Rules::validBirth($a['birth'])) {
                Fail::with('bad');
            }
            $patch['birth'] = $a['birth'] ? (int) $a['birth'] : null;
        }
        if (array_key_exists('side', $a) && in_array($a['side'], Catalog::SIDES, true)) {
            $patch['side'] = $a['side'];
        }
        if ($patch) {
            DB::table('members')->where('id', $this->id())->update($patch + ['updated_at' => now()]);
            Sync::touchMember($this->id());
            Sync::touch('members');
        }

        return ['ok' => true];
    }

    public static function usernameTaken(string $u, ?string $exceptMember = null, ?string $exceptCoach = null): bool
    {
        $k = strtolower(trim($u));

        return $k === 'admin'
            || DB::table('admins')->whereRaw('LOWER(username) = ?', [$k])->exists()
            || DB::table('coaches')->whereRaw('LOWER(username) = ?', [$k])->when($exceptCoach, fn ($q) => $q->where('id', '!=', $exceptCoach))->exists()
            || DB::table('members')->whereRaw('LOWER(username) = ?', [$k])->when($exceptMember, fn ($q) => $q->where('id', '!=', $exceptMember))->exists();
    }

    public function setLogin(array $a): array
    {
        $u = strtolower(trim(\App\Support\In::str($a['user'] ?? '')));
        $pass = \App\Support\In::str($a['pass'] ?? '');
        if (! preg_match('/^[a-z0-9._]{3,20}$/', $u) || ($pass !== '' && (strlen($pass) < 6 || strlen($pass) > 72))) {
            Fail::with('bad');
        }
        if ($pass === '' && ! $this->me->password) {
            Fail::with('bad');
        }
        if (self::usernameTaken($u, $this->id())) {
            Fail::with('taken');
        }
        $patch = ['username' => $u, 'updated_at' => now()];
        if ($pass !== '') {
            $patch['password'] = Hash::make($pass);
        }
        try {
            DB::table('members')->where('id', $this->id())->update($patch);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            Fail::with('taken');
        }
        Sync::touchMember($this->id());
        Sync::touch('members');

        return ['ok' => true];
    }
}
