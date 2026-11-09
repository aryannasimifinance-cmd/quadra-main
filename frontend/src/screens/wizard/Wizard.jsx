import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  BADGES, COACHES, COACH_PACKS, COURTS, DAYPARTS, DURATIONS, EVENT_KIND, LEVELS, MEMBERS, SERIES, coachById, coachPackPrice, coachPacks, courtById, dayKey, dayLabel, dayMonth, dayNum,
  SIDES, limitsOf, coachesRanked, fa, fromKey, hourLabel, isPeak, isWeekend, levelById, levelIndex, nearLevels, nextDays, priceFor, range, short, sideById, toman, weekday, memberById,
} from '../../data'
import { celebrate, chime, haptic } from '../../fx'
import { playerRun, ME, freeStarts, isFree, memberOff, useStore } from '../../store'
import { openGames, planSeries } from '../../select'
import { appEvents, levelOk, whyNot, whyText, audienceText, AUDIENCE, GENDER } from '../../events'
import { Avatar, Button, Chips, CountUp, CtaBar, Icon, LevelPill, Photo, Sheet, TopBar, rise, stagger } from '../../components/ui'
import { Loading } from '../../components/Logo'

const FLOWS = {
  court: ['intent', 'when', 'slot', 'people', 'pay'],
  match: ['intent', 'when', 'games', 'pay'],
  coach: ['intent', 'coach', 'when', 'slot', 'pay'],
  event: ['intent', 'event', 'partner', 'pay'],
  friday: ['intent', 'event', 'partner', 'pay'],
  official: ['intent', 'event', 'partner', 'pay'],
}
const EVENT_INTENTS = ['event', 'friday', 'official']
const TITLES = { intent: 'درخواست شما', when: 'کِی؟', slot: 'زمین و ساعت', people: 'بازیکن‌ها', games: 'بازی‌های باز', coach: 'مربی و پکیج', event: 'مسابقه‌ها', partner: 'یار شما', pay: 'پرداخت' }
// عکس‌ها فقط زمین و وسایل، بدون آدم
const INTENTS = [
  { id: 'court', name: 'رزرو زمین', desc: 'تک جلسه یا پکیج ۵ و ۱۰ جلسه؛ جای خالی رو با هم‌سطح پر می‌کنیم', img: './img/court-pano.jpg', xp: 50, icon: '🎾' },
  { id: 'match', name: 'ساخت مچ', desc: 'یار ندارید؟ به بازی باز هم‌سطحتون بپیوندید', img: './img/court-indoor.jpg', xp: 40, icon: '⚡' },
  { id: 'coach', name: 'پدل با مربی', desc: 'تک جلسه یا پکیج ۵ و ۱۰ جلسه', img: './img/welcome.jpg', xp: 40, icon: '🧢' },
  { id: 'friday', name: 'مسابقات آدینه', desc: 'دوستانه، تیم دونفره', img: './img/welcome-courts.jpg', xp: 60, icon: '☀️' },
  { id: 'official', name: 'ایونت‌های ویبورا', desc: 'دورهمی ورزشی، همان روال آدینه', img: './img/vibora.jpg', xp: 60, icon: '🎉' },
]

export default function Wizard({ preset = {}, onClose, onDone, onStep }) {
  const { user } = useStore()
  const [w, setW] = useState(() => ({
    intent: preset.intent || null, date: preset.date || dayKey(new Date()), daypart: 'any', dur: preset.dur || 1, series: preset.series || 'single', court: preset.court || null, start: preset.start ?? null,
    players: [{ id: ME, name: user.name, level: user.level, me: true }, null, null, null],
    missing: preset.series && preset.series !== 'single' ? 0 : 1, open: !(preset.series && preset.series !== 'single'), wantSide: 'any', visibility: 'public', invited: [], levels: nearLevels(user.level, 1), gameId: preset.gameId || null, coachId: preset.coachId || null, pack: 'one', eventId: preset.eventId || null,
  }))
  const set = (p) => setW((x) => ({ ...x, ...p }))
  const flow = FLOWS[w.intent || 'court']
  const startAt = preset.gameId ? flow.indexOf('pay') : preset.start != null ? flow.indexOf('people') : preset.intent === 'coach' && preset.coachId ? 1 : preset.intent ? 1 : 0
  const [i, setI] = useState(startAt)
  const [dir, setDir] = useState(1)
  const [done, setDone] = useState(null)
  const step = flow[i]
  useEffect(() => { onStep?.(done ? 'done' : step) }, [step, done])

  const scrollTop = () => document.querySelector('.app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  const next = () => { haptic(10); setDir(1); setI((x) => Math.min(x + 1, flow.length - 1)); scrollTop() }
  const goStep = (name, intent) => { setDir(1); setI(FLOWS[intent || w.intent].indexOf(name)); scrollTop() }
  const back = () => { setDir(-1); if (i === 0 || i <= startAt) onClose(); else setI((x) => x - 1); scrollTop() }

  if (done) return <Success r={done} w={w} onHome={() => onDone('home')} onGames={() => onDone('games')} />

  return (
    <div className={`wizard ${step === 'intent' ? 'fit' : ''}`}>
      <TopBar onBack={i > 0 ? back : null} title={TITLES[step]} step={i} total={flow.length} />
      {i > 0 && <Crumbs w={w} step={step} />}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} className={`wz-body ${step === 'intent' ? 'fit' : ''}`} custom={dir}
          variants={{ in: (d) => ({ x: d * -36, opacity: 0 }), on: { x: 0, opacity: 1 }, out: (d) => ({ x: d * 36, opacity: 0 }) }}
          initial="in" animate="on" exit="out" transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}>
          {step === 'intent' && <StepIntent onPick={(intent) => { set({ intent, start: null, gameId: null, eventId: null, dur: 1 }); setDir(1); setI(1); scrollTop() }} />}
          {step === 'when' && <StepWhen w={w} set={set} onNext={next} />}
          {step === 'slot' && <StepSlot w={w} set={set} onNext={next} />}
          {step === 'people' && <StepPeople w={w} set={set} onNext={next} />}
          {step === 'games' && <StepGames w={w} set={set} onNext={next} onCreate={() => { set({ intent: 'court', open: true, missing: 1 }); goStep('slot', 'court') }} />}
          {step === 'coach' && <StepCoach w={w} set={set} onNext={next} />}
          {step === 'event' && <StepEvent w={w} set={set} onNext={next} />}
          {step === 'partner' && <StepPartner w={w} set={set} onNext={next} />}
          {step === 'pay' && <StepPay w={w} set={set} onDone={setDone} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Crumbs({ w, step }) {
  const bits = [INTENTS.find((x) => x.id === w.intent)?.name]
  if (!EVENT_INTENTS.includes(w.intent) && !['when', 'coach'].includes(step)) bits.push(`${dayLabel(w.date)} ${dayNum(fromKey(w.date))}`)
  if (w.start != null && ['people', 'pay'].includes(step)) bits.push(`${courtById(w.court).name}، ${hourLabel(w.start)}`)
  if (w.coachId && step !== 'coach') bits.push(coachById(w.coachId).name)
  return (
    <div className="crumbs">
      {bits.filter(Boolean).map((t, k) => (
        <motion.span key={t} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: k * 0.05 }} className={k === 0 ? 'dot' : ''}>{t}</motion.span>
      ))}
    </div>
  )
}

