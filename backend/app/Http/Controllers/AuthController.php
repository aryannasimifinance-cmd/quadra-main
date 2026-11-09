<?php

namespace App\Http\Controllers;

use App\Actions\PlayerActions;
use App\Domain\Catalog;
use App\Domain\Members;
use App\Domain\Rules;
use App\Domain\Settings;
use App\Domain\Wallet;
use App\Models\Admin;
use App\Models\Coach;
use App\Models\Member;
use App\Sms\Otp;
use App\Sms\SmsSender;
use App\Support\Audit;
use App\Support\Fail;
use App\Support\Ids;
use App\Support\Sync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/** ورود و عضویت: کد پیامکی، نام کاربری و رمز، مدیر و مربی */
class AuthController extends Controller
{
    private static function phone($v): string
    {
        $p = preg_replace('/\D/', '', strtr((string) $v, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']));
        if (! preg_match('/^09\d{9}$/', $p)) {
            Fail::with('phone');
        }

        return $p;
    }

    /** محدودیت تلاش (جلوگیری از حدس زدن رمز و کد) */
    private static function throttle(string $key, int $max, int $decay = 60): void
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            Fail::with('slow', ['sec' => RateLimiter::availableIn($key)]);
        }
        RateLimiter::hit($key, $decay);
    }

    private static function tokenFor($model, string $role): array
    {
        $model->forceFill(['last_login_at' => now()])->save();

        return ['ok' => true, 'token' => $model->createToken($role)->plainTextToken, 'role' => $role, 'id' => $model->id];
    }

    public function sendOtp(Request $r)
    {
        $phone = self::phone($r->input('phone'));
        self::throttle('otp-ip:'.$r->ip(), 8, 300);
        $code = Otp::send($phone, $r->ip());
        $out = ['ok' => true, 'exists' => DB::table('members')->where('phone', $phone)->exists()];
        // فقط در محیط تست (پیامک log و APP_DEBUG روشن) کد برای پر شدن خودکار برمی‌گردد
        if (SmsSender::driver() === 'log' && config('app.debug')) {
            $out['debug_code'] = $code;
        }

        return $out;
    }

