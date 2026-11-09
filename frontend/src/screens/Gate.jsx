import { AnimatePresence, motion } from 'framer-motion'
import { jParts } from '../jalali'
import { useEffect, useRef, useState } from 'react'
import { LEVELS, SIDES, fa, USER_RE, todayKey } from '../data'
import { celebrate, chime, haptic } from '../fx'
import { useStore } from '../store'
import { errText } from '../api'
import { Button, Icon, LevelPill, TopBar } from '../components/ui'
import { Emblem, Loading, QuadraMark } from '../components/Logo'

const toLatin = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
const fa0 = (s) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

export default function Gate() {
  const { requestOtp, verifyOtp, register, loginWithPass, loginTaken, toast } = useStore()
  const [step, setStep] = useState('welcome') // welcome → phone → otp → name → level → done | admin
  const [mode, setMode] = useState('signup')
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState({ phone: '', name: '', gender: null, birth: '', level: null, side: null, username: '', pass: '' })
  const [otp, setOtp] = useState(null) // { debug } کد آزمایشی فقط در محیط تست
  const [ticket, setTicket] = useState(null) // بلیت ثبت‌نام بعد از تأیید شماره
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const order = ['welcome', 'userlogin', 'phone', 'otp', 'name', 'about', 'level', 'side', 'cred', 'done']
  const go = (s) => { setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1); setStep(s) }
  const back = () => go(step === 'admin' || step === 'coach' ? 'welcome' : step === 'userlogin' ? 'phone' : step === 'phone' ? 'welcome' : step === 'name' ? 'phone' : order[order.indexOf(step) - 1])
  const fail = (r) => { haptic([30, 30, 30]); chime('alarm'); toast({ icon: '⛔', title: errText(r) }) }
  // ارسال کد پیامکی
  const sendCode = async () => {
    const r = await requestOtp(form.phone)
    if (r.error) { fail(r); return false }
    setOtp({ debug: r.debug_code || null, at: Date.now() })
    return true
  }
  // عضو قبلی با شماره و کد وارد می‌شود؛ شماره‌ی تازه به ثبت‌نام می‌رود
  const afterOtp = async (code) => {
    const r = await verifyOtp(form.phone, code)
    if (r.member) return 'ok'
    if (r.signup) {
      setTicket(r.signup)
      if (mode === 'login') toast({ icon: '👋', title: 'این شماره هنوز عضو کوادرا نیست', body: 'چند قدم کوتاه تا عضویت مانده.' })
      go('name')
      return 'ok'
    }
    if (r.error === 'code') return 'bad'
    fail(r)
    return 'bad'
  }
  const finish = () => { celebrate(); chime('level'); haptic([20, 40, 20]); go('done') }
  const enter = async () => {
    const r = await register(ticket, { name: form.name.trim(), level: form.level, side: form.side, gender: form.gender, birth: +form.birth || null, ...(form.pass ? { username: form.username, pass: form.pass } : {}) })
    if (!r.error) return true
    if (r.error === 'ticket') { toast({ icon: '⏱', title: 'زمان ثبت‌نام تمام شد', body: 'شماره را دوباره تأیید کنید.' }); go('phone') } else if (r.error === 'taken') { toast({ icon: '⛔', title: 'این نام کاربری گرفته شده' }); go('cred') } else fail(r)
    return false
  }
  const progress = { phone: 0, otp: 1, name: 2, about: 3, level: 4, side: 5, cred: 6 }[step]

  return (
    <div className="auth">
      <HeroSlides dim={step !== 'welcome'} admin={step === 'admin' || step === 'coach'} />
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        <motion.div key={step} className={`auth-pane ${step === 'welcome' ? 'welcome' : ''}`} custom={dir}
          variants={{ in: (d) => ({ x: d * -60, opacity: 0 }), on: { x: 0, opacity: 1 }, out: (d) => ({ x: d * 60, opacity: 0 }) }}
          initial="in" animate="on" exit="out" transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
          {step === 'welcome' && <Welcome onStart={() => { setMode('signup'); go('phone') }} onLogin={() => { setMode('login'); go('phone') }} onAdmin={() => go('admin')} onCoach={() => go('coach')} />}
          {step === 'admin' && <AdminLogin onBack={back} />}
          {step === 'coach' && <AdminLogin coach onBack={back} />}
          {!['welcome', 'done', 'admin', 'coach'].includes(step) && (
            <div className="auth-card">
              <TopBar onBack={back} total={step === 'userlogin' ? 0 : 7} step={progress} title={step === 'userlogin' || (mode === 'login' && step === 'phone') ? 'ورود' : 'عضویت در کوادرا'} transparent />
              {step === 'phone' && <PhoneStep value={form.phone} onChange={(phone) => set({ phone })} onNext={async () => { if (await sendCode()) go('otp') }} mode={mode} onPass={() => go('userlogin')} />}
              {step === 'userlogin' && <UserLogin onLogin={loginWithPass} onPhone={() => go('phone')} />}
              {step === 'otp' && <OtpStep phone={form.phone} debug={otp?.debug} sentAt={otp?.at} onResend={sendCode} onNext={afterOtp} />}
              {step === 'name' && <NameStep form={form} set={set} onNext={() => go('about')} />}
              {step === 'about' && <AboutStep form={form} set={set} onNext={() => go('level')} />}
              {step === 'level' && <LevelStep value={form.level} onChange={(level) => set({ level })} onNext={() => go('side')} />}
              {step === 'side' && <SideStep value={form.side} onChange={(side) => set({ side })} onNext={() => go('cred')} />}
              {step === 'cred' && <CredStep form={form} set={set} taken={(u) => loginTaken(u)} onNext={finish} />}
            </div>
          )}
          {step === 'done' && <Done form={form} onEnter={enter} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ذرات گرد و غبار در نور — موقعیت‌ها ثابت تا با هر رندر عوض نشوند
// پس‌زمینه‌ی ویدیویی: نمای هوایی زمین پدل (Pexels، Gianluca Guidi)
function HeroSlides({ dim, admin }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    // اگر کاربر حرکت کم را ترجیح داده، فقط تصویر ثابت
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { v.pause(); return }
    v.play?.().catch(() => {})
  }, [])
  return (
    <div className="auth-bg">
      <img className="bg-poster" src="./img/welcome-video.jpg" alt="" draggable={false} />
      <video ref={ref} className={`bg-video ${ready ? 'on' : ''}`} src="./img/welcome-video.mp4" poster="./img/welcome-video.jpg"
        autoPlay muted loop playsInline preload="auto" onCanPlay={() => setReady(true)} aria-hidden="true" />
      <div className={`auth-bg-shade ${dim ? 'dim' : ''} ${admin ? 'admin' : ''}`} />
    </div>
  )
}

