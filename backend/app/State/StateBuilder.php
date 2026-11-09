<?php

namespace App\State;

use App\Domain\Catalog;
use App\Domain\Members;
use App\Domain\Settings;
use App\Support\Dates;
use App\Support\Sync;
use Illuminate\Support\Facades\DB;

/**
 * داده‌ی هر نقش را به شکل همان club و حساب بازیکنِ اپ قبلی می‌سازد.
 * بازیکن و مربی فقط آنچه لازم دارند را می‌گیرند؛ اطلاعات خصوصی (موبایل اعضا، حسابداری، حقوق…) فقط برای مدیر است.
 */
final class StateBuilder
{
    /** کلیدهای club که هر بخش همگام‌سازی می‌سازد */
    public const PARTS = [
        'settings' => ['pricing', 'hours', 'limits', 'hrCfg', 'off', 'courtEdits', 'opening', 'suppliers', 'welcome'],
        'members' => ['members', 'memberEdits', 'logins'],
        'coaches' => ['coaches'],
        'bookings' => ['bookings'],
        'coachReqs' => ['coachReqs'],
        'events' => ['events'],
        'sales' => ['sales'],
        'reviews' => ['reviews'],
        'products' => ['products'],
        'orders' => ['orders'],
        'stock' => ['receipts', 'stockMoves', 'apPays'],
        'cafeMenu' => ['cafeItems', 'cafeIngs'],
        'cafeOrders' => ['cafeOrders'],
        'cafeStock' => ['cafeReceipts', 'cafeMoves'],
        'accounting' => ['expenses', 'journals', 'payins'],
        'hr' => ['staff', 'shifts', 'attendance', 'leaves', 'advances', 'payrolls'],
    ];

    public function __construct(private string $role, private ?object $actor) {}

    private function memberId(): ?string
    {
        return $this->role === 'player' ? $this->actor->id : null;
    }

    private function coachId(): ?string
    {
        return $this->role === 'coach' ? $this->actor->id : null;
    }

    /** بخش‌های خواسته‌شده (یا همه) */
    public function club(?array $only = null): array
    {
        $out = [];
        foreach (array_keys(self::PARTS) as $part) {
            if ($only !== null && ! in_array($part, $only, true)) {
                continue;
            }
            // بخش‌های فقط‌مدیر برای بقیه خالی می‌روند تا کد اپ خطا ندهد
            $out += $this->{'part'.ucfirst($part)}();
        }

        return $out;
    }

    // ---------- تنظیمات ----------
    private function partSettings(): array
    {
        $courts = DB::table('courts')->orderBy('id')->get();
        $off = [];
        $edits = [];
        foreach ($courts as $c) {
            if ($c->off) {
                $off[(string) $c->id] = true;
            }
            if ($c->edits) {
                $edits[(string) $c->id] = Shape::j($c->edits);
            }
        }
        $out = [
            'pricing' => Settings::pricing(), 'hours' => Settings::hours(), 'limits' => Settings::limits(),
            'off' => (object) $off, 'courtEdits' => (object) $edits, 'hrCfg' => (object) [], 'opening' => null, 'suppliers' => [],
            'welcome' => Settings::welcome(),
        ];
        if ($this->role === 'admin') {
            $out['hrCfg'] = Settings::hr();
            $out['opening'] = Settings::get('opening');
            $out['suppliers'] = DB::table('suppliers')->orderBy('created_at')->pluck('name')->all();
        }

        return $out;
    }

