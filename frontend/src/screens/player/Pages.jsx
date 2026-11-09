import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BADGES, COACHES, COACH_PACKS, coachesRanked, ratingOf, shownReviews, EVENT_KIND, LEVELS, PACKAGES, RANKS, XP_GUIDE, rankOf, coachPackPrice, coachPacks, dayLabel, dayMonth, fa, fromKey, hourLabel, levelById, short, toman } from '../../data'
import { celebrate, chime, haptic } from '../../fx'
import { ME, myPoints, useStore } from '../../store'
import { activeMembership, quests } from '../../select'
import { Avatar, Button, Chips, Icon, LevelPill, Photo, Sheet, Stars, TopBar, rise, stagger } from '../../components/ui'
import { leaderboard } from './Home'
import { Loading } from '../../components/Logo'
import { EV_FORMAT, appEvents, champOn, finished, isLive, levelOk, showsResults, whyNot, whyText } from '../../events'
import { Bracket, Groups, Podium, Teams, champion } from '../../components/Tournament'

// برگه‌ی امتیاز ناشناس
export function RateSheet({ target, title, onClose }) {
  const { addReview, toast } = useStore()
  const [stars, setStars] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (busy) return
    setBusy(true)
    const r = await addReview(target, stars, text)
    setBusy(false)
    if (r.error) { if (!r.shown) toast({ icon: '⛔', title: r.error === 'dup' ? 'قبلاً نظر داده‌اید' : 'امتیاز ثبت نشد', body: r.error === 'denied' ? 'فقط شاگردهای مربی یا شرکت‌کننده‌های مسابقه می‌توانند امتیاز بدهند' : '' }); onClose(); return }
    chime('success'); toast({ icon: '🙏', title: 'امتیاز شما ثبت شد', body: text.trim() ? `متن نظر بعد از تأیید مدیر نمایش داده می‌شود؛ +${fa(r.xp)} XP` : `+${fa(r.xp)} XP` }); onClose()
  }
  return (
    <Sheet open={!!target} onClose={onClose} title={title}>
      <div className="rate">
        <p className="muted">نام شما به هیچ‌کس، حتی مدیر باشگاه، نشان داده نمی‌شود.</p>
        <Stars value={stars} onChange={setStars} size={34} />
        <textarea placeholder="نظرتان را بنویسید (اختیاری)" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
        <p className="muted small">امتیاز ستاره‌ای همان لحظه حساب می‌شود؛ متن نظر بعد از تأیید مدیر برای بقیه نمایش داده می‌شود.</p>
        <Button full variant="q" disabled={!stars || busy} onClick={send}>{busy ? 'در حال ثبت…' : 'ثبت ناشناس'}</Button>
      </div>
    </Sheet>
  )
}

