<?php

namespace App\Support;

use RuntimeException;

/**
 * خطای «قابل انتظار» (زمین پر شد، موجودی کافی نیست، …).
 * به اپ با کد خطا برمی‌گردد تا همان پیام‌های فعلی اپ نشان داده شود.
 */
class Fail extends RuntimeException
{
    public function __construct(public string $err, public array $extra = [], string $message = '')
    {
        parent::__construct($message ?: $err);
    }

    public static function with(string $code, array $extra = [], string $message = ''): never
    {
        throw new self($code, $extra, $message);
    }
}
