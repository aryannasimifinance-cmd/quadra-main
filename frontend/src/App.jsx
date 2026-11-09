import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from './store'
import { Toasts } from './components/ui'
import { Loading, Sting } from './components/Logo'
import { celebrate, chime } from './fx'
import { errText } from './api'
import Gate from './screens/Gate'
import Main from './screens/player/Main'

const Admin = lazy(() => import('./screens/admin/Admin'))
const Coach = lazy(() => import('./screens/coach/Coach'))

// برگشت از درگاه بانک: ?pay=شناسه — نتیجه از سرور خوانده و پیام مناسب نشان داده می‌شود
const PAY_DONE = { book: 'رزرو ثبت شد', joinGame: 'به بازی پیوستید', bookSeries: 'پکیج رزرو شد', registerEvent: 'ثبت‌نام شد', buyPackage: 'عضویت فعال شد', checkout: 'سفارش فروشگاه ثبت شد', cafeCheckout: 'سفارش کافه ثبت شد', topup: 'کیف پول شارژ شد' }
function usePaymentReturn() {
  const { session, paymentStatus, toast, clearCart } = useStore()
  useEffect(() => {
    if (session?.role !== 'player') return
    const id = new URLSearchParams(window.location.search).get('pay')
    if (!id) return
    window.history.replaceState(null, '', window.location.pathname)
    paymentStatus(id).then((p) => {
      if (p.error) return
      if (p.status === 'failed' || p.status === 'pending') { toast({ icon: '↩️', title: 'پرداخت انجام نشد', body: 'مبلغی از حساب شما کم نشده یا ظرف چند ساعت برمی‌گردد.', duration: 6000 }); return }
      if (p.status !== 'done') { toast({ icon: '⏳', title: 'پرداخت در حال پردازش است', body: 'مبلغ پرداختی در کیف پول شما ثبت شده؛ چند دقیقه بعد «بازی‌های من» یا سفارش‌ها را ببینید.', duration: 8000 }); return }
      const r = p.result || {}
      if (r.error) {
        chime('alarm')
        toast({ icon: '💳', title: 'پرداخت موفق بود، ولی کار انجام نشد', body: `${r.error === 'busy' ? 'ساعت انتخابی همین الان پر شد' : r.error === 'stock' ? 'موجودی همین الان تمام شد' : r.error === 'full' ? 'بازی پر شد' : r.error === 'closed' ? 'ثبت‌نام بسته شد' : errText(r)}؛ مبلغ در کیف پول شماست و می‌توانید دوباره استفاده کنید.`, duration: 9000 })
        return
      }
      if (p.purpose === 'checkout') clearCart('cart')
      if (p.purpose === 'cafeCheckout') clearCart('cafeCart')
      celebrate(); chime('success')
      toast({ icon: '✅', title: PAY_DONE[p.purpose] || 'پرداخت انجام شد', body: [p.ref && `کد پیگیری ${p.ref}`, r.xp && `+${Number(r.xp).toLocaleString('fa-IR')} XP`].filter(Boolean).join('، '), duration: 6000 })
    })
  }, [session?.role]) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function App() {
  const { session, booted, offline } = useStore()
  const [sting, setSting] = useState(() => { try { return !sessionStorage.getItem('quadra-sting') } catch { return true } })
  useEffect(() => { if (!sting) return; try { sessionStorage.setItem('quadra-sting', '1') } catch { /* */ } const t = setTimeout(() => setSting(false), 3400); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  usePaymentReturn()
  const admin = session?.role === 'admin'
  const coach = session?.role === 'coach'
  const ready = booted && !sting

  return (
    <>
      {admin && ready ? (
        <Suspense fallback={<Loading text="بارگذاری پنل مدیریت…" />}><Admin /></Suspense>
      ) : (
        <div className="stage">
          <div className="stage-bg" style={{ backgroundImage: 'url(./img/welcome-night.jpg)' }} />
          <div className="app">
            {!sting && !booted && <Loading show text={offline ? 'اتصال به سرور برقرار نشد؛ دوباره تلاش می‌کنیم…' : 'در حال بارگذاری…'} />}
            {ready && (coach
              ? <Suspense fallback={<Loading text="بارگذاری پنل مربی…" />}><Coach key="c" /></Suspense>
              : session?.role === 'player' ? <Main key="m" /> : <Gate key="g" />)}
            <div id="portal" />
          </div>
        </div>
      )}
      <AnimatePresence>{sting && <Sting key="s" onSkip={() => setSting(false)} />}</AnimatePresence>
      <Toasts />
      {admin && <div id="portal" />}
    </>
  )
}
