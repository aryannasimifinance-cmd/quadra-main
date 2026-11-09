<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// فروشگاه، انبار، کافه و تأمین‌کننده‌ها
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('code', 10)->unique();
            $t->string('cat', 12);
            $t->string('brand', 60)->default('');
            $t->string('name', 200);
            $t->unsignedBigInteger('price');
            $t->unsignedBigInteger('was')->nullable();
            $t->unsignedBigInteger('cost')->default(0); // بهای میانگین موزون
            $t->boolean('active')->default(true);
            $t->string('tag', 20)->nullable();
            $t->json('meta')->nullable(); // عکس، رنگ‌ها، سایزها، توضیح، مشخصات…
            $t->timestamps();
        });
        Schema::create('product_variants', function (Blueprint $t) {
            $t->id();
            $t->string('product_id', 40);
            $t->string('sku', 40)->unique();
            $t->string('size', 20)->nullable();
            $t->string('color', 40)->nullable();
            $t->unsignedInteger('stock')->default(0);
            $t->unsignedSmallInteger('pos')->default(0);
            $t->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $t->index('product_id');
        });

        // اقلام سفارش به‌صورت تصویر ثابت همان لحظه (قیمت و بها) ذخیره می‌شوند
        Schema::create('shop_orders', function (Blueprint $t) {
            $t->string('id', 20)->primary();
            $t->string('by', 80)->nullable();
            $t->json('items');
            $t->unsignedBigInteger('total');
            $t->string('method', 12);
            $t->string('status', 12)->default('new');
            $t->string('source', 10)->nullable();
            $t->timestamp('at');
            $t->timestamps();
            $t->index('by');
            $t->index('at');
        });
        Schema::create('stock_receipts', function (Blueprint $t) {
            $t->string('id', 20)->primary();
            $t->date('date');
            $t->string('supplier', 120);
            $t->string('invoice', 60)->nullable();
            $t->string('pay', 12);
            $t->json('items');
            $t->unsignedBigInteger('total');
            $t->timestamp('at');
            $t->timestamps();
        });
        Schema::create('stock_moves', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->string('kind', 12);
            $t->string('pid', 40);
            $t->string('code', 10);
            $t->string('sku', 40);
            $t->integer('qty');
            $t->unsignedBigInteger('cost');
            $t->string('note', 255)->nullable();
            $t->timestamps();
        });
        Schema::create('suppliers', function (Blueprint $t) {
            $t->string('name', 120)->primary();
            $t->timestamps();
        });
        Schema::create('ap_payments', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->string('supplier', 120);
            $t->unsignedBigInteger('amount');
            $t->string('pay', 12);
            $t->timestamps();
        });

        Schema::create('cafe_items', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('code', 10)->unique();
            $t->string('name', 120);
            $t->string('cat', 12);
            $t->unsignedBigInteger('price');
            $t->unsignedBigInteger('big')->default(0); // افزایش قیمت سایز بزرگ
            $t->boolean('active')->default(true);
            $t->json('recipe'); // [[شناسه‌ی ماده, مقدار به واحد پایه], …]
            $t->json('meta')->nullable(); // شکلک، عکس، زمان آماده‌سازی، توضیح، برچسب
            $t->timestamps();
        });
        Schema::create('cafe_ingredients', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->string('code', 10)->unique();
            $t->string('name', 120);
            $t->string('cat', 12);
            $t->string('unit', 3);
            $t->decimal('cost', 16, 4)->default(0); // بهای هر واحد پایه
            $t->decimal('min', 14, 3)->default(0);
            $t->decimal('stock', 14, 3)->default(0);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        Schema::create('cafe_orders', function (Blueprint $t) {
            $t->string('id', 20)->primary();
            $t->string('by', 80)->nullable();
            $t->json('items');
            $t->json('use')->nullable(); // مصرف مواد اولیه برای سند حسابداری
            $t->unsignedBigInteger('total');
            $t->string('method', 12);
            $t->unsignedTinyInteger('to')->nullable();
            $t->string('status', 12)->default('new');
            $t->string('source', 10)->nullable();
            $t->timestamp('at');
            $t->timestamps();
            $t->index('by');
            $t->index('at');
            $t->index('status');
        });
        Schema::create('cafe_receipts', function (Blueprint $t) {
            $t->string('id', 20)->primary();
            $t->date('date');
            $t->string('supplier', 120);
            $t->string('invoice', 60)->nullable();
            $t->string('pay', 12);
            $t->json('items');
            $t->unsignedBigInteger('total');
            $t->timestamp('at');
            $t->timestamps();
        });
        Schema::create('cafe_moves', function (Blueprint $t) {
            $t->string('id', 40)->primary();
            $t->date('date');
            $t->string('ing', 40);
            $t->string('code', 10);
            $t->string('name', 120);
            $t->decimal('qty', 14, 3);
            $t->bigInteger('amount');
            $t->string('note', 255)->nullable();
            $t->timestamps();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'])) {
            DB::statement('ALTER TABLE cafe_ingredients ADD CONSTRAINT cafe_ing_stock_nonneg CHECK (stock >= 0)');
        }
    }

    public function down(): void
    {
        foreach (['cafe_moves', 'cafe_receipts', 'cafe_orders', 'cafe_ingredients', 'cafe_items', 'ap_payments', 'suppliers', 'stock_moves', 'stock_receipts', 'shop_orders', 'product_variants', 'products'] as $x) {
            Schema::dropIfExists($x);
        }
    }
};
