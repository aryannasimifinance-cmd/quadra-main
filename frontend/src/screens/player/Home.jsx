import { motion } from 'framer-motion'
import { useState } from 'react'
import { COACHES, EVENT_KIND, coachById, weekday, coachesRanked, MEMBERS, PACKAGES, PRODUCTS, courtById, dayLabel, dayMonth, fa, fromKey, hourLabel, levelById, range, rankOf, short, toman } from '../../data'
import { celebrate, chime } from '../../fx'
import { ME, myPoints, useStore } from '../../store'
import { myBookings, openGames, quests, streak, upcomingSlots } from '../../select'
import { Avatar, Button, Icon, LevelPill, Photo, Ring, SectionHead, Sheet, Tilt, rise, stagger } from '../../components/ui'
import { Logo } from '../../components/Logo'
import { ProductImage } from '../../components/Merch'
import { Dish } from '../../components/Dish'
import { Tracker, courtTargets } from './Cafe'
import { available } from '../../cafe'
import { appEvents, champOn, finished, podium, teamName } from '../../events'

export default function Home({ nav }) {
  const s = useStore()
  const { user, xp, club, notifications, wallet } = s
  const rank = rankOf(xp)
  const unread = notifications.filter((n) => !n.read).length
  const mine = myBookings(club).filter((b) => fromKey(b.date).getTime() + (b.start + b.dur) * 36e5 > Date.now())
  const games = openGames(club, user.level).filter((g) => !g.mine).slice(0, 6)
  const slots = upcomingSlots(club, 10)
  const qs = quests(s)
  const st = streak(s)
  const evs = appEvents(club)
  const nextEv = ['friday', 'official'].map((k) => evs.find((e) => e.kind === k)).filter(Boolean)
  // آخرین قهرمان‌هایی که مدیر اجازه‌ی نمایششان را داده
  const champEv = finished(club).find(champOn)
  const pod = champEv && podium(champEv)
  const first = user.name.split(' ')[0]
  const h = new Date().getHours()
  const hello = h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر'

  return (
    <div className="home">
      <section className="hero">
        <Photo src="./img/welcome-courts.jpg" zoom pos="55% 50%" />
        <div className="hero-shade" />
        <div className="hero-top">
          <Logo tone="light" size={17} />
          <div className="hero-actions">
            <button className="wallet-chip" onClick={() => nav.tab('me')}><Icon name="wallet" size={16} />{short(wallet)}</button>
            <motion.button className="icon-btn glass" whileTap={{ scale: 0.85 }} onClick={() => nav.open('notifs')} aria-label="اعلان‌ها">
              <Icon name="bell" size={20} />
              {unread > 0 && <motion.i className="dot" initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} />}
            </motion.button>
          </div>
        </div>
        <div className="hero-body">
          <motion.p className="hello" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.75, y: 0 }}>{hello}، {first}</motion.p>
          <motion.div className="hero-me" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => nav.open('journey')}>
            <Ring value={rank.progress} size={58} stroke={5}><LevelPill id={user.level} /></Ring>
            <div className="grow">
              <b>{rank.name} <span>، {fa(xp)} XP</span></b>
              <small>{rank.next ? `${fa(rank.next.xp - xp)} XP تا ${rank.next.name}` : 'بالاترین رتبه!'}</small>
              <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${rank.progress * 100}%` }} transition={{ delay: 0.4, duration: 1 }} /></div>
            </div>
            <div className="streak" title="هفته‌های پشت‌سرهم">
              <motion.span animate={st ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>🔥</motion.span>
              <b>{fa(st)}</b><small>هفته</small>
            </div>
          </motion.div>
          <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <motion.button className="cta-main" whileTap={{ scale: 0.96 }} onClick={() => nav.start({})}>
              <span><b>بازی بسازید</b><small>زمین، مچ، مربی، آدینه و ویبورا</small></span>
              <i><Icon name="plus" size={24} stroke={2.6} /></i>
            </motion.button>
            <motion.button className="cta-side" whileTap={{ scale: 0.96 }} onClick={() => nav.start({ intent: 'match' })}>
              <Icon name="radar" /><b>مچ سریع</b>
            </motion.button>
          </motion.div>
        </div>
      </section>

      <div className="home-body">
        <CoachDue />
        <section className="h-sec">
          <SectionHead title="رزرو سریع" sub="نزدیک‌ترین ساعت‌های آزاد، ۱ ساعت" action="همه‌ی ساعت‌ها" onAction={() => nav.start({ intent: 'court' })} />
          <motion.div className="slot-row-q" variants={stagger} initial="hidden" animate="show">
            {slots.length === 0 && <div className="empty-card">تا فردا شب ساعت آزادی نمانده — روزهای دیگر را ببینید.</div>}
            {slots.map((x) => (
              <motion.button key={x.court + x.date + x.start} variants={rise} className="qslot" whileTap={{ scale: 0.95 }}
                onClick={() => nav.start({ intent: 'court', court: x.court, date: x.date, start: x.start, dur: 1 })}>
                <small className={x.peak ? 'peak' : ''}>{dayLabel(x.date)}{x.peak ? '، پیک' : ''}</small>
                <b>{hourLabel(x.start)}</b>
                <span className="qs-court"><CourtGlyph n={x.court} />{courtById(x.court).name}</span>
                <em>{fa(x.price)} <small>تومان</small></em>
              </motion.button>
            ))}
          </motion.div>
        </section>

        {mine.length > 0 && (
          <section className="h-sec">
            <SectionHead title="بازی بعدی شما" action="همه" onAction={() => nav.tab('games')} />
            <NextTicket b={mine[0]} onClick={() => nav.tab('games')} />
          </section>
        )}

        <section className="h-sec">
          <SectionHead title="بازی‌های باز هم‌سطح شما" sub={`سطح ${user.level}، ${levelById(user.level).title}`} action="همه" onAction={() => nav.start({ intent: 'match' })} />
          <div className="og-row">
            {games.length === 0 && <div className="empty-card">فعلاً بازی بازی نیست — خودتون یکی بسازید!</div>}
            {games.map((g, i) => (
              <motion.button key={g.id} className="og-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.97 }} onClick={() => nav.start({ intent: 'match', gameId: g.id })}>
                <div className="og-top">
                  <span className={`og-fit ${g.gap === 0 ? 'hot' : ''}`}>{g.gap === 0 ? 'دقیقاً هم‌سطح' : g.gap === 1 ? 'نزدیک به سطح شما' : 'سطح دیگر'}</span>
                  <small>{courtById(g.court).name}</small>
                </div>
                <b>{dayLabel(g.date)}، {range(g.start, g.dur)}</b>
                <div className="og-names">
                  <span>سازنده: <b>{memberName(g.by)}</b></span>
                  {g.players.length > 1 && <span>بازیکن‌ها: {g.players.filter((p) => p !== g.by).map((p) => memberName(p).split(' ')[0]).join('، ')}</span>}
                </div>
                <div className="og-levels">{g.levels.map((l) => <LevelPill key={l} id={l} />)}</div>
                <div className="og-ppl">
                  {[0, 1, 2, 3].map((k) => g.players[k] ? <Avatar key={k} name={MEMBERS.find((m) => m.id === g.players[k])?.name || 'ش'} size={30} /> : <span key={k} className="og-empty" />)}
                  <em>{fa(4 - g.players.length)} جای خالی</em>
                </div>
                <div className="og-foot"><span>سهم هر نفر</span><b>{toman((g.full ?? g.price) / 4)}</b></div>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="h-sec">
          <SectionHead title="چالش‌های این هفته" sub="هر شنبه تازه می‌شوند، جایزه: XP" />
          <div className="quests">
            {qs.map((q) => <Quest key={q.id} q={q} />)}
          </div>
        </section>

        {champEv && <section className="h-sec"><SectionHead title="قهرمان‌ها" action="همه‌ی نتیجه‌ها" onAction={() => nav.open('events')} />
          <motion.button className="champ-card" whileTap={{ scale: 0.98 }} onClick={() => nav.open('events')}>
            <span className="cc-tag">🏆 {champEv.title}، {dayLabel(champEv.date)} {dayMonth(fromKey(champEv.date))}</span>
            <div className="cc-pod">
              <div className="cc-p second"><i>🥈</i><b>{teamName(champEv, pod.second)}</b><small>دوم</small></div>
              <div className="cc-p first"><i>🏆</i><b>{teamName(champEv, pod.first)}</b><small>قهرمان</small></div>
              <div className="cc-p third"><i>🥉</i><b>{pod.third.map((t) => teamName(champEv, t)).join('، ') || '—'}</b><small>سوم</small></div>
            </div>
          </motion.button></section>}

        {nextEv.length > 0 && <section className="h-sec"><SectionHead title="مسابقه‌ها" action="همه" onAction={() => nav.open('events')} />
        {nextEv.map((ev) => (
          <motion.button key={ev.id} className="event-banner" whileTap={{ scale: 0.98 }} onClick={() => nav.open('events', { kind: ev.kind })}>
            <Photo src={ev.img} />
            <div className="event-shade" />
            <div className="event-txt">
              <span className={`pill-q ${ev.kind === 'official' ? 'gold' : ''}`}>{EVENT_KIND[ev.kind].name}، {dayLabel(ev.date)} {dayMonth(fromKey(ev.date))}</span>
              <h3>{ev.title}</h3>
              <p>{ev.format}، {fa(ev.cap - ev.taken)} جای خالی</p>
            </div>
            <span className="event-go"><Icon name="fwd" /></span>
          </motion.button>
        ))}</section>}

        <section className="h-sec">
          <SectionHead title="مربی‌ها" action="کلاس‌ها و پکیج‌ها" onAction={() => nav.open('coaches')} />
          <div className="coach-row">
            {coachesRanked(club).map((c) => (
              <Tilt key={c.id} className="coach-card" onClick={() => nav.open('coaches', { focus: c.id })}>
                <Photo src={c.img} />
                <div className="coach-shade" />
                <div className="coach-txt"><LevelPill id={c.level} /><b>{c.name}</b><small>★ {fa(c.avg)}، {c.title}</small></div>
              </Tilt>
            ))}
          </div>
        </section>

        <motion.button className="pack-promo" whileTap={{ scale: 0.98 }} onClick={() => nav.open('packages')}>
          <div>
            <span className="pill-ink">پکیج‌ها و عضویت</span>
            <h3>تا ۲۵٪ ارزان‌تر بازی کنید</h3>
            <p>{PACKAGES.map((p) => p.name).join('، ')}</p>
          </div>
          <div className="pack-stack">
            {PACKAGES.slice(0, 3).map((p, i) => <motion.span key={p.id} style={{ backgroundImage: `url(${p.img})` }} animate={{ rotate: (i - 1) * 8, y: i === 1 ? -6 : 0 }} whileHover={{ rotate: 0 }} />)}
          </div>
        </motion.button>

        <section className="h-sec">
          <SectionHead title="کافه‌ی کوادرا" sub={courtTargets(club).length ? 'سفارش بدید، سر زمینتون میاریم' : 'قهوه، نوشیدنی، ماکتل و غذا'} action="منوی کامل" onAction={() => nav.tab('cafe')} />
          {club.cafeOrders.filter((o) => o.by === ME && o.status !== 'delivered').slice(0, 1).map((o) => <Tracker key={o.id} o={o} onClick={() => nav.tab('cafe')} />)}
          <div className="shop-peek">
            {club.cafeItems.filter((it) => it.tag && available(it, club.cafeIngs)).slice(0, 8).map((it) => (
              <motion.button key={it.id} className="peek cafe-peek" whileTap={{ scale: 0.95 }} onClick={() => nav.tab('cafe')}>
                <Dish it={it} big />
                <small>{it.name}</small>
                <b>{toman(it.price)}</b>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="h-sec">
          <SectionHead title="از فروشگاه" action="همه" onAction={() => nav.tab('shop')} />
          <div className="shop-peek">
            {PRODUCTS.filter((p) => p.tag && p.active !== false).slice(0, 6).map((p) => (
              <motion.button key={p.id} className="peek" whileTap={{ scale: 0.95 }} onClick={() => nav.tab('shop')}>
                <ProductImage p={p} />
                <small>{p.name}</small>
                <b>{toman(p.price)}</b>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="h-sec">
          <SectionHead title="رنکینگ کوادرا" action="جدول کامل" onAction={() => nav.open('ranking')} />
          <MiniBoard points={myPoints(s)} name={user.name} onClick={() => nav.open('ranking')} />
        </section>

        <p className="foot-note">کوادرا، باشگاه پدل، ۷ صبح تا ۱۲ شب</p>
      </div>
    </div>
  )
}

const memberName = (id) => id?.startsWith('f:') ? id.slice(2) : MEMBERS.find((m) => m.id === id)?.name || 'بازیکن'

export function NextTicket({ b, onClick }) {
  const c = courtById(b.court)
  const mins = Math.round((fromKey(b.date).getTime() + b.start * 36e5 - Date.now()) / 6e4)
  const left = mins < 60 ? `${fa(Math.max(0, mins))} دقیقه دیگه` : mins < 1440 ? `${fa(Math.floor(mins / 60))} ساعت دیگه` : `${fa(Math.floor(mins / 1440))} روز دیگه`
  return (
    <motion.button className="ticket" whileTap={{ scale: 0.98 }} onClick={onClick} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Photo src={c.img} />
      <div className="ticket-shade" />
      <div className="ticket-main">
        <span className="pill-q">{left}</span>
        <h3>{dayLabel(b.date)}، {range(b.start, b.dur)}</h3>
        <p>{c.name}، {b.type === 'open' ? `بازی باز ${fa(b.players.length)}/۴` : b.type === 'coach' ? 'کلاس مربی' : 'رزرو خصوصی'}</p>
      </div>
      <div className="ticket-cut" />
      <div className="ticket-side"><b>{fa(c.id)}</b><small>زمین</small></div>
    </motion.button>
  )
}

// نقشه‌ی ساده‌ی زمین پدل از بالا
function CourtGlyph({ n }) {
  return (
    <svg className="ct-glyph" viewBox="0 0 40 64" aria-hidden="true">
      <rect x="2" y="2" width="36" height="60" rx="4" />
      <line x1="2" y1="32" x2="38" y2="32" className="net" />
      <line x1="2" y1="12" x2="38" y2="12" /><line x1="2" y1="52" x2="38" y2="52" />
      <line x1="20" y1="12" x2="20" y2="52" />
      <text x="20" y="25" textAnchor="middle">{fa(n)}</text>
    </svg>
  )
}

function Quest({ q }) {
  const { claimQuest, toast } = useStore()
  const p = Math.min(1, q.have / q.goal)
  const [busy, setBusy] = useState(false)
  const claim = async () => {
    if (busy) return
    setBusy(true)
    const r = await claimQuest(q.id)
    setBusy(false)
    if (r.error) { if (!r.shown) toast({ icon: '⛔', title: r.error === 'done' ? 'این جایزه را قبلاً گرفته‌اید' : 'هنوز شرط چالش کامل نشده' }); return }
    celebrate(); chime('level')
    toast({ icon: '🎁', title: `+${fa(r.xp)} XP`, body: q.name })
  }
  return (
    <div className={`quest ${q.claimed ? 'done' : ''}`}>
      <span className="quest-ic">{q.icon}</span>
      <div className="grow">
        <b>{q.name}</b>
        <small className="quest-desc">{q.desc}</small>
        <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ duration: 0.9 }} /></div>
      </div>
      {q.ready ? (
        <motion.button className="claim" onClick={claim} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>دریافت +{fa(q.xp)}</motion.button>
      ) : (
        <span className="quest-xp">{q.claimed ? '✓' : `${fa(Math.min(q.have, q.goal))}/${fa(q.goal)}`}</span>
      )}
    </div>
  )
}

export function leaderboard(points, name) {
  // خود کاربر در فهرست اعضای سرور هم هست؛ یک بار و با امتیاز زنده‌اش می‌آید
  return [...MEMBERS.filter((m) => m.id !== ME && !m.inactive).map((m) => ({ id: m.id, name: m.name, level: m.level, points: m.points, games: m.games })), { id: 'me', name, me: true, points }]
    .sort((a, b) => b.points - a.points)
}

function MiniBoard({ points, name, onClick }) {
  const list = leaderboard(points, name)
  const pos = list.findIndex((x) => x.me) + 1
  return (
    <motion.button className="mini-board" onClick={onClick} whileTap={{ scale: 0.98 }}>
      {list.slice(0, 3).map((p, i) => (
        <div key={p.id} className={`mb-row r${i + 1}`}>
          <span className="mb-n">{['🥇', '🥈', '🥉'][i]}</span>
          <Avatar name={p.name} size={32} />
          <b>{p.name}</b>
          <em>{fa(p.points)}</em>
        </div>
      ))}
      <div className="mb-row me">
        <span className="mb-n">#{fa(pos)}</span>
        <Avatar name={name} size={32} me />
        <b>شما</b>
        <em>{fa(points)}</em>
      </div>
    </motion.button>
  )
}

// جلسه‌ی مربی که مربی پرداختش را به من سپرده: با کیف پول یا کارت بانکی پرداخت می‌شود
function CoachDue() {
  const { club, wallet, config, payBooking, toast } = useStore()
  const due = club.bookings.filter((b) => b.payBy === ME && b.type === 'coach' && b.status !== 'cancelled' && b.paid < b.price)
    .sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
  const total = due.reduce((s, b) => s + b.price - b.paid, 0)
  const payOn = !!config?.pay
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!due.length) return null
  const method = pick || (wallet >= total || !payOn ? 'wallet' : 'online')
  const can = method === 'wallet' ? wallet >= total : payOn
  const coach = coachById(due[0].coach)
  const pay = async () => {
    if (busy || !can) return
    setBusy(true)
    const r = await payBooking(due.map((b) => b.id), method)
    setBusy(false)
    if (r?.error) { chime('alarm'); if (!r.shown) toast({ icon: '⛔', title: 'پرداخت انجام نشد', body: r.error === 'wallet' ? 'موجودی کیف پول کافی نیست.' : 'دوباره تلاش کنید.' }); return }
    celebrate(); chime('success'); setOpen(false)
    toast({ icon: '✅', title: 'جلسه پرداخت شد', body: `${fa(due.length)} جلسه با ${coach?.name || 'مربی'}` })
  }
  return (
    <>
      <motion.button className="due-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => setOpen(true)}>
        <span className="due-ic">💳</span>
        <span className="grow"><b>پرداخت {fa(due.length)} جلسه‌ی مربی</b><small>{coach?.name || 'مربی'} هزینه‌ی جلسه را برای شما فرستاده</small></span>
        <em>{toman(total)}</em>
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} title="پرداخت جلسه‌ی مربی">
        <div className="due-list">
          {due.map((b) => (
            <div key={b.id} className="due-row"><span className="grow"><b>{weekday(fromKey(b.date))} {dayMonth(fromKey(b.date))}، <bdi dir="ltr">{range(b.start, b.dur)}</bdi></b><small>{courtById(b.court).name}، {coachById(b.coach)?.name || 'مربی'}</small></span><em>{toman(b.price - b.paid)}</em></div>
          ))}
        </div>
        <div className="methods">
          {[['wallet', 'کیف پول', toman(wallet), 'wallet', wallet >= total], ['online', 'کارت بانکی', 'درگاه شتاب', 'card', payOn]].map(([id, n, sub, ic, ok]) => (
            <button key={id} disabled={!ok} className={`method ${method === id ? 'on' : ''}`} onClick={() => setPick(id)}><Icon name={ic} /><div className="grow"><b>{n}</b><small>{ok ? sub : id === 'online' ? 'پرداخت آنلاین به‌زودی فعال می‌شود' : 'موجودی کافی نیست'}</small></div><span className={`radio ${method === id ? 'on' : ''}`} /></button>
          ))}
        </div>
        <Button full variant="q" disabled={busy || !can} onClick={pay}>{busy ? 'در حال پرداخت…' : `پرداخت ${toman(total)}`}</Button>
      </Sheet>
    </>
  )
}
