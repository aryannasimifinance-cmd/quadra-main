<?php

namespace App\State;

use App\Domain\Catalog;
use App\Support\Dates;

/** تبدیل ردیف‌های دیتابیس به همان شکل JSON که اپ (store.jsx قبلی) داشت */
final class Shape
{
    public static function j($v, $default = null)
    {
        if ($v === null || $v === '') {
            return $default;
        }

        return is_string($v) ? (json_decode($v, true) ?? $default) : $v;
    }

    public static function num($v): float|int
    {
        $f = (float) $v;

        return floor($f) == $f ? (int) $f : $f;
    }

    public static function booking(object $b, array $players = [], array $invited = [], array $settled = []): array
    {
        $plist = [];
        $shares = [];
        foreach ($players as $p) {
            $plist[] = $p->player;
            if ($p->share !== null) {
                $shares[$p->player] = (int) $p->share;
            }
        }
        $out = [
            'id' => $b->id, 'court' => (int) $b->court, 'date' => Dates::key($b->date),
            'start' => self::num($b->start), 'dur' => self::num($b->dur), 'type' => $b->type, 'status' => $b->status,
            'source' => $b->source, 'by' => $b->by, 'players' => $plist, 'coach' => $b->coach,
            'price' => (int) $b->price, 'paid' => (int) $b->paid, 'method' => $b->method,
            'levels' => self::j($b->levels), 'refunded' => (bool) $b->refunded, 'at' => Dates::ms($b->created_at),
        ];
        if ($b->full !== null) {
            $out['full'] = (int) $b->full;
        }
        if ($b->visibility) {
            $out['visibility'] = $b->visibility;
            $out['invited'] = $invited;
        }
        if ($b->want_side) {
            $out['wantSide'] = $b->want_side;
        }
        if ($shares) {
            $out['shares'] = $shares;
        }
        if ($b->series) {
            $out['series'] = $b->series;
        }
        if ($b->block) {
            $out['block'] = $b->block;
        }
        if ($b->note !== null && $b->note !== '') {
            $out['note'] = $b->note;
        }
        if ($settled) {
            $out['settled'] = array_map(fn ($s) => ['amt' => (int) $s->amount, 'at' => Dates::ms($s->at), 'method' => $s->method], $settled);
        }

        return $out;
    }

    /** زمین‌های بسته‌ی مسابقه در تقویم (همان blocksOf اپ) */
    public static function eventBlocks(object $e): array
    {
        if (in_array($e->status, ['draft', 'cancelled'], true)) {
            return [];
        }
        $out = [];
        foreach (self::j($e->courts, []) as $c) {
            $out[] = [
                'id' => "ev-{$e->id}-{$c}", 'court' => (int) $c, 'date' => Dates::key($e->date), 'start' => self::num($e->start), 'dur' => self::num($e->dur),
                'type' => 'block', 'note' => '🏆 '.$e->title, 'event' => $e->id, 'by' => null, 'players' => [], 'price' => 0, 'paid' => 0,
                'status' => 'ok', 'source' => 'desk', 'at' => Dates::ms($e->created_at), 'coach' => null, 'levels' => null, 'refunded' => false, 'method' => null,
            ];
        }

        return $out;
    }

    public static function event(object $e, array $regs, bool $private): array
    {
        $out = [
            'id' => $e->id, 'kind' => $e->kind, 'title' => $e->title, 'desc' => $e->desc, 'format' => $e->format,
            'scoring' => $e->scoring, 'gender' => $e->gender, 'ageMin' => $e->age_min !== null ? (int) $e->age_min : null,
            'ageMax' => $e->age_max !== null ? (int) $e->age_max : null, 'date' => Dates::key($e->date), 'start' => self::num($e->start),
            'dur' => self::num($e->dur), 'courts' => array_map('intval', self::j($e->courts, [])), 'levels' => self::j($e->levels, []),
            'cap' => (int) $e->cap, 'fee' => (int) $e->fee, 'prize' => $e->prize, 'img' => $e->img, 'status' => $e->status,
            'note' => $e->note ?? '', 'teams' => self::j($e->teams, []), 'groups' => self::j($e->groups, []), 'matches' => self::j($e->matches, []),
        ];
        if ($e->setup) {
            $out['setup'] = self::j($e->setup);
        }
        foreach (self::j($e->extra, []) as $k => $v) {
            if (! array_key_exists($k, $out)) {
                $out[$k] = $v;
            }
        }
        $out['regs'] = array_map(fn ($r) => self::reg($r, $private), $regs);

        return $out;
    }

