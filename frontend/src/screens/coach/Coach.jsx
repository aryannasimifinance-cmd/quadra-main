// پنل مربی (موبایل): لایه‌ی میانی بین مدیر و بازیکن. مربی فقط اطلاعات خودش را می‌بیند
// و می‌تواند تا سقف ساعت هفتگی زمین رزرو کند؛ هر رزرو بعد از تأیید مدیر در تقویم ثبت می‌شود.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { COACH_PACKS, COURTS, MEMBERS, addDays, coachPackPrice, courtById, dayMonth, fa, fromKey, hourLabel, hoursOf, range, ratingOf, shownReviews, toman, todayKey, weekday, weekdayShort } from '../../data'
import { chime, haptic } from '../../fx'
import { coachLimits, coachRun, isFree, openHours, useStore } from '../../store'
import { dk, inPeriod, jDateFa, period, shiftPeriod } from '../../jalali'
import { Icon, LevelPill, Sheet } from '../../components/ui'
import { coachFile, who } from '../admin/derive'
import { errText } from '../../api'
import '../../coach.css'

const TABS = [['home', 'خانه', 'home'], ['plan', 'برنامه', 'cal'], ['book', 'رزرو زمین', 'court'], ['students', 'شاگردها', 'users'], ['income', 'درآمد', 'wallet']]
const startOf = (b) => fromKey(b.date).getTime() + b.start * 36e5
const done = (b) => startOf(b) + b.dur * 36e5 <= Date.now()
const fromPack = (b) => b.method === 'package' || b.method === 'coach-pack'
const dayTxt = (k) => (k === todayKey() ? 'امروز' : k === addDays(todayKey(), 1) ? 'فردا' : `${weekday(fromKey(k))} ${dayMonth(fromKey(k))}`)
const REQ = { pending: ['در انتظار تأیید مدیر', 'wait'], ok: ['تأیید شد', 'ok'], rejected: ['رد شد', 'bad'], cancelled: ['لغو شد', 'mute'] }

export default function Coach() {
  const { logout, club, session, user } = useStore()
  const [tab, setTab] = useState('home')
  const [me, setMe] = useState(false)
  const [asg, setAsg] = useState(null) // بلوک تأییدشده‌ای که مربی دارد شاگردهایش را می‌گذارد
  const c = club.coaches.find((x) => x.id === session.id)
  const base = useMemo(() => c && build(club, c, user), [club, c, user])
  const d = base && { ...base, assign: setAsg }
  // اگر مدیر دسترسی را بست، مربی همان لحظه بیرون می‌رود
  useEffect(() => { if (!c || !c.login?.on) logout() }, [c, logout])
  if (!c || !d) return null
  const go = (t) => { haptic(6); setTab(t); document.querySelector('.co-scroll')?.scrollTo(0, 0) }
  const P = { home: Home, plan: Plan, book: Book, students: Students, income: Income }[tab]
  return (
    <div className="co">
      <header className="co-top">
        <button className="co-me" onClick={() => setMe(true)} aria-label="پروفایل من"><span style={{ backgroundImage: `url(${c.img})` }} /></button>
        <div className="grow"><small>پنل مربی</small><b>{TABS.find((t) => t[0] === tab)[1] === 'خانه' ? c.name : TABS.find((t) => t[0] === tab)[1]}</b></div>
        {d.pending > 0 && <button className="co-pend" onClick={() => go('book')}>{fa(d.pending)} منتظر تأیید</button>}
      </header>
      <main className="co-scroll">
        <AnimatePresence initial={false}>
          <motion.div key={tab} className="co-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: 0.12 }}>
            <P c={c} d={d} go={go} />
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="co-tabs">
        {TABS.map(([k, n, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}>
            <span className="co-ti"><Icon name={ic} size={20} />{k === 'home' && d.todo.length > 0 && <i>{fa(d.todo.length)}</i>}</span><small>{n}</small>
          </button>
        ))}
      </nav>
      <Sheet open={me} onClose={() => setMe(false)} title="پروفایل من" tall><Me c={c} d={d} onOut={logout} /></Sheet>
      <Sheet open={!!asg} onClose={() => setAsg(null)} title="شاگردهای ساعت‌های تأییدشده" tall>{asg && <Assign c={c} d={d} block={asg} onDone={() => setAsg(null)} />}</Sheet>
    </div>
  )
}

