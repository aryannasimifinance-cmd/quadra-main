<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// حسابداری و منابع انسانی
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->string('acc', 6);
            $t->unsignedBigInteger('amount');
            $t->string('title', 255)->nullable();
            $t->string('vendor', 120)->nullable();
            $t->string('pay', 12);
            $t->string('invoice', 60)->nullable();
            $t->timestamp('at');
            $t->timestamps();
        });
        Schema::create('journals', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->string('title', 255);
            $t->json('lines');
            $t->timestamp('at');
            $t->timestamps();
        });
        Schema::create('payins', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->unsignedBigInteger('amount');
            $t->string('method', 12);
            $t->string('acc', 6)->nullable();
            $t->string('title', 255)->nullable();
            $t->string('note', 255)->nullable();
            $t->string('by', 80)->nullable();
            $t->string('name', 120)->nullable();
            $t->timestamp('at');
            $t->timestamps();
        });

        Schema::create('staff', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('name', 120);
            $t->string('role', 20);
            $t->string('type', 12);
            $t->unsignedBigInteger('base')->default(0);
            $t->unsignedBigInteger('rate')->default(0);
            $t->unsignedTinyInteger('children')->default(0);
            $t->date('start')->nullable();
            $t->date('contract_end')->nullable();
            $t->string('status', 10)->default('active');
            $t->string('coach', 40)->nullable();
            $t->decimal('share', 4, 2)->nullable();
            $t->json('shifts'); // ۷ روز از شنبه
            $t->json('meta')->nullable(); // تلفن، کد ملی، بیمه، شبا، تحصیلات، مدارک…
            $t->timestamps();
        });
        Schema::create('attendance', function (Blueprint $t) {
            $t->date('date');
            $t->string('staff_id', 40);
            $t->decimal('in', 6, 3);
            $t->decimal('out', 6, 3)->nullable();
            $t->timestamps();
            $t->primary(['date', 'staff_id']);
            $t->foreign('staff_id')->references('id')->on('staff')->cascadeOnDelete();
        });
        Schema::create('leaves', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('staff', 40);
            $t->string('kind', 10);
            $t->date('from');
            $t->date('to');
            $t->unsignedSmallInteger('days');
            $t->string('status', 10)->default('pending');
            $t->string('note', 255)->nullable();
            $t->timestamp('at');
            $t->timestamps();
        });
        Schema::create('advances', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('staff', 40);
            $t->string('name', 120);
            $t->date('date');
            $t->unsignedBigInteger('amount');
            $t->string('pay', 12);
            $t->string('note', 255)->nullable();
            $t->timestamps();
        });
        Schema::create('payrolls', function (Blueprint $t) {
            $t->string('id', 20)->primary();
            $t->string('month', 7)->unique();
            $t->string('label', 40);
            $t->date('date');
            $t->json('rows');
            $t->date('paid_at')->nullable();
            $t->date('ins_paid_at')->nullable();
            $t->timestamp('at');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['payrolls', 'advances', 'leaves', 'attendance', 'staff', 'payins', 'journals', 'expenses'] as $x) {
            Schema::dropIfExists($x);
        }
    }
};
