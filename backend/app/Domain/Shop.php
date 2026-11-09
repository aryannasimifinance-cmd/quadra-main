<?php

namespace App\Domain;

use App\Support\Fail;
use Illuminate\Support\Facades\DB;

/** فروشگاه و انبار — همان catalog.js و منطق سفارش اپ */
final class Shop
{
    public const COLORS = ['مشکی' => 'BK', 'سفید' => 'WH', 'فیروزه‌ای' => 'TQ', 'سرمه‌ای' => 'NV', 'طوسی' => 'GR', 'قرمز' => 'RD', 'نارنجی' => 'OR', 'آبی' => 'BL', 'زرد' => 'YL', 'صورتی' => 'PK', 'سبز' => 'GN'];

    public const COLOR_HEX = ['مشکی' => '#141413', 'سفید' => '#F4F2EC', 'فیروزه‌ای' => '#19C9C1', 'سرمه‌ای' => '#24344F', 'طوسی' => '#9A988F', 'قرمز' => '#C2503A', 'نارنجی' => '#E07B39', 'آبی' => '#2F5D8C', 'زرد' => '#E7C25A', 'صورتی' => '#E79BB8', 'سبز' => '#3DA57E'];

    public const CAT_CODE = ['racket' => '11', 'shoes' => '12', 'apparel' => '13', 'balls' => '14', 'bags' => '15', 'acc' => '16'];

    public static function latin(string $s): string
    {
        return strtr($s, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
    }

    public static function skuOf(string $code, ?string $size, ?string $color): string
    {
        $s = $size !== null && $size !== '' ? str_replace('/', '', self::latin($size)) : '00';
        $c = $color !== null && $color !== '' ? (self::COLORS[$color] ?? 'XX') : '00';

        return "{$code}-{$s}-{$c}";
    }

    public static function nextCode(string $cat): string
    {
        $pre = self::CAT_CODE[$cat] ?? '19';
        $max = DB::table('products')->where('code', 'like', $pre.'%')->pluck('code')->map(fn ($c) => (int) substr($c, 2))->max() ?? 0;

        return $pre.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    /** ترکیب سایز × رنگ؛ موجودی تنوع‌های قبلی حفظ می‌شود */
    public static function makeVariants(string $code, array $meta, array $old): array
    {
        $sizes = ! empty($meta['sizes']) && is_array($meta['sizes']) ? array_values($meta['sizes']) : [null];
        $colors = ! empty($meta['colors']) && is_array($meta['colors']) ? array_values(array_map(fn ($c) => is_array($c) ? ($c['n'] ?? null) : $c, $meta['colors'])) : [null];
        $byOld = [];
        foreach ($old as $v) {
            $byOld[$v->sku] = $v;
        }
        $out = [];
        foreach ($sizes as $size) {
            foreach ($colors as $color) {
                $sku = self::skuOf($code, $size, $color);
                if (isset($out[$sku])) {
                    continue;
                }
                $out[$sku] = ['sku' => $sku, 'size' => $size, 'color' => $color, 'stock' => isset($byOld[$sku]) ? (int) $byOld[$sku]->stock : 0];
            }
        }
        // تنوعی که حذف شده ولی هنوز موجودی دارد نگه داشته می‌شود
        foreach ($old as $v) {
            if ((int) $v->stock > 0 && ! isset($out[$v->sku])) {
                $out[$v->sku] = ['sku' => $v->sku, 'size' => $v->size, 'color' => $v->color, 'stock' => (int) $v->stock];
            }
        }

        return array_values($out);
    }

    public static function saveVariants(string $pid, array $variants): void
    {
        $keep = array_column($variants, 'sku');
        DB::table('product_variants')->where('product_id', $pid)->whereNotIn('sku', $keep ?: ['-'])->delete();
        foreach ($variants as $i => $v) {
            DB::table('product_variants')->updateOrInsert(['sku' => $v['sku']], ['product_id' => $pid, 'size' => $v['size'], 'color' => $v['color'], 'stock' => max(0, (int) $v['stock']), 'pos' => $i]);
        }
    }

    /**
     * سطرهای سبد/فروش را به تنوع مشخص وصل می‌کند و قیمت و بهای فعلی را می‌گذارد.
     * $active: کالای غیرفعال پذیرفته نشود (اپ بازیکن)
     */
    public static function resolve(array $lines, bool $active): array
    {
        if (! $lines || count($lines) > 40) {
            Fail::with('bad');
        }
        $out = [];
        foreach ($lines as $x) {
            $pid = $x['pid'] ?? null;
            $qty = $x['qty'] ?? null;
            if (! is_string($pid) || ! is_numeric($qty) || (int) $qty != $qty || (int) $qty < 1 || (int) $qty > 100) {
                Fail::with('bad');
            }
            $p = DB::table('products')->where('id', $pid)->first();
            if (! $p || ($active && ! $p->active)) {
                Fail::with('stock', ['name' => $p->name ?? '']);
            }
            $vs = DB::table('product_variants')->where('product_id', $pid)->orderBy('pos')->get();
            $v = null;
            if (! empty($x['sku'])) {
                $v = $vs->firstWhere('sku', $x['sku']);
            } else {
                $size = ($x['size'] ?? null) ?: null;
                $color = ($x['color'] ?? null) ?: null;
                $v = $vs->first(fn ($y) => ($y->size ?: null) === $size && ($y->color ?: null) === $color);
                if (! $v && $vs->count() === 1) {
                    $v = $vs->first();
                }
            }
            if (! $v) {
                Fail::with('stock', ['name' => $p->name]);
            }
            $key = $v->sku;
            if (isset($out[$key])) {
                $out[$key]['qty'] += (int) $qty;
            } else {
                $out[$key] = ['pid' => $p->id, 'qty' => (int) $qty, 'size' => $v->size, 'color' => $v->color,
                    'colorHex' => $v->color ? (self::COLOR_HEX[$v->color] ?? null) : null, 'sku' => $v->sku,
                    'price' => (int) $p->price, 'cost' => (int) $p->cost, '_name' => $p->name];
            }
        }

        return array_values($out);
    }

    /** کم کردن موجودی؛ اگر کافی نباشد خطا (باید بعد از قفل «shop» باشد) */
    public static function take(array $items): void
    {
        foreach ($items as $x) {
            $n = DB::table('product_variants')->where('sku', $x['sku'])->where('stock', '>=', $x['qty'])->decrement('stock', $x['qty']);
            if ($n !== 1) {
                Fail::with('stock', ['name' => $x['_name'] ?? '']);
            }
        }
    }

    public static function strip(array $items): array
    {
        return array_map(function ($x) {
            unset($x['_name']);

            return $x;
        }, $items);
    }
}
