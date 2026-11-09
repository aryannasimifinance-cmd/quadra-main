<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** جلسه‌ی مربی: چه کسی هزینه‌ی این ساعت را می‌دهد (خود مربی یا شاگرد) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $t) {
            $t->string('pay_by', 40)->nullable()->after('block')->index();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $t) {
            $t->dropIndex(['pay_by']);
            $t->dropColumn('pay_by');
        });
    }
};
