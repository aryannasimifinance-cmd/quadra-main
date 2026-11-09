<?php

namespace App\Http\Middleware;

use App\Domain\Settings;
use App\Models\Admin;
use App\Models\Coach;
use App\Models\Member;
use App\Support\Audit;
use Closure;
use Illuminate\Http\Request;

/** هر مسیر فقط برای نقش خودش: role:player | role:coach | role:admin | role:any */
class Role
{
    public function handle(Request $request, Closure $next, string $role)
    {
        Settings::forget();
        $u = $request->user();
        $actual = match (true) {
            $u instanceof Member => 'player',
            $u instanceof Coach => 'coach',
            $u instanceof Admin => 'admin',
            default => null,
        };
        if (! $actual || ($role !== 'any' && $role !== $actual)) {
            return response()->json(['error' => 'auth'], 401);
        }
        // مربی‌ای که دسترسی‌اش بسته شده یا مدیر غیرفعال همان لحظه بیرون می‌رود
        if (($actual === 'coach' && ! $u->login_on) || ($actual === 'admin' && ! $u->active)) {
            $u->currentAccessToken()?->delete();

            return response()->json(['error' => 'auth'], 401);
        }
        Audit::$actor = $actual.':'.$u->id;
        $request->attributes->set('role', $actual);

        return $next($request);
    }
}
