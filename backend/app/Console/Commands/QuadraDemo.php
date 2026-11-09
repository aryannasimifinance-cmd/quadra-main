<?php

namespace App\Console\Commands;

use App\Domain\Settings;
use App\Support\ClubImporter;
use App\Support\Sync;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * داده‌ی نمایشی (همان داده‌ی نسخه‌ی قبلی اپ) — همه‌ی داده‌های فعلی پاک می‌شود!
 * مدیر: admin / quadra ، بازیکن: 09120000000 یا aryan / 123456 ، مربی: faraz / 123456
 */
class QuadraDemo extends Command
{
    protected $signature = 'quadra:demo {--force : روی سرور اصلی هم اجرا شود}';

    protected $description = 'پاک کردن همه‌ی داده‌ها و ورود داده‌ی نمایشی';

    public function handle(): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('روی سرور اصلی همه‌ی داده‌ها پاک می‌شود؛ اگر مطمئنید با --force اجرا کنید.');

            return self::FAILURE;
        }
        $file = database_path('seed/demo.json');
        if (! is_file($file)) {
            $this->error('database/seed/demo.json پیدا نشد (در frontend اجرا کنید: npm run seed:export)');

            return self::FAILURE;
        }
        Artisan::call('migrate:fresh', ['--force' => true]);
        Settings::forget();
        $d = json_decode(file_get_contents($file), true);
        DB::transaction(function () use ($d) {
            QuadraInstall::base();
            DB::table('admins')->insert(['id' => 'a-demo', 'name' => 'مدیر نمایشی', 'username' => 'admin', 'password' => Hash::make('quadra'), 'role' => 'owner', 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
            $me = [
                'user' => ['name' => 'آریان نسیمی‌فر', 'phone' => '09120000000', 'level' => 'C+', 'side' => 'right', 'gender' => 'm', 'birth' => 1374, 'joined' => now()->subDays(90)->getTimestampMs()],
                'xp' => 340, 'wallet' => 800000, 'badges' => ['first', 'host', 'social'],
            ];
            (new ClubImporter('m-me'))->club($d['club'], $d['members'], $me);
            DB::table('members')->where('id', 'm-me')->update(['username' => 'aryan', 'password' => Hash::make('123456')]);
            // رمز مربی‌های نمایشی: ۶ رقمی
            DB::table('coaches')->whereNotNull('username')->update(['password' => Hash::make('123456')]);
            Settings::put('welcome', ['wallet' => 500000, 'xp' => 20]);
        });
        Sync::touch(...Sync::NAMES);
        $this->info('داده‌ی نمایشی وارد شد. مدیر: admin / quadra — بازیکن: aryan / 123456 — مربی: faraz / 123456');

        return self::SUCCESS;
    }
}
