// وضعیت زنده‌ی ۴ زمین: الان چه کسی روی کدام زمین است؛ قابل جابه‌جایی روز به روز و ساعت به ساعت
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { COURTS, TYPE_NAME, addDays, hoursOf, coachById, dayLabel, fa, fromKey, hourLabel, range, todayKey } from '../../data'
import { isFree, payState, useStore } from '../../store'
import { jDateFa } from '../../jalali'
import { SHIFTS, shiftOn } from '../../hr'
import { Icon } from '../../components/ui'
import { STATUS, occupancy, who } from './derive'
import { Seg } from './kit'

export const TYPE_CLS = { private: 't-private', open: 't-open', coach: 't-coach', block: 't-block', event: 't-event' }
const nowHour = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60 }
const covering = (list, t) => list.find((b) => b.start <= t && t < b.start + b.dur)
const name = (b, user) => (b.type === 'block' ? b.note || 'تعمیرات' : b.type === 'coach' ? `کلاس ${coachById(b.coach)?.name}` : b.type === 'event' && b.note ? b.note : who(b.by, user).replace(' (اپ)', ''))
const mins = (h) => { const m = Math.round(h * 60); return m >= 60 ? `${fa(Math.floor(m / 60))} ساعت${m % 60 ? ` و ${fa(m % 60)} دقیقه` : ''}` : `${fa(m)} دقیقه` }

export function LiveCourts({ ctx }) {
  const { club, user } = useStore()
  const { open: H0, close: H1 } = hoursOf(club)
  const [date, setDate] = useState(todayKey())
  const [hour, setHour] = useState(null) // null = زنده
  const [view, setView] = useState('cards')
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t) }, [])
  const today = todayKey(), isToday = date === today
  const live = isToday && hour == null
  const nh = nowHour()
  const t = live ? Math.min(Math.max(nh, H0), H1 - 0.01) : (hour ?? (isToday ? Math.floor(nh) : 18)) + 0.01
  const selH = Math.floor(t)
  const byCourt = useMemo(() => Object.fromEntries(COURTS.map((c) => [c.id, club.bookings.filter((b) => b.date === date && b.court === c.id && b.status !== 'cancelled').sort((a, b) => a.start - b.start)])), [club.bookings, date])
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i)
  const busyAt = (h) => COURTS.filter((c) => covering(byCourt[c.id], h + 0.01)).length
  const busyNow = COURTS.filter((c) => covering(byCourt[c.id], t) && covering(byCourt[c.id], t).type !== 'block').length
  const onShift = club.staff.filter((s) => {
    const sh = shiftOn(club, s.id, date)
    if (sh === 'off') return false
    if (isToday && live) { const r = club.attendance?.[date]?.[s.id]; return r && r.in != null && r.out == null }
    return SHIFTS[sh].from <= t && t < SHIFTS[sh].to
  })
  const pickDay = (k) => { setDate(k); if (k !== today && hour == null) setHour(18) }

  return (
    <section className="lboard light">
      <div className="lv-head">
        <div className="lv-title">
          <span className={`live-dot ${live ? 'on' : ''}`} />
          <div><h3>{live ? 'زمین‌ها، همین الان' : 'وضعیت زمین‌ها'}</h3>
            <small>ساعت {hourLabel(live ? Math.floor(nh * 2) / 2 : selH)}، {fa(busyNow)} از ۴ زمین در حال بازی</small></div>
        </div>
        <div className="lv-date">
          <button onClick={() => pickDay(addDays(date, -1))} aria-label="روز قبل" data-tip="روز قبل"><Icon name="back" size={16} /></button>
          <b>{isToday ? 'امروز' : dayLabel(date)}<small>{jDateFa(date)}</small></b>
          <button onClick={() => pickDay(addDays(date, 1))} aria-label="روز بعد" data-tip="روز بعد"><Icon name="fwd" size={16} /></button>
        </div>
        <div className="lv-tools">
          {!live && <button className="adm-btn primary sm" onClick={() => { setDate(today); setHour(null) }} data-tip="نمایش وضعیت همین لحظه"><span className="live-dot on sm" />الان</button>}
          <Seg value={view} onChange={setView} options={{ cards: 'زمین‌ها', timeline: 'خط زمان' }} tips={{ cards: 'هر زمین یک کارت: کی بازی می‌کند و چقدر مانده', timeline: 'همه‌ی رزروهای روز روی خط زمان' }} />
        </div>
      </div>

      {view === 'cards' ? (<>
        <div className="lv-hours" role="listbox" aria-label="ساعت">
          {hours.map((h) => {
            const n = busyAt(h), past = isToday && h + 1 <= nh, cur = isToday && Math.floor(nh) === h
            return (
              <button key={h} role="option" aria-selected={selH === h} className={`lvh ${selH === h ? 'on' : ''} ${past ? 'past' : ''} ${cur ? 'now' : ''}`}
                onClick={() => setHour(cur && isToday ? null : h)} data-tip={`ساعت ${fa(h)}: ${fa(n)} از ۴ زمین پر`}>
                <i style={{ '--b': n / 4 }} />
                <small>{h % 3 === 1 || selH === h ? fa(h) : ''}</small>
              </button>
            )
          })}
        </div>

        <div className="courts-live">
          {COURTS.map((c) => <CourtCard key={c.id} c={c} list={byCourt[c.id]} t={t} live={live} date={date} off={club.off[c.id]} user={user} ctx={ctx} />)}
        </div>
        <p className="lv-staff"><Icon name="users" size={14} />{onShift.length ? `در شیفت: ${onShift.map((s) => s.name.split(' ')[0]).join('، ')}` : 'پرسنلی در شیفت نیست'}</p>
      </>) : <Timeline date={date} onPick={ctx.open} />}
    </section>
  )
}