function build(club, c, user) {
  const f = coachFile(club, c.id, user, 'all')
  const bk = club.bookings.filter((b) => b.coach === c.id && b.status !== 'cancelled').sort((a, b) => startOf(a) - startOf(b))
  const t = todayKey()
  const share = c.share ?? 50
  const nth = new Map()
  bk.filter((b) => b.series).forEach((b) => { const list = bk.filter((x) => x.series === b.series); nth.set(b.id, [list.indexOf(b) + 1, list.length]) })
  const sales = club.sales.filter((s) => s.kind === 'coach' && s.item === c.id)
  const income = (p) => {
    const singles = bk.filter((b) => !fromPack(b) && !b.series && done(b) && inPeriod(b.date, p))
    const packs = sales.filter((s) => inPeriod(dk(s.at), p))
    const held = bk.filter((b) => done(b) && inPeriod(b.date, p))
    const gross = singles.reduce((s, b) => s + b.paid, 0) + packs.reduce((s, x) => s + x.price, 0)
    return { singles, packs, held, gross, mine: Math.round((gross * share) / 100) }
  }
  const reqs = (club.coachReqs || []).filter((r) => r.coach === c.id)
  const open = openHours(club, c.id)
  const pend = reqs.filter((r) => r.status === 'pending')
  const recent = Date.now() - 3 * 864e5
  const due = dueOf(bk, c)
  const todo = [
    open.length && { ic: 'users', tone: 'warn', title: `${fa(open.length)} ساعت تأییدشده بدون شاگرد`, sub: 'برای هر ساعت ۱ یا ۲ شاگرد اضافه کنید', act: 'assign', block: open[0].block, btn: 'افزودن شاگرد' },
    due.length && { ic: 'wallet', tone: 'warn', title: `${fa(due.length)} جلسه هنوز پرداخت نشده`, sub: 'خودتان پرداخت کنید یا برای شاگرد بفرستید تا زمین قطعی شود', act: 'assign', block: due[0].block, btn: 'پرداخت' },
    ...pend.map((r) => ({ ic: 'clock', tone: 'wait', title: 'درخواست رزرو منتظر تأیید مدیر', sub: `${dayTxt(r.date)}، ${hourLabel(r.start)} تا ${hourLabel(r.start + r.dur)}، ${courtById(r.court).name}`, act: 'book' })),
    ...reqs.filter((r) => r.status === 'ok' && (r.done || r.at) > recent && !open.some((b) => b.block === r.id)).map((r) => ({ ic: 'check', tone: 'ok', title: 'رزرو شما تأیید شد', sub: `${dayTxt(r.date)}، ${hourLabel(r.start)} تا ${hourLabel(r.start + r.dur)}، ${courtById(r.court).name}`, act: 'plan' })),
    ...reqs.filter((r) => r.status === 'rejected' && (r.done || r.at) > recent).map((r) => ({ ic: 'close', tone: 'bad', title: 'درخواست رزرو رد شد', sub: `${dayTxt(r.date)}، ${hourLabel(r.start)}؛ ساعت دیگری بگیرید`, act: 'book', btn: 'رزرو دوباره' })),
  ].filter(Boolean)
  return {
    todo, c, due,
    f, bk, nth, share, income, reqs, open,
    pending: reqs.filter((r) => r.status === 'pending').length,
    today: bk.filter((b) => b.date === t),
    next: bk.filter((b) => !done(b)),
    week: bk.filter((b) => !done(b) && fromKey(b.date) < fromKey(addDays(t, 7))),
    rating: ratingOf(club, 'coach:' + c.id),
  }
}

// جلسه‌های بلوک تأییدشده که شاگرد دارند، تمام نشده‌اند، پرداخت نشده‌اند و هنوز برای شاگرد هم فرستاده نشده‌اند
const unpaid = (b) => b.block && b.status !== 'cancelled' && b.players.length > 0 && !done(b) && b.paid < b.price
const sentToStudent = (b, c) => !!b.payBy && b.payBy !== c.member
const dueOf = (bk, c) => bk.filter((b) => unpaid(b) && !sentToStudent(b, c))
const payState = (b, c) => (b.paid >= b.price ? ['پرداخت‌شده', 'ok'] : sentToStudent(b, c) ? ['منتظر پرداخت شاگرد', 'wait'] : ['پرداخت نشده', 'due'])

// یک کلاس: ساعت و زمین، شاگردها، جلسه‌ی چندم پکیج، وضعیت
function Ses({ b, d, showDay }) {
  const { user } = useStore()
  const n = d.nth.get(b.id)
  const st = done(b) ? ['برگزار شد', 'mute'] : fromPack(b) || b.paid >= b.price ? ['پرداخت‌شده', 'ok'] : b.block ? payState(b, d.c)
    : ['پرداخت در پذیرش', 'due']
  return (
    <div className={`co-ses ${done(b) ? 'past' : ''}`}>
      <div className="co-ses-t"><b>{hourLabel(b.start)}</b><small>{fa(b.dur)} ساعت</small></div>
      <div className="co-ses-m">
        <b>{b.players.length ? b.players.map((p) => who(p, user)).join('، ') : 'بدون شاگرد مشخص'}</b>
        <small>{showDay ? `${dayTxt(b.date)}، ` : ''}{courtById(b.court).name}، {n ? `جلسه‌ی ${fa(n[0])} از ${fa(n[1])}` : 'تک جلسه'}</small>
      </div>
      {!b.players.length && b.block && !done(b)
        ? <button className="co-tag add" onClick={() => d.assign(b.block)}>+ شاگرد</button>
        : st[1] === 'due' && b.block ? <button className="co-tag add" onClick={() => d.assign(b.block)}>پرداخت</button>
        : <em className={`co-tag ${st[1]}`}>{st[0]}</em>}
    </div>
  )
}

