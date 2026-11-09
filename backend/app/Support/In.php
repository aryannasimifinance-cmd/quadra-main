<?php

namespace App\Support;

/** تبدیل امن ورودی کاربر: هر چیزی جز متن/عدد (مثلاً لیست) رشته‌ی خالی می‌شود */
final class In
{
    public static function str($v): string
    {
        return is_scalar($v) ? (string) $v : '';
    }
}