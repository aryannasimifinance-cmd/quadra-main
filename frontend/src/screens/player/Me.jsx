import { motion } from 'framer-motion'
import { J_MONTHS, faDigits, jParts } from '../../jalali'
import { useState } from 'react'
import { BADGES, COACHES, CREDITS, RANKS, XP_GUIDE, fa, levelById, productById, rankOf, sideById, toman, USER_RE, todayKey } from '../../data'
import { celebrate, chime, haptic } from '../../fx'
import { ME, myPoints, useStore } from '../../store'
import { activeMembership, myBookings, isUpcoming } from '../../select'
import { Avatar, Button, CountUp, Icon, LevelPill, SectionHead, Sheet } from '../../components/ui'
import { leaderboard } from './Home'
import { Loading, BrandBar } from '../../components/Logo'

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
    <div className="page me me2">
      {/* کارت بازیکن: مثل کارت عضویت باشگاه */}
      <section className="pc">
        <BrandBar />
        <div className="pc-card">
          <span className="pc-jersey" aria-hidden="true">{user.level}</span>
          <div className="pc-top">
            <Avatar name={user.name} size={58} me />
            <div className="grow">
              <small>کارت بازیکن کوادرا</small>
              <h2>{user.name}</h2>
            </div>
          </div>
          <div className="pc-tags">
            <span className="pc-lvl"><LevelPill id={user.level} />{levelById(user.level).title}</span>
            {user.side && <span>{sideById(user.side).name}</span>}
            <span style={{ '--rc': rank.c === '#141413' ? 'var(--ink)' : rank.c }} className="pc-rank">{rank.name}</span>
          </div>
          <div className="pc-xp">
            <div className="pc-xp-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${rank.progress * 100}%` }} transition={{ duration: 1 }} /></div>
            <div className="pc-xp-t"><b>{fa(xp)} XP</b>{rank.next && <small>{fa(rank.next.xp - xp)} تا {rank.next.name}</small>}</div>
          </div>
        </div>
        <div className="pc-stats">
          <button onClick={() => nav.tab('games')}><b><CountUp to={games} /></b><small>بازی</small></button>
          <button onClick={() => nav.open('ranking')}><b>#<CountUp to={pos} /></b><small>رنکینگ</small></button>
          <button onClick={() => nav.open('ranking')}><b><CountUp to={pts} /></b><small>امتیاز</small></button>
          <button onClick={() => nav.open('journey')}><b><CountUp to={badges.length} /></b><small>نشان</small></button>
        </div>
      </section>

      <div className="page-body">
        {/* کیف پول: بلیت با خط برش */}
        <div className="wallet2">
          <div className="grow"><small><Icon name="wallet" size={15} />کیف پول</small><b><CountUp to={wallet} format={(v) => toman(v)} /></b></div>
          <button className="w2-top" onClick={() => setTop(true)}><Icon name="plus" size={20} stroke={2.4} /><span>شارژ</span></button>
        </div>

        <div className="assets2">
          <button onClick={() => nav.open('packages')}>
            <Icon name="ticket" size={18} /><span>جلسه‌ی پکیج زمین</span><b>{fa(upcoming.filter((b) => b.series && b.type !== 'coach').length)}</b>
          </button>
          <button onClick={() => nav.open('coaches')}>
            <Icon name="coach" size={18} /><span>جلسه‌ی مربی پیش رو</span><b>{fa(upcoming.filter((b) => b.type === 'coach').length)}</b>
          </button>
          <button className={mem ? 'gold' : ''} onClick={() => nav.open('packages')}>
            <Icon name="crown" size={18} /><span>{mem ? `عضویت، ${fa(Math.ceil((s.membership.until - Date.now()) / 864e5))} روز مانده` : 'عضویت'}</span><b>{mem ? mem.name.replace('عضویت ', '') : '—'}</b>
          </button>
        </div>

        <motion.button className="jr2" whileTap={{ scale: 0.98 }} onClick={() => nav.open('journey')}>
          <div className="jr2-h"><b>مسیر باشگاه</b><small>{fa(badges.length)} از {fa(BADGES.length)} نشان</small></div>
          <div className="jr2-ladder">
            {RANKS.map((r, i) => <i key={r.name} className={i < rank.index ? 'done' : i === rank.index ? 'on' : ''} style={{ '--c': r.c }} title={r.name}><em>{i === rank.index ? r.name : ''}</em></i>)}
          </div>
        </motion.button>

        {orders.length > 0 && (<>
          <SectionHead title="سفارش‌های من" />
          {orders.map((o) => (
            <div key={o.id} className="order-card">
              <div className="oc-top">
                <div><small>سفارش</small><b dir="ltr">{o.id}</b></div>
                <span className={`st st-${o.status}`}>{{ new: 'در حال آماده‌سازی', ready: 'آماده‌ی تحویل', delivered: 'تحویل شد' }[o.status]}</span>
              </div>
              <ul className="oc-items">
                {o.items.map((x, i) => {
                  const p = productById(x.pid)
                  const v = p?.variants?.find((y) => y.sku === x.sku)
                  const opt = v ? [v.size, v.color].filter(Boolean).join(' / ') : ''
                  return <li key={i}><span>{p?.name || 'کالا'}{opt && <em>{opt}</em>}</span><small>× {fa(x.qty)}</small></li>
                })}
              </ul>
              <div className="oc-foot">
                <small>{o.at ? (() => { const d = new Date(o.at); const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; const j = jParts(k); return `${fa(j.d)} ${J_MONTHS[j.m - 1]} ${faDigits(j.y)}` })() : ''}</small>
                <b>{toman(o.total)}</b>
              </div>
            </div>
          ))}
        </>)}

        <div className="me-tiles">
          {[['sparkle', 'رتبه‌ها و نشان‌ها', 'journey'], ['trophy', 'رنکینگ', 'ranking'], ['ticket', 'پکیج و عضویت', 'packages'], ['coach', 'مربی‌ها و کلاس‌ها', 'coaches'], ['star', 'مسابقه‌ها', 'events'], ['bell', 'اعلان‌ها', 'notifs']].map(([ic, n, pg]) => (
            <motion.button key={pg} whileTap={{ scale: 0.95 }} onClick={() => nav.open(pg)}><Icon name={ic} size={20} /><span>{n}</span></motion.button>
          ))}
        </div>

        <div className="me-acts">
          <button onClick={() => setAcc(true)}><Icon name="lock" size={18} /><span>مشخصات و ورود با رمز</span>{!user?.username && <em className="menu-dot">تنظیم نشده</em>}<Icon name="fwd" size={16} /></button>
          <button className="danger" onClick={() => { haptic(10); logout() }}><Icon name="logout" size={18} /><span>خروج از حساب</span></button>
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