    public static function reg(object $r, bool $private): array
    {
        $out = ['id' => $r->rid, 'by' => $r->by, 'name' => $r->name, 'level' => $r->level, 'at' => Dates::ms($r->at)];
        if ($r->pair) {
            $out['pair'] = $r->pair;
        }
        if ($r->waiting) {
            $out['waiting'] = true;
        }
        if ($private) {
            $out += ['phone' => $r->phone, 'method' => $r->method, 'paid' => (int) $r->paid, 'source' => $r->source, 'sale' => $r->sale];
            if ($r->payer) {
                $out['payer'] = $r->payer;
            }
            if ($r->gender) {
                $out['gender'] = $r->gender;
            }
            if ($r->birth) {
                $out['birth'] = (int) $r->birth;
            }
        } else {
            $out['paid'] = (int) $r->paid > 0 ? 1 : 0;
        }

        return $out;
    }

    public static function member(object $m, int $games, string $scope): array
    {
        $base = [
            'id' => $m->id, 'name' => $m->name, 'level' => $m->level, 'side' => $m->side,
            'points' => Catalog::levelBase($m->level) + intdiv((int) $m->xp, 2) + (int) $m->points_extra,
            'games' => $games, 'wins' => (int) $m->wins,
        ];
        if ($m->inactive) {
            $base['inactive'] = true;
        }
        if ($scope === 'coach') {
            return $base;
        }
        $base['gender'] = $m->gender;
        $base['birth'] = $m->birth !== null ? (int) $m->birth : null;
        if ($scope === 'player') {
            return $base;
        }
        $created = $m->joined_at ?? $m->created_at;

        return $base + [
            'phone' => $m->phone, 'source' => $m->source, 'member' => $m->vip_now ?? $m->vip, 'note' => $m->note ?? '',
            'joined' => $created ? (int) floor((time() - strtotime($created)) / 86400) : 0, 'at' => Dates::ms($m->created_at),
            'username' => $m->username,
        ];
    }

    /** $scope: public (بازیکن‌ها)، self (خود مربی)، full (مدیر) */
    public static function coach(object $c, string $scope): array
    {
        $out = [
            'id' => $c->id, 'name' => $c->name, 'title' => $c->title, 'level' => $c->level, 'exp' => (int) $c->exp,
            'rating' => $c->rating !== null ? (float) $c->rating : null, 'price' => (int) $c->price, 'img' => $c->img, 'bio' => $c->bio ?? '',
            'record' => self::j($c->record, []), 'packs' => self::j($c->packs, ['one' => true, 'five' => true, 'ten' => true, 'group' => true]),
            'prices' => (object) self::j($c->prices, []), 'active' => (bool) $c->active,
        ];
        if ($scope === 'public') {
            return $out;
        }
        $out += [
            'member' => $c->member, 'phone' => $c->phone, 'since' => $c->since, 'share' => (int) $c->share, 'note' => $c->note ?? '',
            'login' => ['on' => (bool) $c->login_on, 'user' => $c->username ?? '', 'pass' => '', 'set' => $c->password !== null, 'day' => (int) $c->cap_day, 'week' => (int) $c->cap_week],
        ];
        if ($scope === 'self') {
            $out['note'] = ''; // یادداشت مدیر برای خود مربی نشان داده نمی‌شود

            return $out;
        }
        foreach (self::j($c->meta, []) as $k => $v) {
            if (! array_key_exists($k, $out)) {
                $out[$k] = $v;
            }
        }

        return $out;
    }

