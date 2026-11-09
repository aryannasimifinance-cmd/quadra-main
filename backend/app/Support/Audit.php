<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Audit
{
    public static ?string $actor = null;

    public static function log(string $action, ?string $subject = null, array $data = []): void
    {
        $json = $data ? json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR) : null;
        DB::table('audit_logs')->insert([
            'actor' => self::$actor !== null ? mb_substr(self::$actor, 0, 60) : null,
            'action' => mb_substr($action, 0, 60),
            'subject' => $subject !== null ? mb_substr($subject, 0, 80) : null,
            'data' => $json !== null && strlen($json) > 20000 ? json_encode(['truncated' => true]) : $json,
            'ip' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
