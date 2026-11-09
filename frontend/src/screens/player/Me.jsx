import { motion } from 'framer-motion'
import { jParts } from '../../jalali'
import { useState } from 'react'
import { BADGES, COACHES, CREDITS, RANKS, XP_GUIDE, fa, levelById, productById, rankOf, sideById, toman, USER_RE, todayKey } from '../../data'
import { celebrate, chime, haptic } from '../../fx'
import { ME, myPoints, useStore } from '../../store'
import { activeMembership, myBookings, isUpcoming } from '../../select'
import { Avatar, Button, CountUp, Icon, LevelPill, Ring, SectionHead, Sheet } from '../../components/ui'
import { leaderboard } from './Home'
import { Loading } from '../../components/Logo'

export default function Me({ nav }) {
  const s = useStore()
  const { user, xp, badges, wallet, club, logout, topUp, toast } = s
  const [acc, setAcc] = useState(false)
  const upcoming = myBookings(club).filter(isUpcoming)
  const rank = rankOf(xp)
  const pts = myPoints(s)
  const pos = leaderboard(pts, user.name).findIndex((x) => x.me) + 1
  const games = myBookings(club).length
  const mem = activeMembership(s)
  const orders = club.orders.filter((o) => o.by === ME)
  const [badge, setBadge] = useState(null)
  const [top, setTop] = useState(false)

  // شارژ از درگاه بانک؛ بعد از برگشت به اپ، نتیجه نشان داده می‌شود
  const [topBusy, setTopBusy] = useState(false)
  const doTop = async (n) => {
    if (topBusy) return
    setTopBusy(true)
    const r = await topUp(n)
    setTopBusy(false)
    if (r?.error && !r.shown) toast({ icon: '⛔', title: 'شارژ انجام نشد' })
  }

  return (
    <div className="page me">
      <section className="me-head">
        <div className="me-bg" style={{ backgroundImage: "radial-gradient(circle at 85% 0%, rgba(5,224,218,.35), transparent 50%), url(./img/tiles.jpg)" }} />
        <div className="me-row">
          <Ring value={rank.progress} size={84} stroke={5} track="rgba(255,255,255,.15)"><Avatar name={user.name} size={64} me /></Ring>
          <div className="grow">
            <h2>{user.name}</h2>
            <p><LevelPill id={user.level} /> {levelById(user.level).title}{user.side ? `، ${sideById(user.side).name}` : ''}، <span style={{ color: rank.c === '#141413' ? '#fff' : rank.c }}>{rank.name}</span></p>
          </div>
        </div>
        <div className="me-xp">
          <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${rank.progress * 100}%` }} transition={{ duration: 1 }} /></div>
          <small>{fa(xp)} XP {rank.next && `، ${fa(rank.next.xp - xp)} تا ${rank.next.name}`}</small>
        </div>
        <div className="me-stats">
          <button onClick={() => nav.tab('games')}><b><CountUp to={games} /></b><small>بازی</small></button>
          <button onClick={() => nav.open('ranking')}><b>#<CountUp to={pos} /></b><small>رنکینگ در باشگاه</small></button>
          <button onClick={() => nav.open('ranking')}><b><CountUp to={pts} /></b><small>امتیاز</small></button>
          <button><b><CountUp to={badges.length} /></b><small>نشان</small></button>
        </div>
      </section>

      <div className="page-body">
        <div className="wallet-card">
          <div><small>کیف پول</small><b><CountUp to={wallet} format={(v) => toman(v)} /></b></div>
          <Button small variant="q" icon="plus" onClick={() => setTop(true)}>شارژ</Button>
        </div>

        <div className="assets">
          <button className="asset" onClick={() => nav.open('packages')}>
            <Icon name="ticket" /><b>{fa(upcoming.filter((b) => b.series && b.type !== 'coach').length)}</b><small>جلسه‌ی پکیج زمین</small>
          </button>
          <button className="asset" onClick={() => nav.open('coaches')}>
            <Icon name="coach" /><b>{fa(upcoming.filter((b) => b.type === 'coach').length)}</b><small>جلسه‌ی مربی پیش رو</small>
          </button>
          <button className={`asset ${mem ? 'gold' : ''}`} onClick={() => nav.open('packages')}>
            <Icon name="crown" /><b>{mem ? mem.name.replace('عضویت ', '') : '—'}</b><small>{mem ? `${fa(Math.ceil((s.membership.until - Date.now()) / 864e5))} روز مانده` : 'عضویت'}</small>
          </button>
        </div>

        <motion.button className="jr-teaser" whileTap={{ scale: 0.98 }} onClick={() => nav.open('journey')}>
          <div className="jr-steps">
            {RANKS.map((r, i) => <i key={r.name} className={i <= rank.index ? 'on' : ''} style={{ '--c': r.c }} />)}
          </div>
          <div className="grow">
            <b>مسیر باشگاه</b>
            <small>{rank.name}، {fa(badges.length)} از {fa(BADGES.length)} نشان، چالش‌های هفته</small>
          </div>
          <Icon name="fwd" size={18} />
        </motion.button>

        {orders.length > 0 && (<>
          <SectionHead title="سفارش‌های من" />
          {orders.map((o) => (
            <div key={o.id} className="order-row">
              <div className="grow"><b dir="ltr">{o.id}</b><small>{o.items.map((x) => productById(x.pid).name).join('، ')}</small></div>
              <span className={`st st-${o.status}`}>{{ new: 'در حال آماده‌سازی', ready: 'آماده‌ی تحویل', delivered: 'تحویل شد' }[o.status]}</span>
            </div>
          ))}
        </>)}

        <div className="menu-list">
          {[['sparkle', 'مسیر باشگاه: رتبه‌ها و نشان‌ها', 'journey'], ['trophy', 'رنکینگ باشگاه', 'ranking'], ['ticket', 'پکیج‌ها و عضویت', 'packages'], ['coach', 'مربی‌ها و کلاس‌ها', 'coaches'], ['star', 'مسابقه‌ها و تورنمنت‌ها', 'events'], ['bell', 'اعلان‌ها', 'notifs']].map(([ic, n, pg]) => (
            <button key={pg} onClick={() => nav.open(pg)}><Icon name={ic} /><span>{n}</span><Icon name="fwd" size={16} /></button>
          ))}
          <button onClick={() => setAcc(true)}><Icon name="lock" /><span>مشخصات و ورود با رمز</span>{!user?.username && <em className="menu-dot">تنظیم نشده</em>}<Icon name="fwd" size={16} /></button>
          <button className="danger" onClick={() => { haptic(10); logout() }}><Icon name="logout" /><span>خروج از حساب</span></button>
        </div>
        <details className="credits"><summary>منابع تصاویر</summary>{CREDITS.map((c) => <small key={c}>{c}</small>)}</details>
      </div>

      <Sheet open={!!badge} onClose={() => setBadge(null)}>
        {badge && (
          <div className="badge-detail">
            <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>{badges.includes(badge.id) ? badge.icon : '🔒'}</motion.span>
            <h3>{badge.name}</h3><p className="muted">{badge.desc}</p>
            <p className="pill-ink">{badges.includes(badge.id) ? 'باز شده، +۱۵ XP' : 'هنوز قفله'}</p>
          </div>
        )}
      </Sheet>
      <Sheet open={acc} onClose={() => setAcc(false)} title="مشخصات و ورود با رمز">{acc && <Account onDone={() => setAcc(false)} />}</Sheet>
      <Sheet open={top} onClose={() => setTop(false)} title="شارژ کیف پول">
        <div className="topup">
          {[500000, 1000000, 2000000, 5000000].map((n) => <Button key={n} variant="ghost" disabled={topBusy || !s.config?.pay} onClick={() => doTop(n)}>{toman(n)}</Button>)}
          <p className="hint">{s.config?.pay ? 'پرداخت از درگاه امن بانکی انجام می‌شود و بعد از برگشت، کیف پول شارژ شده است.' : 'پرداخت آنلاین به‌زودی فعال می‌شود؛ تا آن موقع می‌توانید در پذیرش باشگاه شارژ کنید.'}</p>
          <Loading show={topBusy} text="اتصال به درگاه پرداخت…" />
        </div>
      </Sheet>
    </div>
  )
}

// جنسیت و سال تولد (برای رویدادهای ویژه) و نام کاربری/رمز برای ورود بدون پیامک
function Account({ onDone }) {
  const { user, updateProfile, setLogin, loginTaken, toast } = useStore()
  const J = jParts(todayKey()).y
  const [g, setG] = useState(user?.gender || null)
  const [b, setB] = useState(user?.birth ? String(user.birth) : '')
  const [u, setU] = useState(user?.username || '')
  const [p, setP] = useState('')
  const y = +b, okY = !b || (y >= J - 90 && y <= J - 7)
  const uChanged = u !== (user?.username || '')
  const badU = u && !USER_RE.test(u), dup = USER_RE.test(u) && loginTaken(u, user?.phone)
  const wantsLogin = uChanged || p
  const okLogin = !wantsLogin || (USER_RE.test(u) && !dup && (p.length >= 6 || (!p && user?.username)))
  const ok = okY && okLogin && (g !== (user?.gender || null) || y !== (user?.birth || 0) || wantsLogin)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    const pr = await updateProfile({ gender: g, birth: y || null })
    if (pr?.error) { setBusy(false); if (!pr.shown) toast({ icon: '⛔', title: 'ذخیره نشد' }); return }
    if (wantsLogin) { const r = await setLogin(u, p); if (r.error) { setBusy(false); if (!r.shown || r.error === 'bad') toast({ icon: '⛔', title: r.error === 'taken' ? 'این نام کاربری گرفته شده' : 'نام کاربری یا رمز درست نیست' }); return } }
    setBusy(false)
    chime('success'); toast({ icon: '✅', title: 'ذخیره شد', body: wantsLogin ? `از این به بعد با «${u}» هم وارد می‌شوید` : 'مشخصات به‌روز شد' }); onDone()
  }
  return (
    <div className="acc-form">
      <p className="label">جنسیت</p>
      <div className="gender-pick">{[['f', 'خانم', '👩'], ['m', 'آقا', '👨']].map(([id, n, e]) => <button key={id} type="button" className={g === id ? 'on' : ''} onClick={() => setG(id)}><i>{e}</i><b>{n}</b></button>)}</div>
      <p className="label">سال تولد (شمسی){y && okY ? ` — ${fa(J - y)} ساله` : ''}</p>
      <input className="acc-in" inputMode="numeric" dir="ltr" maxLength={4} placeholder="مثلاً ۱۳۷۵" value={b} onChange={(e) => setB(e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').slice(0, 4))} />
      {!okY && <p className="acc-bad">سال تولد شمسی را درست وارد کنید.</p>}
      <p className="label">ورود بدون پیامک</p>
      <p className="muted small">اگر پیامک نرسید، در صفحه‌ی ورود «ورود با نام کاربری و رمز» را بزنید.</p>
      <input className="acc-in" dir="ltr" autoCapitalize="none" placeholder="username" value={u} onChange={(e) => setU(e.target.value.replace(/\s/g, '').toLowerCase().slice(0, 20))} />
      {badU && <p className="acc-bad">فقط حروف انگلیسی کوچک، عدد، نقطه و زیرخط؛ حداقل ۳ حرف.</p>}
      {dup && <p className="acc-bad">این نام کاربری گرفته شده.</p>}
      <input className="acc-in" dir="ltr" type="password" autoComplete="new-password" placeholder={user?.username ? 'رمز تازه (اگر می‌خواهید عوض کنید)' : 'رمز، حداقل ۶ کاراکتر'} value={p} onChange={(e) => setP(e.target.value)} />
      {p && p.length < 6 && <p className="acc-bad">رمز حداقل ۶ کاراکتر.</p>}
      <Button full variant="q" disabled={!ok || busy} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</Button>
    </div>
  )
}