function Welcome({ onStart, onLogin, onAdmin, onCoach }) {
  const words = ['فراتر از', 'یک بازی']
  return (
    <div className="welcome-in">
      <div className="welcome-emblem"><Emblem size={84} /></div>
      <div className="welcome-copy">
        <h1>
          {words.map((w, i) => (
            <motion.span key={w} className={i === 1 ? 'hl' : ''} initial={{ opacity: 0, y: 40, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 200, damping: 18 }}>{w}</motion.span>
          ))}
        </h1>
        <motion.p className="sub-line" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.7 }}>
          به سادگی زمین رزرو کنید، بازی بچینید و لذت ببرید.
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.85 }}>
          <b>مدرن‌ترین باشگاه</b> پدل استان البرز
        </motion.p>
      </div>
      <motion.div className="welcome-cta" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
        <Button full variant="q" onClick={onStart}>شروع کنیم</Button>
        <Button full variant="glass" onClick={onLogin}>قبلاً عضو شده‌ام</Button>
        <div className="staff-links">
          <button className="admin-link" onClick={onAdmin}><Icon name="shield" size={16} /> ورود مدیر باشگاه</button>
          <i />
          <button className="admin-link" onClick={onCoach}><Icon name="coach" size={16} /> ورود مربی‌ها</button>
        </div>
      </motion.div>
    </div>
  )
}