    public function verifyOtp(Request $r)
    {
        $phone = self::phone($r->input('phone'));
        $code = preg_replace('/\D/', '', strtr((string) $r->input('code'), ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']));
        self::throttle('verify:'.$phone, 10, 600);
        if (strlen($code) !== 4 || ! Otp::check($phone, $code)) {
            return ['error' => 'code'];
        }
        $m = Member::where('phone', $phone)->first();
        if ($m) {
            Audit::$actor = 'member:'.$m->id;
            Audit::log('login.otp', $m->id);

            return self::tokenFor($m, 'player');
        }

        // شماره‌ی تازه: بلیت ۳۰ دقیقه‌ای برای تکمیل ثبت‌نام
        return ['ok' => true, 'signup' => Crypt::encryptString(json_encode(['phone' => $phone, 'exp' => time() + 1800]))];
    }

    public function register(Request $r)
    {
        try {
            $t = json_decode(Crypt::decryptString((string) $r->input('ticket')), true);
        } catch (\Throwable) {
            return ['error' => 'ticket'];
        }
        if (! is_array($t) || ($t['exp'] ?? 0) < time() || empty($t['phone'])) {
            return ['error' => 'ticket'];
        }
        $phone = $t['phone'];
        $name = trim((string) $r->input('name'));
        $level = $r->input('level');
        $side = $r->input('side');
        $gender = $r->input('gender');
        $birth = $r->input('birth');
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120 || ! Catalog::isLevel($level) || ($side && ! in_array($side, Catalog::SIDES, true))
            || ($gender && ! in_array($gender, ['f', 'm'], true)) || ($birth && ! Rules::validBirth($birth))) {
            Fail::with('bad');
        }
        $user = $r->input('username') ? strtolower(trim((string) $r->input('username'))) : null;
        $pass = (string) $r->input('pass', '');
        if ($user !== null) {
            if (! preg_match('/^[a-z0-9._]{3,20}$/', $user) || strlen($pass) < 6 || strlen($pass) > 72) {
                Fail::with('bad');
            }
            if (PlayerActions::usernameTaken($user)) {
                Fail::with('taken');
            }
        }

        $member = DB::transaction(function () use ($phone, $name, $level, $side, $gender, $birth, $user, $pass) {
            // اگر هم‌زمان با همین شماره حساب ساخته شده باشد، همان برمی‌گردد
            $exists = DB::table('members')->where('phone', $phone)->lockForUpdate()->first();
            if ($exists) {
                return Member::find($exists->id);
            }
            $id = Ids::make('m');
            DB::table('members')->insert([
                'id' => $id, 'name' => $name, 'phone' => $phone, 'level' => $level, 'side' => $side ?: 'both', 'gender' => $gender ?: null,
                'birth' => $birth ? (int) $birth : null, 'source' => 'app', 'username' => $user, 'password' => $user ? Hash::make($pass) : null,
                'joined_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $gift = Settings::welcome();
            if ((int) $gift['wallet'] > 0) {
                Wallet::credit($id, (int) $gift['wallet'], 'gift', 'welcome', 'هدیه‌ی ثبت‌نام');
            }
            if ((int) $gift['xp'] > 0) {
                DB::table('members')->where('id', $id)->increment('xp', (int) $gift['xp']);
                DB::table('xp_events')->insert(['member_id' => $id, 'amount' => (int) $gift['xp'], 'reason' => 'welcome', 'created_at' => now()]);
            }
            $first = explode(' ', $name)[0];
            $bits = array_filter([(int) $gift['xp'] > 0 ? \App\Support\Jalali::fa((string) $gift['xp']).' امتیاز' : null, (int) $gift['wallet'] > 0 ? \App\Support\Jalali::fa(number_format((int) $gift['wallet'])).' تومان اعتبار' : null]);
            Members::notify($id, '👋', "{$first}، به کوادرا خوش اومدید", ($bits ? implode(' و ', $bits).' هدیه گرفتید. ' : '').'اولین بازیتون رو بسازید تا نشان «سرویس اول» باز بشه.');
            Sync::touch('members');

            return Member::find($id);
        });
        Audit::$actor = 'member:'.$member->id;
        Audit::log('signup', $member->id);

        return self::tokenFor($member, 'player');
    }

    public function password(Request $r)
    {
        $u = strtolower(trim((string) $r->input('username')));
        $p = (string) $r->input('password');
        self::throttle('pass:'.$r->ip(), 10, 300);
        self::throttle('pass-u:'.$u, 8, 900);
        $m = $u !== '' ? Member::whereRaw('LOWER(username) = ?', [$u])->first() : null;
        if (! $m || ! $m->password || ! Hash::check($p, $m->password)) {
            return ['error' => 'bad'];
        }
        RateLimiter::clear('pass-u:'.$u);

        return self::tokenFor($m, 'player');
    }

    public function staff(Request $r)
    {
        $role = $r->input('role') === 'coach' ? 'coach' : 'admin';
        $u = strtolower(trim((string) $r->input('username')));
        $p = (string) $r->input('password');
        self::throttle('staff:'.$r->ip(), 10, 300);
        self::throttle('staff-u:'.$role.':'.$u, 8, 900);
        if ($role === 'admin') {
            $a = $u !== '' ? Admin::whereRaw('LOWER(username) = ?', [$u])->first() : null;
            if (! $a || ! $a->active || ! Hash::check($p, $a->password)) {
                return ['error' => 'bad'];
            }
            RateLimiter::clear('staff-u:'.$role.':'.$u);
            Audit::$actor = 'admin:'.$a->id;
            Audit::log('login.admin', $a->id);

            return self::tokenFor($a, 'admin') + ['name' => $a->name];
        }
        $c = $u !== '' ? Coach::whereRaw('LOWER(username) = ?', [$u])->first() : null;
        if (! $c || ! $c->password || ! Hash::check($p, $c->password)) {
            return ['error' => 'bad'];
        }
        if (! $c->login_on) {
            return ['error' => 'off'];
        }
        RateLimiter::clear('staff-u:'.$role.':'.$u);

        return self::tokenFor($c, 'coach') + ['name' => $c->name];
    }

    public function usernameFree(Request $r)
    {
        $u = strtolower(trim((string) $r->query('u')));
        $me = $r->user('sanctum');

        return ['taken' => $u === '' || PlayerActions::usernameTaken($u, $me instanceof Member ? $me->id : null)];
    }

    public function logout(Request $r)
    {
        $r->user()?->currentAccessToken()?->delete();

        return ['ok' => true];
    }
}