    // ---------- اعضا ----------
    private function partMembers(): array
    {
        $today = Dates::today();
        // تعداد بازی‌های برگزارشده‌ی هر عضو
        $games = DB::table('booking_players')->join('bookings', 'bookings.id', '=', 'booking_players.booking_id')
            ->whereNotNull('booking_players.member_id')->where('bookings.status', 'ok')->where('bookings.date', '<', $today)
            ->groupBy('booking_players.member_id')->selectRaw('booking_players.member_id as m, count(*) as n')->pluck('n', 'm')->all();

        $scope = $this->role === 'admin' ? 'admin' : ($this->role === 'coach' ? 'coach' : 'player');
        $q = DB::table('members')->orderBy('created_at')->orderBy('id');
        if ($scope === 'admin') {
            // عضویت فعالِ خریداری‌شده روی برچسب دستی مدیر اولویت دارد
            $q->select('members.*')->selectSub(DB::table('memberships')->whereColumn('memberships.member_id', 'members.id')->where('ends_at', '>', now())->orderByDesc('ends_at')->limit(1)->select('package'), 'vip_now');
        }
        $rows = $q->get();

        $students = [];
        if ($scope === 'coach') {
            $students = array_flip(array_merge(
                // فقط شاگردهایی که خودشان کلاس یا پکیج این مربی را گرفته‌اند (نه کسی که مربی دستی اضافه کرده)
                DB::table('bookings')->where('coach', $this->coachId())->where('source', 'app')->whereNotNull('by')->pluck('by')->all(),
                DB::table('sales')->where('kind', 'coach')->where('item', $this->coachId())->whereNotNull('by')->pluck('by')->all(),
            ));
        }

        $members = [];
        foreach ($rows as $m) {
            $x = Shape::member($m, (int) $m->games_base + (int) ($games[$m->id] ?? 0), $scope);
            if ($scope === 'coach' && isset($students[$m->id])) {
                $x['phone'] = $m->phone;
            }
            $members[] = $x;
        }
        $logins = (object) [];
        if ($scope === 'admin') {
            $logins = (object) $rows->whereNotNull('username')->mapWithKeys(fn ($m) => [$m->username => ['phone' => $m->phone]])->all();
        }

        return ['members' => $members, 'memberEdits' => (object) [], 'logins' => $logins];
    }

    // ---------- مربی‌ها ----------
    private function partCoaches(): array
    {
        $list = DB::table('coaches')->orderBy('created_at')->orderBy('id')->get()->map(function ($c) {
            $scope = $this->role === 'admin' ? 'full' : ($c->id === $this->coachId() ? 'self' : 'public');

            return Shape::coach($c, $scope);
        })->all();

        return ['coaches' => $list];
    }

    // ---------- رزروها ----------
    private function partBookings(): array
    {
        $me = $this->memberId();
        $coach = $this->coachId();
        $today = Dates::today();
        $q = DB::table('bookings');
        if ($this->role === 'player') {
            $from = now()->subDays(1)->format('Y-m-d');
            $to = now()->addDays(120)->format('Y-m-d');
            $q->where(function ($w) use ($me, $from, $to) {
                $w->where(fn ($x) => $x->whereBetween('date', [$from, $to])->where('status', 'ok'))
                    ->orWhere('by', $me)
                    ->orWhereExists(fn ($s) => $s->from('booking_players')->whereColumn('booking_players.booking_id', 'bookings.id')->where('booking_players.player', $me))
                    ->orWhereExists(fn ($s) => $s->from('booking_invites')->whereColumn('booking_invites.booking_id', 'bookings.id')->where('booking_invites.member_id', $me));
            });
        } elseif ($this->role === 'coach') {
            $from = now()->subDays(1)->format('Y-m-d');
            $q->where(fn ($w) => $w->where(fn ($x) => $x->where('date', '>=', $from)->where('status', 'ok'))->orWhere('coach', $coach));
        }
        $rows = $q->orderBy('date')->orderBy('start')->get();
        $ids = $rows->pluck('id')->all();

        $players = [];
        $invites = [];
        $settled = [];
        foreach (array_chunk($ids, 2000) as $chunk) {
            foreach (DB::table('booking_players')->whereIn('booking_id', $chunk)->orderBy('pos')->orderBy('id')->get() as $p) {
                $players[$p->booking_id][] = $p;
            }
            foreach (DB::table('booking_invites')->whereIn('booking_id', $chunk)->get() as $i) {
                $invites[$i->booking_id][] = $i->member_id;
            }
            if ($this->role === 'admin') {
                foreach (DB::table('booking_payments')->whereIn('booking_id', $chunk)->orderBy('id')->get() as $s) {
                    $settled[$s->booking_id][] = $s;
                }
            }
        }

        $out = [];
        foreach ($rows as $b) {
            $pl = $players[$b->id] ?? [];
            $inv = $invites[$b->id] ?? [];
            $full = Shape::booking($b, $pl, $inv, $settled[$b->id] ?? []);
            if ($this->role === 'admin') {
                $out[] = $full;

                continue;
            }
            $mine = $this->role === 'player'
                ? ($b->by === $me || collect($pl)->contains('player', $me) || in_array($me, $inv, true))
                : $b->coach === $coach;
            if ($mine) {
                if ($this->role === 'player') {
                    // دعوت‌شده‌های دیگر لازم نیست؛ فقط خود کاربر
                    if (isset($full['invited'])) {
                        $full['invited'] = in_array($me, $inv, true) ? [$me] : [];
                    }
                    unset($full['settled']);
                }
                $out[] = $full;

                continue;
            }
            $out[] = $this->anonymous($b, $full);
        }

        // زمین‌های بسته‌ی مسابقه
        $ev = DB::table('events')->whereNotIn('status', ['draft', 'cancelled']);
        if ($this->role !== 'admin') {
            $ev->where('date', '>=', now()->subDays(1)->format('Y-m-d'));
        }
        foreach ($ev->get() as $e) {
            array_push($out, ...Shape::eventBlocks($e));
        }

        return ['bookings' => $out];
    }