// هشدار ساعت‌های بی‌شاگرد؛ روی آن بزنید تا ویزارد شاگردگذاری باز شود
function OpenAlert({ d }) {
  if (!d.open.length) return null
  return (
    <button className="co-alert" onClick={() => d.assign(d.open[0].block)}>
      <Icon name="users" size={20} />
      <span className="grow"><b>{fa(d.open.length)} ساعت تأییدشده بدون شاگرد</b><small>مدیر رزرو را تأیید کرد؛ حالا شاگرد هر ساعت را مشخص کنید</small></span>
      <Icon name="back" size={16} />
    </button>
  )
}

function Home({ c, d, go }) {
  const wk = d.income(period('week', todayKey()))
  const nx = d.next[0]
  const lim = coachLimits(useStore().club, c, todayKey())
  return (
    <>
      {nx ? (
        <div className="co-next">
          <small>کلاس بعدی</small>
          <b>{dayTxt(nx.date)}، ساعت {hourLabel(nx.start)}</b>
          <span>{courtById(nx.court).name}، {nx.players.length ? nx.players.map((p) => who(p)).join('، ') : 'بدون شاگرد مشخص'}</span>
        </div>
      ) : <div className="co-next empty"><b>کلاس رزروشده‌ای ندارید</b><span>از دکمه‌ی «رزرو» زمین بگیرید.</span></div>}
      <div className="co-stats">
        <button onClick={() => go('plan')}><b>{fa(d.today.length)}</b><small>کلاس امروز</small></button>
        <button onClick={() => go('plan')}><b>{fa(d.week.length)}</b><small>کلاس ۷ روز آینده</small></button>
        <button onClick={() => go('income')}><b>{toman(wk.mine).replace(' تومان', '')}</b><small>درآمد این هفته (تومان)</small></button>
      </div>
      <button className="co-quota" onClick={() => go('book')}>
        <Icon name="court" size={18} /><span className="grow">رزرو زمین: امروز <b>{fa(lim.day)}</b> و این هفته <b>{fa(lim.week)}</b> ساعت مانده</span><Icon name="back" size={16} />
      </button>
      <h3 className="co-h todo-h">کارهای من{d.todo.length > 0 && <em className="co-count">{fa(d.todo.length)}</em>}<small>درخواست‌ها، تأییدها و کارهایی که باید انجام دهید</small></h3>
      {d.todo.length ? (
        <div className="co-list">
          {d.todo.map((t, i) => (
            <button key={i} className={`co-todo ${t.tone}`} onClick={() => (t.act === 'assign' ? d.assign(t.block) : go(t.act))}>
              <span className="co-todo-ic"><Icon name={t.ic} size={18} /></span>
              <span className="grow"><b>{t.title}</b><small>{t.sub}</small></span>
              {t.btn ? <em>{t.btn}</em> : <Icon name="back" size={15} />}
            </button>
          ))}
        </div>
      ) : <div className="co-empty co-done"><Icon name="check" size={20} /><b>کاری نمانده</b><span>درخواست منتظر یا ساعت بی‌شاگردی ندارید.</span></div>}
    </>
  )
}

function DayChips({ days, value, onPick, count }) {
  return (
    <div className="co-days">
      {days.map((k) => {
        const n = count(k)
        return (
          <button key={k} className={`${value === k ? 'on' : ''} ${k === todayKey() ? 'today' : ''}`} onClick={() => { haptic(5); onPick(k) }}>
            <small>{k === todayKey() ? 'امروز' : weekdayShort(fromKey(k))}</small><b>{dayMonth(fromKey(k)).split(' ')[0]}</b><i className={n ? 'has' : ''}>{n ? fa(n) : ''}</i>
          </button>
        )
      })}
    </div>
  )
}

