// رزروها: «برنامه» (هر رزرو یک ردیف) و «زمین‌ها» (هر زمین یک ستون، با ساعت‌های آزاد بین رزروها)
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { COURTS, MEMBERS, TYPE_NAME, hoursOf, addDays, coachById, courtById, dayMonth, fa, fromKey, hourLabel, range, short, toman, todayKey, weekday } from '../../data'
import { payState, useStore } from '../../store'
import { Icon } from '../../components/ui'
import { jDate } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { STATUS, who } from './derive'
import { Card, Empty, Search, Seg, Status, XlsxBtn } from './kit'

const RANGES = [['today', 'امروز', 'رزروهای امروز'], ['tomorrow', 'فردا', 'رزروهای فردا'], ['next', '۷ روز آینده', 'از امروز تا یک هفته‌ی بعد'], ['past', '۷ روز گذشته', 'بازی‌های هفته‌ی گذشته']]
const TYPES = [['private', 'رزرو زمین', 'کل زمین برای یک نفر و همراهانش؛ در اپ همان موقع کامل پرداخت می‌شود'], ['open', 'بازی باز', 'بازی که بقیه می‌توانند به آن بپیوندند'], ['coach', 'کلاس', 'کلاس با مربی'], ['event', 'ایونت', 'تولد، شرکتی یا هر برنامه‌ی خصوصی روی یک یا چند زمین'], ['block', 'تعمیرات', 'زمین برای تعمیر بسته است']]
const PAYS = [['paid', 'پرداخت‌شده', 'کامل پرداخت شده'], ['partial', 'بخشی پرداخت‌شده', 'فقط در بازی باز: بعضی بازیکن‌ها هنوز سهمشان را نداده‌اند'], ['pending', 'پرداخت‌نشده', 'رزرو پذیرش؛ موقع بازی در پذیرش پرداخت می‌شود'], ['void', 'لغوشده', 'رزروهای لغوشده']]
const SOURCES = [['app', 'اپ', 'رزرو از اپ'], ['desk', 'پذیرش', 'رزرو تلفنی یا حضوری']]
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 }

function Chips({ value, onChange, options, all = 'همه' }) {
  return (
    <div className="bk-chips">
      <button className={value === 'all' ? 'on' : ''} onClick={() => onChange('all')}>{all}</button>
      {options.map(([k, n, tip, cls]) => <button key={k} className={`${value === k ? 'on' : ''} ${cls || ''}`} onClick={() => onChange(value === k ? 'all' : k)} data-tip={tip}>{n}</button>)}
    </div>
  )
}