    /** رزرو دیگران: فقط آنچه برای تقویم و بازی‌های باز لازم است */
    private function anonymous(object $b, array $full): array
    {
        $publicOpen = $b->type === 'open' && $b->visibility !== 'private';
        $x = [
            'id' => $full['id'], 'court' => $full['court'], 'date' => $full['date'], 'start' => $full['start'], 'dur' => $full['dur'],
            'type' => $b->type === 'open' ? 'open' : ($b->type === 'coach' ? 'coach' : ($b->type === 'block' ? 'block' : 'private')),
            'status' => $b->status, 'by' => $publicOpen ? $b->by : null, 'players' => $publicOpen ? $full['players'] : [],
            'coach' => $b->type === 'coach' ? $b->coach : null, 'price' => $publicOpen ? $full['price'] : 0, 'paid' => 0,
            'levels' => $publicOpen ? $full['levels'] : null, 'refunded' => false, 'method' => null, 'at' => $full['at'],
        ];
        if ($publicOpen && isset($full['full'])) {
            $x['full'] = $full['full'];
        }
        if ($b->type === 'open') {
            $x['visibility'] = $b->visibility ?: 'public';
            $x['invited'] = [];
            if (! $publicOpen) {
                // بازی خصوصی دیگران: پر حساب می‌شود تا در فهرست‌ها نیاید
                $x['players'] = ['', '', '', ''];
            }
        }
        if ($b->type === 'block' && $b->note) {
            $x['note'] = $b->note;
        }

        return $x;
    }

    // ---------- درخواست‌های مربی ----------
    private function partCoachReqs(): array
    {
        if ($this->role === 'player') {
            return ['coachReqs' => []];
        }
        $rows = DB::table('coach_requests')->orderByDesc('created_at')->get();
        if ($this->role === 'admin') {
            return ['coachReqs' => $rows->map(fn ($r) => Shape::coachReq($r))->all()];
        }
        $out = [];
        foreach ($rows as $r) {
            if ($r->coach === $this->coachId()) {
                $out[] = Shape::coachReq($r);
            } elseif ($r->status === 'pending') {
                // درخواست منتظر مربی دیگر فقط جای زمین را نگه می‌دارد
                $out[] = ['id' => $r->id, 'coach' => '-', 'date' => Dates::key($r->date), 'court' => (int) $r->court, 'start' => Shape::num($r->start), 'dur' => Shape::num($r->dur), 'status' => 'pending', 'student' => null, 'note' => '', 'at' => Dates::ms($r->created_at), 'done' => null];
            }
        }

        return ['coachReqs' => $out];
    }

