<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// کاربران، دسترسی، کیف پول، اعلان‌ها و گیمیفیکیشن
return new class extends Migration
{
    public function up(): void
    {
        // همه‌ی بازیکن‌ها و اعضای باشگاه (ثبت‌نام از اپ یا پذیرش)
        Schema::create('members', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('name', 120);
            $t->string('phone', 11)->nullable()->unique();
            $t->string('level', 3)->default('C');
            $t->string('side', 5)->default('both');
            $t->char('gender', 1)->nullable();
            $t->unsignedSmallInteger('birth')->nullable(); // سال تولد شمسی
            $t->unsignedInteger('xp')->default(0);
            $t->bigInteger('wallet')->default(0);
            $t->string('vip', 10)->nullable(); // عضویت دستی مدیر: gold / black
            $t->text('note')->nullable();
            $t->boolean('inactive')->default(false);
            $t->string('source', 10)->nullable(); // app / desk / null (داده‌ی وارداتی)
            $t->string('username', 20)->nullable()->unique();
            $t->string('password')->nullable();
            // آمار وارداتی از نسخه‌ی قبل (بازی‌ها و امتیاز اضافه)؛ برای اعضای تازه صفر
            $t->unsignedInteger('games_base')->default(0);
            $t->unsignedInteger('wins')->default(0);
            $t->integer('points_extra')->default(0);
            $t->unsignedInteger('state_v')->default(1); // نسخه‌ی داده‌ی شخصی برای همگام‌سازی
            $t->timestamp('joined_at')->nullable();
            $t->timestamp('last_login_at')->nullable();
            $t->timestamps();
            $t->index('inactive');
        });

        Schema::create('admins', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('name', 120);
            $t->string('username', 40)->unique();
            $t->string('password');
            $t->string('role', 20)->default('owner');
            $t->boolean('active')->default(true);
            $t->timestamp('last_login_at')->nullable();
            $t->timestamps();
        });

        Schema::create('coaches', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('name', 120);
            $t->string('title', 120)->default('');
            $t->string('level', 3)->default('B');
            $t->unsignedTinyInteger('exp')->default(0);
            $t->decimal('rating', 2, 1)->nullable();
            $t->unsignedBigInteger('price')->default(0); // نرخ هر جلسه
            $t->mediumText('img')->nullable();
            $t->text('bio')->nullable();
            $t->json('record')->nullable();
            $t->json('packs')->nullable();
            $t->json('prices')->nullable();
            $t->boolean('active')->default(true);
            $t->string('member', 40)->nullable(); // عضو باشگاهِ متناظر
            // فقط مدیر
            $t->string('phone', 11)->nullable();
            $t->string('since', 12)->nullable();
            $t->unsignedTinyInteger('share')->default(50);
            $t->text('note')->nullable();
            $t->boolean('login_on')->default(false);
            $t->string('username', 40)->nullable()->unique();
            $t->string('password')->nullable();
            $t->unsignedTinyInteger('cap_day')->default(5);
            $t->unsignedTinyInteger('cap_week')->default(15);
            $t->json('meta')->nullable();
            $t->timestamp('last_login_at')->nullable();
            $t->timestamps();
        });

        Schema::create('otp_codes', function (Blueprint $t) {
            $t->id();
            $t->string('phone', 11)->index();
            $t->string('code_hash');
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->timestamp('expires_at');
            $t->timestamp('used_at')->nullable();
            $t->string('ip', 45)->nullable();
            $t->timestamp('created_at')->nullable();
        });

        Schema::create('notifications', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('member_id', 40);
            $t->string('icon', 16)->default('🔔');
            $t->string('title', 200);
            $t->text('body')->nullable();
            $t->boolean('read')->default(false);
            $t->timestamp('created_at')->nullable();
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $t->index(['member_id', 'created_at']);
        });

        // دفتر کیف پول: هر تغییر موجودی یک ردیف با مانده‌ی بعد از آن
        Schema::create('wallet_transactions', function (Blueprint $t) {
            $t->id();
            $t->string('member_id', 40);
            $t->bigInteger('amount');
            $t->bigInteger('balance');
            $t->string('kind', 20); // topup / pay / refund / gift / adjust
            $t->string('ref', 80)->nullable();
            $t->string('note', 255)->nullable();
            $t->string('actor', 60)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $t->index(['member_id', 'id']);
        });

        Schema::create('memberships', function (Blueprint $t) {
            $t->id();
            $t->string('member_id', 40);
            $t->string('package', 20);
            $t->timestamp('starts_at');
            $t->timestamp('ends_at');
            $t->string('sale', 40)->nullable();
            $t->timestamps();
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $t->index(['member_id', 'ends_at']);
        });

        Schema::create('member_badges', function (Blueprint $t) {
            $t->string('member_id', 40);
            $t->string('badge', 20);
            $t->timestamp('created_at')->nullable();
            $t->primary(['member_id', 'badge']);
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });

        Schema::create('xp_events', function (Blueprint $t) {
            $t->id();
            $t->string('member_id', 40);
            $t->integer('amount');
            $t->string('reason', 60);
            $t->timestamp('created_at')->nullable();
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $t->index('member_id');
        });

        Schema::create('quest_claims', function (Blueprint $t) {
            $t->string('member_id', 40);
            $t->string('week', 10); // شنبه‌ی همان هفته، YYYY-MM-DD
            $t->string('quest', 20);
            $t->timestamp('created_at')->nullable();
            $t->primary(['member_id', 'week', 'quest']);
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });

        // نظرها بدون نام نویسنده؛ review_marks فقط نشان می‌دهد چه کسی به چه چیزی نظر داده (برای جلوگیری از تکرار)
        Schema::create('reviews', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('target', 60)->index();
            $t->unsignedTinyInteger('stars');
            $t->text('text')->nullable();
            $t->boolean('ok')->default(true);
            $t->boolean('hidden')->default(false);
            $t->timestamp('created_at')->nullable();
        });
        Schema::create('review_marks', function (Blueprint $t) {
            $t->string('member_id', 40);
            $t->string('target', 60);
            $t->primary(['member_id', 'target']);
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });

        // پرداخت‌های درگاه بانکی
        Schema::create('payments', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('member_id', 40);
            $t->unsignedBigInteger('amount'); // تومان
            $t->string('purpose', 20);
            $t->json('payload');
            $t->string('status', 12)->default('pending'); // pending / paid / failed / done
            $t->string('driver', 20);
            $t->string('authority', 120)->nullable()->index();
            $t->string('ref_id', 120)->nullable();
            $t->string('card', 40)->nullable();
            $t->json('result')->nullable();
            $t->timestamp('verified_at')->nullable();
            $t->timestamps();
            $t->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->string('actor', 60)->nullable();
            $t->string('action', 60);
            $t->string('subject', 80)->nullable();
            $t->json('data')->nullable();
            $t->string('ip', 45)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->index('created_at');
        });

        // قفل‌های نام‌دار برای ترتیبی کردن عملیات حساس (رزرو، انبار، کافه، مسابقه)
        Schema::create('mutexes', function (Blueprint $t) {
            $t->string('name', 60)->primary();
        });
        Schema::create('sync_versions', function (Blueprint $t) {
            $t->string('name', 30)->primary();
            $t->unsignedBigInteger('version')->default(1);
        });
        Schema::create('sequences', function (Blueprint $t) {
            $t->string('name', 20)->primary();
            $t->unsignedBigInteger('value')->default(0);
        });
        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 40)->primary();
            $t->json('value')->nullable();
            $t->timestamps();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'])) {
            DB::statement('ALTER TABLE members ADD CONSTRAINT members_wallet_nonneg CHECK (wallet >= 0)');
        }
    }

    public function down(): void
    {
        foreach (['settings', 'sequences', 'sync_versions', 'mutexes', 'audit_logs', 'payments', 'review_marks', 'reviews', 'quest_claims', 'xp_events', 'member_badges', 'memberships', 'wallet_transactions', 'notifications', 'otp_codes', 'coaches', 'admins', 'members'] as $x) {
            Schema::dropIfExists($x);
        }
    }
};