function CourtCard({ c, list, t, live, date, off, user, ctx }) {
  const cur = covering(list, t)
  const next = list.find((b) => b.start > t)
  const st = cur && cur.type !== 'block' ? payState(cur) : null
  const left = cur ? cur.start + cur.dur - t : 0
  const players = cur ? (cur.type === 'open' ? [...cur.players, ...Array(Math.max(0, 4 - cur.players.length)).fill(null)] : cur.type === 'block' ? [] : [cur.by, '+', '+', '+']) : []
  const state = off ? 'off' : !cur ? 'free' : cur.type === 'block' ? 'block' : 'busy'
  const label = { off: 'غیرفعال', free: 'آزاد', block: 'تعمیرات', busy: live ? 'در حال بازی' : 'رزرو شده' }[state]
  const open = () => (cur ? ctx.open({ kind: 'booking', id: cur.id }) : !off && ctx.open({ kind: 'new', court: c.id, date, start: Math.floor(t) }))
  return (
    <button className={`cl ${state}`} onClick={open}>
      <div className="cl-h"><b>{c.name}</b><small>{c.kind}</small><span className={`cl-st ${state}`}><i />{label}</span></div>
      <CourtArt state={state} type={cur?.type} players={players} user={user} />
      {cur ? (
        <div className="cl-body">
          <div className="cl-who"><b>{name(cur, user)}</b><span className="num" dir="ltr">{range(cur.start, cur.dur)}</span></div>
          {live && <div className="cl-prog" data-tip={`${mins(left)} مانده`}><i style={{ width: `${Math.min(100, ((t - cur.start) / cur.dur) * 100)}%` }} /></div>}
          <small className="cl-meta">{cur.type === 'block' ? 'زمین بسته است' : `${TYPE_NAME[cur.type]}${live ? `، ${mins(left)} مانده` : ''}${st && st !== 'paid' ? `، ${STATUS[st].name}` : ''}`}</small>
        </div>
      ) : (
        <div className="cl-body">
          <div className="cl-who"><b className="free">{off ? 'غیرفعال' : next ? `آزاد تا ${hourLabel(next.start)}` : 'تا آخر شب آزاد'}</b>{!off && <span className="cl-add"><Icon name="plus" size={13} />رزرو</span>}</div>
          <small className="cl-meta">{next ? `بعدی: ${name(next, user)}` : off ? 'از تنظیمات فعال کنید' : 'رزرو دیگری نیست'}</small>
        </div>
      )}
    </button>
  )
}