    // ---------- مسابقه‌ها ----------
    private function partEvents(): array
    {
        if ($this->role === 'coach') {
            return ['events' => []];
        }
        $q = DB::table('events')->orderByDesc('date')->orderByDesc('created_at');
        if ($this->role !== 'admin') {
            $q->where('status', '!=', 'draft');
        }
        $events = $q->get();
        $regs = [];
        foreach (DB::table('event_registrations')->whereIn('event_id', $events->pluck('id')->all())->orderBy('at')->orderBy('id')->get() as $r) {
            $regs[$r->event_id][] = $r;
        }
        $private = $this->role === 'admin';

        return ['events' => $events->map(fn ($e) => Shape::event($e, $regs[$e->id] ?? [], $private))->all()];
    }

    // ---------- فروش‌ها ----------
    private function partSales(): array
    {
        $q = DB::table('sales')->whereNull('refunded_at')->orderByDesc('at');
        if ($this->role === 'player') {
            $q->where('by', $this->memberId());
        } elseif ($this->role === 'coach') {
            $q->where('kind', 'coach')->where('item', $this->coachId());
        }

        return ['sales' => $q->get()->map(fn ($s) => Shape::sale($s))->all()];
    }

    // ---------- نظرها ----------
    private function partReviews(): array
    {
        $admin = $this->role === 'admin';
        $q = DB::table('reviews')->orderByDesc('created_at');
        if ($this->role === 'coach') {
            $q->where('target', 'coach:'.$this->coachId());
        }

        return ['reviews' => $q->get()->map(function ($r) use ($admin) {
            $shown = $admin || ($r->ok && ! $r->hidden);
            $x = ['id' => $r->id, 'target' => $r->target, 'stars' => (int) $r->stars, 'text' => $shown ? ($r->text ?? '') : '', 'at' => Dates::ms($r->created_at)];
            if ($admin) {
                $x['ok'] = (bool) $r->ok;
                if ($r->hidden) {
                    $x['hidden'] = true;
                }
            }

            return $x;
        })->all()];
    }

    // ---------- فروشگاه ----------
    private function partProducts(): array
    {
        if ($this->role === 'coach') {
            return ['products' => []];
        }
        $variants = [];
        foreach (DB::table('product_variants')->orderBy('product_id')->orderBy('pos')->orderBy('id')->get() as $v) {
            $variants[$v->product_id][] = $v;
        }
        $admin = $this->role === 'admin';

        return ['products' => DB::table('products')->orderBy('code')->get()->map(fn ($p) => Shape::product($p, $variants[$p->id] ?? [], $admin))->all()];
    }

    private function partOrders(): array
    {
        if ($this->role === 'coach') {
            return ['orders' => []];
        }
        $q = DB::table('shop_orders')->orderByDesc('at');
        if ($this->role === 'player') {
            $q->where('by', $this->memberId());
        }

        return ['orders' => $q->get()->map(fn ($o) => Shape::order($o, false, $this->role === 'admin'))->all()];
    }

    private function partStock(): array
    {
        if ($this->role !== 'admin') {
            return ['receipts' => [], 'stockMoves' => [], 'apPays' => []];
        }

        return [
            'receipts' => DB::table('stock_receipts')->orderByDesc('date')->orderByDesc('at')->get()->map(fn ($r) => ['id' => $r->id, 'date' => Dates::key($r->date), 'supplier' => $r->supplier, 'invoice' => $r->invoice ?? '', 'pay' => $r->pay, 'items' => Shape::j($r->items, []), 'total' => (int) $r->total, 'at' => Dates::ms($r->at)])->all(),
            'stockMoves' => DB::table('stock_moves')->orderByDesc('date')->orderByDesc('created_at')->get()->map(fn ($m) => ['id' => $m->id, 'date' => Dates::key($m->date), 'kind' => $m->kind, 'pid' => $m->pid, 'code' => $m->code, 'sku' => $m->sku, 'qty' => (int) $m->qty, 'cost' => (int) $m->cost, 'note' => $m->note ?? ''])->all(),
            'apPays' => DB::table('ap_payments')->orderByDesc('date')->orderByDesc('created_at')->get()->map(fn ($p) => ['id' => $p->id, 'date' => Dates::key($p->date), 'supplier' => $p->supplier, 'amount' => (int) $p->amount, 'pay' => $p->pay])->all(),
        ];
    }

