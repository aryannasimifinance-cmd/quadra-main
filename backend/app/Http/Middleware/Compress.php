<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * فشرده‌سازی gzip پاسخ‌های بزرگ API (داده‌ی پنل مدیر ۷ مگ ← کمتر از ۰٫۵ مگ).
 * اگر وب‌سرور خودش فشرده کرده باشد یا مرورگر پشتیبانی نکند، کاری نمی‌کند.
 */
class Compress
{
    private const MIN = 20 * 1024;

    public function handle(Request $request, Closure $next)
    {
        $res = $next($request);
        if (! function_exists('gzencode') || $res->headers->has('Content-Encoding') || ! str_contains((string) $request->header('Accept-Encoding'), 'gzip')
            || ! method_exists($res, 'getContent') || $res instanceof \Symfony\Component\HttpFoundation\StreamedResponse || $res instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse) {
            return $res;
        }
        $body = $res->getContent();
        if ($body === false || strlen($body) < self::MIN) {
            return $res;
        }
        $gz = gzencode($body, 5);
        if ($gz === false) {
            return $res;
        }
        $res->setContent($gz);
        $res->headers->set('Content-Encoding', 'gzip');
        $res->headers->set('Vary', 'Accept-Encoding', false);
        $res->headers->set('Content-Length', (string) strlen($gz));

        return $res;
    }
}
