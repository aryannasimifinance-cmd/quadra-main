<?php

namespace App\Domain;

use App\Support\Fail;
use Illuminate\Support\Facades\DB;

/**
 * کافه: مصرف مواد اولیه طبق دستور تهیه و بهای تمام‌شده — همان cafe.js اپ.
 * موجودی به واحد پایه (گرم / میلی‌لیتر / عدد) است.
 */
final class Cafe
{
    public const BIG_K = 1.5;

    /** اقلام و مواد اولیه را برای محاسبه بار می‌کند (باید بعد از قفل «cafe» صدا زده شود) */
    public static function load(): array
    {
        $items = DB::table('cafe_items')->get()->keyBy('id')->map(function ($i) {
            $i->recipe = json_decode($i->recipe, true) ?: [];

            return $i;
        })->all();
        $ings = DB::table('cafe_ingredients')->get()->keyBy('id')->map(function ($g) {
            $g->stock = (float) $g->stock;
            $g->cost = (float) $g->cost;

            return $g;
        })->all();

        return [$items, $ings];
    }

    /** سطرهای سبد را تمیز و یکی می‌کند؛ سطر نامعتبر = خطا */
    public static function clean(array $items, $lines): array
    {
        if (! is_array($lines) || ! $lines || count($lines) > 40) {
            Fail::with('bad');
        }
        $out = [];
        foreach ($lines as $x) {
            $iid = $x['iid'] ?? null;
            $qty = $x['qty'] ?? null;
            if (! is_string($iid) || ! isset($items[$iid]) || ! is_numeric($qty) || (int) $qty != $qty || (int) $qty < 1 || (int) $qty > 50) {
                Fail::with('stock');
            }
            $it = $items[$iid];
            if (! $it->active) {
                Fail::with('stock');
            }
            $big = ! empty($x['big']) && (int) $it->big > 0;
            $note = isset($x['note']) && is_scalar($x['note']) ? mb_substr(trim((string) $x['note']), 0, 60) : '';
            $out[] = ['iid' => $iid, 'qty' => (int) $qty, 'big' => $big, 'note' => $note];
        }

        return $out;
    }

    private static function recipe(object $it, bool $big): array
    {
        return array_map(fn ($r) => [$r[0], (float) $r[1] * ($big ? self::BIG_K : 1)], $it->recipe);
    }

    public static function priceOf(object $it, bool $big): int
    {
        return (int) $it->price + ($big && (int) $it->big > 0 ? (int) $it->big : 0);
    }

    /** کمبود: [شناسه‌ی ماده => کمبود] */
    public static function shortage(array $ings, array $items, array $lines): array
    {
        $need = [];
        foreach ($lines as $x) {
            foreach (self::recipe($items[$x['iid']], $x['big']) as [$id, $q]) {
                $need[$id] = ($need[$id] ?? 0) + $q * $x['qty'];
            }
        }
        $short = [];
        foreach ($need as $id => $q) {
            $have = isset($ings[$id]) ? $ings[$id]->stock : 0;
            if ($q > $have + 1e-9) {
                $short[$id] = $q - $have;
            }
        }

        return $short;
    }

    /**
     * ثبت سفارش: قیمت، بهای تمام‌شده و مصرف هر ماده با بهای همان لحظه.
     * خروجی: lines (اقلام سفارش)، use (برای سند حسابداری)، stock (موجودی تازه‌ی هر ماده)، total
     */
    public static function place(array $ings, array $items, array $lines): array
    {
        if (self::shortage($ings, $items, $lines)) {
            Fail::with('stock');
        }
        $use = [];
        $out = [];
        foreach ($lines as $x) {
            $it = $items[$x['iid']];
            $cost = 0.0;
            foreach (self::recipe($it, $x['big']) as [$id, $q]) {
                if (! isset($ings[$id])) {
                    continue;
                }
                $g = $ings[$id];
                $u = $use[$id] ?? ['code' => $g->code, 'qty' => 0.0, 'amt' => 0.0];
                $u['qty'] += $q * $x['qty'];
                $u['amt'] += $q * $x['qty'] * $g->cost;
                $cost += $q * $x['qty'] * $g->cost;
                $use[$id] = $u;
            }
            $out[] = ['iid' => $it->id, 'code' => $it->code, 'name' => $it->name, 'cat' => $it->cat, 'qty' => $x['qty'], 'big' => $x['big'], 'note' => $x['note'], 'price' => self::priceOf($it, $x['big']), 'cost' => (int) round($cost)];
        }
        // جمع ردیف‌ها با جمع مصرف یکی می‌شود تا سند تراز بماند
        $usedSum = 0;
        foreach ($use as $id => $u) {
            $use[$id]['amt'] = (int) round($u['amt']);
            $usedSum += $use[$id]['amt'];
        }
        $diff = $usedSum - array_sum(array_column($out, 'cost'));
        if ($out && $diff) {
            $out[0]['cost'] += $diff;
        }
        $stock = [];
        foreach ($use as $id => $u) {
            $stock[$id] = max(0, round($ings[$id]->stock - $u['qty'], 3));
        }
        $total = 0;
        foreach ($out as $l) {
            $total += $l['qty'] * $l['price'];
        }

        return [
            'lines' => $out,
            'use' => array_values(array_map(fn ($u) => [$u['code'], round($u['qty'] * 100) / 100, $u['amt']], $use)),
            'stock' => $stock,
            'total' => $total,
        ];
    }

    public static function saveStock(array $stock): void
    {
        foreach ($stock as $id => $s) {
            DB::table('cafe_ingredients')->where('id', $id)->update(['stock' => $s, 'updated_at' => now()]);
        }
    }

    /** خرید مواد اولیه: موجودی و بهای میانگین موزون */
    public static function receive(array $lines): void
    {
        $by = [];
        foreach ($lines as $l) {
            $by[$l['ing']][] = $l;
        }
        foreach ($by as $id => $ls) {
            $g = DB::table('cafe_ingredients')->where('id', $id)->first();
            if (! $g) {
                Fail::with('bad');
            }
            $add = array_sum(array_column($ls, 'qty'));
            $val = 0.0;
            foreach ($ls as $l) {
                $val += $l['qty'] * $l['cost'];
            }
            $stock = (float) $g->stock;
            $cost = $stock + $add > 0 ? ($stock * (float) $g->cost + $val) / ($stock + $add) : (float) $g->cost;
            DB::table('cafe_ingredients')->where('id', $id)->update(['stock' => round($stock + $add, 3), 'cost' => round($cost, 2), 'updated_at' => now()]);
        }
    }
}