export function Bookings({ ctx }) {
  const { club, user } = useStore()
  const [rng, setRng] = useState('today')
  const [court, setCourt] = useState('all')
  const [type, setType] = useState('all')
  const [pay, setPay] = useState('all')
  const [src, setSrc] = useState('all')
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const [pick, setPick] = useState(null)
  const t = todayKey()
  const days = useMemo(() => {
    if (rng === 'today') return [t]
    if (rng === 'tomorrow') return [addDays(t, 1)]
    if (rng === 'next') return Array.from({ length: 7 }, (_, i) => addDays(t, i))
    return Array.from({ length: 7 }, (_, i) => addDays(t, i - 7))
  }, [rng, t])
  // در بازه‌ی ۷ روزه هر بار فقط یک روز نشان داده می‌شود تا زمین‌های روزهای مختلف قاطی نشوند
  const day = days.length > 1 ? (days.includes(pick) ? pick : rng === 'past' ? days[days.length - 1] : days[0]) : days[0]
  const pickRange = (k) => { setRng(k); setPick(null) }
  const list = useMemo(() => club.bookings.filter((b) => {
    if (!days.includes(b.date)) return false
    const st = payState(b)
    const ps = st === 'refunded' ? 'void' : st
    if (pay === 'all' ? b.status === 'cancelled' : ps !== pay) return false
    if (type !== 'all' && b.type !== type) return false
    return (court === 'all' || b.court === +court) && (src === 'all' || b.source === src)
      && (!q || [b.by, ...b.players].some((p) => who(p, user).includes(q) || MEMBERS.find((m) => m.id === p)?.phone.includes(q.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))))
  }), [club.bookings, days, court, type, pay, src, q, user])
  const sum = list.filter((b) => b.status !== 'cancelled').reduce((s, b) => ({ price: s.price + b.price, paid: s.paid + Math.min(b.paid, b.price) }), { price: 0, paid: 0 })
  const courts = court === 'all' ? COURTS : COURTS.filter((c) => c.id === +court)
  const extra = [type, pay, src].filter((x) => x !== 'all').length
  const active = extra + (court !== 'all') + (q ? 1 : 0)
  const reset = () => { setCourt('all'); setType('all'); setPay('all'); setSrc('all'); setQ('') }
  const exp = () => downloadXlsx('quadra-bookings', [{ name: 'رزروها', rows: table('رزروهای باشگاه کوادرا', ['تاریخ', 'ساعت', 'زمین', 'نوع', 'مشتری', 'بازیکن', 'منبع', 'مبلغ', 'دریافتی', 'مانده', 'وضعیت'],
    [...list].sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start).map((b) => [jDate(b.date), range(b.start, b.dur), courtById(b.court).name, TYPE_NAME[b.type], who(b.by, user), b.players.length, b.source === 'app' ? 'اپ' : 'پذیرش', b.price, b.paid, Math.max(0, b.price - b.paid), STATUS[payState(b)].name]),
    ['جمع', '', '', '', '', '', '', sum.price, sum.paid, sum.price - sum.paid, '']) }])

  return (
    <div className="stack">
      <div className="bk-filters">
        <div className="bk-row">
          <div className="bk-range">{RANGES.map(([k, n, tip]) => <button key={k} className={rng === k ? 'on' : ''} onClick={() => pickRange(k)} data-tip={tip}>{rng === k && <motion.i layoutId="bk-rng" className="bk-rng-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}<span>{n}</span></button>)}</div>
          <select className="bk-court-sel" value={court} onChange={(e) => setCourt(e.target.value)} data-tip="فقط رزروهای یک زمین">{[['all', 'همه‌ی زمین‌ها'], ...COURTS.map((c) => [String(c.id), c.name])].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <div className="bk-q"><Search value={q} onChange={setQ} ph="جستجوی نام یا موبایل اعضا" /></div>
          <button className={`adm-btn ghost sm bk-more ${more || extra ? 'on' : ''}`} onClick={() => setMore(!more)} data-tip="فیلتر بر اساس نوع رزرو، پرداخت و منبع">
            <Icon name="filter" size={15} />فیلتر بیشتر{extra > 0 && <em>{fa(extra)}</em>}
          </button>
          <XlsxBtn onClick={exp} label="اکسل" />
        </div>
        {more && (
          <motion.div className="bk-extra" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <label><small>نوع</small><Chips value={type} onChange={setType} options={TYPES.map(([k, n, tip]) => [k, n, tip, `tp-${k}`])} /></label>
            <label><small>پرداخت</small><Chips value={pay} onChange={setPay} options={PAYS} /></label>
            <label><small>منبع</small><Chips value={src} onChange={setSrc} options={SOURCES} /></label>
            {active > 0 && <button className="link" onClick={reset}>پاک کردن همه</button>}
        <div className="bk-legend">
          {TYPES.map(([k, n]) => <span key={k}><i className={`lg tp-${k}`} />{n}</span>)}
          <span className="sep" />
          <span><i className="lg live" />در حال بازی</span>
        </div>
          </motion.div>
        )}
      </div>

      <div className="bk-sum">
        <div data-tip="رزروهای لغوشده حساب نمی‌شوند"><small>تعداد رزروها</small><b>{fa(list.filter((b) => b.status !== 'cancelled').length)}</b></div>
        <div data-tip="جمع قیمت همه‌ی این رزروها"><small>ارزش رزروها</small><b>{toman(sum.price)}</b></div>
        <div data-tip="پولی که از اپ یا در پذیرش گرفته شده"><small>تا الان دریافت شده</small><b className="ok">{toman(sum.paid)}</b></div>
        <div data-tip="باید در پذیرش گرفته شود؛ از بخش «دریافت‌ها» تسویه کنید"><small>هنوز دریافت نشده</small><b className={sum.price - sum.paid ? 'warn' : ''}>{toman(sum.price - sum.paid)}</b></div>
      </div>


      {days.length > 1 && (
        <div className="bk-strip" role="tablist" aria-label="روز">
          {days.map((k) => {
            const n = list.filter((b) => b.date === k && b.status !== 'cancelled').length
            return (
              <button key={k} role="tab" aria-selected={day === k} className={`${day === k ? 'on' : ''} ${k === t ? 'today' : ''}`} onClick={() => setPick(k)}>
                <small>{k === t ? 'امروز' : weekday(fromKey(k))}</small><b>{dayMonth(fromKey(k))}</b><em className={n ? '' : 'none'}>{n ? `${fa(n)} رزرو` : 'بدون رزرو'}</em>
              </button>
            )
          })}
        </div>
      )}

      {[day].map((k) => {
        const dayList = list.filter((b) => b.date === k)
        const dateTxt = `${k === t ? 'امروز، ' : ''}${weekday(fromKey(k))} ${dayMonth(fromKey(k))}`
        return (
          <section key={k} className="bk-day">
            <header>
              <h3><Icon name="cal" size={17} />{weekday(fromKey(k))} {dayMonth(fromKey(k))}{k === t && <small>امروز</small>}</h3>
              <span>{fa(dayList.length)} رزرو، {toman(dayList.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.price, 0))}</span>
              <button className="adm-btn ghost sm" onClick={() => ctx.open({ kind: 'new', date: k })} data-tip="رزرو دستی برای این روز"><Icon name="plus" size={14} />رزرو</button>
            </header>
            <div className={`bk-lanes ${courts.length === 1 ? 'one' : ''}`} style={{ '--n': courts.length }}>
              {courts.map((c) => {
                const lane = dayList.filter((b) => b.court === c.id).sort((a, b) => a.start - b.start)
                const items = [...lane.map((b) => ({ at: b.start, b })), ...(club.off[c.id] ? [] : gaps(lane, k, t, hoursOf(club)).map(([from, to]) => ({ at: from, gap: [from, to] })))].sort((x, y) => x.at - y.at)
                return (
                  <div key={c.id} className="bk-lane">
                    <div className="bk-lane-h"><b>{c.name}</b><small>{club.off[c.id] ? 'غیرفعال' : c.kind}</small><em>{fa(lane.filter((b) => b.status !== 'cancelled').length)} رزرو</em></div>
                    <div className="bk-lane-d"><Icon name="cal" size={12} />{dateTxt}</div>
                    {items.map((x) => (x.b
                      ? <Ticket key={x.b.id} b={x.b} today={k === t} onClick={() => ctx.open({ kind: 'booking', id: x.b.id })} />
                      : <button key={'g' + x.at} className="bk-gap" onClick={() => ctx.open({ kind: 'new', date: k, court: c.id, start: x.gap[0] })} data-tip="رزرو دستی در این ساعت">
                        <span dir="ltr">{hourLabel(x.gap[0])}–{hourLabel(x.gap[1])}</span><small>آزاد</small><Icon name="plus" size={14} /></button>))}
                    {!items.length && <small className="bk-none">{club.off[c.id] ? 'این زمین غیرفعال است' : 'ساعت آزادی نمانده'}</small>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {!list.length && active > 0 && <Empty>با این فیلترها رزروی نیست. <button className="link" onClick={reset}>پاک کردن فیلترها</button></Empty>}
    </div>
  )
}

// ساعت‌های آزاد یک زمین در روز (از ۷ صبح تا ۱۲ شب)؛ برای امروز از ساعت بعدی، برای روزهای گذشته هیچ
function gaps(lane, k, today, { open, close }) {
  if (fromKey(k) < fromKey(today)) return []
  const out = []
  let h = k === today ? Math.max(open, Math.ceil(nowH())) : open
  lane.filter((b) => b.status !== 'cancelled').forEach((b) => { if (b.start - h >= 1) out.push([h, b.start]); h = Math.max(h, b.start + b.dur) })
  if (close - h >= 1) out.push([h, close])
  return out
}

// کارت هر رزرو: نوار رنگی نوع، ساعت، نام، بازیکن‌ها و وضعیت پرداخت
function Ticket({ b, today, onClick }) {
  const { user } = useStore()
  const st = payState(b)
  const live = today && b.status !== 'cancelled' && nowH() >= b.start && nowH() < b.start + b.dur
  const spots = b.type === 'block' ? [] : b.type === 'open' ? Array.from({ length: 4 }, (_, i) => b.players[i] || null) : b.players.slice(0, 4)
  const title = b.type === 'block' ? b.note || 'تعمیرات' : b.type === 'coach' ? `کلاس ${coachById(b.coach)?.name || ''}` : b.type === 'event' ? b.note || 'ایونت' : who(b.by, user)
  return (
    <button className={`bk-ticket tp-${b.type} ${b.status === 'cancelled' ? 'cancel' : ''} ${live ? 'is-live' : ''}`} onClick={onClick}>
      <div className="bk-top"><span className="bk-time" dir="ltr">{range(b.start, b.dur)}</span>{live ? <span className="bk-live"><i />الان</span> : <small className="bk-type">{TYPE_NAME[b.type]}</small>}</div>
      <b className="bk-name">{b.type === 'block' && <Icon name="wrench" size={13} />}{title}</b>
      {b.type !== 'block' && (
        <div className="bk-foot">
          <span className="bk-ppl" data-tip={b.type === 'open' ? `${fa(b.players.length)} از ۴ بازیکن` : `${fa(b.players.length)} بازیکن`}>{spots.map((p, i) => <i key={i} className={p ? 'on' : ''}>{p ? who(p, user)[0] : ''}</i>)}</span>
          <span className={`bk-paid ${b.status === 'cancelled' ? 'void' : st}`}>{b.status === 'cancelled' ? 'لغو شده' : st === 'paid' ? toman(b.price) : `${short(b.paid)} از ${short(b.price)}`}</span>
        </div>
      )}
    </button>
  )
}

