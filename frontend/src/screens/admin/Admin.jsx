import { AnimatePresence, motion } from 'framer-motion'
import { Component, useEffect, useMemo, useState } from 'react'
import {
  COACHES, COURTS, DURATIONS, MEMBERS, METHOD_NAME, TYPE_NAME, addDays, coachById, courtById, dayLabel, dayMonth, fa, fromKey,
  hourLabel, mil, priceFor, EV_IMG, plainMoney, hoursOf, range, short, stockOf, toman, todayKey, weekdayShort, dayNum,
} from '../../data'
import { chime } from '../../fx'
import { isFree, payState, useStore } from '../../store'
import { dailyPL, ledger, segments } from '../../accounting'
import { dk, inPeriod, jMonthKey, jMonthLabel, period } from '../../jalali'
import { channelOf } from './Payins'
import { contractAlert } from '../../hr'
import { Icon, LevelPill } from '../../components/ui'
import { Logo } from '../../components/Logo'
import { occupancy, payments, who } from './derive'
import { Coaches, Members, Payments, Settings } from './Lists'
import { CoachPanel } from './CoachAccess'
import { Bookings } from './BookingsBoard'
import { ShopAdmin } from './ShopAdmin'
import { CafeAdmin } from './CafeAdmin'
import { Events } from './Events'
import { Accounting } from './Accounting'
import { Hr } from './Hr'
import { LiveCourts, TYPE_CLS, Timeline } from './Live'
import { Card, Eye, EyeMid, Guide, Kpi, MASK, Money, Status, TipLayer } from './kit'
import { upcoming } from '../../events'
import { TodayIn } from './Payins'
import { refCode } from '../player/Games'
import '../../admin.css'
import '../../admin-ops.css'

const NAV = [
  { group: 'عملیات', items: [
    { id: 'overview', name: 'داشبورد', icon: 'grid', tip: 'خلاصه‌ی امروز، زمین‌های زنده و کارهای مانده' },
    { id: 'calendar', name: 'تقویم زمین‌ها', icon: 'court', tip: 'برنامه‌ی ساعتی ۴ زمین؛ رزرو دستی با کلیک روی جای خالی' },
    { id: 'bookings', name: 'رزروها', icon: 'cal', tip: 'فهرست همه‌ی رزروها با جستجو و فیلتر' },
    { id: 'events', name: 'آدینه و ایونت ویبورا', icon: 'trophy', tip: 'تعریف آدینه و ایونت ویبورا، ثبت‌نام، تیم‌بندی، نتایج و برنده‌ها' },
  ] },
  { group: 'فروش و مالی', items: [
    { id: 'shop', name: 'فروشگاه و انبار', icon: 'bag', tip: 'کالاها، سفارش‌های اپ، فروش حضوری و موجودی' },
    { id: 'cafe', name: 'کافه', icon: 'cup', tip: 'منو، سفارش‌های کافه، مواد اولیه و خرید' },
    { id: 'payments', name: 'دریافت‌ها', icon: 'card', tip: 'همه‌ی پول‌های دریافتی و رزروهای تسویه‌نشده' },
    { id: 'accounting', name: 'حسابداری', icon: 'chart', tip: 'سود هر بخش، هزینه‌ها، طلب و بدهی، گزارش اکسل' },
  ] },
  { group: 'افراد', items: [
    { id: 'members', name: 'اعضا', icon: 'users', tip: 'بازیکن‌ها، سطح و سابقه‌ی بازی' },
    { id: 'coaches', name: 'مربی‌ها و پکیج‌ها', icon: 'coach', tip: 'کلاس‌ها، امتیاز و درآمد هر مربی' },
    { id: 'coachpanel', name: 'پنل مربی‌ها', icon: 'lock', tip: 'نام کاربری و رمز مربی‌ها، تأیید دسترسی و درخواست‌های رزرو زمین' },
    { id: 'hr', name: 'منابع انسانی', icon: 'shield', tip: 'پرسنل، شیفت، حضور و غیاب، مرخصی و حقوق' },
  ] },
  { group: 'باشگاه', items: [{ id: 'settings', name: 'تنظیمات', icon: 'cog', tip: 'قیمت ساعت‌ها و فعال یا غیرفعال کردن زمین' }] },
]
const ITEMS = NAV.flatMap((g) => g.items)
const GUIDES = {
  overview: 'خلاصه‌ی امروز: زمین‌های زنده، کارهای مانده و درآمد. روی هر کار بزنید تا به همان بخش بروید.',
  calendar: 'برنامه‌ی ساعتی ۴ زمین. روی جای خالی بزنید تا رزرو دستی ثبت شود؛ خانه‌های «🏆» زمین‌هایی است که برای آدینه یا مسابقه رزرو شده.',
  bookings: 'همه‌ی رزروها با جستجو و فیلتر؛ روی هر رزرو بزنید تا پرداخت، جابه‌جایی یا لغو را انجام دهید.',
  payments: 'پول‌هایی که رسیده و رزروهایی که هنوز تسویه نشده‌اند؛ مانده‌ها را از همین‌جا دریافت کنید.',
  coachpanel: 'هر مربی با نام کاربری و رمزی که این‌جا می‌دهید وارد پنل خودش می‌شود. درخواست‌های رزرو زمینِ مربی‌ها هم این‌جا تأیید یا رد می‌شود.',
  hr: 'پرسنل، شیفت، حضور و غیاب، مرخصی و حقوق. مربی‌ها هم اگر کارمند باشند این‌جا تعریف می‌شوند.',
  settings: 'قیمت ساعت‌های عادی و پیک، و باز یا بسته کردن هر زمین.',
}
const BOOKING_SECS = ['overview', 'calendar', 'bookings']

