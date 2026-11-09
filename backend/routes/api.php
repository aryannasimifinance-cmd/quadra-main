<?php

use App\Http\Controllers\ActionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\StateController;
use Illuminate\Support\Facades\Route;

Route::get('config', [StateController::class, 'config']);

// ورود و عضویت
Route::prefix('auth')->group(function () {
    Route::post('otp', [AuthController::class, 'sendOtp']);
    Route::post('verify', [AuthController::class, 'verifyOtp']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('password', [AuthController::class, 'password']);
    Route::post('staff', [AuthController::class, 'staff']);
    Route::get('username', [AuthController::class, 'usernameFree']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
});

// برگشت از درگاه بانک (بدون ورود؛ پرداخت با شناسه‌ی خودش پیدا و تأیید می‌شود)
Route::get('pay/callback/{id}', [PaymentController::class, 'callback']);
Route::get('pay/fake/{id}', [PaymentController::class, 'fake']);

Route::middleware(['auth:sanctum', 'role:any'])->group(function () {
    Route::get('state', [StateController::class, 'state']);
    Route::get('sync', [StateController::class, 'sync']);
});

Route::middleware(['auth:sanctum', 'role:player'])->group(function () {
    Route::post('player/{action}', [ActionController::class, 'player']);
    Route::get('pay/{id}', [PaymentController::class, 'status']);
});

Route::middleware(['auth:sanctum', 'role:coach'])->post('coach/{action}', [ActionController::class, 'coach']);

Route::middleware(['auth:sanctum', 'role:admin'])->post('admin/{cmd}', [ActionController::class, 'admin']);