function StepIntent({ onPick }) {
  const { user } = useStore()
  // چیدمان ثابت هم‌اندازه‌ی صفحه (CSS)؛ صفحه اسکرول نمی‌خورد و کارت‌ها زیر نوار پایین نمی‌روند
  return (
    <>
      <motion.p className="wz-hello" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>خوش اومدین <b>{user.name.split(' ')[0]} جان</b> 👋</motion.p>
      <h2 className="wz-h">درخواست شما <small>زیر یک دقیقه درخواست شما ثبت و انجام می‌شود</small></h2>
      <motion.div className="intent-list" variants={stagger} initial="hidden" animate="show">
        {INTENTS.map((t, k) => (
          <motion.button key={t.id} variants={rise} className={`intent-card ${k === 0 ? 'big' : ''}`} whileTap={{ scale: 0.97 }} onClick={() => { haptic(10); onPick(t.id) }}>
            <Photo src={t.img} />
            <div className="intent-shade" />
            <span className="intent-ic">{t.icon}</span>
            <div className="intent-txt"><b>{t.name}</b><p>{t.desc}</p></div>
            <span className="intent-xp">+{fa(t.xp)} XP</span>
          </motion.button>
        ))}
      </motion.div>
    </>
  )
}

function DayPicker({ value, onChange }) {
  const days = useMemo(() => {
    const d = nextDays(14)
    return d.some((x) => dayKey(x) === value) ? d : [fromKey(value), ...d]
  }, [value])
  return (
    <div className="days">
      {days.map((d) => {
        const k = dayKey(d), on = value === k
        return (
          <motion.button key={k} className={`day ${on ? 'on' : ''} ${d.getDay() === 4 || d.getDay() === 5 ? 'we' : ''}`} whileTap={{ scale: 0.9 }} onClick={() => { haptic(6); onChange(k) }}>
            {on && <motion.span layoutId="day-bg" className="day-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <small>{dayLabel(d)}</small>
            <b>{dayNum(d)}</b>
          </motion.button>
        )
      })}
    </div>
  )
}

// مراحل رزرو زمین — توضیح ساده‌ی فرایند
function Process() {
  const steps = [['روز و ساعت', 'یک یا چند ساعت پشت هم'], ['زمین', 'از بین ۴ زمین'], ['یارها', 'از اعضا یا با لینک دعوت'], ['پرداخت', 'کل مبلغ یا سهم خودتان']]
  return (
    <div className="process">
      {steps.map(([t, d], i) => (
        <div key={t} className={`pr-step ${i === 0 ? 'on' : ''}`}><span>{fa(i + 1)}</span><b>{t}</b><small>{d}</small></div>
      ))}
    </div>
  )
}

// تقویم ماه (شمسی) برای دیدن هفته‌ی بعد و ماه‌های پیش رو
const pMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' })
const pDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' })
function MonthCal({ value, onPick }) {
  const { club } = useStore()
  // یک بار ساعت‌های پر را جمع می‌کنیم تا تقویم سبک بماند
  const full = useMemo(() => {
    const busy = new Map()
    club.bookings.forEach((b) => {
      if (b.status === 'cancelled') return
      for (let h = Math.floor(b.start); h < b.start + b.dur; h++) busy.set(`${b.date}|${b.court}|${h}`, 1)
    })
    return (k) => !COURTS.some((c) => !club.off[c.id] && Array.from({ length: 17 }, (_, i) => 7 + i).some((h) => !busy.has(`${k}|${c.id}|${h}`)))
  }, [club])
  const groups = []
  nextDays(62).forEach((d) => {
    const m = pMonth.format(d)
    if (!groups.length || groups[groups.length - 1].m !== m) groups.push({ m, days: [] })
    groups[groups.length - 1].days.push(d)
  })
  return (
    <div className="mcal">
      {groups.map((g) => (
        <div key={g.m}>
          <p className="mcal-m">{g.m}</p>
          <div className="mcal-grid">
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((x) => <small key={x}>{x}</small>)}
            {Array.from({ length: (g.days[0].getDay() + 1) % 7 }, (_, i) => <span key={'b' + i} />)}
            {g.days.map((d) => {
              const k = dayKey(d), isFull = full(k)
              return (
                <button key={k} disabled={isFull} className={`${value === k ? 'on' : ''} ${isFull ? 'full' : ''} ${isWeekend(d) ? 'we' : ''}`} onClick={() => { haptic(6); onPick(k) }}>
                  {pDay.format(d)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="mcal-note">روزهای کم‌رنگ پر هستند، پنجشنبه و جمعه رنگی</p>
    </div>
  )
}

function StepWhen({ w, set, onNext }) {
  const { club, user } = useStore()
  const [cal, setCal] = useState(false)
  const dp = DAYPARTS.find((d) => d.id === w.daypart)
  const count = useMemo(() => {
    if (w.intent === 'match') return openGames(club, user.level, { date: w.date }).filter((g) => !g.mine && g.start >= dp.from && g.start < dp.to).length
    return COURTS.reduce((n, c) => n + freeStarts(club, w.date, c.id, 1, dp.from, dp.to).length, 0)
  }, [w.date, w.daypart, w.intent, club])
  return (
    <div className="when">
      {w.intent === 'court' && <Process />}
      <section>
        <div className="label-row">
          <p className="label">روز</p>
          <button className="cal-btn" onClick={() => { haptic(6); setCal(true) }}><Icon name="cal" size={16} /> تقویم هفته‌ی بعد و ماه</button>
        </div>
        <DayPicker value={w.date} onChange={(date) => set({ date, start: null })} />
      </section>
      <section><p className="label">چه ساعتی؟</p>
        <Chips id="dp" options={DAYPARTS.map((d) => ({ id: d.id, name: d.name }))} value={w.daypart} onChange={(daypart) => set({ daypart, start: null })} />
      </section>
      {w.intent !== 'court' && <p className="hint">{w.intent === 'match' ? '⚡ بازی‌هایی که نزدیک به سطح شما هستند اول نمایش داده می‌شوند.' : '🧢 جلسه‌ی مربی ۶۰ دقیقه است.'}</p>}
      <CtaBar>
        <Button full variant="dark" disabled={!count && w.intent !== 'match'} onClick={onNext}>
          {w.intent === 'match'
            ? (count ? <>نمایش <CountUp key={count} to={count} duration={0.5} /> بازی باز</> : 'بازی بازی نیست — خودم می‌سازم')
            : count ? <><CountUp key={count} to={count} duration={0.5} /> ساعت آزاد روی ۴ زمین</> : 'در این بازه ساعت آزاد نیست'}
        </Button>
      </CtaBar>
      <Sheet open={cal} onClose={() => setCal(false)} title="انتخاب روز">
        <MonthCal value={w.date} onPick={(date) => { set({ date, start: null }); setCal(false) }} />
      </Sheet>
    </div>
  )
}

// ماتریس ساعت × ۴ زمین — چند ساعت پشت هم روی یک زمین قابل انتخاب است
function StepSlot({ w, set, onNext }) {
  const { club, toast } = useStore()
  const dp = DAYPARTS.find((d) => d.id === w.daypart)
  const isCoach = w.intent === 'coach'
  const now = new Date(), today = w.date === dayKey(now), nowH = now.getHours() + now.getMinutes() / 60
  const coachBusy = (h) => isCoach && club.bookings.some((b) => b.coach === w.coachId && b.date === w.date && b.status !== 'cancelled' && h < b.start + b.dur && b.start < h + 1)
  const free = (c, h) => isFree(club, w.date, c, h, 1) && !coachBusy(h)
  const inSel = (c, h) => w.start != null && w.court === c && h >= w.start && h < w.start + w.dur
  const hours = []
  for (let h = dp.from; h < Math.min(dp.to, 24); h++) if (!today || h > nowH) hours.push(h)
  const rows = hours.filter((h) => COURTS.some((c) => free(c.id, h) || inSel(c.id, h)))
  const showPeak = club.pricing.peak !== club.pricing.offpeak
  const maxRun = limitsOf(club).playerRun

  const tap = (c, h) => {
    haptic(8)
    const runWarn = () => toast({ icon: '⏱', title: `حداکثر ${fa(maxRun)} ساعت پشت هم`, body: 'با رزروهای قبلی خودتان در همین روز' })
    const fresh = () => (!isCoach && playerRun(club, w.date, h, 1) > maxRun ? runWarn() : set({ court: c, start: h, dur: 1 }))
    if (isCoach || w.start == null || w.court !== c) return fresh()
    const s0 = w.start, e0 = w.start + w.dur
    if (h >= s0 && h < e0) { // روی انتخاب زدن = برداشتن همان ساعت
      if (w.dur === 1) return set({ start: null })
      if (h === s0) return set({ start: s0 + 1, dur: w.dur - 1 })
      if (h === e0 - 1) return set({ dur: w.dur - 1 })
      return set({ dur: h - s0 })
    }
    if (h === e0 || h === s0 - 1) {
      if (w.dur >= maxRun) { toast({ icon: '⏱', title: `حداکثر ${fa(maxRun)} ساعت پشت هم` }); return }
      if (playerRun(club, w.date, Math.min(h, s0), w.dur + 1) > maxRun) return runWarn()
      return h === e0 ? set({ dur: w.dur + 1 }) : set({ start: h, dur: w.dur + 1 })
    }
    fresh()
  }
  const total = w.start != null ? (isCoach ? coachById(w.coachId).price : priceFor(w.date, w.start, w.dur, club.pricing)) : 0

  return (
    <div className="slot">
      <p className="slot-help">{isCoach ? 'یک ساعت آزاد را انتخاب کنید.' : `روی یک ساعت بزنید. برای بیشتر، ساعت قبل یا بعدش را هم بزنید (تا ${fa(maxRun)} ساعت). با زدن دوباره، آن ساعت برداشته می‌شود.`}</p>
      <div className="slot-courts">
        <span />
        {COURTS.map((c) => (
          <div key={c.id} className={`sc-head ${w.court === c.id && w.start != null ? 'on' : ''} ${club.off[c.id] ? 'off' : ''}`}>
            <img src={c.img} alt="" loading="lazy" /><b>{fa(c.id)}</b><small>زمین</small>
          </div>
        ))}
      </div>
      <div className="slot-grid">
        {rows.length === 0 && <div className="empty-card">در این بازه ساعت آزاد نیست؛ روز یا ساعت دیگری انتخاب کنید.</div>}
        {rows.map((h) => (
          <div key={h} className="slot-row">
            <span className={`slot-t ${showPeak && isPeak(w.date, h, club.pricing) ? 'peak' : ''}`}>{hourLabel(h)}</span>
            {COURTS.map((c) => {
              const sel = inSel(c.id, h)
              const ok = sel || free(c.id, h)
              const cls = sel ? `sel ${inSel(c.id, h - 1) ? 'jt' : ''} ${inSel(c.id, h + 1) ? 'jb' : ''}` : ok ? 'free' : 'busy'
              return (
                <button key={c.id} className={`cell ${cls}`} disabled={!ok} onClick={() => tap(c.id, h)}>
                  {sel ? <Icon name="check" size={16} stroke={3} /> : ok ? <span>{fa(isCoach ? coachById(w.coachId).price : priceFor(w.date, h, 1, club.pricing))}</span> : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="slot-legend"><i className="lg free" /> آزاد، {isCoach ? 'قیمت جلسه (تومان)' : 'قیمت هر ساعت زمین (تومان)'} <i className="lg sel" /> انتخاب شما <i className="lg busy" /> رزرو شده{showPeak && <> <i className="lg peak" /> پیک</>}</p>
      <AnimatePresence>
        {w.start != null && (
          <motion.div className="sel-sum" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grow"><b>{courtById(w.court).name}، {range(w.start, w.dur)}</b><small>{fa(w.dur)} ساعت{!isCoach && `، هر نفر ${toman(total / 4)}`}</small></div>
            <em>{toman(total)}</em>
          </motion.div>
        )}
      </AnimatePresence>
      <CtaBar>
        <Button full variant="dark" disabled={w.start == null} onClick={onNext}>
          {w.start == null ? 'یک ساعت آزاد انتخاب کنید' : <>ادامه، {fa(w.dur)} ساعت روی {courtById(w.court).name}</>}
        </Button>
      </CtaBar>
    </div>
  )
}

// یارها: تیم کامل، یک یار کم یا دو یار کم
const TEAM = [{ id: 0, name: 'تیم کامله', sub: '۴ نفریم' }, { id: 1, name: '۱ یار کم', sub: '۳ نفریم' }, { id: 2, name: '۲ یار کم', sub: '۲ نفریم' }]
function StepPeople({ w, set, onNext }) {
  const [edit, setEdit] = useState(null)
  const need = 3 - w.missing // تعداد یارهایی که خودشان اضافه می‌کنند
  const added = w.players.slice(1, need + 1).filter(Boolean).length
  const ready = added === need
  const put = (k, p) => { const n = [...w.players]; n[k] = p; set({ players: n }); haptic(12) }
  const setMissing = (m) => {
    const n = w.players.map((p, k) => (k === 0 || k <= 3 - m ? p : null))
    set({ missing: m, open: m > 0, players: n }); haptic(8)
  }
  const toggleLevel = (id) => {
    const has = w.levels.includes(id)
    if (has && w.levels.length === 1) return
    set({ levels: has ? w.levels.filter((x) => x !== id) : [...w.levels, id].sort((a, b) => levelIndex(a) - levelIndex(b)) })
  }
  const reach = MEMBERS.filter((m) => w.levels.includes(m.level) && (w.wantSide === 'any' || m.side === w.wantSide || m.side === 'both')).length * 6 + 8
  return (
    <div className="people">
      <h2 className="wz-h">چند نفرید؟</h2>
      <div className="team-pick">
        {TEAM.map((t) => (
          <button key={t.id} className={`team-opt ${w.missing === t.id ? 'on' : ''}`} onClick={() => setMissing(t.id)}>
            <span className="team-dots">{[0, 1, 2, 3].map((k) => <i key={k} className={k < 4 - t.id ? 'f' : ''} />)}</span>
            <b>{t.name}</b><small>{t.sub}</small>
          </button>
        ))}
      </div>
      <div className="court-viz">
        <div className="cv-net" /><div className="cv-line a" /><div className="cv-line b" /><div className="cv-mid" />
        {[0, 1, 2, 3].map((k) => {
          const p = w.players[k]
          const searching = k > need
          return (
            <div key={k} className={`cv-spot s${k}`}>
              {p ? (
                <div className="spot-p" onClick={() => k > 0 && put(k, null)}>
                  <Avatar name={p.name} size={50} me={p.me} />
                  <span>{p.me ? 'شما' : p.name.split(' ')[0]}</span>
                  {p.level ? <LevelPill id={p.level} /> : <em className="inv">مهمان</em>}
                </div>
              ) : searching ? (
                <div className="spot-p"><div className="spot-search"><Icon name="radar" size={22} /></div><span>در جستجو…</span></div>
              ) : (
                <div className="spot-p"><Avatar empty size={50} onClick={() => setEdit(k)} /><span>افزودن یار</span></div>
              )}
            </div>
          )
        })}
      </div>
      <p className="label">چه کسی این بازی را ببیند؟</p>
      <div className="vis-pick">
        {[['public', 'عمومی', 'همه‌ی اعضا در «بازی‌های باز» می‌بینند'], ['private', 'خصوصی', 'فقط یارها و دعوت‌شده‌ها می‌بینند']].map(([id, n, d]) => (
          <button key={id} className={`vis-opt ${w.visibility === id ? 'on' : ''}`} onClick={() => { haptic(6); set({ visibility: id }) }}>
            <Icon name={id === 'public' ? 'users' : 'lock'} size={18} /><div><b>{n}</b><small>{d}</small></div>
          </button>
        ))}
      </div>
      {w.missing > 0 && w.visibility === 'private' && (
        <div className="mm on">
          <div className="mm-head"><div className="mm-ic"><Icon name="lock" /></div>
            <div className="grow"><b>{fa(w.missing)} جای خالی با دعوت پر می‌شود</b><small>این بازی در لیست عمومی نمی‌آید؛ اعضایی را که می‌خواهید دعوت کنید</small></div></div>
          <div className="mm-body">
            <div className="inv-chips">
              {w.invited.map((id) => (
                <span key={id}>{MEMBERS.find((m) => m.id === id)?.name}<button onClick={() => set({ invited: w.invited.filter((x) => x !== id) })} aria-label="حذف">×</button></span>
              ))}
              <button className="inv-add" onClick={() => setEdit('invite')}><Icon name="plus" size={14} /> دعوت عضو</button>
            </div>
          </div>
        </div>
      )}
      {w.missing > 0 && w.visibility === 'public' && (
        <div className="mm on">
          <div className="mm-head"><div className="mm-ic"><Icon name="radar" /></div>
            <div className="grow"><b>برای {fa(w.missing)} جای خالی دنبال یار می‌گردیم</b><small>به اعضای هم‌سطح اعلان می‌دهیم</small></div></div>
          <div className="mm-body">
            <p className="label">چه سطح‌هایی؟</p>
            <div className="lv-pick">
              {LEVELS.map((l) => (
                <button key={l.id} className={w.levels.includes(l.id) ? 'on' : ''} style={{ '--c': l.color }} onClick={() => { haptic(6); toggleLevel(l.id) }}>{l.id}</button>
              ))}
            </div>
            <p className="label">کدام سمت زمین؟</p>
            <Chips id="ws" small value={w.wantSide} onChange={(wantSide) => set({ wantSide })} options={[{ id: 'any', name: 'فرقی نمی‌کند' }, ...SIDES.slice(0, 2).map((x) => ({ id: x.id, name: x.name }))]} />
            <div className="reach"><span className="reach-n">{fa(reach)}</span><span>عضو کوادرا اعلان می‌گیرند</span></div>
          </div>
        </div>
      )}
      <CtaBar>
        <Button full variant="dark" disabled={!ready} onClick={onNext}>
          {ready ? (w.missing ? 'ثبت بازی و پرداخت سهم' : 'تیم کامله! پرداخت') : `${fa(need - added)} یار دیگر اضافه کنید`}
        </Button>
      </CtaBar>
      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit === 'invite' ? 'دعوت به بازی خصوصی' : 'افزودن یار'} tall>
        {edit === 'invite'
          ? <AddPlayer noPhone exclude={[...w.players.filter(Boolean).map((p) => p.id), ...w.invited]} onAdd={(p) => { set({ invited: [...w.invited, p.id] }); setEdit(null) }} />
          : edit !== null && <AddPlayer exclude={w.players.filter(Boolean).map((p) => p.id)} onAdd={(p) => { put(edit, p); setEdit(null) }} />}
      </Sheet>
    </div>
  )
}

function AddPlayer({ onAdd, exclude, noPhone, levels, allow }) {
  const { toast } = useStore()
  const [tab, setTab] = useState('member')
  const [q, setQ] = useState('')
  const [side, setSide] = useState('all')
  const [gName, setGName] = useState('')
  const [invite, setInvite] = useState(false)
  const [phone, setPhone] = useState('')
  const list = MEMBERS.filter((m) => !m.inactive && !exclude.includes(m.id) && (!levels || levels.includes(m.level)) && (!allow || allow(m)) && (!q || m.name.includes(q.trim())) && (side === 'all' || m.side === side || m.side === 'both')).slice(0, 40)
  const digits = phone.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '')
  const okPhone = /^09\d{9}$/.test(digits)
  const faD = (x) => x.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
  const okGuest = gName.trim().length >= 2 && (!invite || okPhone)
  const addGuest = () => {
    const name = gName.trim()
    if (invite) {
      const link = `${location.origin}${location.pathname}?invite=${digits.slice(-4)}`
      const text = `${name} عزیز، به کوادرا بپیوندید و با هم پدل بازی کنیم: ${link}`
      if (navigator.share) navigator.share({ title: 'QUADRA', text }).catch(() => {})
      toast({ icon: '✉️', title: 'لینک عضویت فرستاده شد', body: `${name}، ${faD(digits)}` })
    }
    onAdd({ id: 'f:' + name, name, level: null, guest: true })
  }
  return (
    <div className="add-p">
      {!noPhone && (
        <div className="seg">
          {[['member', 'از اعضای کوادرا'], ['guest', 'مهمان (عضو نیست)']].map(([id, n]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { haptic(6); setTab(id) }}>
              {tab === id && <motion.span layoutId="seg-add" className="seg-bg" />}<span>{n}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'member' ? (
        <>
          <label className="search"><Icon name="search" size={18} /><input placeholder="جستجوی اعضا" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <Chips id="sd" small value={side} onChange={setSide} options={[{ id: 'all', name: 'همه' }, { id: 'right', name: 'سمت راست' }, { id: 'left', name: 'سمت چپ' }]} />
          <div className="member-list">
            {levels && <p className="muted small">فقط اعضایی که شرایط این رویداد را دارند نشان داده می‌شوند (سطح {levels.join(' / ')}).</p>}
            {list.length === 0 && <p className="muted">عضوی با این مشخصات پیدا نشد.</p>}
            {list.map((m) => (
              <button key={m.id} className="member-row" onClick={() => onAdd({ id: m.id, name: m.name, level: m.level, gender: m.gender, birth: m.birth })}>
                <Avatar name={m.name} size={36} />
                <div className="grow"><b>{m.name}</b><small>{sideById(m.side).name}</small></div>
                <LevelPill id={m.level} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="guest">
          <p className="muted">فقط اسمش کافی است.</p>
          <label className="field"><Icon name="user" /><input autoFocus placeholder="نام مهمان" value={gName} onChange={(e) => setGName(e.target.value)} /></label>
          <button className={`tgl ${invite ? 'on' : ''}`} onClick={() => setInvite(!invite)}>
            <span>لینک عضویت در کوادرا هم برایش فرستاده شود</span><i className={`switch ${invite ? 'on' : ''}`}><motion.i layout /></i>
          </button>
          {invite && <label className="field"><Icon name="phone" /><input inputMode="numeric" dir="ltr" placeholder="0912 345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>}
          <Button full variant="dark" disabled={!okGuest} onClick={addGuest}>{invite ? 'افزودن مهمان و ارسال لینک' : 'افزودن مهمان'}</Button>
        </div>
      )}
    </div>
  )
}

function StepGames({ w, set, onNext, onCreate }) {
  const { club, user } = useStore()
  const dp = DAYPARTS.find((d) => d.id === w.daypart)
  const list = openGames(club, user.level, { date: w.date }).filter((g) => !g.mine && g.start >= dp.from && g.start < dp.to)
  return (
    <div className="games-pick">
      <h2 className="wz-h">به یکی بپیوندید <small>مرتب‌شده بر اساس نزدیکی به سطح {user.level}</small></h2>
      <motion.div variants={stagger} initial="hidden" animate="show" className="og-list">
        {list.map((g) => <motion.div key={g.id} variants={rise}><GameCard g={g} on={w.gameId === g.id} onClick={() => { haptic(8); set({ gameId: g.id }) }} /></motion.div>)}
        <motion.button variants={rise} className="create-card" whileTap={{ scale: 0.97 }} onClick={onCreate}>
          <Icon name="plus" size={26} /><div><b>خودم یه بازی باز می‌سازم</b><small>زمین رو انتخاب کنید، بقیه رو ما پیدا می‌کنیم</small></div>
        </motion.button>
      </motion.div>
      <CtaBar>
        <Button full variant="dark" disabled={!w.gameId} onClick={onNext}>{w.gameId ? 'پیوستن و پرداخت سهم' : 'یک بازی انتخاب کنید'}</Button>
      </CtaBar>
    </div>
  )
}

// نام بازیکن برای کارت‌ها: عضو، مهمان (f:نام) یا خود کاربر
const playerName = (id) => id === ME ? 'شما' : id?.startsWith('f:') ? id.slice(2) : MEMBERS.find((m) => m.id === id)?.name || 'بازیکن'

export function GameCard({ g, on, onClick }) {
  const c = courtById(g.court)
  const others = g.players.filter((p) => p !== g.by)
  return (
    <motion.button className={`og-wide ${on ? 'on' : ''}`} whileTap={{ scale: 0.98 }} onClick={onClick}>
      <Photo src={c.img} />
      <div className="og-wide-body">
        <div className="og-top">
          <span className={`og-fit ${g.gap === 0 ? 'hot' : ''}`}>{g.gap === 0 ? 'دقیقاً هم‌سطح' : g.gap === 1 ? 'نزدیک' : `${fa(g.gap)} سطح فاصله`}</span>
          <small>{c.name}، {c.kind}</small>
        </div>
        <b>{dayLabel(g.date)}، {range(g.start, g.dur)}</b>
        <div className="og-names">
          <span>سازنده: <b>{playerName(g.by)}</b></span>
          {others.length > 0 && <span>بازیکن‌ها: {others.map((p) => playerName(p).split(' ')[0]).join('، ')}</span>}
        </div>
        <div className="og-ppl">
          {[0, 1, 2, 3].map((k) => g.players[k] ? <Avatar key={k} name={playerName(g.players[k])} size={28} /> : <span key={k} className="og-empty" />)}
          <div className="og-levels">{g.levels.map((l) => <LevelPill key={l} id={l} />)}</div>
        </div>
        <div className="og-foot"><span>{fa(4 - g.players.length)} جای خالی</span><b>{toman((g.full ?? g.price) / 4)}</b></div>
      </div>
      {on && <motion.span className="tick" initial={{ scale: 0 }} animate={{ scale: 1 }}><Icon name="check" size={16} stroke={3} /></motion.span>}
    </motion.button>
  )
}

function StepCoach({ w, set, onNext }) {
  const coach = coachById(w.coachId)
  return (
    <div className="coach-pick">
      <h2 className="wz-h">با کی تمرین کنیم؟</h2>
      <div className="coach-list">
        {coachesRanked(useStore().club).map((c) => (
          <motion.button key={c.id} className={`coach-li ${w.coachId === c.id ? 'on' : ''}`} whileTap={{ scale: 0.98 }} onClick={() => { haptic(8); set({ coachId: c.id, ...(coachPacks(c).some((p) => p.id === w.pack) ? {} : { pack: coachPacks(c)[0]?.id }) }) }}>
            <Photo src={c.img} />
            <div className="grow">
              <b>{c.name} <LevelPill id={c.level} /></b>
              <small>{c.title}، {fa(c.exp)} سال سابقه، ★ {fa(c.avg)} ({fa(c.count)} نظر)</small>
              <ul className="record">{c.record.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
            <em>{short(c.price)}<small>هر جلسه</small></em>
          </motion.button>
        ))}
      </div>
      {coach && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="label">تعداد جلسه</p>
          <div className="pack-grid">
            {coachPacks(coach).map((p) => (
              <motion.button key={p.id} className={`pack-opt ${w.pack === p.id ? 'on' : ''}`} whileTap={{ scale: 0.95 }} onClick={() => { haptic(6); set({ pack: p.id }) }}>
                <b>{p.name}</b><span>{toman(coachPackPrice(coach, p))}</span>{p.tag && <small>{p.tag}</small>}
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}
      {coach && COACH_PACKS.find((p) => p.id === w.pack)?.sessions > 1 && <p className="hint">📅 جلسه‌ها هر هفته همان روز و ساعتی است که در مرحله‌ی بعد انتخاب می‌کنید؛ همه همان لحظه در تقویم ثبت می‌شوند.</p>}
      <CtaBar><Button full variant="dark" disabled={!coach || !coachPacks(coach).some((p) => p.id === w.pack)} onClick={onNext}>انتخاب روز و ساعت</Button></CtaBar>
    </div>
  )
}

function StepEvent({ w, set, onNext }) {
  const { club, user } = useStore()
  const all = appEvents(club)
  return (
    <div className="event-pick">
      {Object.entries(EVENT_KIND).filter(([kind]) => w.intent === 'event' || w.intent === kind).map(([kind, k]) => (
        <div key={kind} className="ev-group">
          <h2 className="wz-h">{k.name}</h2>
          <p className="muted ev-kind-sub">{k.sub}</p>
          {all.filter((e) => e.kind === kind).map((e) => {
            const has = e.regs.some((r) => r.by === ME), full = e.taken + 2 > e.cap, why = whyNot(e, user), lvl = !!why
            return (
              <motion.button key={e.id} className={`ev-card ${w.eventId === e.id ? 'on' : ''}`} disabled={has || full || lvl || e.status !== 'open'} whileTap={{ scale: 0.98 }} onClick={() => { haptic(8); set({ eventId: e.id }) }}>
                <Photo src={e.img} />
                <div className="ev-shade" />
                <div className="ev-txt">
                  <span className={`pill-q ${kind === 'official' ? 'gold' : ''}`}>{dayLabel(e.date)} {dayMonth(fromKey(e.date))}، {hourLabel(e.start)}</span>
                  <b>{e.title}</b>
                  <small>{e.format}، سطح {e.levels.join(' / ')}{audienceText(e) && `، ${audienceText(e)}`}</small>
                  <div className="ev-cap"><div className="bar"><i style={{ width: `${(e.taken / e.cap) * 100}%` }} /></div><span>{fa(e.taken)}/{fa(e.cap)}</span></div>
                </div>
                <em>{has ? 'ثبت‌نام شدید' : full ? 'تکمیل' : e.status !== 'open' ? 'بسته' : why === 'level' ? 'سطح شما نیست' : why ? whyText(e, why) : short(e.fee)}</em>
              </motion.button>
            )
          })}
        </div>
      ))}
      <CtaBar><Button full variant="dark" disabled={!w.eventId} onClick={onNext}>انتخاب یار</Button></CtaBar>
    </div>
  )
}

// مسابقه دونفره است: بازیکن یارش را از اعضا یا مهمان انتخاب می‌کند و ورودی تیم را یک‌جا می‌دهد
function StepPartner({ w, set, onNext }) {
  const { club } = useStore()
  const ev = appEvents(club).find((e) => e.id === w.eventId)
  const p = w.partner?.solo ? null : w.partner
  if (!ev) return null
  const exclude = [ME, ...ev.regs.map((r) => r.by)]
  return (
    <div className="partner-pick">
      <div className="pp-ev"><b>{ev.title}</b><small>{dayLabel(ev.date)}، {hourLabel(ev.start)}، سطح {ev.levels.join(' / ')}</small></div>
      <p className="hint">🎾 مسابقه دونفره است و فقط سطح {ev.levels.join(' / ')}{audienceText(ev) && ` (${audienceText(ev)})`} می‌توانند شرکت کنند (یار مهمان هم باید همین شرایط را داشته باشد). یارتان را انتخاب کنید؛ ورودی هر دو نفر ({toman(ev.fee)} × ۲) را شما یک‌جا پرداخت می‌کنید و از اول هم‌تیمی هستید.</p>
      {p ? (
        <motion.div className="pp-chosen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Avatar name={p.name} size={44} />
          <div className="grow"><small>یار شما</small><b>{p.name}</b>{p.level && <LevelPill id={p.level} />}</div>
          <Button small variant="ghost" onClick={() => set({ partner: null })}>تغییر</Button>
        </motion.div>
      ) : w.partner?.solo ? (
        <motion.div className="pp-chosen solo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <span className="pp-wait">⏳</span>
          <div className="grow"><small>بدون یار</small><b>منتظر یار می‌مانم</b><small>باشگاه یک یار هم‌سطح برایتان می‌گذارد؛ فقط ورودی خودتان ({toman(ev.fee)})</small></div>
          <Button small variant="ghost" onClick={() => set({ partner: null })}>تغییر</Button>
        </motion.div>
      ) : (<>
        <AddPlayer exclude={exclude} noPhone={false} levels={ev.levels?.length ? ev.levels : null} allow={(m) => !whyNot(ev, m)} onAdd={(x) => { haptic(8); set({ partner: x }) }} />
        <button className="pp-solo" onClick={() => { haptic(6); set({ partner: { solo: true } }) }}>یار ندارم؛ منتظر یار می‌مانم <small>باشگاه یار هم‌سطح می‌گذارد</small></button>
      </>)}
      {p?.guest && (<>
        <p className="label">سطح تقریبی یارتان</p>
        <Chips id="pp-lv" small scroll value={p.level || ''} onChange={(level) => set({ partner: { ...p, level } })} options={LEVELS.filter((l) => levelOk(ev, l.id)).map((l) => ({ id: l.id, name: l.id }))} />
        {ev.gender && ev.gender !== 'all' && <p className="hint">این رویداد {AUDIENCE[ev.gender]} است؛ یار مهمان هم باید {GENDER[ev.gender]} باشد.</p>}
        {ev.gender && ev.gender !== 'all' && <Chips id="pp-g" small value={p.gender || ''} onChange={(gender) => set({ partner: { ...p, gender } })} options={[{ id: ev.gender, name: `یارم ${GENDER[ev.gender]} است` }]} />}
        {(ev.ageMin || ev.ageMax) && (<>
          <p className="label">سال تولد یارتان</p>
          <input className="pp-birth" inputMode="numeric" dir="ltr" maxLength={4} placeholder="مثلاً ۱۳۷۵" value={p.birth ? fa(p.birth).replace(/٬/g, '') : ''} onChange={(e) => set({ partner: { ...p, birth: +e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').slice(0, 4) || null } })} />
        </>)}
      </>)}
      <CtaBar><Button full variant="dark" disabled={!w.partner || (p && !!whyNot(ev, p.guest ? p : { ...memberById(p.id), ...p }))} onClick={onNext}>ادامه و پرداخت</Button></CtaBar>
    </div>
  )
}

// کلاس مربی: روزهای هفته، و خلاصه‌ی شروع، پایان، ساعت و هزینه
const WEEK = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']]
function CoachPlan({ w, set, count, plan, total }) {
  const base = fromKey(w.date).getDay()
  const days = w.days?.length ? w.days : [base]
  const ss = plan?.sessions || [{ date: w.date, start: w.start }]
  const first = ss[0], last = ss[ss.length - 1]
  const used = [...new Set(ss.map((x) => fromKey(x.date).getDay()))]
  const hours = [...new Set(ss.map((x) => x.start))]
  return (
    <section className="coach-plan">
      {count > 1 && (<>
        <p className="label">روزهای کلاس در هفته</p>
        <div className="cp-days">{WEEK.map(([d, n]) => (
          <button key={d} className={days.includes(d) ? 'on' : ''} disabled={d === base} onClick={() => { haptic(6); set({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] }) }}>{n}</button>
        ))}</div>
        <p className="hint">روز اول ({WEEK.find((x) => x[0] === base)[1]}) ثابت است؛ با انتخاب روزهای بیشتر، کلاس زودتر تمام می‌شود.</p>
      </>)}
      <div className="cp-sum">
        <div><small>شروع</small><b>{weekday(fromKey(first.date))} {dayMonth(fromKey(first.date))}</b></div>
        <div><small>پایان</small><b>{weekday(fromKey(last.date))} {dayMonth(fromKey(last.date))}</b></div>
        <div><small>روزها</small><b>{WEEK.filter(([d]) => used.includes(d)).map(([, n]) => n).join('، ')}</b></div>
        <div><small>ساعت</small><b>{hours.map((h) => range(h, 1)).join('، ')}</b></div>
        <div><small>جلسه‌ها</small><b>{fa(count)} جلسه</b></div>
        <div><small>هزینه</small><b>{toman(total)}</b>{count > 1 && <small>هر جلسه {toman(Math.round(total / count))}</small>}</div>
      </div>
    </section>
  )
}

// ---------- پرداخت ----------
function StepPay({ w, set, onDone }) {
  const s = useStore()
  const { club, wallet } = s
  const off = memberOff(s)
  const coach = coachById(w.coachId)
  const pack = COACH_PACKS.find((p) => p.id === w.pack)
  const game = w.gameId && club.bookings.find((b) => b.id === w.gameId)
  const ev = w.eventId && appEvents(club).find((e) => e.id === w.eventId)
  const filled = w.players.filter(Boolean)
  const isOpen = w.intent === 'court' && w.open && filled.length < 4
  const series = SERIES.find((x) => x.id === w.series) || SERIES[0]
  const dur = w.intent === 'coach' ? 1 : w.dur
  const count = w.intent === 'coach' ? pack.sessions : w.intent === 'court' && !isOpen ? series.sessions : 1
  const plan = useMemo(() => (count > 1
    ? planSeries(club, { court: w.court, date: w.date, start: w.start, dur, count, coach: w.intent === 'coach' ? coach.id : null, days: w.intent === 'coach' ? w.days : null })
    : null), [count, club, w.court, w.date, w.start, dur, w.coachId, w.days])
  const sessPrices = plan ? plan.sessions.map((x) => priceFor(x.date, x.start, x.dur, club.pricing)) : []

  let title, sub, lines = [], total, kind
  if (w.intent === 'match' && game) {
    kind = 'join'
    title = 'پیوستن به بازی باز'; sub = `${dayLabel(game.date)}، ${range(game.start, game.dur)}، ${courtById(game.court).name}`
    const full = game.full ?? game.price
    lines = [['کل زمین', toman(full)], ['سهم شما (۱ از ۴)', toman(full / 4)]]
    total = full / 4
    if (off) { lines.push(['تخفیف عضویت', '−' + toman(total * off)]); total *= 1 - off }
  } else if (w.intent === 'coach') {
    kind = count > 1 ? 'coach-series' : 'coach'
    title = `${pack.name}، ${coach.name}`; sub = `${count > 1 ? 'از ' : ''}${dayLabel(w.date)}، ${range(w.start, 1)}`
    total = coachPackPrice(coach, pack)
    lines = coach.prices?.[pack.id] ? [[`${pack.name}، ${fa(count)} جلسه`, toman(total)]] : [[`${fa(count)} جلسه × ${toman(coach.price)}`, toman(coach.price * count * (pack.mult || 1))], pack.off > 0 && ['تخفیف پکیج', '−' + toman(coach.price * count * pack.off)]].filter(Boolean)
  } else if (EVENT_INTENTS.includes(w.intent)) {
    kind = 'event'
    title = ev.title; sub = `${dayLabel(ev.date)}، ${hourLabel(ev.start)}، ${ev.format}`
    total = ev.fee * (w.partner?.solo ? 1 : 2); lines = w.partner?.solo ? [['ثبت‌نام', 'تکی، منتظر یار'], ['ورودی شما', toman(total)], ['جایزه', ev.prize]] : [['تیم شما', `${(s.user?.name || '').split(' ')[0]} و ${w.partner?.name.split(' ')[0] || ''}`], [`ورودی ۲ نفر × ${toman(ev.fee)}`, toman(total)], ['جایزه', ev.prize]]
  } else if (count > 1) {
    kind = 'court-series'
    const base = sessPrices.reduce((a, x) => a + x, 0)
    title = `${series.name} زمین`; sub = `هر هفته، ${weekday(fromKey(w.date))}، ${range(w.start, w.dur)}`
    total = Math.round(base * (1 - series.off) / 1000) * 1000
    lines = [[`${fa(plan.sessions.length)} جلسه × ${DURATIONS.find((d) => d.h === w.dur).name}`, toman(base)], ['تخفیف پکیج', '−' + toman(base - total)]]
  } else {
    kind = 'court'
    const base = priceFor(w.date, w.start, w.dur, club.pricing)
    title = isOpen ? 'بازی باز' : 'رزرو زمین'; sub = `${dayLabel(w.date)}، ${range(w.start, w.dur)}، ${courtById(w.court).name}`
    const full = base * (1 - off)
    lines = [['زمین ' + DURATIONS.find((d) => d.h === w.dur).name, toman(base)], off > 0 && ['تخفیف عضویت', '−' + toman(base * off)], isOpen && ['سهم شما (بقیه سهم خودشون رو می‌دن)', toman(full / 4)]].filter(Boolean)
    total = isOpen ? full / 4 : full
  }

  const payOn = !!s.config?.pay
  const methods = [
    { id: 'wallet', name: 'کیف پول', sub: toman(wallet), icon: 'wallet', ok: wallet >= total },
    { id: 'online', name: 'کارت بانکی', sub: payOn ? 'درگاه شتاب' : 'به‌زودی', icon: 'card', ok: payOn },
  ]
  const [method, setMethod] = useState(() => (wallet >= total || !payOn ? 'wallet' : 'online'))
  const useMethod = wallet >= total ? method : 'online'
  const [busy, setBusy] = useState(false)
  const blocked = plan && !plan.complete
  const cantPay = useMethod === 'online' && !payOn

  // مبلغ نهایی را سرور حساب می‌کند؛ پرداخت آنلاین یعنی رفتن به درگاه و برگشت به اپ
  const confirm = async () => {
    if (busy || cantPay) return
    setBusy(true); haptic(12)
    let r
    if (kind === 'join') r = await s.joinGame(game.id, useMethod)
    else if (kind === 'event') r = await s.registerEvent(ev, useMethod, w.partner)
    else if (kind === 'coach') r = await s.book({ court: w.court, date: w.date, start: w.start, dur: 1, type: 'coach', coach: coach.id, pack: pack.id, players: [ME] }, useMethod)
    else if (kind === 'coach-series') {
      r = await s.bookSeries(plan.sessions.map((x) => ({ court: x.court, date: x.date, start: x.start, dur: 1 })), { kind: 'coach', item: coach.id, pack: pack.id }, useMethod)
    } else if (kind === 'court-series') {
      r = await s.bookSeries(plan.sessions.map((x) => ({ court: x.court, date: x.date, start: x.start, dur: x.dur, players: filled.map((p) => p.id) })), { kind: 'package', item: series.id }, useMethod)
    } else {
      r = await s.book({ court: w.court, date: w.date, start: w.start, dur: w.dur, type: isOpen ? 'open' : 'private', players: filled.map((p) => p.id), levels: isOpen ? w.levels : null, wantSide: isOpen ? w.wantSide : null, visibility: w.visibility, invited: w.visibility === 'private' ? w.invited : [] }, useMethod)
    }
    if (r?.error) {
      setBusy(false); chime('alarm')
      if (r.shown) return
      s.toast(kind === 'event' ? { icon: '⛔', title: 'ثبت‌نام این مسابقه دیگر ممکن نیست', body: 'ظرفیت همین الان پر شد یا ثبت‌نام بسته شد' }
        : r.error === 'run' ? { icon: '⏱', title: `حداکثر ${fa(r.run)} ساعت پشت هم`, body: 'با رزروهای قبلی خودتان در همین روز از سقف بیشتر می‌شود' }
        : r.error === 'full' ? { icon: '⛔', title: 'این بازی همین الان پر شد', body: 'یک بازی دیگر انتخاب کنید' }
        : { icon: '⛔', title: 'یکی از ساعت‌ها همین الان پر شد', body: 'برنامه به‌روز شد؛ دوباره بررسی و پرداخت کنید' })
      return
    }
    chime('success'); celebrate(); haptic([20, 40, 20, 40, 80])
    onDone({ ...r, kind, title, sub, total, method: useMethod, open: isOpen && w.visibility !== 'private' })
  }

  return (
    <div className="pay">
      {w.intent === 'court' && (
        <section className="series-pick">
          <p className="label">تعداد جلسه</p>
          <div className="pack-grid three">
            {SERIES.map((x) => (
              <motion.button key={x.id} className={`pack-opt ${w.series === x.id ? 'on' : ''}`} whileTap={{ scale: 0.95 }} disabled={isOpen && x.sessions > 1}
                onClick={() => { haptic(6); set({ series: x.id }) }}>
                <b>{x.name}</b>{x.tag ? <small>{x.tag}</small> : <span>همین یک بار</span>}
              </motion.button>
            ))}
          </div>
          {isOpen && <p className="hint">پکیج برای تیم کامل است؛ برای خرید پکیج، در مرحله‌ی قبل «تیم کامله» را انتخاب کنید.</p>}
        </section>
      )}
      {w.intent === 'coach' && <CoachPlan w={w} set={set} count={count} plan={plan} total={total} />}
      <div className="pay-ticket">
        <span className="pill-ink">{title}</span>
        <h3>{sub}</h3>
        <div className="pay-lines">{lines.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        <div className="pay-total"><span>مبلغ قابل پرداخت</span><b>{toman(total)}</b></div>
      </div>
      {plan && (
        <section className="plan">
          <p className="label">برنامه‌ی {fa(count)} جلسه — همه همین الان در تقویم رزرو می‌شوند</p>
          {plan.sessions.map((x, k) => (
            <motion.div key={x.date} className={`plan-row ${x.moved ? 'moved' : ''}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(k, 10) * 0.03 }}>
              <span className="plan-n">{fa(k + 1)}</span>
              <div className="grow"><b>{weekday(fromKey(x.date))} {dayMonth(fromKey(x.date))}</b><small>{courtById(x.court).name}{x.moved ? '، ساعت یا زمین جابه‌جا شد' : ''}</small></div>
              <span className="plan-t">{range(x.start, x.dur)}</span>
            </motion.div>
          ))}
          {plan.skipped > 0 && plan.complete && <p className="hint">{fa(plan.skipped)} هفته در آن ساعت جای خالی نداشت؛ آن جلسه به هفته‌ی بعد منتقل شد.</p>}
          {blocked && <p className="hint warn">فقط {fa(plan.sessions.length)} از {fa(count)} جلسه در هفته‌های پیش رو جا شد. روز یا ساعت دیگری انتخاب کنید.</p>}
        </section>
      )}
      <p className="label">روش پرداخت</p>
      <div className="methods">
        {methods.map((m) => (
          <motion.button key={m.id} className={`method ${useMethod === m.id ? 'on' : ''}`} disabled={!m.ok} whileTap={{ scale: 0.97 }} onClick={() => { haptic(6); setMethod(m.id) }}>
            <Icon name={m.icon} /><div className="grow"><b>{m.name}</b><small>{m.ok ? m.sub : m.id === 'online' ? 'پرداخت آنلاین به‌زودی فعال می‌شود' : 'موجودی کافی نیست'}</small></div>
            <span className={`radio ${useMethod === m.id ? 'on' : ''}`} />
          </motion.button>
        ))}
      </div>
      <Loading show={busy} text={useMethod === 'online' ? 'اتصال به درگاه پرداخت…' : count > 1 ? `ثبت ${fa(count)} جلسه در تقویم…` : 'در حال ثبت رزرو…'} />
      <p className="hint">لغو رایگان هر جلسه تا ۶ ساعت قبل از شروع — مبلغ همان جلسه به کیف پول برمی‌گرده.</p>
      <CtaBar>
        <Button full variant="q" disabled={busy || blocked || cantPay} onClick={confirm}>
          {busy ? (useMethod === 'online' ? 'اتصال به درگاه…' : 'در حال ثبت…') : cantPay ? 'موجودی کیف پول کافی نیست' : `پرداخت ${toman(total)}`}
        </Button>
      </CtaBar>
    </div>
  )
}

function Success({ r, w, onHome, onGames }) {
  const [show, setShow] = useState(0)
  useEffect(() => { const t = setTimeout(() => setShow(1), 900); return () => clearTimeout(t) }, [])
  return (
    <div className="success">
      <motion.div className="succ-check" initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
        <svg viewBox="0 0 52 52" width="92" height="92"><motion.path d="M14 27l8 8 16-17" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.35, duration: 0.45 }} /></svg>
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{r.kind === 'event' ? 'ثبت‌نام شد!' : r.kind === 'join' ? 'به بازی پیوستید!' : r.count > 1 ? 'پکیج رزرو شد!' : 'رزرو شد!'}</motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} transition={{ delay: 0.4 }}>{r.title}، {r.sub}</motion.p>
      {r.count > 1 && <motion.p className="pill-q" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>{fa(r.count)} جلسه در تقویم شما ثبت شد</motion.p>}
      <motion.div className="xp-big" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.55, type: 'spring', stiffness: 300, damping: 14 }}>
        +<CountUp to={r.xp || 0} duration={1} /> <small>XP{r.mult > 1 ? '، ۲ برابر عضویت' : ''}</small>
      </motion.div>
      {r.open && (
        <motion.div className="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {[0, 1, 2].map((k) => <motion.span key={k} animate={{ scale: [0.3, 2.4], opacity: [0.7, 0] }} transition={{ repeat: Infinity, duration: 2.2, delay: k * 0.7 }} />)}
          <Icon name="radar" size={26} />
          <p>در حال پیدا کردن بازیکن هم‌سطح… وقتی کسی درخواست بده خبرتون می‌کنیم.</p>
        </motion.div>
      )}
      <AnimatePresence>
        {show && r.badges?.length > 0 && (
          <motion.div className="new-badges" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="label">نشان جدید باز شد!</p>
            <div>
              {r.badges.map((id, k) => {
                const b = BADGES.find((x) => x.id === id)
                return (
                  <motion.div key={id} className="badge-pop" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: k * 0.15, type: 'spring', stiffness: 300, damping: 12 }}>
                    <span>{b.icon}</span><b>{b.name}</b>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="succ-cta">
        <Button full variant="q" onClick={onGames}>بازی‌های من</Button>
        <Button full variant="ghost" onClick={onHome}>خانه</Button>
      </div>
    </div>
  )
}