export function Coaches({ nav, onBack, focus }) {
  const { club, rated = [] } = useStore()
  const [rate, setRate] = useState(null)
  const list = coachesRanked(club)
  const studied = (id) => club.bookings.some((b) => b.coach === id && b.by === ME && b.status === 'ok')
  useEffect(() => { if (focus) document.getElementById('c-' + focus)?.scrollIntoView({ behavior: 'smooth' }) }, [focus])
  return (
    <div className="page">
      <TopBar onBack={onBack} title="مربی‌ها و کلاس‌ها" />
      <motion.div className="page-body" variants={stagger} initial="hidden" animate="show">
        <p className="lead">مربی‌ها به ترتیب امتیاز شاگردها. امتیاز و نظرها ناشناس ثبت می‌شوند.</p>
        {list.map((c, i) => {
          const done = rated.includes('coach:' + c.id)
          return (
            <motion.article key={c.id} id={'c-' + c.id} variants={rise} className="coach-big">
              <Photo src={c.img} />
              <div className="cb-shade" />
              <div className="cb-txt">
                <div className="row-between"><span className="cb-rank">#{fa(i + 1)} مربی باشگاه</span><LevelPill id={c.level} /></div>
                <h3>{c.name}</h3>
                <small>{c.title}، {fa(c.exp)} سال سابقه</small>
                <div className="cb-score"><Stars value={c.avg} /><b>{fa(c.avg)}</b><small>از {fa(c.count)} نظر ناشناس</small></div>
                <ul className="record light">{c.record.map((f) => <li key={f}>{f}</li>)}</ul>
                {[...new Set(shownReviews(c.list).map((r) => r.text))].slice(0, 3).map((t) => <p key={t} className="cb-quote">«{t}» <small>— ناشناس</small></p>)}
                <div className="cb-packs">
                  {coachPacks(c).map((p) => <div key={p.id}><small>{p.name}</small><b>{short(coachPackPrice(c, p))}</b></div>)}
                </div>
                <Button full variant="q" onClick={() => nav.start({ intent: 'coach', coachId: c.id })}>رزرو جلسه یا خرید پکیج</Button>
                <button className="cb-rate-btn" disabled={done || !studied(c.id)} onClick={() => setRate(c)}>
                  {done ? '✓ نظر شما ثبت شده' : studied(c.id) ? '★ امتیاز و نظر ناشناس' : 'بعد از اولین جلسه می‌توانید امتیاز بدهید'}
                </button>
              </div>
            </motion.article>
          )
        })}
      </motion.div>
      <RateSheet target={rate && 'coach:' + rate.id} title={rate && `امتیاز به ${rate.name}`} onClose={() => setRate(null)} />
    </div>
  )
}

