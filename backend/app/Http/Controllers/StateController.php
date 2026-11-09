<?php

namespace App\Http\Controllers;

use App\Domain\Catalog;
use App\Payments\PaymentService;
use App\Sms\SmsSender;
use App\State\StateBuilder;
use Illuminate\Http\Request;

/** داده‌ی اپ: کامل یا فقط بخش‌های تغییرکرده، و نسخه‌ها برای همگام‌سازی */
class StateController extends Controller
{
    public function state(Request $r)
    {
        $role = $r->attributes->get('role');
        $u = $r->user();
        $only = $r->query('only') ? array_values(array_intersect(explode(',', (string) $r->query('only')), array_keys(StateBuilder::PARTS))) : null;
        $b = new StateBuilder($role, $u);
        $out = [
            'session' => ['role' => $role, 'id' => $u->id, 'name' => $u->name ?? null],
            'club' => $b->club($only),
            'v' => StateBuilder::versions($u, $role),
        ];
        if ($role === 'player' && ($only === null || $r->boolean('me'))) {
            $out['me'] = $b->me();
        }

        return response()->json($out);
    }

    public function sync(Request $r)
    {
        return ['v' => StateBuilder::versions($r->user(), $r->attributes->get('role'))];
    }

    /** تنظیمات عمومی برای اپ (پیش از ورود) */
    public function config()
    {
        return [
            'demo' => (bool) config('quadra.demo'),
            'pay' => PaymentService::enabled(),
            'smsTest' => SmsSender::driver() === 'log',
            'topup' => ['min' => (int) config('quadra.payment.topup_min'), 'max' => (int) config('quadra.payment.topup_max')],
            'levels' => array_keys(Catalog::LEVELS),
            'welcome' => \App\Domain\Settings::welcome(),
        ];
    }
}