    // ---------- کافه ----------
    private function partCafeMenu(): array
    {
        if ($this->role === 'coach') {
            return ['cafeItems' => [], 'cafeIngs' => []];
        }
        $admin = $this->role === 'admin';

        return [
            'cafeItems' => DB::table('cafe_items')->orderBy('code')->get()->map(fn ($i) => Shape::cafeItem($i))->all(),
            'cafeIngs' => DB::table('cafe_ingredients')->orderBy('code')->get()->map(fn ($g) => Shape::cafeIng($g, $admin))->all(),
        ];
    }

    private function partCafeOrders(): array
    {
        if ($this->role === 'coach') {
            return ['cafeOrders' => []];
        }
        $q = DB::table('cafe_orders')->orderByDesc('at');
        if ($this->role === 'player') {
            $q->where('by', $this->memberId());
        }

        return ['cafeOrders' => $q->get()->map(fn ($o) => Shape::order($o, true, $this->role === 'admin'))->all()];
    }

    private function partCafeStock(): array
    {
        if ($this->role !== 'admin') {
            return ['cafeReceipts' => [], 'cafeMoves' => []];
        }

        return [
            'cafeReceipts' => DB::table('cafe_receipts')->orderByDesc('date')->orderByDesc('at')->get()->map(fn ($r) => ['id' => $r->id, 'date' => Dates::key($r->date), 'supplier' => $r->supplier, 'invoice' => $r->invoice ?? '', 'pay' => $r->pay, 'items' => Shape::j($r->items, []), 'total' => (int) $r->total, 'at' => Dates::ms($r->at)])->all(),
            'cafeMoves' => DB::table('cafe_moves')->orderByDesc('date')->orderByDesc('created_at')->get()->map(fn ($m) => ['id' => $m->id, 'date' => Dates::key($m->date), 'ing' => $m->ing, 'code' => $m->code, 'name' => $m->name, 'qty' => Shape::num($m->qty), 'amount' => (int) $m->amount, 'note' => $m->note ?? ''])->all(),
        ];
    }

    // ---------- حسابداری ----------
    private function partAccounting(): array
    {
        if ($this->role !== 'admin') {
            return ['expenses' => [], 'journals' => [], 'payins' => []];
        }

        return [
            'expenses' => DB::table('expenses')->orderByDesc('date')->orderByDesc('at')->get()->map(fn ($e) => ['id' => $e->id, 'date' => Dates::key($e->date), 'acc' => $e->acc, 'amount' => (int) $e->amount, 'title' => $e->title ?? '', 'vendor' => $e->vendor ?? '', 'pay' => $e->pay, 'invoice' => $e->invoice ?? '', 'at' => Dates::ms($e->at)])->all(),
            'journals' => DB::table('journals')->orderByDesc('date')->orderByDesc('at')->get()->map(fn ($j) => ['id' => $j->id, 'date' => Dates::key($j->date), 'title' => $j->title, 'lines' => Shape::j($j->lines, []), 'at' => Dates::ms($j->at)])->all(),
            'payins' => DB::table('payins')->orderByDesc('at')->get()->map(fn ($p) => ['id' => $p->id, 'at' => Dates::ms($p->at), 'date' => Dates::key($p->date), 'amount' => (int) $p->amount, 'method' => $p->method, 'acc' => $p->acc, 'title' => $p->title ?? '', 'note' => $p->note ?? '', 'by' => $p->by, 'name' => $p->name])->all(),
        ];
    }

