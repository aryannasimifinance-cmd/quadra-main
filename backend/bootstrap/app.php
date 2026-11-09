<?php

use App\Http\Middleware\Role;
use App\Support\Fail;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['role' => Role::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // خطاهای قابل انتظار با کد خطا (همان پیام‌های اپ)
        $exceptions->render(function (Fail $f, Request $r) {
            return response()->json(['error' => $f->err] + $f->extra);
        });
        $exceptions->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*') || $r->expectsJson());
    })->create();
