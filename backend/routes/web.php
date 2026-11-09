<?php

use Illuminate\Support\Facades\Route;

// اپ (خروجی build فرانت در public/spa.html)؛ هر مسیری غیر از api به همان صفحه می‌رسد
$spa = function () {
    $file = public_path('spa.html');
    abort_unless(is_file($file), 404, 'Frontend is not built. Run: cd frontend && npm run build');

    return response(file_get_contents($file), 200, ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-cache']);
};

Route::get('/', $spa);
Route::fallback(fn () => request()->is('api/*') ? response()->json(['error' => 'notfound'], 404) : $spa());