// ورود مدیر یا مربی؛ نام کاربری و رمز هر مربی را مدیر در پرونده‌ی مربی می‌دهد و دسترسی را فعال می‌کند
function AdminLogin({ onBack, coach }) {
  const { staffLogin, toast, config } = useStore()
  const [why, setWhy] = useState('')
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (busy) return
    const fail = (msg) => { setErr(true); setWhy(msg); haptic([30, 30, 30]) }
    setBusy(true)
    const r = await staffLogin(coach ? 'coach' : 'admin', u, p)
    if (r.error) {
      setBusy(false)
      return fail(r.error === 'bad' ? 'نام کاربری یا رمز درست نیست' : r.error === 'off' ? 'دسترسی شما هنوز توسط مدیر فعال نشده است' : errText(r))
    }
    chime('success')
    const first = (r.name || '').split(' ')[0]
    toast(coach ? { icon: '🎾', title: `خوش آمدید${first ? '، ' + first : ''}`, body: 'پنل مربی کوادرا' } : { icon: '🛡', title: 'خوش آمدید، مدیر', body: 'پنل مدیریت کوادرا' })
  }
  return (
    <div className="admin-gate">
      <motion.div className="admin-card" animate={err ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} onAnimationComplete={() => setErr(false)}>
        <button className="icon-btn ghost" onClick={onBack} aria-label="بازگشت"><Icon name="back" /></button>
        <div className="admin-card-head">
          <QuadraMark size={44} tone="light" />
          <div><b>{coach ? 'پنل مربی' : 'پنل مدیریت'}</b><small>{coach ? 'نام کاربری و رمز را از مدیر باشگاه بگیرید' : 'فقط برای کارکنان کوادرا'}</small></div>
        </div>
        <label className="field dark"><Icon name="user" /><input dir="ltr" placeholder="نام کاربری" value={u} onChange={(e) => { setU(e.target.value); setWhy('') }} autoFocus /></label>
        <label className="field dark"><Icon name="lock" /><input dir="ltr" type="password" placeholder="رمز عبور" value={p} onChange={(e) => { setP(e.target.value); setWhy('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        {why && <p className="login-why">{why}</p>}
        <Button full variant="q" onClick={submit} disabled={!u || !p || busy}>{busy ? 'در حال ورود…' : 'ورود به پنل'}</Button>
        <Loading show={busy} text={coach ? 'ورود به پنل مربی…' : 'ورود به پنل مدیریت…'} />
        {config.demo && <p className="demo-hint">{coach ? <>نسخه‌ی نمایشی — نام کاربری <code>faraz</code>، رمز <code>123456</code></> : <>نسخه‌ی نمایشی — نام کاربری <code>admin</code>، رمز <code>quadra</code></>}</p>}
      </motion.div>
    </div>
  )
}

function PhoneStep({ value, onChange, onNext: send, mode, onPass }) {
  const { config } = useStore()
  const [busy, setBusy] = useState(false)
  const onNext = async () => { if (busy) return; setBusy(true); await send(); setBusy(false) }
  const valid = /^09\d{9}$/.test(value) && !busy
  const pretty = value.replace(/^(\d{4})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))
  return (
    <div className="step-body">
      <h2>{mode === 'login' ? 'خوش برگشتید 👋' : 'شماره موبایلتون؟'}</h2>
      <p className="muted">یک کد ۴ رقمی براتون پیامک می‌کنیم.</p>
      <label className={`field phone ${valid ? 'ok' : ''}`}>
        <Icon name="phone" />
        <input inputMode="numeric" autoFocus dir="ltr" placeholder="0912 345 6789" value={fa0(pretty)}
          onChange={(e) => onChange(toLatin(e.target.value).replace(/\D/g, '').slice(0, 11))}
          onKeyDown={(e) => e.key === 'Enter' && valid && onNext()} />
        <AnimatePresence>{valid && <motion.span className="field-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" size={16} stroke={3} /></motion.span>}</AnimatePresence>
      </label>
      <Button full variant="q" disabled={!valid} onClick={onNext}>{busy ? 'در حال ارسال…' : 'ارسال کد'}</Button>
      {config.demo && <button className="link center" onClick={() => onChange('09120000000')}>شماره‌ی نمایشی</button>}
      {mode === 'login' && <button className="link center pass-link" onClick={onPass}><Icon name="lock" size={15} /> پیامک نمی‌رسد؟ ورود با نام کاربری و رمز</button>}
    </div>
  )
}

// ورود بدون پیامک؛ نام کاربری و رمز در ثبت‌نام یا از «پروفایل» ساخته می‌شود
function UserLogin({ onLogin, onPhone }) {
  const { config } = useStore()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState('')
  const ok = u.trim().length >= 3 && p.length >= 6 && !busy
  const go = async () => {
    if (!ok) return
    setBusy(true)
    const r = await onLogin(u, p)
    setBusy(false)
    if (r?.error) { setErr(true); setWhy(r.error === 'bad' ? 'نام کاربری یا رمز درست نیست.' : errText(r)); haptic([30, 30, 30]); chime('alarm') }
  }
  return (
    <div className="step-body">
      <h2>ورود با نام کاربری</h2>
      <p className="muted">برای وقتی که پیامک نمی‌رسد یا شماره در دسترس نیست.</p>
      <label className={`field ${err ? 'bad' : ''}`}><Icon name="user" /><input dir="ltr" autoFocus autoCapitalize="none" autoComplete="username" placeholder="username" value={u} onChange={(e) => { setU(e.target.value.replace(/\s/g, '').toLowerCase()); setErr(false) }} /></label>
      <label className={`field ${err ? 'bad' : ''}`}><Icon name="lock" /><input dir="ltr" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="رمز" value={p} onChange={(e) => { setP(e.target.value); setErr(false) }} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label="نمایش رمز"><Icon name="eye" size={17} /></button></label>
      {err && <p className="login-why">{why || 'نام کاربری یا رمز درست نیست.'}</p>}
      <Button full variant="q" disabled={!ok} onClick={go}>{busy ? 'در حال ورود…' : 'ورود'}</Button>
      <button className="link center" onClick={onPhone}>ورود با شماره موبایل</button>
      {config.demo && <p className="demo-hint">نسخه‌ی نمایشی: <code>aryan</code> / <code>123456</code></p>}
    </div>
  )
}

// جنسیت و سن: برای رویدادهای ویژه‌ی بانوان/آقایان و رده‌های سنی
const J_NOW = jParts(todayKey()).y
function AboutStep({ form, set, onNext }) {
  const y = +toLatin(String(form.birth || ''))
  const age = y ? J_NOW - y : null
  const okY = y >= J_NOW - 90 && y <= J_NOW - 7
  const ok = form.gender && okY
  return (
    <div className="step-body">
      <h2>کمی درباره‌ی شما</h2>
      <p className="muted">برای رویدادهای ویژه‌ی بانوان یا آقایان و رده‌های سنی؛ جای دیگری نمایش داده نمی‌شود.</p>
      <div className="gender-pick">
        {[['f', 'خانم', '👩'], ['m', 'آقا', '👨']].map(([id, n, e]) => (
          <button key={id} type="button" className={form.gender === id ? 'on' : ''} onClick={() => { haptic(6); set({ gender: id }) }}><i>{e}</i><b>{n}</b></button>
        ))}
      </div>
      <label className={`field ${form.birth && !okY ? 'bad' : ''}`}>
        <Icon name="cal" />
        <input inputMode="numeric" dir="ltr" placeholder={`سال تولد، مثلاً ${fa(J_NOW - 28)}`} value={fa0(String(form.birth || ''))} maxLength={4}
          onChange={(e) => set({ birth: toLatin(e.target.value).replace(/\D/g, '').slice(0, 4) })} onKeyDown={(e) => e.key === 'Enter' && ok && onNext()} />
        {okY && <span className="field-age">{fa(age)} ساله</span>}
      </label>
      {form.birth && String(form.birth).length === 4 && !okY && <p className="login-why">سال تولد شمسی را درست وارد کنید (مثلاً ۱۳۷۵).</p>}
      <Button full variant="q" disabled={!ok} onClick={onNext}>ادامه</Button>
    </div>
  )
}

// نام کاربری و رمز (اختیاری): اگر روزی پیامک نرسید، با این وارد می‌شوید
function CredStep({ form, set, taken, onNext }) {
  const [show, setShow] = useState(false)
  const u = form.username
  const badU = u && !USER_RE.test(u), dup = USER_RE.test(u) && taken(u)
  const ok = USER_RE.test(u) && !dup && form.pass.length >= 6
  return (
    <div className="step-body">
      <h2>ورود بدون پیامک</h2>
      <p className="muted">یک نام کاربری و رمز بسازید؛ اگر پیامک نرسید یا شماره عوض شد، با همین وارد می‌شوید.</p>
      <label className={`field ${badU || dup ? 'bad' : ''}`}><Icon name="user" /><input dir="ltr" autoCapitalize="none" autoComplete="username" placeholder="username" value={u} onChange={(e) => set({ username: e.target.value.replace(/\s/g, '').toLowerCase().slice(0, 20) })} /></label>
      {badU && <p className="login-why">فقط حروف انگلیسی کوچک، عدد، نقطه و زیرخط؛ حداقل ۳ حرف.</p>}
      {dup && <p className="login-why">این نام کاربری گرفته شده؛ یکی دیگر انتخاب کنید.</p>}
      <label className="field"><Icon name="lock" /><input dir="ltr" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="رمز، حداقل ۶ کاراکتر" value={form.pass} onChange={(e) => set({ pass: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ok && onNext()} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label="نمایش رمز"><Icon name="eye" size={17} /></button></label>
      <Button full variant="q" disabled={!ok} onClick={onNext}>تموم شد!</Button>
      <button className="link center" onClick={() => { set({ username: '', pass: '' }); onNext() }}>بعداً از پروفایل می‌سازم</button>
    </div>
  )
}

function OtpStep({ phone, debug, sentAt, onResend, onNext }) {
  const [code, setCode] = useState(['', '', '', ''])
  const [auto, setAuto] = useState(false)
  const [sec, setSec] = useState(59)
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const refs = useRef([])
  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => { setSec(59); const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t) }, [sentAt])
  // دریافت خودکار پیامک (WebOTP) روی گوشی‌هایی که پشتیبانی می‌کنند
  useEffect(() => {
    if (!('OTPCredential' in window)) return
    const ac = new AbortController()
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal }).then((o) => {
      const d = (o?.code || '').replace(/\D/g, '').slice(0, 4)
      if (d.length === 4) { setAuto(true); setCode(d.split('')) }
    }).catch(() => {})
    return () => ac.abort()
  }, [])
  // فقط در محیط تست: کدی که سرور برگردانده خودکار پر می‌شود
  useEffect(() => {
    if (!debug) return
    const t = setTimeout(() => {
      setAuto(true)
      debug.split('').forEach((d, i) => setTimeout(() => { haptic(6); setCode((c) => { const n = [...c]; n[i] = d; return n }) }, i * 140))
    }, 900)
    return () => clearTimeout(t)
  }, [debug, sentAt])
  const full = code.every(Boolean)
  useEffect(() => {
    if (!full || busy) return
    let live = true
    setBusy(true)
    const t = setTimeout(async () => {
      const r = await onNext(code.join(''))
      if (!live) return
      setBusy(false)
      if (r === 'bad') { setBad(true); haptic([30, 30, 30]); chime('alarm'); setCode(['', '', '', '']); setAuto(false); refs.current[0]?.focus() } else chime('success')
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [full]) // eslint-disable-line react-hooks/exhaustive-deps
  const resend = async () => { if (await onResend()) { setCode(['', '', '', '']); setBad(false) } }
  const put = (i, v) => {
    const d = toLatin(v).replace(/\D/g, '').slice(-1)
    setBad(false)
    setCode((c) => { const n = [...c]; n[i] = d; return n })
    if (d && i < 3) refs.current[i + 1]?.focus()
  }
  return (
    <div className="step-body">
      <h2>کد تأیید</h2>
      <p className="muted">به <b dir="ltr">{fa0(phone)}</b> ارسال شد</p>
      <div className="otp" dir="ltr">
        {code.map((d, i) => (
          <motion.input key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" value={d ? fa0(d) : ''}
            className={d ? 'filled' : ''} animate={d ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.25 }}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }} />
        ))}
      </div>
      <AnimatePresence>
        {auto && !bad && <motion.p className="auto-sms" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>✨ کد از پیامک خودکار خوانده شد</motion.p>}
      </AnimatePresence>
      {bad && <p className="login-why">کد درست نیست یا منقضی شده؛ دوباره وارد کنید.</p>}
      <p className="muted center">{sec > 0 ? `ارسال مجدد تا ${fa(sec)} ثانیه` : <button className="link" onClick={resend}>ارسال مجدد کد</button>}</p>
    </div>
  )
}

