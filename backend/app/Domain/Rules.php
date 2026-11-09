<?php

namespace App\Domain;

use App\Support\Jalali;

/** قواعد شرکت در مسابقه — همان whyNot اپ */
final class Rules
{
    /** null یعنی مجاز؛ وگرنه level / gender / age */
    public static function whyNot(object $ev, array $p): ?string
    {
        $levels = is_string($ev->levels) ? (json_decode($ev->levels, true) ?: []) : ($ev->levels ?? []);
        if ($levels && (empty($p['level']) || ! in_array($p['level'], $levels, true))) {
            return 'level';
        }
        if ($ev->gender && $ev->gender !== 'all' && ($p['gender'] ?? null) !== $ev->gender) {
            return 'gender';
        }
        if ($ev->age_min || $ev->age_max) {
            $a = Jalali::age(isset($p['birth']) ? (int) $p['birth'] : null);
            if ($a === null || ($ev->age_min && $a < $ev->age_min) || ($ev->age_max && $a > $ev->age_max)) {
                return 'age';
            }
        }

        return null;
    }

    public static function validBirth($y): bool
    {
        $now = Jalali::year();

        return is_numeric($y) && (int) $y >= $now - 90 && (int) $y <= $now - 7;
    }
}
