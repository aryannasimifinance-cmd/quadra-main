<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Audit
{
    public static ?string $actor = null;

    public static function log(string $action, ?string $subject = null, array $data = []): void
    {
        DB::table('audit_logs')->insert([
            'actor' => self::$actor,
            'action' => $action,
            'subject' => $subject,
            'data' => $data ? json_encode($data, JSON_UNESCAPED_UNICODE) : null,
            'ip' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
