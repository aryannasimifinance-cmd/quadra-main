<?php

namespace App\Http\Controllers;

use App\Actions\AdminActions;
use App\Actions\CoachActions;
use App\Actions\PlayerActions;
use App\State\StateBuilder;
use App\Support\Fail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * همه‌ی کارهای اپ از این‌جا اجرا می‌شوند. خطای قابل انتظار (مثل «زمین پر شد») با
 * کد خطا برمی‌گردد تا اپ همان پیام فعلی را نشان دهد؛ نسخه‌های تازه هم برمی‌گردد.
 */
class ActionController extends Controller
{
    private const PLAYER = ['book', 'joinGame', 'declineInvite', 'cancelMine', 'registerEvent', 'bookSeries', 'buyPackage', 'topUp',
        'checkout', 'cafeCheckout', 'payBooking', 'claimQuest', 'addReview', 'notify', 'readAll', 'updateProfile', 'setLogin'];

    private const COACH = ['coachReq', 'coachReqCancel', 'coachSetPlayers', 'coachPay'];

    private function respond(Request $r, callable $fn)
    {
        try {
            $out = $fn();
        } catch (Fail $f) {
            $out = ['error' => $f->err] + $f->extra;
        } catch (\TypeError|\ArgumentCountError|\ValueError $e) {
            Log::notice('bad action input', ['path' => $r->path(), 'e' => $e->getMessage()]);
            $out = ['error' => 'bad'];
        }
        $out['v'] = StateBuilder::versions($r->user(), $r->attributes->get('role'));

        return response()->json($out);
    }

    public function player(Request $r, string $action)
    {
        abort_unless(in_array($action, self::PLAYER, true), 404);

        return $this->respond($r, function () use ($r, $action) {
            $a = PlayerActions::forMember($r->user()->id);

            return $action === 'readAll' ? $a->readAll() : $a->{$action}((array) $r->json()->all());
        });
    }

    public function coach(Request $r, string $action)
    {
        abort_unless(in_array($action, self::COACH, true), 404);

        return $this->respond($r, fn () => (new CoachActions($r->user()))->{$action}((array) $r->json()->all()));
    }

    /** دستورهای پنل مدیر با همان آرگومان‌های store قبلی: { "args": [...] } */
    public function admin(Request $r, string $cmd)
    {
        abort_unless(in_array($cmd, AdminActions::COMMANDS, true), 404);
        $args = $r->json('args', []);
        if (! is_array($args) || ! array_is_list($args) || count($args) > 6) {
            return response()->json(['error' => 'bad']);
        }

        return $this->respond($r, fn () => (new AdminActions($r->user()))->{$cmd}(...$args));
    }
}
