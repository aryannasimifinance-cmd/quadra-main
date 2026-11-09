<?php

namespace App\Support;

/**
 * عکس‌هایی که مدیر آپلود می‌کند در اپ به شکل data:image می‌آیند؛ این‌جا به فایل
 * در public/uploads تبدیل می‌شوند و فقط آدرس فایل در دیتابیس می‌ماند.
 */
final class Uploads
{
    private const MAX = 4 * 1024 * 1024;

    public static function image($value): ?string
    {
        if ($value === null || $value === '' || $value === false) {
            return null;
        }
        if (! is_string($value)) {
            Fail::with('bad');
        }
        if (! str_starts_with($value, 'data:')) {
            // آدرس عکس آماده یا فایل قبلاً آپلودشده
            if (strlen($value) > 500 || ! preg_match('#^(\./|/|https://)[^\s"\'<>]*$#', $value)) {
                Fail::with('bad');
            }

            return $value;
        }
        if (! preg_match('#^data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$#', $value, $m)) {
            Fail::with('image');
        }
        $bin = base64_decode(preg_replace('/\s+/', '', $m[2]), true);
        if ($bin === false || strlen($bin) > self::MAX || strlen($bin) < 64) {
            Fail::with('image');
        }
        $info = @getimagesizefromstring($bin);
        if (! $info || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            Fail::with('image');
        }
        $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]];
        $dir = 'uploads/'.date('Y/m');
        $abs = public_path($dir);
        if (! is_dir($abs) && ! mkdir($abs, 0755, true) && ! is_dir($abs)) {
            throw new \RuntimeException('cannot create upload dir');
        }
        $name = bin2hex(random_bytes(12)).'.'.$ext;
        file_put_contents($abs.'/'.$name, $bin);

        return './'.$dir.'/'.$name;
    }
}