function NameStep({ form, set, onNext }) {
  const ok = form.name.trim().length >= 2
  return (
    <div className="step-body">
      <h2>چی صداتون کنیم؟</h2>
      <label className="field">
        <Icon name="user" />
        <input autoFocus placeholder="نام و نام خانوادگی" value={form.name} onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && ok && onNext()} />
      </label>
      <Button full variant="q" disabled={!ok} onClick={onNext}>ادامه</Button>
    </div>
  )
}

// آزمون تعیین سطح — هر پاسخ ۰ تا ۳ امتیاز؛ مجموع ۰ تا ۳۰
const QUIZ = [
  { q: 'چند وقته به‌طور منظم پدل بازی می‌کنید؟', a: ['کمتر از ۳ ماه', '۳ ماه تا یک سال', 'یک تا سه سال', 'بیشتر از سه سال'] },
  { q: 'هفته‌ای چند بار بازی می‌کنید؟', a: ['کمتر از یک بار', 'یک بار', 'دو تا سه بار', 'چهار بار یا بیشتر'] },
  { q: 'سابقه‌ی تنیس یا اسکواش دارید؟', a: ['نه', 'تفریحی', 'باشگاهی و منظم', 'رقابتی'] },
  { q: 'سرویستون چطوره؟', a: ['هنوز زیاد خطا می‌زنم', 'وارد می‌کنم ولی ساده', 'با جهت و عمق کنترل‌شده', 'با اسپین و برای شروع حمله'] },
  { q: 'توپی که از دیوار پشتی برمی‌گرده رو چطور جواب می‌دید؟', a: ['معمولاً از دستم می‌ره', 'توپ‌های ساده رو برمی‌گردونم', 'بیشترشون رو کنترل‌شده می‌زنم', 'حتی دو دیوار و کرنر رو راحت می‌زنم'] },
  { q: 'پشت تور و والی؟', a: ['کمتر جلو می‌رم', 'والی ساده می‌زنم', 'والی با جهت و عمق', 'بلاک، دراپ و والی تهاجمی'] },
  { q: 'بندخا و ویبورا؟', a: ['نمی‌شناسم', 'می‌شناسم ولی نمی‌زنم', 'گاهی درست درمیاد', 'ابزار ثابت بازیمه'] },
  { q: 'اسمش (ضربه‌ی بالای سر)؟', a: ['نمی‌زنم', 'تخت و بی‌جهت', 'با قدرت و جهت', 'توپ رو از زمین بیرون می‌فرستم (x3 / x4)'] },
  { q: 'از لوب چطور استفاده می‌کنید؟', a: ['اتفاقی پیش میاد', 'برای فرار از فشار', 'عمدی برای گرفتن تور', 'دقیق روی ضعف حریف'] },
  { q: 'تجربه‌ی مسابقه دارید؟', a: ['نه', 'فقط دوستانه', 'تورنمنت باشگاهی', 'مسابقات رسمی / رنکینگ'] },
]
const CUTS = [27, 23, 19, 16, 13, 10, 7, 4] // حداقل امتیاز A، B+، B، B-، C+، C، C-، D+ (نتیجه حداکثر B)
const quizLevel = (ans) => {
  const score = ans.reduce((s, k) => s + k, 0)
  let i = CUTS.findIndex((c) => score >= c)
  if (i === -1) i = 8
  // آزمون حداکثر سطح B می‌دهد؛ B+ و A فقط با انتخاب مستقیم / ارزیابی مربی
  return LEVELS[Math.max(i, 2)].id
}

