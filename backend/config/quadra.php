<?php

// تنظیمات اختصاصی کوادرا — همه از .env خوانده می‌شوند تا بدون تغییر کد عوض شوند
return [
    // حالت نمایشی: راهنمای رمزهای نمونه و دکمه‌ی «بازنشانی داده‌ها» در پنل مدیر
    'demo' => (bool) env('QUADRA_DEMO', false),

    // آدرس اپ (برای برگشت از درگاه بانک)؛ معمولاً همان APP_URL
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost')),

    'otp' => [
        'ttl' => 120,          // اعتبار کد (ثانیه)
        'resend' => 55,        // فاصله‌ی ارسال دوباره (ثانیه)
        'max_attempts' => 5,   // تلاش مجاز برای هر کد
        'per_hour' => 6,       // حداکثر پیامک به هر شماره در ساعت
    ],

    // پیامک: log (فقط در لاگ سرور می‌نویسد) | kavenegar | smsir
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'kavenegar' => [
            'key' => env('KAVENEGAR_API_KEY'),
            'template' => env('KAVENEGAR_TEMPLATE', 'quadra-otp'),
        ],
        'smsir' => [
            'key' => env('SMSIR_API_KEY'),
            'template_id' => env('SMSIR_TEMPLATE_ID'),
            'param' => env('SMSIR_PARAM', 'CODE'),
        ],
    ],

    // درگاه پرداخت: fake (صفحه‌ی آزمایشی؛ در production خاموش است) | zarinpal
    'payment' => [
        'driver' => env('PAYMENT_DRIVER', 'fake'),
        'zarinpal' => [
            'merchant' => env('ZARINPAL_MERCHANT_ID'),
            'sandbox' => (bool) env('ZARINPAL_SANDBOX', false),
        ],
        'topup_min' => 100000,
        'topup_max' => 50000000,
    ],
];