export function Packages({ onBack, nav }) {
  const s = useStore()
  const [sel, setSel] = useState(null)
  const [method, setMethod] = useState(() => (s.config?.pay ? 'online' : 'wallet'))
  const [busy, setBusy] = useState(false)
  const mem = activeMembership(s)
  const buy = async () => {
    if (busy) return
    setBusy(true)
    const r = await s.buyPackage(sel, method)
    setBusy(false)
    if (r.error) { if (!r.shown) s.toast({ icon: '⛔', title: 'خرید انجام نشد', body: '' }); return }
    celebrate(); chime('level'); haptic([20, 40, 20])
    s.toast({ icon: '💎', title: `${sel.name} فعال شد`, body: `+${fa(r.xp)} XP${r.badges.length ? '، نشان «وفادار»' : ''}`, duration: 4500 })
    setSel(null)
  }
  return (
    <div className="page">
      <TopBar onBack={onBack} title="پکیج‌ها و عضویت" />
      <motion.div className="page-body" variants={stagger} initial="hidden" animate="show">
        {mem && <div className="mem-active"><Icon name="crown" /><div><b>{mem.name} فعال است</b><small>{fa(Math.ceil((s.membership.until - Date.now()) / 864e5))} روز مانده، {fa(mem.off * 100)}٪ تخفیف روی همه‌ی رزروها</small></div></div>}
        {PACKAGES.map((p) => (
          <motion.button key={p.id} variants={rise} className={`pkg ${p.kind}`} whileTap={{ scale: 0.98 }} onClick={() => { haptic(8); p.kind === 'series' ? nav.start({ intent: 'court', series: p.id }) : setSel(p) }}>
            <Photo src={p.img} />
            <div className="pkg-shade" />
            {p.tag && <span className="pkg-tag">{p.tag}</span>}
            <div className="pkg-txt">
              <small>{p.kind === 'series' ? 'پکیج زمین' : 'عضویت'}، {p.sub}</small>
              <h3>{p.name}</h3>
              <ul>{p.perks.map((x) => <li key={x}><Icon name="check" size={14} stroke={3} />{x}</li>)}</ul>
              <div className="pkg-price">{p.kind === 'series' ? <b>{fa(p.off * 100)}٪ تخفیف، انتخاب روز و ساعت</b> : <b>{toman(p.price)}</b>}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        {sel && (
          <div className="buy">
            <p className="muted">{sel.sub}، {fa(sel.days)} روز اعتبار</p>
            <div className="methods">
              {[['wallet', 'کیف پول', toman(s.wallet), 'wallet', s.wallet >= sel.price], ['online', 'کارت بانکی', 'درگاه شتاب', 'card', !!s.config?.pay]].map(([id, n, sub, ic, ok]) => (
                <button key={id} disabled={!ok} className={`method ${method === id ? 'on' : ''}`} onClick={() => setMethod(id)}><Icon name={ic} /><div className="grow"><b>{n}</b><small>{ok ? sub : id === 'online' ? 'پرداخت آنلاین به‌زودی فعال می‌شود' : 'موجودی کافی نیست'}</small></div><span className={`radio ${method === id ? 'on' : ''}`} /></button>
              ))}
            </div>
            <Loading show={busy} text={method === 'online' ? 'اتصال به درگاه پرداخت…' : 'در حال پرداخت…'} />
            <Button full variant="q" disabled={busy || (method === 'wallet' ? s.wallet < sel.price : !s.config?.pay)} onClick={buy}>{busy ? 'در حال پرداخت…' : `خرید، ${toman(sel.price)}`}</Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export function Ranking({ onBack }) {
  const s = useStore()
  const [scope, setScope] = useState('all')
  const pts = myPoints(s)
  let list = leaderboard(pts, s.user.name).map((x) => ({ ...x, level: x.me ? s.user.level : x.level }))
  if (scope === 'level') list = list.filter((x) => x.level === s.user.level)
  const pos = list.findIndex((x) => x.me) + 1
  const top = list.slice(0, 3)
  return (
    <div className="page ranking">
      <TopBar onBack={onBack} title="رنکینگ کوادرا" />
      <div className="page-body">
        <Chips id="rk" value={scope} onChange={setScope} options={[{ id: 'all', name: 'کل باشگاه' }, { id: 'level', name: `سطح ${s.user.level}` }]} />
        <div className="podium">
          {[1, 0, 2].map((k) => top[k] && (
            <motion.div key={top[k].id} className={`pod p${k + 1}`} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + (k === 0 ? 0.3 : k * 0.12), type: 'spring', stiffness: 220, damping: 16 }}>
              {k === 0 && <motion.span className="crown" animate={{ rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 2.4 }}>👑</motion.span>}
              <Avatar name={top[k].name} size={k === 0 ? 68 : 54} me={top[k].me} />
              <b>{top[k].me ? 'شما' : top[k].name.split(' ')[0]}</b>
              <small>{fa(top[k].points)}</small>
              <div className="pod-bar"><span>{fa(k + 1)}</span></div>
            </motion.div>
          ))}
        </div>
        <div className="rk-list">
          {list.slice(3, 40).map((p, i) => (
            <motion.div key={p.id} className={`rk-row ${p.me ? 'me' : ''}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
              <span className="rk-n">{fa(i + 4)}</span>
              <Avatar name={p.name} size={34} me={p.me} />
              <div className="grow"><b>{p.me ? `${p.name} (شما)` : p.name}</b><small>{p.games ? `${fa(p.games)} بازی` : 'بازیکن جدید'}</small></div>
              <LevelPill id={p.level} />
              <em>{fa(p.points)}</em>
            </motion.div>
          ))}
        </div>
        {pos > 40 && <div className="rk-row me sticky"><span className="rk-n">{fa(pos)}</span><Avatar name={s.user.name} size={34} me /><div className="grow"><b>شما</b><small>با هر بازی بالاتر می‌رید</small></div><em>{fa(pts)}</em></div>}
        <div className="rk-how">
          <b>امتیاز رنکینگ چطور حساب می‌شه؟</b>
          <p>هر سطح امتیاز پایه دارد ({LEVELS.slice(0, 3).map((l) => `${l.id}: ${fa(l.base)}`).join('، ')} …) و هر XP که از بازی، کلاس و تورنمنت می‌گیرید نصفش به رنکینگتون اضافه می‌شه.</p>
        </div>
      </div>
    </div>
  )
}

export function Events({ nav, onBack, kind: initial = 'friday' }) {
  const { club, rated = [] } = useStore()
  const [rate, setRate] = useState(null)
  const [open, setOpen] = useState(null)
  const [kind, setKind] = useState(initial)
  const list = appEvents(club).filter((e) => e.kind === kind)
  const past = finished(club).filter((e) => e.kind === kind).slice(0, 8)
  const sel = open && (club.events || []).find((e) => e.id === open)
  return (
    <div className="page">
      <TopBar onBack={onBack} title="مسابقه‌ها" />
      <div className="page-body">
        <Chips id="ev-kind" value={kind} onChange={setKind} options={Object.entries(EVENT_KIND).map(([id, k]) => ({ id, name: k.name }))} />
        <p className="muted ev-kind-sub">{EVENT_KIND[kind].sub}</p>
        <motion.div key={kind} className="ev-list" variants={stagger} initial="hidden" animate="show">
          {list.map((e) => {
            const mine = e.regs.some((r) => r.by === ME)
            return (
              <motion.button key={e.id} variants={rise} className="ev-card big" whileTap={{ scale: 0.98 }} onClick={() => setOpen(e.id)}>
                <Photo src={e.img} />
                <div className="ev-shade" />
                <div className="ev-txt">
                  <span className={`pill-q ${e.kind === 'official' ? 'gold' : ''}`}>{dayLabel(e.date)} {dayMonth(fromKey(e.date))}، {hourLabel(e.start)}</span>
                  <b>{e.title}</b>
                  <small>{e.format}، سطح {e.levels.join(' / ')}، جایزه: {e.prize}</small>
                  <div className="ev-cap"><div className="bar"><i style={{ width: `${Math.min(100, (e.taken / e.cap) * 100)}%` }} /></div><span>{e.taken >= e.cap ? 'تکمیل' : `${fa(e.cap - e.taken)} جای خالی`}</span></div>
                </div>
                <em>{mine ? '✓ ثبت‌نام' : short(e.fee)}</em>
              </motion.button>
            )
          })}
          {!list.length && <div className="empty-card">فعلاً مسابقه‌ی تازه‌ای اعلام نشده.</div>}
        </motion.div>
        {past.length > 0 && <p className="label">برگزارشده‌ها؛ نتیجه‌ها و برنده‌ها</p>}
        {past.map((e) => {
          const r = ratingOf(club, 'event:' + e.id), done = rated.includes('event:' + e.id)
          const ch = champOn(e) && champion(e)
          return (
            <div key={e.id} className="past-ev" onClick={() => setOpen(e.id)} role="button">
              <div className="grow"><b>{e.title}</b><small>{dayMonth(fromKey(e.date))}، {fa(e.teams.length)} تیم</small>
                {ch && <small className="past-champ">🏆 {ch.name}</small>}
                <div className="cb-score dark"><Stars value={r.avg} size={13} /><b>{fa(r.avg)}</b><small>{fa(r.count)} نظر</small></div></div>
              {(done || e.regs.some((r) => r.by === ME)) && <Button small variant={done ? 'ghost' : 'dark'} disabled={done} onClick={(x) => { x.stopPropagation(); setRate(e) }}>{done ? '✓ ثبت شد' : 'امتیاز بدهید'}</Button>}
            </div>
          )
        })}
      </div>
      <Sheet open={!!sel} onClose={() => setOpen(null)} title={sel?.title} tall>
        {sel && <EventInfo ev={sel} onJoin={() => { setOpen(null); nav.start({ intent: 'event', eventId: sel.id }) }} />}
      </Sheet>
      <RateSheet target={rate && 'event:' + rate.id} title={rate && `امتیاز به ${rate.title}`} onClose={() => setRate(null)} />
    </div>
  )
}

// جزئیات یک مسابقه در اپ: شرکت‌کننده‌ها، تیم‌ها، گروه‌ها، جدول حذفی و برنده‌ها
function EventInfo({ ev, onJoin }) {
  const { user } = useStore()
  const why = whyNot(ev, user), lvl = !!why
  const mine = ev.regs.some((r) => r.by === ME)
  const show = showsResults(ev)
  const tabs = [['people', `شرکت‌کننده‌ها ${fa(ev.regs.length)}`], show && ev.teams.length && ['teams', 'تیم‌ها'], show && ev.groups.length && ['groups', 'گروه‌ها'], show && ev.matches.some((m) => m.stage === 'ko') && ['ko', 'حذفی']].filter(Boolean)
  const [tab, setTab] = useState(() => (!showsResults(ev) ? 'people' : ev.matches.some((m) => m.stage === 'ko') ? 'ko' : ev.groups.length ? 'groups' : ev.teams.length ? 'teams' : 'people'))
  const can = ev.status === 'open' && !mine && !lvl && ev.regs.length + 2 <= ev.cap
  return (
    <div className="ev-info">
      <div className="ev-meta">
        <span>{dayLabel(ev.date)} {dayMonth(fromKey(ev.date))}، {hourLabel(ev.start)} تا {hourLabel(ev.start + ev.dur)}</span>
        <span>{ev.desc || EV_FORMAT[ev.format]}، سطح {ev.levels.join(' / ')}</span>
        <span>ورودی {toman(ev.fee)} هر نفر، تیم دونفره؛ جایزه: {ev.prize}</span>
        {ev.note && <span>{ev.note}</span>}
      </div>
      {champOn(ev) ? <Podium ev={ev} /> : ev.teams.length > 0 && <p className="muted small">نتیجه‌های این مسابقه هنوز اعلام نشده است.</p>}
      <Chips id={'evt-' + ev.id} small value={tab} onChange={setTab} options={tabs.map(([id, name]) => ({ id, name }))} />
      {tab === 'people' && (
        <div className="ev-people">
          {ev.regs.map((r) => <div key={r.id} className={r.by === ME ? 'me' : ''}><Avatar name={r.name} size={30} me={r.by === ME} /><b>{r.by === ME ? 'شما' : r.name}</b>{r.waiting && !ev.teams.some((t) => t.players.includes(r.id)) && <small className="wait-pill">منتظر یار</small>}{r.level && <LevelPill id={r.level} />}</div>)}
          {!ev.regs.length && <p className="muted">هنوز کسی ثبت‌نام نکرده؛ اولین نفر باشید.</p>}
          {!ev.teams.length && ev.regs.length > 0 && <p className="muted small">تیم‌ها قبل از شروع مسابقه، هم‌سطح چیده و همین‌جا اعلام می‌شوند.</p>}
        </div>
      )}
      {tab === 'teams' && <Teams ev={ev} />}
      {tab === 'groups' && <Groups ev={ev} />}
      {tab === 'ko' && <Bracket ev={ev} />}
      {isLive(ev) && <div className="ev-cta"><Button full variant="q" disabled={!can} onClick={onJoin}>{mine ? '✓ ثبت‌نام کرده‌اید' : ev.status !== 'open' ? 'ثبت‌نام بسته شد' : ev.regs.length + 2 > ev.cap ? 'ظرفیت تکمیل است' : why === 'level' ? `فقط سطح ${ev.levels.join(' / ')}؛ سطح شما ${user?.level}` : why ? (why === 'age' && !user?.birth ? 'سال تولدتان را در پروفایل وارد کنید' : why === 'gender' && !user?.gender ? 'جنسیت‌تان را در پروفایل وارد کنید' : whyText(ev, why)) : `ثبت‌نام تیم دونفره، ${toman(ev.fee * 2)}`}</Button></div>}
    </div>
  )
}

export function Notifications({ onBack }) {
  const { notifications, readAll } = useStore()
  useEffect(() => { const t = setTimeout(readAll, 800); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page">
      <TopBar onBack={onBack} title="اعلان‌ها" />
      <div className="page-body">
        {notifications.length === 0 && <div className="empty-card">اعلانی ندارید.</div>}
        {notifications.map((n, i) => (
          <motion.div key={n.id} className={`notif ${n.read ? '' : 'new'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <span className="notif-ic">{n.icon}</span>
            <div><b>{n.title}</b><p>{n.body}</p><small>{new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(n.at)}</small></div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// مسیر باشگاه: رتبه‌ها روی یک مسیر عمودی، جای فعلی کاربر، نشان‌ها و راهنمای XP
export function Journey({ onBack }) {
  const s = useStore()
  const { xp, badges } = s
  const rank = rankOf(xp)
  const qs = quests(s)
  const fill = Math.min(1, (rank.index + rank.progress) / (RANKS.length - 1))
  return (
    <div className="page journey">
      <TopBar onBack={onBack} title="مسیر باشگاه" />
      <div className="page-body">
        <div className="jr-head">
          <div className="grow">
            <small>رتبه‌ی فعلی شما</small>
            <h2>{rank.name}</h2>
            <p>{fa(xp)} XP{rank.next ? `، ${fa(rank.next.xp - xp)} XP تا «${rank.next.name}»` : '، بالاترین رتبه'}</p>
            <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${rank.progress * 100}%` }} transition={{ duration: 1 }} /></div>
          </div>
          <div className="jr-badges"><b>{fa(badges.length)}</b><small>از {fa(BADGES.length)} نشان</small></div>
        </div>

        <p className="label">مسیر رتبه‌ها</p>
        <div className="jr-path" style={{ '--fill': fill }}>
          <div className="jr-line"><motion.i initial={{ height: 0 }} animate={{ height: `${fill * 100}%` }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} /></div>
          {RANKS.map((r, i) => {
            const st = i < rank.index ? 'done' : i === rank.index ? 'cur' : 'next'
            return (
              <motion.div key={r.name} className={`jr-node ${st} ${i % 2 ? 'left' : 'right'}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                <span className="jr-dot" style={{ '--c': r.c }}>{st === 'done' ? '✓' : fa(i + 1)}</span>
                <div className="jr-card">
                  <b>{r.name}</b>
                  <small>{r.desc}</small>
                  <em>{st === 'cur' ? 'شما اینجایید' : st === 'done' ? 'گذرانده‌اید' : `از ${fa(r.xp)} XP`}</em>
                </div>
              </motion.div>
            )
          })}
        </div>

        <p className="label">چالش‌های این هفته</p>
        <div className="jr-quests">
          {qs.map((q) => (
            <div key={q.id} className={`jr-q ${q.claimed ? 'done' : ''}`}>
              <span>{q.icon}</span>
              <div className="grow"><b>{q.name}</b><small>{q.desc}</small></div>
              <em>{q.claimed ? '✓' : `+${fa(q.xp)}`}</em>
            </div>
          ))}
        </div>

        <p className="label">نشان‌ها، هر نشان ۱۵ XP</p>
        <div className="badges">
          {BADGES.map((b) => {
            const has = badges.includes(b.id)
            return (
              <div key={b.id} className={`badge ${has ? 'on' : ''}`}>
                <span className="badge-ic">{has ? b.icon : '🔒'}</span>
                <div className="grow"><b>{b.name}</b><small>{b.desc}</small></div>
                {has && <em className="badge-ok">✓</em>}
              </div>
            )
          })}
        </div>

        <div className="xp-guide open">
          <b>چطور XP بگیرم؟</b>
          {XP_GUIDE.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          <p>جدا از رتبه، «سطح بازی» شما (A تا D) فقط برای پیدا کردن هم‌سطح در مچ‌هاست و با XP عوض نمی‌شود.</p>
        </div>
      </div>
    </div>
  )
}