function LevelStep({ value, onChange, onNext }) {
  const [quiz, setQuiz] = useState(null)
  const [ans, setAns] = useState([])
  const answer = (k) => {
    haptic(8)
    const next = [...ans.slice(0, quiz), k]
    if (quiz < QUIZ.length - 1) { setAns(next); setQuiz(quiz + 1) } else {
      onChange(quizLevel(next)); setQuiz(null); setAns([]); chime('success')
    }
  }
  const prev = () => (quiz === 0 ? setQuiz(null) : setQuiz(quiz - 1))
  return (
    <div className="step-body">
      <h2>سطحتون چیه؟</h2>
      <p className="muted">برای مچ‌میکینگ — بعد از هر بازی دقیق‌تر می‌شه.</p>
      <AnimatePresence mode="wait">
        {quiz === null ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="quiz-cta" onClick={() => { setQuiz(0); setAns([]) }}>
              <Icon name="sparkle" /> مطمئن نیستم — با ۱۰ سؤال دقیق پیداش کن
            </button>
            <p className="quiz-note">نتیجه‌ی آزمون حداکثر سطح B است؛ سطح‌های B+ و A با ارزیابی مربی باشگاه تأیید می‌شوند.</p>
            <div className="level-list">
              {LEVELS.map((l) => (
                <motion.button key={l.id} className={`level-row ${value === l.id ? 'on' : ''}`} whileTap={{ scale: 0.98 }} onClick={() => { haptic(6); onChange(l.id) }}>
                  <LevelPill id={l.id} />
                  <div><b>{l.title}</b><small>{l.desc}</small></div>
                  {value === l.id && <motion.span layoutId="lvl-check" className="lvl-check"><Icon name="check" size={16} stroke={3} /></motion.span>}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key={'q' + quiz} className="quiz" initial={{ x: -40, opacity: 0, rotate: -2 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: 40, opacity: 0, rotate: 2, pointerEvents: 'none' }}>
            <div className="quiz-top">
              <span className="quiz-n">{fa(quiz + 1)} / {fa(QUIZ.length)}</span>
              <button className="link" onClick={prev}>{quiz === 0 ? 'انصراف' : 'سؤال قبلی'}</button>
            </div>
            <div className="quiz-bar"><i style={{ width: `${((quiz + 1) / QUIZ.length) * 100}%` }} /></div>
            <h3>{QUIZ[quiz].q}</h3>
            {QUIZ[quiz].a.map((a, k) => (
              <motion.button key={a} className={`quiz-a ${ans[quiz] === k ? 'on' : ''}`} whileTap={{ scale: 0.97 }} onClick={() => answer(k)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }}>{a}</motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {quiz === null && <Button full variant="q" disabled={!value} onClick={onNext}>ادامه</Button>}
    </div>
  )
}

function SideStep({ value, onChange, onNext }) {
  return (
    <div className="step-body">
      <h2>کدام سمت زمین بازی می‌کنید؟</h2>
      <p className="muted">برای پیدا کردن یار مناسب — بعداً هم قابل تغییر است.</p>
      <div className="side-pick">
        {SIDES.map((x) => (
          <button key={x.id} className={`side-opt ${value === x.id ? 'on' : ''}`} onClick={() => { haptic(6); onChange(x.id) }}>
            <svg viewBox="0 0 40 56" className={`side-ic ${x.id}`} aria-hidden="true">
              <rect x="2" y="2" width="36" height="52" rx="4" /><line x1="2" y1="28" x2="38" y2="28" /><line x1="20" y1="28" x2="20" y2="54" />
              <rect className="hl-r" x="20" y="28" width="18" height="26" /><rect className="hl-l" x="2" y="28" width="18" height="26" />
            </svg>
            <div className="grow"><b>{x.name}</b><small>{x.desc}</small></div>
          </button>
        ))}
      </div>
      <Button full variant="q" disabled={!value} onClick={onNext}>تموم شد!</Button>
    </div>
  )
}

function Done({ form, onEnter: enter }) {
  const { config } = useStore()
  const [busy, setBusy] = useState(false)
  const onEnter = async () => { if (busy) return; setBusy(true); if (!(await enter())) setBusy(false) }
  const w = config.welcome || {}
  const gift = [w.xp > 0 && `+${fa(w.xp)} XP`, w.wallet > 0 && `${fa(Math.round(w.wallet / 1000))} هزار تومان اعتبار هدیه`].filter(Boolean).join('، ')
  return (
    <div className="done">
      <motion.div className="done-badge" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        <LevelPill id={form.level} big />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{form.name}، آماده‌اید!</motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.45 }}>سطح شروع: {form.level}، رتبه‌ی باشگاه: تازه‌وارد</motion.p>
      {gift && <motion.div className="xp-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}>{gift}</motion.div>}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} style={{ width: '100%' }}>
        <Button full variant="q" disabled={busy} onClick={onEnter}>{busy ? 'در حال ساخت حساب…' : 'بریم!'}</Button>
      </motion.div>
    </div>
  )
}