    public static function product(object $p, array $variants, bool $admin): array
    {
        $out = self::j($p->meta, []);
        $out = array_merge($out, [
            'id' => $p->id, 'code' => $p->code, 'cat' => $p->cat, 'brand' => $p->brand, 'name' => $p->name,
            'price' => (int) $p->price, 'active' => (bool) $p->active,
            'variants' => array_map(fn ($v) => ['sku' => $v->sku, 'size' => $v->size, 'color' => $v->color, 'stock' => (int) $v->stock], $variants),
        ]);
        if ($p->was) {
            $out['was'] = (int) $p->was;
        }
        if ($p->tag) {
            $out['tag'] = $p->tag;
        }
        if ($admin) {
            $out['cost'] = (int) $p->cost;
        }

        return $out;
    }

    public static function cafeItem(object $i): array
    {
        return array_merge(self::j($i->meta, []), [
            'id' => $i->id, 'code' => $i->code, 'name' => $i->name, 'cat' => $i->cat, 'price' => (int) $i->price,
            'big' => (int) $i->big, 'active' => (bool) $i->active, 'recipe' => array_map(fn ($r) => [$r[0], self::num($r[1])], self::j($i->recipe, [])),
        ]);
    }

    public static function cafeIng(object $g, bool $admin): array
    {
        $out = ['id' => $g->id, 'code' => $g->code, 'name' => $g->name, 'cat' => $g->cat, 'unit' => $g->unit, 'stock' => self::num($g->stock), 'active' => (bool) $g->active];
        if ($admin) {
            $out['cost'] = self::num($g->cost);
            $out['min'] = self::num($g->min);
        }

        return $out;
    }

    public static function order(object $o, bool $cafe, bool $admin = true): array
    {
        $out = ['id' => $o->id, 'by' => $o->by, 'items' => self::j($o->items, []), 'total' => (int) $o->total, 'method' => $o->method, 'status' => $o->status, 'source' => $o->source, 'at' => Dates::ms($o->at)];
        if ($cafe) {
            $out['use'] = self::j($o->use, []);
            $out['to'] = $o->to !== null ? (int) $o->to : null;
        }

        return $admin ? $out : self::publicOrder($out);
    }

    /** سفارش برای بازیکن: بهای تمام‌شده و مصرف مواد (اطلاعات مالی باشگاه) حذف می‌شود */
    public static function publicOrder(array $o): array
    {
        $o['items'] = array_map(function ($x) {
            unset($x['cost']);

            return $x;
        }, $o['items'] ?? []);
        if (array_key_exists('use', $o)) {
            $o['use'] = [];
        }

        return $o;
    }

    public static function sale(object $s): array
    {
        return ['id' => $s->id, 'kind' => $s->kind, 'item' => $s->item, 'pack' => $s->pack, 'series' => $s->series, 'name' => $s->name, 'by' => $s->by, 'price' => (int) $s->price, 'method' => $s->method, 'at' => Dates::ms($s->at)];
    }

    public static function coachReq(object $r): array
    {
        return ['id' => $r->id, 'coach' => $r->coach, 'date' => Dates::key($r->date), 'court' => (int) $r->court, 'start' => self::num($r->start), 'dur' => self::num($r->dur),
            'student' => $r->student, 'note' => $r->note ?? '', 'status' => $r->status, 'at' => Dates::ms($r->created_at), 'done' => Dates::ms($r->decided_at)];
    }

    public static function staff(object $s): array
    {
        return array_merge(self::j($s->meta, []), [
            'id' => $s->id, 'name' => $s->name, 'role' => $s->role, 'type' => $s->type, 'base' => (int) $s->base, 'rate' => (int) $s->rate,
            'children' => (int) $s->children, 'start' => Dates::key($s->start), 'contractEnd' => Dates::key($s->contract_end), 'status' => $s->status,
        ] + ($s->coach ? ['coach' => $s->coach] : []) + ($s->share !== null ? ['share' => (float) $s->share] : []));
    }
}