    // ---------- منابع انسانی ----------
    private function partHr(): array
    {
        if ($this->role !== 'admin') {
            return ['staff' => [], 'shifts' => (object) [], 'attendance' => (object) [], 'leaves' => [], 'advances' => [], 'payrolls' => []];
        }
        $staff = DB::table('staff')->orderBy('created_at')->orderBy('id')->get();
        $att = [];
        foreach (DB::table('attendance')->get() as $a) {
            $att[Dates::key($a->date)][$a->staff_id] = ['in' => Shape::num($a->in), 'out' => $a->out !== null ? Shape::num($a->out) : null];
        }

        return [
            'staff' => $staff->map(fn ($s) => Shape::staff($s))->all(),
            'shifts' => (object) $staff->mapWithKeys(fn ($s) => [$s->id => Shape::j($s->shifts, array_fill(0, 7, 'off'))])->all(),
            'attendance' => (object) $att,
            'leaves' => DB::table('leaves')->orderByDesc('at')->get()->map(fn ($l) => ['id' => $l->id, 'staff' => $l->staff, 'kind' => $l->kind, 'from' => Dates::key($l->from), 'to' => Dates::key($l->to), 'days' => (int) $l->days, 'status' => $l->status, 'note' => $l->note ?? '', 'at' => Dates::ms($l->at)])->all(),
            'advances' => DB::table('advances')->orderByDesc('date')->orderByDesc('created_at')->get()->map(fn ($a) => ['id' => $a->id, 'staff' => $a->staff, 'name' => $a->name, 'date' => Dates::key($a->date), 'amount' => (int) $a->amount, 'pay' => $a->pay, 'note' => $a->note ?? ''])->all(),
            'payrolls' => DB::table('payrolls')->orderByDesc('month')->get()->map(fn ($p) => ['id' => $p->id, 'month' => $p->month, 'label' => $p->label, 'date' => Dates::key($p->date), 'rows' => Shape::j($p->rows, []), 'paidAt' => Dates::key($p->paid_at), 'insPaidAt' => Dates::key($p->ins_paid_at), 'at' => Dates::ms($p->at)])->all(),
        ];
    }

    // ---------- حساب شخصی بازیکن ----------
    public function me(): ?array
    {
        if ($this->role !== 'player') {
            return null;
        }
        $m = DB::table('members')->where('id', $this->actor->id)->first();
        if (! $m) {
            return null;
        }
        $ms = Members::membership($m->id);
        $quests = [];
        foreach (DB::table('quest_claims')->where('member_id', $m->id)->where('week', '>=', now()->subDays(60)->format('Y-m-d'))->get() as $q) {
            $quests[$q->week][] = $q->quest;
        }

        return [
            'user' => [
                'id' => $m->id, 'name' => $m->name, 'phone' => $m->phone, 'level' => $m->level, 'side' => $m->side,
                'gender' => $m->gender, 'birth' => $m->birth !== null ? (int) $m->birth : null,
                'username' => $m->username, 'joined' => Dates::ms($m->joined_at ?? $m->created_at),
            ],
            'xp' => (int) $m->xp,
            'wallet' => (int) $m->wallet,
            'badges' => DB::table('member_badges')->where('member_id', $m->id)->orderBy('created_at')->pluck('badge')->all(),
            'rated' => DB::table('review_marks')->where('member_id', $m->id)->pluck('target')->all(),
            'membership' => $ms ? ['id' => $ms->package, 'until' => Dates::ms($ms->ends_at)] : null,
            'notifications' => DB::table('notifications')->where('member_id', $m->id)->orderByDesc('created_at')->orderByDesc('id')->limit(60)->get()
                ->map(fn ($n) => ['id' => $n->id, 'at' => Dates::ms($n->created_at), 'read' => (bool) $n->read, 'icon' => $n->icon, 'title' => $n->title, 'body' => $n->body ?? ''])->all(),
            'quests' => (object) $quests,
            'events' => DB::table('event_registrations')->where('by', $m->id)->distinct()->pluck('event_id')->all(),
            'v' => (int) $m->state_v,
        ];
    }

    public static function versions(?object $actor, string $role): array
    {
        $v = Sync::versions();
        if ($role === 'player') {
            $v['me'] = (int) DB::table('members')->where('id', $actor->id)->value('state_v');
        }

        return $v;
    }
}
