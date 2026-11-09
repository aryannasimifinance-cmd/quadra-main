<?php

namespace App\Http\Controllers;

use App\Payments\FakeGateway;
use App\Payments\PaymentService;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** برگشت از درگاه بانک و صفحه‌ی درگاه آزمایشی */
class PaymentController extends Controller
{
    public function callback(Request $r, string $id)
    {
        $p = PaymentService::complete($id, $r->query());
        $base = rtrim((string) config('quadra.frontend_url'), '/');

        return redirect()->away($base.'/?pay='.urlencode($p->id));
    }

    public function status(Request $r, string $id)
    {
        // مربی پرداخت‌هایی را می‌بیند که با حساب عضوِ متناظرش انجام داده
        $u = $r->user();
        $owner = $u instanceof \App\Models\Coach ? $u->member : $u->id;
        $p = $owner ? DB::table('payments')->where('id', $id)->where('member_id', $owner)->first() : null;
        abort_unless($p, 404);

        return [
            'id' => $p->id, 'status' => $p->status, 'purpose' => $p->purpose, 'amount' => (int) $p->amount, 'ref' => $p->ref_id,
            'result' => json_decode($p->result ?? 'null', true), 'at' => Dates::ms($p->created_at),
        ];
    }

    /** درگاه آزمایشی (فقط وقتی PAYMENT_DRIVER=fake و سرور در حالت تست/نمایشی است) */
    public function fake(string $id)
    {
        $gw = new FakeGateway;
        $p = DB::table('payments')->where('id', $id)->first();
        abort_unless($p && $p->driver === 'fake' && $gw->enabled() && $p->status === 'pending', 404);
        $amount = number_format((int) $p->amount);
        $ok = e(url('/api/pay/callback/'.$id).'?Authority='.urlencode($p->authority).'&Status=OK');
        $no = e(url('/api/pay/callback/'.$id).'?Authority='.urlencode($p->authority).'&Status=NOK');

        return response(<<<HTML
<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>درگاه پرداخت آزمایشی</title>
<style>body{font-family:Tahoma,sans-serif;background:#f4f2ec;display:grid;place-items:center;min-height:100vh;margin:0}
.c{background:#fff;border-radius:18px;padding:28px;max-width:360px;width:calc(100% - 32px);box-shadow:0 10px 40px rgba(0,0,0,.08);text-align:center}
b{font-size:26px;display:block;margin:12px 0}a{display:block;padding:14px;border-radius:12px;margin-top:10px;text-decoration:none;font-weight:bold}
.ok{background:#0e9f98;color:#fff}.no{background:#eee;color:#333}small{color:#888}</style></head>
<body><div class="c"><small>درگاه آزمایشی — پول واقعی جابه‌جا نمی‌شود</small><b>{$amount} تومان</b>
<a class="ok" href="{$ok}">پرداخت موفق</a><a class="no" href="{$no}">انصراف</a></div></body></html>
HTML);
    }
}