// تصویر بالا به پایین زمین پدل ۲۰×۱۰ متر با جای ۴ بازیکن
function CourtArt({ state, type, players, user }) {
  const pos = [[52, 30], [52, 80], [148, 30], [148, 80]]
  return (
    <svg viewBox="0 0 200 110" className={`court-art ${state} ${type || ''}`} aria-hidden="true">
      <rect x="2" y="2" width="196" height="106" rx="6" className="ca-surf" />
      {state === 'block' && <rect x="2" y="2" width="196" height="106" rx="6" fill="url(#hatch)" />}
      <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="rgba(0,0,0,.08)" /></pattern></defs>
      <g className="ca-lines">
        <rect x="8" y="8" width="184" height="94" rx="2" fill="none" />
        <line x1="31" y1="8" x2="31" y2="102" /><line x1="169" y1="8" x2="169" y2="102" />
        <line x1="31" y1="55" x2="169" y2="55" />
      </g>
      <line x1="100" y1="4" x2="100" y2="106" className="ca-net" />
      <g className="ca-glass"><path d="M4 4h22M4 4v30M4 106h22M4 106V76M196 4h-22M196 4v30M196 106h-22M196 106V76" /></g>
      {players.map((p, i) => {
        const [x, y] = pos[i]
        if (p === null) return <circle key={i} cx={x} cy={y} r="11" className="ca-empty" />
        const n = p === '+' ? '' : who(p, user)
        return (
          <g key={i} className={`ca-p ${p === '+' ? 'mate' : ''}`}>
            <circle cx={x} cy={y} r="11" />
            {n && <text x={x} y={y + 4} textAnchor="middle">{n[0]}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ---------- تایم‌لاین ۴ زمین ----------
export function Timeline({ date, compact, onPick }) {
  const { club, user } = useStore()
  const { open: H0, close: H1 } = hoursOf(club)
  const isToday = date === todayKey()
  const nowX = ((nowHour() - H0) / (H1 - H0)) * 100
  const past = (h) => fromKey(date) < fromKey(todayKey()) || (isToday && h + 1 <= nowHour())
  return (
    <div className={`tl ${compact ? 'compact' : ''}`}>
      <div className="tl-hours"><span />{Array.from({ length: H1 - H0 }, (_, i) => <small key={i}>{fa(H0 + i)}</small>)}</div>
      {COURTS.map((c) => {
        const list = club.bookings.filter((b) => b.date === date && b.court === c.id && b.status !== 'cancelled')
        return (
          <div key={c.id} className={`tl-row ${club.off[c.id] ? 'off' : ''}`}>
            <div className="tl-court"><b>{c.name}</b><small>{c.kind}، {fa(Math.round(occupancy(club, date, c.id) * 100))}٪</small></div>
            <div className="tl-track">
              {!club.off[c.id] && Array.from({ length: H1 - H0 }, (_, i) => H0 + i).filter((h) => !past(h) && isFree(club, date, c.id, h, 1)).map((h) => (
                <button key={'f' + h} className="tl-free" style={{ right: `${((h - H0) / (H1 - H0)) * 100}%`, width: `${100 / (H1 - H0)}%` }} onClick={() => onPick({ kind: 'new', court: c.id, date, start: h })} data-tip={`رزرو ${c.name}، ${hourLabel(h)}`} aria-label={`رزرو ${c.name} ساعت ${hourLabel(h)}`}><Icon name="plus" size={13} /></button>
              ))}
              {isToday && nowX > 0 && nowX < 100 && <i className="tl-now" style={{ right: `${nowX}%` }} />}
              {list.map((b) => {
                const st = payState(b)
                return (
                  <motion.button key={b.id} className={`tl-b ${TYPE_CLS[b.type]}`} style={{ right: `${((b.start - H0) / (H1 - H0)) * 100}%`, width: `calc(${(b.dur / (H1 - H0)) * 100}% - 3px)` }}
                    whileHover={{ y: -2 }} onClick={() => onPick({ kind: 'booking', id: b.id })} title={`${TYPE_NAME[b.type]}، ${range(b.start, b.dur)}`}>
                    <b>{b.type === 'block' ? b.note || 'تعمیرات' : b.type === 'coach' ? coachById(b.coach)?.name : who(b.by, user).replace(' (اپ)', '')}</b>
                    {!compact && <small>{range(b.start, b.dur)}{b.type === 'open' ? `، ${fa(b.players.length)}/۴` : ''}</small>}
                    {b.type !== 'block' && <i className={`pd ${STATUS[st].cls}`} />}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="tl-legend">
        {Object.entries({ private: 'رزرو زمین', open: 'بازی باز', coach: 'کلاس مربی', event: 'ایونت', block: 'تعمیرات' }).map(([k, v]) => <span key={k}><i className={TYPE_CLS[k]} />{v}</span>)}
        <span><i className="pd ok" />پرداخت‌شده</span><span><i className="pd warn" />بخشی پرداخت‌شده</span><span><i className="pd bad" />پرداخت‌نشده</span>
      </div>
    </div>
  )
}
