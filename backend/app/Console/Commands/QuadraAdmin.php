<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** ساخت مدیر تازه یا تغییر رمز مدیر: php artisan quadra:admin admin */
class QuadraAdmin extends Command
{
    protected $signature = 'quadra:admin {username} {--password=} {--name=مدیر باشگاه} {--disable}';

    protected $description = 'ساخت یا تغییر رمز اکانت مدیر';

    public function handle(): int
    {
        $u = strtolower($this->argument('username'));
        $row = DB::table('admins')->where('username', $u)->first();
        if ($this->option('disable')) {
            DB::table('admins')->where('username', $u)->update(['active' => false]);
            DB::table('personal_access_tokens')->where('tokenable_type', \App\Models\Admin::class)->where('tokenable_id', $row->id ?? '')->delete();
            $this->info("مدیر {$u} غیرفعال شد.");

            return self::SUCCESS;
        }
        $pass = $this->option('password') ?: Str::password(14, symbols: false);
        if (strlen($pass) < 8) {
            $this->error('رمز مدیر حداقل ۸ کاراکتر.');

            return self::FAILURE;
        }
        if ($row) {
            DB::table('admins')->where('id', $row->id)->update(['password' => Hash::make($pass), 'active' => true, 'updated_at' => now()]);
            DB::table('personal_access_tokens')->where('tokenable_type', \App\Models\Admin::class)->where('tokenable_id', $row->id)->delete();
        } else {
            DB::table('admins')->insert(['id' => 'a'.Str::lower(Str::random(10)), 'name' => $this->option('name'), 'username' => $u, 'password' => Hash::make($pass), 'role' => 'owner', 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->info("نام کاربری: {$u}  رمز: {$pass}");

        return self::SUCCESS;
    }
}
