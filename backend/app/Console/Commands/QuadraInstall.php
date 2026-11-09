<?php

namespace App\Console\Commands;

use App\Domain\Catalog;
use App\Support\ClubImporter;
use App\Support\Sync;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * نصب اولیه: زمین‌ها، قفل‌ها، اکانت مدیر و کاتالوگ اولیه (کالا، منوی کافه، مربی‌ها با موجودی صفر).
 * اجرای دوباره امن است؛ چیزی که هست تکرار نمی‌شود.
 */
class QuadraInstall extends Command
{
    protected $signature = 'quadra:install {--admin= : نام کاربری مدیر} {--password= : رمز مدیر} {--no-catalog : کاتالوگ اولیه وارد نشود}';

    protected $description = 'نصب پایه‌ی کوادرا (زمین‌ها، مدیر، کاتالوگ اولیه)';

    public function handle(): int
    {
        self::base();
        if (! DB::table('admins')->exists()) {
            $user = strtolower($this->option('admin') ?: env('ADMIN_USERNAME', 'admin'));
            $pass = $this->option('password') ?: env('ADMIN_PASSWORD') ?: Str::password(14, symbols: false);
            DB::table('admins')->insert(['id' => 'a'.Str::lower(Str::random(10)), 'name' => 'مدیر باشگاه', 'username' => $user, 'password' => Hash::make($pass), 'role' => 'owner', 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
            $this->info("اکانت مدیر ساخته شد — نام کاربری: {$user}  رمز: {$pass}");
            $this->warn('این رمز را جای امنی یادداشت کنید؛ دوباره نشان داده نمی‌شود. (تغییر: php artisan quadra:admin)');
        }
        if (! $this->option('no-catalog') && ! DB::table('products')->exists() && ! DB::table('cafe_items')->exists()) {
            $file = database_path('seed/catalog.json');
            if (is_file($file)) {
                DB::transaction(fn () => (new ClubImporter)->catalog(json_decode(file_get_contents($file), true)));
                $this->info('کاتالوگ اولیه (فروشگاه، منوی کافه، مربی‌ها) وارد شد؛ موجودی‌ها صفر است و با «ورود کالا» پر می‌شود.');
            }
        }
        Sync::touch(...Sync::NAMES);
        $this->info('نصب کامل شد.');

        return self::SUCCESS;
    }

    public static function base(): void
    {
        foreach (Catalog::COURT_IDS as $id) {
            DB::table('courts')->insertOrIgnore(['id' => $id, 'off' => false, 'created_at' => now(), 'updated_at' => now()]);
        }
        foreach (['booking', 'event', 'shop', 'cafe'] as $m) {
            DB::table('mutexes')->insertOrIgnore(['name' => $m]);
        }
        foreach (Sync::NAMES as $n) {
            DB::table('sync_versions')->insertOrIgnore(['name' => $n, 'version' => 1]);
        }
    }
}