function Plan({ d }) {
  const t = todayKey()
  const [past, setPast] = useState(false)
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, past ? i - 14 : i))
  const [pick, setPick] = useState(null)
  const day = days.includes(pick) ? pick : past ? days[13] : days[0]
  const list = d.bk.filter((b) => b.date === day)
  return (
    <>
      <div className="co-seg"><button className={!past ? 'on' : ''} onClick={() => setPast(false)}>پیش‌رو</button><button className={past ? 'on' : ''} onClick={() => setPast(true)}>گذشته</button></div>
      <DayChips days={days} value={day} onPick={setPick} count={(k) => d.bk.filter((b) => b.date === k).length} />
      <h3 className="co-h">{dayTxt(day)}<small>{jDateFa(day)}</small></h3>
      {list.length ? <div className="co-list">{list.map((b) => <Ses key={b.id} b={b} d={d} />)}</div> : <p className="co-empty">در این روز کلاسی ندارید.</p>}
    </>
  )
}

// رزرو زمین: روز را انتخاب کنید و روی ساعت‌های آزاد جدول بزنید (پشت هم تا سقف)؛ درخواست برای مدیر می‌رود
function Book({ c, d }) {
  const { club, coachReq, coachReqCancel, toast, user } = useStore()
  const t = todayKey()
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i))
  const [date, setDate] = useState(t)
  const [sel, setSel] = useState(null) // { court, start, dur }
  const lim = coachLimits(club, c, date)
  const cap = Math.min(lim.day, lim.week)
  const { open, close } = hoursOf(club)
  const nowH = new Date().getHours() + new Date().getMinutes() / 60
  // درخواست منتظر هر مربی جا را نگه می‌دارد تا دو نفر یک ساعت را نخواهند
  const held = (ct, h) => (club.coachReqs || []).some((r) => r.status === 'pending' && r.date === date && r.court === ct && h >= r.start && h < r.start + r.dur)
  const mineAt = (h) => d.bk.some((b) => b.date === date && h >= b.start && h < b.start + b.dur) || d.reqs.some((r) => r.status === 'pending' && r.date === date && h >= r.start && h < r.start + r.dur)
  const free = (ct, h) => isFree(club, date, ct, h, 1) && !held(ct, h) && !mineAt(h)
  const inSel = (ct, h) => sel && sel.court === ct && h >= sel.start && h < sel.start + sel.dur
  const hours = Array.from({ length: close - open }, (_, i) => open + i).filter((h) => date !== t || h > nowH)
  const rows = hours.filter((h) => COURTS.some((ct) => free(ct.id, h) || inSel(ct.id, h)))
  const warn = (title) => { haptic([20, 20]); toast({ icon: '⏱', title }) }
  const tap = (ct, h) => {
    haptic(6)
    const fresh = () => (cap < 1 ? warn('سقف رزرو این روز یا هفته پر است') : coachRun(club, c, date, h, 1) > lim.run ? warn(`حداکثر ${fa(lim.run)} ساعت پشت هم`) : setSel({ court: ct, start: h, dur: 1 }))
    if (!sel || sel.court !== ct) return fresh()
    const s0 = sel.start, e0 = sel.start + sel.dur
    if (h >= s0 && h < e0) { // دوباره زدن = برداشتن
      if (sel.dur === 1) return setSel(null)
      if (h === s0) return setSel({ ...sel, start: s0 + 1, dur: sel.dur - 1 })
      return setSel({ ...sel, dur: h - s0 || 1 })
    }
    if (h === e0 || h === s0 - 1) {
      const next = { ...sel, start: Math.min(h, s0), dur: sel.dur + 1 }
      if (coachRun(club, c, date, next.start, next.dur) > lim.run) return warn(`حداکثر ${fa(lim.run)} ساعت پشت هم`)
      if (next.dur > cap) return warn(`فقط ${fa(cap)} ساعت از سقف شما مانده`)
      return setSel(next)
    }
    fresh()
  }
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (busy) return
    setBusy(true)
    const r = await coachReq({ date, court: sel.court, start: sel.start, dur: sel.dur, student: null, note: '' })
    setBusy(false)
    if (r.error) { if (!r.shown) toast({ icon: '⛔', title: { quota: 'سقف رزرو پر است', run: `حداکثر ${fa(lim.run)} ساعت پشت هم`, busy: 'این ساعت همین الان پر شد', open: 'اول شاگردهای ساعت‌های تأییدشده را بگذارید', off: 'دسترسی شما بسته شده است' }[r.error] || 'ثبت نشد' }); return }
    chime('success'); toast({ icon: '📨', title: 'درخواست فرستاده شد', body: 'بعد از تأیید مدیر در برنامه‌ی شما می‌آید' })
    setSel(null)
  }
  const mine = d.reqs.filter((r) => r.status !== 'cancelled' && fromKey(r.date) >= fromKey(t)).sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
  return (
    <div className={`co-book ${sel ? 'co-has-send' : ''}`}>
      <div className="co-caps">
        <div><b>{fa(lim.day)}</b><small>ساعت مانده در این روز</small></div>
        <div><b>{fa(lim.week)}</b><small>ساعت مانده این هفته</small></div>
        <div><b>{fa(lim.run)}</b><small>ساعت پشت هم حداکثر</small></div>
      </div>
      <OpenAlert d={d} />
      {d.open.length > 0 ? <p className="co-empty">اول شاگردهای ساعت‌های تأییدشده را مشخص کنید، بعد رزرو تازه بدهید.</p> : (<>
      <DayChips days={days} value={date} onPick={(k) => { setDate(k); setSel(null) }} count={(k) => d.reqs.filter((r) => r.date === k && r.status === 'pending').length} />
      <p className="co-note">روی یک ساعت آزاد بزنید؛ برای بیشتر، ساعت بعدی همان زمین را هم بزنید. بعد از تأیید مدیر، شاگرد هر ساعت را مشخص می‌کنید.</p>
      <div className="slot co-slot">
        <div className="slot-courts"><span />{COURTS.map((ct) => <div key={ct.id} className={`sc-head ${sel?.court === ct.id ? 'on' : ''} ${club.off[ct.id] ? 'off' : ''}`}><b>{fa(ct.id)}</b><small>زمین</small></div>)}</div>
        <div className="slot-grid">
          {!rows.length && <div className="empty-card">در این روز ساعت آزادی نمانده.</div>}
          {rows.map((h) => (
            <div key={h} className="slot-row">
              <span className="slot-t">{hourLabel(h)}</span>
              {COURTS.map((ct) => {
                const s = inSel(ct.id, h), ok = s || free(ct.id, h)
                return <button key={ct.id} className={`cell ${s ? `sel ${inSel(ct.id, h - 1) ? 'jt' : ''} ${inSel(ct.id, h + 1) ? 'jb' : ''}` : ok ? 'free' : 'busy'}`} disabled={!ok} onClick={() => tap(ct.id, h)}>{s && <Icon name="check" size={15} stroke={3} />}</button>
              })}
            </div>
          ))}
        </div>
      </div>
      </>)}

      <h3 className="co-h">درخواست‌های من</h3>
      {mine.length ? <div className="co-list">{mine.map((r) => (
        <div key={r.id} className="co-req">
          <div className="grow"><b>{dayTxt(r.date)}، <bdi dir="ltr">{range(r.start, r.dur)}</bdi></b><small>{courtById(r.court).name}{r.student ? `، ${who(r.student, user)}` : ''}</small></div>
          {r.status === 'ok' && d.open.some((b) => b.block === r.id)
            ? <button className="co-tag add" onClick={() => d.assign(r.id)}>+ شاگردها</button>
            : <em className={`co-tag ${REQ[r.status][1]}`}>{REQ[r.status][0]}</em>}
          {r.status === 'pending' && <button className="co-x" onClick={() => { coachReqCancel(r.id); toast({ icon: '↩️', title: 'درخواست لغو شد' }) }} aria-label="لغو درخواست"><Icon name="close" size={14} /></button>}
        </div>
      ))}</div> : <p className="co-empty">درخواست فعالی ندارید.</p>}

      <AnimatePresence>
        {sel && (
          <motion.div className="co-send" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <div className="co-send-t"><b>{dayTxt(date)}، <bdi dir="ltr">{range(sel.start, sel.dur)}</bdi></b><small>{courtById(sel.court).name}، {fa(sel.dur)} ساعت</small></div>
            <button className="co-btn" disabled={busy} onClick={send}>{busy ? 'در حال ارسال…' : 'ارسال برای تأیید'}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Students({ d }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const list = d.f.students.filter((s) => !q || s.name.includes(q) || s.phone?.includes(q))
  return (
    <>
      <label className="co-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`جستجو در ${fa(d.f.students.length)} شاگرد`} /></label>
      <div className="co-list">
        {list.map((s) => {
          const packs = d.f.packs.filter((p) => p.by === s.id && p.pack !== 'one')
          const left = packs.reduce((n, p) => n + Math.max(0, p.total - p.used), 0)
          const on = open === s.id
          return (
            <div key={s.id} className={`co-stud ${on ? 'open' : ''}`}>
              <button className="co-stud-h" onClick={() => { haptic(5); setOpen(on ? null : s.id) }}>
                <span className="co-ini">{(s.name || '?')[0]}</span>
                <span className="grow"><b>{s.name}</b><small>{s.upcoming ? `جلسه‌ی بعدی: ${dayTxt(s.upcoming)}` : s.last ? `آخرین جلسه: ${jDateFa(s.last)}` : '—'}</small></span>
                {s.level && <LevelPill id={s.level} />}
              </button>
              {on && (
                <div className="co-stud-b">
                  <div className="co-mini"><div><b>{fa(s.past)}</b><small>جلسه‌ی برگزارشده</small></div><div><b>{fa(s.next)}</b><small>جلسه‌ی آینده</small></div><div><b>{fa(left)}</b><small>مانده از پکیج</small></div></div>
                  {packs.map((p) => <div key={p.id} className="co-pack"><span><b>{p.packName}</b><small>{fa(p.used)} از {fa(p.total)}</small></span><i><em style={{ width: `${(p.used / p.total) * 100}%` }} /></i></div>)}
                  {s.phone && <a className="co-call" href={`tel:${s.phone}`}><Icon name="phone" size={16} /><span dir="ltr">{s.phone}</span></a>}
                </div>
              )}
            </div>
          )
        })}
        {!list.length && <p className="co-empty">{q ? `شاگردی با «${q}» پیدا نشد.` : 'هنوز شاگردی ندارید.'}</p>}
      </div>
    </>
  )
}

function Income({ d }) {
  const { user } = useStore()
  const [p, setP] = useState(() => period('month', todayKey()))
  const m = d.income(p)
  const months = []
  for (let k = todayKey(), i = 0; i < 6; i++) { const pp = period('month', k); months.unshift({ p: pp, ...d.income(pp) }); k = shiftPeriod(pp, -1) }
  const max = Math.max(1, ...months.map((x) => x.mine))
  const rows = [
    ...m.packs.map((s) => ({ at: s.at, date: dk(s.at), what: COACH_PACKS.find((x) => x.id === s.pack)?.name || s.name, who: who(s.by, user), amount: s.price })),
    ...m.singles.map((b) => ({ at: startOf(b), date: b.date, what: 'تک جلسه', who: b.players.map((x) => who(x, user)).join('، '), amount: b.paid })),
  ].sort((a, b) => b.at - a.at)
  return (
    <>
      <div className="co-month">
        <button onClick={() => setP(period('month', shiftPeriod(p, -1)))} aria-label="ماه قبل"><Icon name="back" size={18} /></button>
        <b>{p.label}</b>
        <button disabled={p.from === period('month', todayKey()).from} onClick={() => setP(period('month', shiftPeriod(p, 1)))} aria-label="ماه بعد"><Icon name="fwd" size={18} /></button>
      </div>
      <div className="co-earn">
        <small>سهم شما</small><b>{toman(m.mine)}</b>
        <span>{fa(d.share)}٪ از {toman(m.gross)} درآمد کلاس‌ها، {fa(m.held.length)} جلسه‌ی برگزارشده</span>
      </div>
      <div className="co-bars">{months.map((x) => (
        <button key={x.p.from} className={x.p.from === p.from ? 'on' : ''} onClick={() => setP(x.p)}>
          <span><i style={{ height: `${Math.max(4, (x.mine / max) * 100)}%` }} /></span><small>{x.p.label.split(' ')[0]}</small>
        </button>
      ))}</div>
      <h3 className="co-h">ریز درآمد<small>تسویه با مدیر باشگاه</small></h3>
      {rows.length ? <div className="co-list">{rows.map((r, i) => (
        <div key={i} className="co-row"><div className="grow"><b>{r.what}</b><small>{r.who}، {jDateFa(r.date)}</small></div><span><b>{toman(Math.round((r.amount * d.share) / 100))}</b><small>از {toman(r.amount)}</small></span></div>
      ))}</div> : <p className="co-empty">در این ماه درآمدی ثبت نشده.</p>}
    </>
  )
}

function Me({ c, d, onOut }) {
  const shown = shownReviews(d.rating.list)
  const [all, setAll] = useState(false)
  return (
    <div className="co-prof">
      <div className="co-prof-h">
        <span style={{ backgroundImage: `url(${c.img})` }} />
        <div><b>{c.name}</b><small>{c.title}، {fa(c.exp)} سال سابقه</small><LevelPill id={c.level} /></div>
      </div>
      <div className="co-rate"><b>★ {fa(d.rating.avg)}</b><small>از {fa(d.rating.count)} امتیاز شاگردها</small></div>
      {shown.length > 0 && <div className="co-revs">{(all ? shown : shown.slice(0, 3)).map((r) => <p key={r.id}><span>{'★'.repeat(r.stars)}</span>{r.text}</p>)}
        {shown.length > 3 && !all && <button className="co-link" onClick={() => setAll(true)}>همه‌ی {fa(shown.length)} نظر</button>}</div>}
      <h3 className="co-h">نرخ‌های شما در اپ</h3>
      <div className="co-prices">{COACH_PACKS.filter((p) => c.packs?.[p.id] !== false).map((p) => <div key={p.id}><small>{p.name}</small><b>{toman(coachPackPrice(c, p))}</b></div>)}</div>
      <p className="co-note">برای تغییر عکس، معرفی، نرخ یا رمز با مدیر باشگاه هماهنگ کنید.</p>
      <button className="co-btn ghost" onClick={onOut}><Icon name="logout" size={18} />خروج از پنل</button>
    </div>
  )
}

// بعد از تأیید مدیر: مربی برای هر ساعتِ بلوک تأییدشده شاگرد می‌گذارد (آموزش بی‌شاگرد نمی‌ماند)
function Assign({ c, d, block, onDone }) {
  const { club, coachSetPlayers, toast, user } = useStore()
  const hours = club.bookings.filter((b) => b.coach === c.id && b.block === block && b.status !== 'cancelled' && !done(b)).sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
  const [pick, setPick] = useState(null) // id ساعت یا 'all'
  const [q, setQ] = useState('')
  const [guest, setGuest] = useState('')
  const empty = hours.filter((b) => !b.players.length)
  const put = (pid) => {
    haptic(8)
    const targets = pick === 'all' ? empty : hours.filter((b) => b.id === pick)
    targets.forEach((b) => { if (!b.players.includes(pid)) coachSetPlayers(c.id, b.id, [...b.players, pid]) })
    setPick(null); setQ(''); setGuest('')
  }
  const drop = (b, pid) => coachSetPlayers(c.id, b.id, b.players.filter((x) => x !== pid))
  const mine = d.f.students.map((s) => s.id)
  const inHour = pick && pick !== 'all' ? hours.find((b) => b.id === pick)?.players || [] : []
  const found = (q.trim()
    ? MEMBERS.filter((m) => !m.inactive && (m.name.includes(q.trim()) || m.phone?.includes(q.trim())))
    : MEMBERS.filter((m) => mine.includes(m.id))).filter((m) => !inHour.includes(m.id)).slice(0, 12)
  const first = hours[0]
  if (!hours.length) return <p className="co-empty">ساعتی برای تکمیل نمانده.</p>
  if (pick) {
    const target = pick === 'all' ? `همه‌ی ${fa(empty.length)} ساعت خالی` : `ساعت ${hourLabel(hours.find((b) => b.id === pick)?.start)}`
    return (
      <div className="co-asg">
        <button className="co-link" onClick={() => setPick(null)}>→ برگشت</button>
        <h3 className="co-h">انتخاب شاگرد<small>برای {target}</small></h3>
        <label className="co-search"><Icon name="search" size={17} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا موبایل عضو" /></label>
        <div className="co-list">
          {found.map((m) => <button key={m.id} className="co-pick" onClick={() => put(m.id)}><span className="co-ini">{m.name[0]}</span><span className="grow"><b>{m.name}</b><small>{mine.includes(m.id) ? 'شاگرد شما' : 'عضو باشگاه'}</small></span><LevelPill id={m.level} /></button>)}
          {!found.length && <p className="co-empty">عضوی پیدا نشد؛ پایین به‌عنوان مهمان اضافه کنید.</p>}
        </div>
        <div className="co-guest"><input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="شاگرد غیرعضو: نام و نام خانوادگی" /><button disabled={guest.trim().length < 3} onClick={() => put('f:' + guest.trim())}>افزودن</button></div>
      </div>
    )
  }
  return (
    <div className="co-asg">
      <p className="co-note">آموزش با بازی فرق دارد: برای هر ساعت ۱ یا ۲ شاگرد بگذارید. تا همه‌ی ساعت‌ها کامل نشود، درخواست تازه نمی‌توانید بدهید.</p>
      <div className="co-asg-head"><b>{dayTxt(first.date)}، {courtById(first.court).name}</b><span>{fa(hours.length - empty.length)} از {fa(hours.length)} ساعت کامل</span><i><em style={{ width: `${((hours.length - empty.length) / hours.length) * 100}%` }} /></i></div>
      {empty.length > 1 && <button className="co-all" onClick={() => setPick('all')}><Icon name="users" size={16} />یک شاگرد برای همه‌ی ساعت‌های خالی</button>}
      <div className="co-list">
        {hours.map((b) => (
          <div key={b.id} className={`co-asg-row ${b.players.length ? 'ok' : ''}`}>
            <div className="co-asg-t"><b>{hourLabel(b.start)}</b><small>تا {hourLabel(b.start + b.dur)}</small></div>
            <div className="co-asg-p">
              {b.players.map((p) => <span key={p} className="co-chip">{who(p, user)}<button onClick={() => drop(b, p)} aria-label="حذف"><Icon name="close" size={11} /></button></span>)}
              {b.players.length < 2 && <button className="co-chip add" onClick={() => setPick(b.id)}><Icon name="plus" size={12} />{b.players.length ? 'نفر دیگر' : 'شاگرد'}</button>}
              {b.players.length > 0 && (() => { const ps = payState(b, c); return <em className={`co-pay-st ${ps[1]}`}>{ps[0]}</em> })()}
            </div>
          </div>
        ))}
      </div>
      <PayBox c={c} hours={hours} />
      <button className="co-btn" disabled={empty.length > 0} onClick={() => { chime('success'); toast({ icon: '✅', title: 'برنامه کامل شد', body: `${fa(hours.length)} جلسه با شاگرد ثبت شد` }); onDone() }}>
        {empty.length ? `${fa(empty.length)} ساعت هنوز شاگرد ندارد` : 'تمام شد'}
      </button>
    </div>
  )
}

// پرداخت هزینه‌ی جلسه‌ها: خود مربی (کیف پول / کارت بانکی) یا فرستادن برای شاگرد تا در اپ خودش بپردازد
function PayBox({ c, hours }) {
  const { coachPay, toast, config, user } = useStore()
  const [mode, setMode] = useState(null) // null | 'coach'
  const [busy, setBusy] = useState(false)
  const list = hours.filter(unpaid)
  if (!list.length) return null
  const sum = (xs) => xs.reduce((s, b) => s + b.price - b.paid, 0)
  const total = sum(list)
  const forStudent = list.filter((b) => !sentToStudent(b, c) && !b.players[0]?.startsWith('f:'))
  const guests = list.filter((b) => b.players[0]?.startsWith('f:'))
  const wallet = c.wallet ?? null
  const payOn = !!config?.pay
  const run = async (fn, ok) => {
    if (busy) return
    setBusy(true); haptic(10)
    const r = await fn()
    setBusy(false)
    if (r?.error) { chime('alarm'); if (!r.shown) toast({ icon: '⛔', title: 'پرداخت انجام نشد', body: errText(r), duration: 6000 }); return }
    chime('success'); toast(ok(r)); setMode(null)
  }
  const ids = (xs) => xs.map((b) => b.id)
  return (
    <div className="co-paybox">
      <div className="co-paybox-h"><Icon name="wallet" size={18} /><span className="grow"><b>هزینه‌ی {fa(list.length)} جلسه</b><small>تا پرداخت نشود، زمین قطعی نیست</small></span><em>{toman(total)}</em></div>
      {mode === 'coach' ? (
        <div className="co-paybox-m">
          <button className="co-pm" disabled={busy || wallet == null || wallet < total} onClick={() => run(() => coachPay(ids(list), 'coach', 'wallet'), () => ({ icon: '✅', title: 'پرداخت شد', body: `${fa(list.length)} جلسه از کیف پول شما پرداخت شد` }))}>
            <Icon name="wallet" size={18} /><span className="grow"><b>کیف پول من</b><small>{wallet == null ? 'هنوز کیف پولی ندارید؛ با کارت بانکی بپردازید' : `موجودی ${toman(wallet)}${wallet < total ? '، کافی نیست' : ''}`}</small></span>
          </button>
          <button className="co-pm" disabled={busy || !payOn} onClick={() => run(() => coachPay(ids(list), 'coach', 'online'), () => ({ icon: '✅', title: 'پرداخت شد' }))}>
            <Icon name="card" size={18} /><span className="grow"><b>کارت بانکی</b><small>{payOn ? 'درگاه شتاب' : 'پرداخت آنلاین هنوز فعال نیست'}</small></span>
          </button>
          <button className="co-link" onClick={() => setMode(null)}>→ برگشت</button>
        </div>
      ) : (
        <div className="co-paybox-a">
          <button className="co-btn" disabled={busy} onClick={() => setMode('coach')}>خودم پرداخت می‌کنم</button>
          <button className="co-btn soft" disabled={busy || !forStudent.length} onClick={() => run(() => coachPay(ids(forStudent), 'student'), () => ({ icon: '📨', title: 'برای شاگرد فرستاده شد', body: `${[...new Set(forStudent.map((b) => who(b.players[0], user)))].join('، ')} در اپ خودش پرداخت می‌کند` }))}>
            شاگرد پرداخت کند{forStudent.length && forStudent.length < list.length ? ` (${fa(forStudent.length)} جلسه)` : ''}
          </button>
          {guests.length > 0 && <p className="co-note">شاگرد مهمان (غیرعضو) نمی‌تواند در اپ پرداخت کند؛ آن جلسه‌ها را خودتان بپردازید یا در پذیرش.</p>}
          {list.some((b) => sentToStudent(b, c)) && <p className="co-note">بعضی جلسه‌ها برای شاگرد فرستاده شده و منتظر پرداخت اوست؛ اگر بخواهید خودتان هم می‌توانید بپردازید.</p>}
        </div>
      )}
    </div>
  )
}
