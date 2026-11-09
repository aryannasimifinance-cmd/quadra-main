<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// زمین‌ها، رزروها، درخواست مربی، فروش‌ها و مسابقه‌ها
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courts', function (Blueprint $t) {
            $t->unsignedTinyInteger('id')->primary();
            $t->boolean('off')->default(false);
            $t->json('edits')->nullable(); // تغییر نام/عکس مدیر؛ null یعنی پیش‌فرض
            $t->timestamps();
        });

        Schema::create('bookings', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->unsignedTinyInteger('court');
            $t->date('date');
            $t->decimal('start', 4, 2);
            $t->decimal('dur', 4, 2);
            $t->string('type', 10); // private / open / coach / event / block
            $t->string('status', 10)->default('ok'); // ok / cancelled
            $t->string('source', 10)->nullable(); // app / desk / coach
            $t->string('by', 80)->nullable(); // شناسه‌ی عضو یا f:نام مهمان
            $t->string('coach', 40)->nullable();
            $t->unsignedBigInteger('price')->default(0); // مبلغ قابل دریافت (بعد از تخفیف)
            $t->unsignedBigInteger('full')->nullable(); // قیمت کامل زمین قبل از تخفیف (بازی باز)
            $t->unsignedBigInteger('paid')->default(0);
            $t->string('method', 12)->nullable();
            $t->json('levels')->nullable();
            $t->string('want_side', 5)->nullable();
            $t->string('visibility', 8)->nullable();
            $t->string('series', 40)->nullable()->index();
            $t->string('block', 40)->nullable()->index(); // درخواست مربیِ تأییدشده
            $t->string('note', 255)->nullable();
            $t->boolean('refunded')->default(false);
            $t->timestamp('cancelled_at')->nullable();
            $t->timestamps();
            $t->foreign('court')->references('id')->on('courts');
            $t->index(['date', 'court']);
            $t->index(['coach', 'date']);
            $t->index('by');
            $t->index(['status', 'date']);
        });

        Schema::create('booking_players', function (Blueprint $t) {
            $t->id();
            $t->string('booking_id', 40);
            $t->unsignedTinyInteger('pos')->default(0);
            $t->string('player', 80); // شناسه‌ی عضو یا f:نام مهمان
            $t->string('member_id', 40)->nullable(); // فقط برای اعضا (برای جستجو)
            $t->unsignedBigInteger('share')->nullable(); // سهمی که خود این بازیکن از اپ پرداخت کرده
            $t->string('share_method', 12)->nullable();
            $t->timestamps();
            $t->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $t->unique(['booking_id', 'player']);
            $t->index('member_id');
        });

        Schema::create('booking_invites', function (Blueprint $t) {
            $t->string('booking_id', 40);
            $t->string('member_id', 40);
            $t->primary(['booking_id', 'member_id']);
            $t->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $t->index('member_id');
        });

        // تسویه‌های بعدی در پذیرش (پرداخت اول همان paid منهای جمع این‌هاست)
        Schema::create('booking_payments', function (Blueprint $t) {
            $t->id();
            $t->string('booking_id', 40);
            $t->unsignedBigInteger('amount');
            $t->string('method', 12);
            $t->timestamp('at');
            $t->string('actor', 60)->nullable();
            $t->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $t->index('booking_id');
        });

        Schema::create('coach_requests', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('coach', 40);
            $t->date('date');
            $t->unsignedTinyInteger('court');
            $t->decimal('start', 4, 2);
            $t->decimal('dur', 4, 2);
            $t->string('student', 80)->nullable();
            $t->string('note', 255)->nullable();
            $t->string('status', 10)->default('pending');
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
            $t->foreign('coach')->references('id')->on('coaches')->cascadeOnDelete();
            $t->index(['status', 'date']);
        });

        // فروش پکیج زمین، پکیج مربی، عضویت و ورودی مسابقه
        Schema::create('sales', function (Blueprint $t) {
            $t->string('id', 60)->primary();
            $t->string('kind', 12); // package / coach / event
            $t->string('item', 60)->nullable();
            $t->string('pack', 20)->nullable();
            $t->string('series', 40)->nullable();
            $t->string('name', 255);
            $t->string('by', 80)->nullable();
            $t->unsignedBigInteger('price');
            $t->string('method', 12)->nullable();
            $t->timestamp('at');
            $t->timestamp('refunded_at')->nullable();
            $t->timestamps();
            $t->index(['kind', 'item']);
            $t->index('by');
        });

        Schema::create('events', function (Blueprint $t) {
            $t->string('id', 60)->primary();
            $t->string('kind', 12)->default('friday');
            $t->string('title', 200);
            $t->text('desc')->nullable();
            $t->string('format', 12)->default('groups');
            $t->string('scoring', 10)->nullable();
            $t->string('gender', 3)->default('all');
            $t->unsignedTinyInteger('age_min')->nullable();
            $t->unsignedTinyInteger('age_max')->nullable();
            $t->date('date');
            $t->decimal('start', 4, 2);
            $t->decimal('dur', 4, 2);
            $t->json('courts');
            $t->json('levels')->nullable();
            $t->unsignedSmallInteger('cap')->default(16);
            $t->unsignedBigInteger('fee')->default(0);
            $t->string('prize', 255)->nullable();
            $t->mediumText('img')->nullable();
            $t->string('status', 10)->default('draft');
            $t->text('note')->nullable();
            $t->json('teams')->nullable();
            $t->json('groups')->nullable();
            $t->json('matches')->nullable();
            $t->json('setup')->nullable();
            $t->json('extra')->nullable(); // فیلدهای نمایشی دیگر (showResults، champPub و…)
            $t->timestamps();
            $t->index(['status', 'date']);
        });

        Schema::create('event_registrations', function (Blueprint $t) {
            $t->id();
            $t->string('event_id', 60);
            $t->string('rid', 40); // شناسه‌ی ثبت‌نام داخل همان مسابقه (در تیم‌ها استفاده می‌شود)
            $t->string('by', 80)->nullable();
            $t->string('name', 120);
            $t->string('level', 3)->nullable();
            $t->string('phone', 11)->nullable();
            $t->char('gender', 1)->nullable();
            $t->unsignedSmallInteger('birth')->nullable();
            $t->string('method', 12)->nullable();
            $t->unsignedBigInteger('paid')->default(0);
            $t->string('source', 10)->nullable();
            $t->string('sale', 60)->nullable();
            $t->string('pair', 60)->nullable();
            $t->string('payer', 80)->nullable();
            $t->boolean('waiting')->default(false);
            $t->timestamp('at');
            $t->timestamps();
            $t->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
            $t->unique(['event_id', 'rid']);
            $t->index('by');
        });
    }

    public function down(): void
    {
        foreach (['event_registrations', 'events', 'sales', 'coach_requests', 'booking_payments', 'booking_invites', 'booking_players', 'bookings', 'courts'] as $x) {
            Schema::dropIfExists($x);
        }
    }
};