// اگر بخشی به خطا بخورد، فقط همان بخش پیام می‌دهد و بقیه‌ی پنل سر جایش می‌ماند (نه صفحه‌ی سیاه)
class Guard extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('admin section crashed', err, info?.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="adm-crash"><Icon name="bolt" size={22} /><b>این صفحه به مشکل خورد</b><small>{String(this.state.err?.message || this.state.err)}</small>
        <button className="adm-btn primary" onClick={() => { this.setState({ err: null }); this.props.onReset?.() }}>برگشت</button></div>
    )
  }
}

export default function Admin() {
  const { logout, club } = useStore()
  plainMoney(true)
  useEffect(() => () => plainMoney(false), [])
  const [sec, setSec] = useState('overview')
  const [menu, setMenu] = useState(false)
  const [drawer, setDrawer] = useState(null) // {kind:'booking', id} | {kind:'new', court, date, start}
  // هر بار زدن یک بخش، آن بخش از صفحه‌ی اولش باز می‌شود (مثلاً از جزئیات یک آدینه به فهرست)
  const [visit, setVisit] = useState(0)
  const ctx = { go: (s) => { setSec(s); setVisit((v) => v + 1); window.scrollTo(0, 0) }, open: setDrawer }
  const S = { overview: Overview, calendar: Calendar, bookings: Bookings, payments: Payments, shop: ShopAdmin, cafe: CafeAdmin, accounting: Accounting, coaches: Coaches, coachpanel: CoachPanel, events: Events, members: Members, hr: Hr, settings: Settings }[sec]
  const badges = { shop: club.orders.filter((o) => o.status === 'new').length, cafe: club.cafeOrders.filter((o) => o.status !== 'delivered').length, hr: club.leaves.filter((l) => l.status === 'pending').length, coachpanel: (club.coachReqs || []).filter((r) => r.status === 'pending').length }
  return (
    <div className="adm" dir="rtl">
      <aside className={`adm-side ${menu ? 'open' : ''}`}>
        <div className="adm-brand"><Logo tone="light" size={18} /><small>پنل مدیریت باشگاه</small></div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="adm-group">
              <small>{g.group}</small>
              {g.items.map((n) => (
                <button key={n.id} className={sec === n.id ? 'on' : ''} onClick={() => { ctx.go(n.id); setMenu(false) }} data-tip={n.tip}>
                  {sec === n.id && <motion.span layoutId="adm-nav" className="adm-nav-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <Icon name={n.icon} size={18} /><span>{n.name}</span>{badges[n.id] > 0 && <em>{fa(badges[n.id])}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="adm-me">
          <div className="adm-av">م</div>
          <div className="grow"><b>مدیر باشگاه</b><small>admin</small></div>
          <button onClick={logout} title="خروج" aria-label="خروج"><Icon name="logout" size={18} /></button>
        </div>
      </aside>
      {menu && <div className="adm-scrim" onClick={() => setMenu(false)} />}
      <main className="adm-main">
        <header className="adm-top">
          <button className="adm-burger" onClick={() => setMenu(true)} aria-label="منو"><Icon name="menu" /></button>
          <div className="grow"><h1>{ITEMS.find((n) => n.id === sec).name}</h1><small>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date()).replace(/,/g, '،')}</small></div>
          {BOOKING_SECS.includes(sec) && <button className="adm-btn primary" onClick={() => setDrawer({ kind: 'new', date: todayKey() })} data-tip="ثبت رزرو تلفنی یا حضوری در پذیرش"><Icon name="plus" size={18} />رزرو دستی</button>}
        </header>
        <AnimatePresence mode="wait">
          <motion.div key={sec} className="adm-body" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {GUIDES[sec] && <Guide>{GUIDES[sec]}</Guide>}
            <Guard key={visit} onReset={() => setVisit((v) => v + 1)}><S ctx={ctx} /></Guard>
          </motion.div>
        </AnimatePresence>
      </main>
      <Guard key={drawer ? JSON.stringify(drawer) : 'none'} onReset={() => setDrawer(null)}><Drawer d={drawer} onClose={() => setDrawer(null)} /></Guard>
      <TipLayer />
    </div>
  )
}

// داشبورد: فقط مهم‌ترین‌ها — عددهای امروز، زمین‌های زنده، کارهای مانده و نتیجه‌ی ماه
function Overview({ ctx }) {
  const [plShow, setPlShow] = useState(false)
  const { club, user } = useStore()
  const V = useMemo(() => ledger(club), [club])
  const today = todayKey()
  // محاسبه‌های سنگین فقط وقتی داده‌ی باشگاه عوض شود
  const { segDay, segMonth, avg7 } = useMemo(() => {
    const week = dailyPL(V, { from: addDays(today, -7), to: addDays(today, -1) })
    return { segDay: segments(V, period('day', today)), segMonth: segments(V, period('month', today)), avg7: [...week.values()].reduce((s, d) => s + d.rev, 0) / 7 }
  }, [V, today])
  const todays = club.bookings.filter((b) => b.date === today && b.status === 'ok' && b.type !== 'block')
  const occ = occupancy(club, today)
  // درآمد این ماه به تفکیک: رزرو زمین از اپ، کافه، فروشگاه
  const mon = period('month', today), monName = jMonthLabel(jMonthKey(today))
  const paysM = useMemo(() => payments(club, user).filter((p) => p.paid > 0 && p.at <= Date.now() && inPeriod(dk(p.at), mon)), [club]) // eslint-disable-line react-hooks/exhaustive-deps
  const sumOf = (f) => { const l = paysM.filter(f); return [l.reduce((s, p) => s + p.paid, 0), l.length] }
  const [appCourt, appCourtN] = sumOf((p) => p.kind === 'court' && channelOf(p.method) === 'app')
  const [cafeRev, cafeN] = sumOf((p) => p.kind === 'cafe')
  const [shopRev, shopN] = sumOf((p) => p.kind === 'shop')
  const shopOpen = club.orders.filter((o) => o.status !== 'delivered')
  const cafeOpen = club.cafeOrders.filter((o) => o.status !== 'delivered')
  const unpaid = todays.filter((b) => b.paid < b.price)
  const lowShop = club.products.filter((p) => p.active !== false && stockOf(p) <= 3)
  const lowCafe = club.cafeIngs.filter((g) => g.active !== false && g.stock <= g.min)
  const openNeed = club.bookings.filter((b) => b.type === 'open' && b.status === 'ok' && b.players.length < 4 && (b.date === today || b.date === addDays(today, 1)))
  const leaves = club.leaves.filter((l) => l.status === 'pending')
  const contracts = club.staff.filter((s) => s.status !== 'ended' && contractAlert(s))
  const off = Object.entries(club.off).filter(([, v]) => v)

  const todo = [
    cafeOpen.length && { ic: 'cup', tone: 'w', title: `${fa(cafeOpen.length)} سفارش کافه در صف`, sub: `${fa(cafeOpen.filter((o) => o.to).length)} سفارش سر زمین`, go: 'cafe', tip: 'سفارش‌ها را به مرحله‌ی بعد ببرید تا مشتری اعلان بگیرد' },
    shopOpen.length && { ic: 'bag', tone: 'w', title: `${fa(shopOpen.length)} سفارش فروشگاه تحویل نشده`, sub: `${fa(shopOpen.filter((o) => o.status === 'new').length)} جدید، ${fa(shopOpen.filter((o) => o.status === 'ready').length)} آماده‌ی تحویل`, go: 'shop', tip: 'سفارش‌های اپ که باید در پذیرش آماده و تحویل شوند' },
    unpaid.length && { ic: 'cash', tone: 'w', title: `${fa(unpaid.length)} رزرو امروز تسویه نشده`, sub: toman(unpaid.reduce((s, b) => s + b.price - b.paid, 0)), go: 'payments', tip: 'مانده را قبل یا بعد از بازی در پذیرش بگیرید' },
    openNeed.length && { ic: 'radar', tone: 'q', title: `${fa(openNeed.length)} بازی باز هنوز کامل نشده`, sub: 'امروز و فردا', go: 'bookings', tip: 'می‌توانید به اعضای هم‌سطح اطلاع بدهید' },
    (lowShop.length || lowCafe.length) && { ic: 'box', tone: 'b', title: 'موجودی رو به اتمام', sub: [lowShop.length && `${fa(lowShop.length)} کالای فروشگاه`, lowCafe.length && `${fa(lowCafe.length)} ماده‌ی کافه`].filter(Boolean).join('، '), go: lowCafe.length > lowShop.length ? 'cafe' : 'shop', tip: 'وقت سفارش خرید است' },
    leaves.length && { ic: 'sun', tone: 'b', title: `${fa(leaves.length)} درخواست مرخصی`, sub: leaves.map((l) => club.staff.find((s) => s.id === l.staff)?.name).join('، '), go: 'hr', tip: 'تأیید یا رد در منابع انسانی ← مرخصی' },
    contracts.length && { ic: 'shield', tone: 'b', title: `${fa(contracts.length)} قرارداد نزدیک پایان`, sub: contracts.map((s) => s.name).join('، '), go: 'hr', tip: 'تمدید یا تسویه‌ی قرارداد' },
    ...upcoming(club).filter((e) => fromKey(e.date) <= fromKey(addDays(today, 7))).map((e) => ({
      ic: 'trophy', tone: 'q', title: `🏆 ${e.title}، ${dayLabel(e.date)}`, go: 'events', tip: 'این ساعت‌ها در تقویم برای مسابقه بسته است',
      sub: `${e.courts.length === 4 ? 'همه‌ی زمین‌ها' : e.courts.map((c) => courtById(c).name).join('، ')} از ${fa(e.start)} تا ${fa(e.start + e.dur)} رزرو مسابقه، ${fa(e.regs.length)} از ${fa(e.cap)} نفر`,
    })),
    ...off.map(([id]) => ({ ic: 'wrench', tone: 'b', title: `${courtById(+id).name} غیرفعال است`, sub: 'از تنظیمات فعال کنید', go: 'settings' })),
  ].filter(Boolean)

  return (
    <div className="ov">
      <div className="kpis four">
        <Kpi secret="value" icon="cash" label="درآمد امروز" value={mil(segDay.R)} delta={avg7 ? ((segDay.R - avg7) / avg7) * 100 : null} sub="زمین، کلاس، فروشگاه، کافه و…" tip="مقایسه با میانگین ۷ روز گذشته؛ کلیک برای حسابداری" onClick={() => ctx.go('accounting')} />
        <Kpi icon="court" label="پر بودن زمین‌ها امروز" value={`${fa(Math.round(occ * 100))}٪`} sub={`${fa(todays.length)} رزرو`} tip="درصد ساعت‌های رزروشده‌ی ۴ زمین از ۷ صبح تا ۱۲ شب" onClick={() => ctx.go('calendar')} />
        <Kpi icon="bag" label="سفارش‌های باز" tone={shopOpen.length + cafeOpen.length ? 'warn' : ''} value={fa(shopOpen.length + cafeOpen.length)} sub={`کافه ${fa(cafeOpen.length)}، فروشگاه ${fa(shopOpen.length)}`} tip="سفارش‌هایی که هنوز به مشتری تحویل نشده‌اند" onClick={() => ctx.go(cafeOpen.length ? 'cafe' : 'shop')} />
        <Kpi secret icon="chart" label="سود این ماه" tone={segMonth.net < 0 ? 'warn' : 'good'} value={mil(segMonth.net)} tip="درآمد ماه شمسی جاری منهای همه‌ی هزینه‌ها" onClick={() => ctx.go('accounting')} />
      </div>
      <div className="kpis three">
        <Kpi secret="value" icon="phone" label="درآمد رزرو زمین از اپ" value={mil(appCourt)} sub={`${fa(appCourtN)} رزرو آنلاین، ${monName}`} tip="پول رزروهای زمین که این ماه از درگاه و کیف پول اپ رسیده" onClick={() => ctx.go('payments')} />
        <Kpi secret="value" icon="cup" label="درآمد کافه" value={mil(cafeRev)} sub={`${fa(cafeN)} سفارش، ${monName}`} tip="فروش کافه در ماه جاری" onClick={() => ctx.go('cafe')} />
        <Kpi secret="value" icon="bag" label="درآمد فروشگاه" value={mil(shopRev)} sub={`${fa(shopN)} سفارش، ${monName}`} tip="فروش فروشگاه در ماه جاری" onClick={() => ctx.go('shop')} />
      </div>

      <TodayIn compact />

      <LiveCourts ctx={ctx} />

      <div className="two">
        <Card title="کارهای مانده" sub={todo.length ? `${fa(todo.length)} مورد` : null} tip="هرچه نیاز به اقدام شما دارد؛ روی هر مورد بزنید">
          {todo.length ? (
            <div className="alerts">
              {todo.map((t, i) => (
                <button key={i} className="alert" onClick={() => t.go && ctx.go(t.go)} data-tip={t.tip}>
                  <span className={`al-ic ${t.tone}`}><Icon name={t.ic} size={16} /></span>
                  <div className="grow"><b>{t.title}</b><small>{t.sub}</small></div>
                  <Icon name="back" size={14} />
                </button>
              ))}
            </div>
          ) : <div className="all-good"><Icon name="check" size={20} /><b>همه‌چیز مرتب است</b><small>کاری منتظر شما نیست.</small></div>}
        </Card>
        <Card title="این ماه، بخش به بخش" sub={plShow ? `درآمد ${short(segMonth.R)}، هزینه ${short(segMonth.D + segMonth.O)}` : 'مبلغ‌ها پنهان است'} tip="سود هر بخش باشگاه پس از کم کردن هزینه‌ی مستقیم همان بخش"
          right={<div className="row-btns">{plShow && <Eye on={plShow} set={setPlShow} />}<button className="adm-btn ghost sm" onClick={() => ctx.go('accounting')} data-tip="جزئیات در حسابداری">جزئیات</button></div>}>
          {!plShow ? <EyeMid set={setPlShow} /> : <div className="mini-pl">
            {segMonth.units.filter((u) => u.revenue).map((u) => (
              <div key={u.id} data-tip={u.tip}>
                <span><Icon name={u.icon} size={15} />{u.name}</span>
                <i><em style={{ width: `${(u.revenue / Math.max(1, ...segMonth.units.map((x) => x.revenue))) * 100}%` }} /></i>
                <b>{plShow ? short(u.revenue) : MASK}<small>سود {plShow ? short(u.profit) : MASK}</small></b>
              </div>
            ))}
            <div className="mp-over" data-tip="حقوق پرسنل، اجاره، قبض‌ها، تعمیرات، تبلیغات و…"><span>هزینه‌های عمومی</span><b className="neg">{plShow ? `−${short(segMonth.O)}` : MASK}</b></div>
            <div className={`mp-net ${segMonth.net < 0 ? 'neg' : ''}`}><span>{segMonth.net < 0 ? 'زیان خالص' : 'سود خالص'}</span><b>{plShow ? toman(segMonth.net) : MASK}</b></div>
          </div>}
        </Card>
      </div>
    </div>
  )
}

function Calendar({ ctx }) {
  const { club } = useStore()
  const [date, setDate] = useState(todayKey())
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayKey(), i - 3))
  const list = club.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && b.type !== 'block')
  const dayRev = list.reduce((s, b) => s + b.price, 0), dayPaid = list.reduce((s, b) => s + b.paid, 0)
  return (
    <div className="cal">
      <div className="cal-days">
        <button className="adm-btn ghost sm" onClick={() => setDate(addDays(date, -1))} aria-label="روز قبل"><Icon name="back" size={16} /></button>
        <div className="cal-strip">
          {days.map((k) => (
            <button key={k} className={`cal-d ${k === date ? 'on' : ''} ${k === todayKey() ? 'today' : ''}`} onClick={() => setDate(k)}>
              <small>{weekdayShort(fromKey(k))}</small><b>{dayNum(fromKey(k))}</b>
              <i style={{ '--o': occupancy(club, k) }} />
            </button>
          ))}
        </div>
        <button className="adm-btn ghost sm" onClick={() => setDate(addDays(date, 1))} aria-label="روز بعد"><Icon name="fwd" size={16} /></button>
      </div>
      <div className="cal-sum">
        <div><small>تاریخ</small><b>{dayLabel(date)}، {dayMonth(fromKey(date))}</b></div>
        <div><small>رزروها</small><b>{fa(list.length)}</b></div>
        <div><small>اشغال</small><b>{fa(Math.round(occupancy(club, date) * 100))}٪</b></div>
        <div><small>مبلغ رزروها</small><b>{toman(dayRev)}</b></div>
        <div><small>دریافت‌شده</small><b>{toman(dayPaid)}</b></div>
      </div>
      <Card title="زمان‌بندی ۴ زمین" sub="روی فضای خالی بزنید تا رزرو دستی ثبت شود">
        <Timeline date={date} onPick={ctx.open} />
      </Card>
    </div>
  )
}

// ---------- کشوی جزئیات و رزرو دستی ----------
function Drawer({ d, onClose }) {
  return (
    <AnimatePresence>
      {d && (
        <>
          <motion.div className="dr-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 36 }}>
            <button className="dr-x" onClick={onClose} aria-label="بستن"><Icon name="close" /></button>
            {d.kind === 'booking' ? <BookingDetail id={d.id} onClose={onClose} /> : <NewBooking d={d} onClose={onClose} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function BookingDetail({ id, onClose }) {
  const { club, user, adminSettle, adminCancel, adminMove, toast } = useStore()
  const b = club.bookings.find((x) => x.id === id)
  const [method, setMethod] = useState('card')
  if (!b) return null
  const st = payState(b), c = courtById(b.court)
  const settle = () => { adminSettle(b.id, method); chime('success'); toast({ icon: '✅', title: 'پرداخت ثبت شد', body: toman(b.price - b.paid) }) }
  const cancel = (refund) => { adminCancel(b.id, refund); toast({ icon: '↩️', title: 'رزرو لغو شد', body: refund ? 'مبلغ مسترد شد' : 'بدون استرداد' }); onClose() }
  const moveTo = (court) => {
    if (!isFree({ ...club, bookings: club.bookings.filter((x) => x.id !== b.id) }, b.date, court, b.start, b.dur)) { toast({ icon: '⛔', title: 'این زمین در آن ساعت پر است' }); return }
    adminMove(b.id, { court }); toast({ icon: '🔁', title: `منتقل شد به ${courtById(court).name}` })
  }
  return (
    <div className="dr">
      <div className="dr-photo" style={{ backgroundImage: `url(${c.img})` }}><div><span className={`type-pill ${TYPE_CLS[b.type]}`}>{TYPE_NAME[b.type]}</span><h2>{dayLabel(b.date)}، {range(b.start, b.dur)}</h2><small>{c.name}، {dayMonth(fromKey(b.date))}</small></div></div>
      {b.type !== 'block' && (<>
        <div className="dr-rows">
          <div><span>رزروکننده</span><b>{who(b.by, user)}</b></div>
          {b.coach && <div><span>مربی</span><b>{coachById(b.coach).name}</b></div>}
          <div><span>منبع</span><b>{b.source === 'app' ? 'اپ' : 'پذیرش'}</b></div>
          <div><span>کد</span><b dir="ltr">{refCode(b.id)}</b></div>
          {b.levels && <div><span>سطح‌ها</span><b>{b.levels.join('، ')}</b></div>}
          {b.type === 'open' && <div><span>نمایش</span><b>{b.visibility === 'private' ? `خصوصی، ${fa((b.invited || []).length)} دعوت` : 'عمومی'}</b></div>}
        </div>
        <h4>بازیکن‌ها {b.type === 'open' && `(${fa(b.players.length)}/۴)`}</h4>
        <div className="dr-ppl">
          {b.players.map((p) => { const m = MEMBERS.find((x) => x.id === p); return <div key={p}><span className="adm-av sm">{who(p, user)[0]}</span><b>{who(p, user)}</b>{m && <LevelPill id={m.level} />}</div> })}
          {b.type === 'open' && Array.from({ length: 4 - b.players.length }, (_, i) => <div key={i} className="empty"><span className="adm-av sm">+</span><b>جای خالی</b></div>)}
        </div>
        <h4>پرداخت</h4>
        <div className="dr-pay">
          <div><span>مبلغ</span><b>{toman(b.price)}</b></div>
          <div><span>دریافت‌شده</span><b>{toman(b.paid)}</b></div>
          <div><span>مانده</span><b>{toman(Math.max(0, b.price - b.paid))}</b></div>
          <div><span>وضعیت</span><Status s={st} /></div>
          {b.method && <div><span>روش</span><b>{METHOD_NAME[b.method]}</b></div>}
        </div>
        {b.status === 'ok' && st !== 'paid' && (
          <div className="dr-settle">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>{['card', 'cash', 'online'].map((m) => <option key={m} value={m}>{METHOD_NAME[m]}</option>)}</select>
            <button className="adm-btn primary" onClick={settle}><Icon name="check" size={16} />تسویه {toman(b.price - b.paid)}</button>
          </div>
        )}
        {b.status === 'ok' && (<>
          <h4>انتقال به زمین دیگر</h4>
          <div className="dr-move">{COURTS.map((x) => <button key={x.id} disabled={x.id === b.court} className="adm-btn ghost sm" onClick={() => moveTo(x.id)}>{x.name}</button>)}</div>
        </>)}
      </>)}
      {b.type === 'block' && <p className="muted">{b.note}</p>}
      {b.status === 'ok' ? (
        <div className="dr-cta">
          {b.paid > 0 && <button className="adm-btn danger" onClick={() => cancel(true)}>لغو و استرداد</button>}
          <button className="adm-btn ghost" onClick={() => cancel(false)}>{b.type === 'block' ? 'حذف تعمیرات' : 'لغو بدون استرداد'}</button>
        </div>
      ) : <p className="cancelled">این رزرو لغو شده است{b.refunded ? '، مبلغ مسترد شد' : ''}.</p>}
    </div>
  )
}

// ایونت: برنامه‌ی خصوصی روی یک یا چند زمین با مبلغ توافقی؛ آدینه: زمین‌ها به آدینه‌ی همان روز اضافه یا آدینه‌ی تازه ساخته می‌شود
const BOOK_TYPES = { private: 'رزرو زمین', open: 'بازی باز', coach: 'کلاس', event: 'ایونت', friday: 'آدینه', block: 'تعمیرات' }
const evDefaults = { kind: 'friday', desc: 'تیم‌های دونفره، گروهی + حذفی', format: 'groups', levels: ['B', 'C+', 'C'], cap: 16, fee: 750000, prize: 'راکت + توپ', img: EV_IMG[0], status: 'open', note: '' }

function NewBooking({ d, onClose }) {
  const { club, adminAddBooking, adminEventSave, toast } = useStore()
  const [f, setF] = useState({ court: d.court || 1, courts: [d.court || 1], date: d.date, start: d.start ?? 17, dur: 1, type: 'private', member: MEMBERS.find((m) => !m.inactive)?.id || null, coach: COACHES.find((c) => c.active !== false)?.id || null, pay: 'none', method: 'card', note: '', q: '', title: '', total: null, evId: null })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const multi = f.type === 'event' || f.type === 'friday'
  // آدینه‌های همان روز که هنوز برگزار نشده‌اند؛ اولی پیش‌فرض است
  const sameDay = club.events.filter((e) => e.date === f.date && ['draft', 'open', 'closed'].includes(e.status))
  const target = f.type === 'friday' && f.evId !== 'new' ? sameDay.find((e) => e.id === f.evId) || sameDay[0] : null
  const S = target ? target.start : f.start, D = target ? target.dur : f.dur
  const courts = multi ? f.courts : [f.court]
  const fresh = target ? courts.filter((c) => !target.courts.includes(c)) : courts
  const base = f.type === 'coach' ? (coachById(f.coach)?.price || 0) * D : f.type === 'block' || f.type === 'friday' ? 0 : priceFor(f.date, S, D, club.pricing) * courts.length
  const price = f.type === 'event' && f.total != null ? f.total : base
  const coachClash = f.type === 'coach' && club.bookings.some((b) => b.coach === f.coach && b.date === f.date && b.status !== 'cancelled' && f.start < b.start + b.dur && b.start < f.start + f.dur)
  const taken = fresh.filter((c) => !isFree(club, f.date, c, S, D))
  const { open, close } = hoursOf(club)
  const free = fresh.length > 0 && !taken.length && S >= open && S + D <= close && !coachClash
  const matches = MEMBERS.filter((m) => !m.inactive && (!f.q || m.name.includes(f.q) || m.phone.includes(f.q))).slice(0, 6)
  const times = []; for (let h = open; h < close; h += 1) times.push(h)
  const pickType = (type) => set({ type, total: null, ...(type === 'friday' ? { courts: [1, 2, 3, 4], ...(sameDay.length ? {} : { start: 9, dur: 3 }) } : type === 'event' ? { courts: [f.court] } : {}) })
  const togCourt = (c) => set({ courts: f.courts.includes(c) ? f.courts.filter((x) => x !== c) : [...f.courts, c].sort() })
  const where = courts.length === 4 ? 'همه‌ی زمین‌ها' : courts.map((c) => courtById(c).name).join('، ')
  const save = () => {
    if (f.type !== 'block' && f.type !== 'friday' && !f.member) { toast({ icon: '⛔', title: 'عضو را انتخاب کنید', body: 'اگر عضوی نیست، اول در «اعضا» ثبتش کنید' }); return }
    if (f.type === 'coach' && !f.coach) { toast({ icon: '⛔', title: 'مربی‌ای تعریف نشده است' }); return }
    if (f.type === 'friday') {
      const ev = target ? adminEventSave({ id: target.id, courts: [...new Set([...target.courts, ...courts])].sort() })
        : adminEventSave({ ...evDefaults, title: f.title.trim() || 'آدینه‌ی کوادرا', date: f.date, start: S, dur: D, courts })
      chime('success'); toast({ icon: '🏆', title: target ? `زمین به «${ev.title}» اضافه شد` : `«${ev.title}» ساخته شد`, body: target ? where : 'ثبت‌نام و جزئیاتش را در «آدینه‌ها و مسابقات» کامل کنید' }); onClose(); return
    }
    // ایونت چندزمینه: هر زمین یک رزرو، مبلغ کل بین زمین‌ها پخش می‌شود
    const each = Math.floor(price / courts.length)
    courts.forEach((c, i) => {
      const pr = i === 0 ? price - each * (courts.length - 1) : each
      const paid = f.pay === 'full' ? pr : 0
      adminAddBooking({ court: c, date: f.date, start: S, dur: D, type: f.type, by: f.type === 'block' ? null : f.member, players: f.type === 'block' ? [] : [f.member],
        levels: f.type === 'open' ? [MEMBERS.find((m) => m.id === f.member)?.level || 'C'] : null, coach: f.type === 'coach' ? f.coach : null, price: pr, paid, method: paid ? f.method : null, note: f.type === 'event' ? f.title.trim() || 'ایونت' : f.note })
    })
    chime('success'); toast({ icon: '📅', title: f.type === 'event' ? `ایونت «${f.title.trim() || 'ایونت'}» ثبت شد` : 'رزرو ثبت شد', body: `${where}، ${range(S, D)}` }); onClose()
  }
  return (
    <div className="dr">
      <h2 className="dr-h">رزرو دستی</h2>
      <div className="form">
        <label>نوع<div className="seg-adm wrap">{Object.entries(BOOK_TYPES).map(([k, v]) => <button key={k} className={f.type === k ? 'on' : ''} onClick={() => pickType(k)}>{v}</button>)}</div></label>
        {f.type === 'friday' && sameDay.length > 0 && <label>آدینه<div className="seg-adm wrap">{sameDay.map((e) => <button key={e.id} className={target?.id === e.id ? 'on' : ''} onClick={() => set({ evId: e.id })}>{e.title}</button>)}<button className={!target ? 'on' : ''} onClick={() => set({ evId: 'new' })}>+ آدینه‌ی تازه</button></div></label>}
        {(f.type === 'event' || (f.type === 'friday' && !target)) && <label>{f.type === 'event' ? 'عنوان ایونت' : 'اسم آدینه'}<input placeholder={f.type === 'event' ? 'مثلاً تولد، تیم‌سازی شرکت' : 'آدینه‌ی کوادرا'} value={f.title} onChange={(e) => set({ title: e.target.value })} /></label>}
        {multi ? <label>زمین‌ها<div className="seg-adm">{COURTS.map((c) => <button key={c.id} className={f.courts.includes(c.id) ? 'on' : ''} onClick={() => togCourt(c.id)}>{c.name}{target?.courts.includes(c.id) ? ' ✓' : ''}</button>)}</div></label>
          : <label>زمین<div className="seg-adm">{COURTS.map((c) => <button key={c.id} className={f.court === c.id ? 'on' : ''} onClick={() => set({ court: c.id })}>{c.name}</button>)}</div></label>}
        <div className="form-2">
          <label>تاریخ<select value={f.date} onChange={(e) => set({ date: e.target.value, evId: null })}>{Array.from({ length: 28 }, (_, i) => addDays(todayKey(), i - 3)).map((k) => <option key={k} value={k}>{dayLabel(k)} {dayMonth(fromKey(k))}</option>)}</select></label>
          <label>ساعت شروع<select disabled={!!target} value={S} onChange={(e) => set({ start: +e.target.value })}>{times.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
        </div>
        {multi ? <label>تا ساعت<select disabled={!!target} value={S + D} onChange={(e) => set({ dur: +e.target.value - S })}>{Array.from({ length: Math.max(1, close - S) }, (_, i) => S + i + 1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
          : <label>مدت<div className="seg-adm">{DURATIONS.map((x) => <button key={x.h} className={f.dur === x.h ? 'on' : ''} onClick={() => set({ dur: x.h })}>{x.name}</button>)}</div></label>}
        {target && <small className="muted">ساعت همان آدینه است ({range(S, D)})؛ زمین‌های ✓ از قبل مال آدینه‌اند.</small>}
        {f.type === 'coach' && <label>مربی<select value={f.coach} onChange={(e) => set({ coach: e.target.value })}>{COACHES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {f.type === 'friday' ? null : f.type !== 'block' ? (<>
          <label>{f.type === 'event' ? 'برگزارکننده' : 'مشتری'}<input placeholder="جستجوی نام یا موبایل" value={f.q} onChange={(e) => set({ q: e.target.value })} /></label>
          <div className="pick-list">{matches.map((m) => <button key={m.id} className={f.member === m.id ? 'on' : ''} onClick={() => set({ member: m.id })}><span className="adm-av sm">{m.name[0]}</span><b>{m.name}</b><small dir="ltr">{m.phone}</small><LevelPill id={m.level} /></button>)}</div>
          {f.type === 'event' && <label>مبلغ کل ایونت<Money value={price} onChange={(total) => set({ total })} /><small className="muted">بر اساس نرخ زمین: {toman(base)}</small></label>}
          <label>پرداخت<div className="seg-adm">{Object.entries({ none: 'در پذیرش، موقع بازی', full: 'همین الان، کامل' }).map(([k, v]) => <button key={k} className={f.pay === k ? 'on' : ''} onClick={() => set({ pay: k })}>{v}</button>)}</div></label>
          {f.pay !== 'none' && <label>روش<div className="seg-adm">{['card', 'cash', 'online'].map((m) => <button key={m} className={f.method === m ? 'on' : ''} onClick={() => set({ method: m })}>{METHOD_NAME[m]}</button>)}</div></label>}
        </>) : <label>توضیح<input placeholder="مثلاً تعویض چمن" value={f.note} onChange={(e) => set({ note: e.target.value })} /></label>}
      </div>
      <div className="dr-total"><span>{where || 'زمینی انتخاب نشده'}، {range(S, D)}</span><b>{f.type === 'friday' ? 'ورودی با ثبت‌نام' : toman(price)}</b></div>
      {!free && <p className="cancelled">{coachClash ? `${coachById(f.coach).name} در این ساعت کلاس دیگری دارد.` : !courts.length ? 'حداقل یک زمین انتخاب کنید.' : !fresh.length ? 'این زمین‌ها از قبل مال همین آدینه‌اند.' : S < open || S + D > close ? `خارج از ساعت کاری مجموعه است (${hourLabel(open)} تا ${hourLabel(close)}).` : `این بازه روی ${taken.map((c) => courtById(c).name).join('، ')} آزاد نیست.`}</p>}
      {free && f.date === todayKey() && S + D <= new Date().getHours() && <p className="pt-warn">این ساعت امروز گذشته است؛ فقط برای ثبت بازی‌ای که انجام شده استفاده کنید.</p>}
      <button className="adm-btn primary full" disabled={!free} onClick={save}>{f.type === 'friday' ? (target ? 'افزودن زمین به آدینه' : 'ساخت آدینه') : f.type === 'event' ? 'ثبت ایونت' : 'ثبت رزرو'}</button>
    </div>
  )
}
