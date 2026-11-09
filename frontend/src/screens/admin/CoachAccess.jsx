// پنل مربی‌ها (سمت مدیر): درخواست‌های رزرو زمینِ مربی‌ها برای تأیید، دسترسی هر مربی و سقف‌های رزرو
import { useState } from 'react'
import { COACHES, courtById, dayMonth, fa, fromKey, limitsOf, range, todayKey, weekday } from '../../data'
import { chime } from '../../fx'
import { coachCaps, coachLimits, isFree, openHours, useStore } from '../../store'
import { Icon } from '../../components/ui'
import { who } from './derive'
import { Card, Empty, Seg } from './kit'

const day = (k) => `${weekday(fromKey(k))} ${dayMonth(fromKey(k))}`
const ST = { pending: ['در انتظار', 'warn'], ok: ['تأیید شد', 'ok'], rejected: ['رد شد', 'bad'], cancelled: ['لغو مربی', 'mute'] }
const Step = ({ value, set, min = 0, max = 40, unit = 'ساعت' }) => (
  <span className="num-step"><button type="button" onClick={() => set(Math.max(min, value - 1))} aria-label="کمتر"><Icon name="minus" size={13} /></button><b>{fa(value)} {unit}</b><button type="button" onClick={() => set(Math.min(max, value + 1))} aria-label="بیشتر"><Icon name="plus" size={13} /></button></span>
)

export function CoachPanel() {
  const { club } = useStore()
  const reqs = club.coachReqs || []
  const pending = reqs.filter((r) => r.status === 'pending').sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
  const past = reqs.filter((r) => r.status !== 'pending').sort((a, b) => (b.done || b.at) - (a.done || a.at)).slice(0, 12)
  return (
    <div className="stack">
      <Card title="درخواست‌های رزرو زمین" sub={pending.length ? `${fa(pending.length)} درخواست منتظر تأیید شما` : 'درخواست منتظری نیست'}>
        {pending.length ? <div className="cr-list">{pending.map((r) => <Req key={r.id} r={r} />)}</div> : <Empty>وقتی مربی‌ای از پنلش زمین رزرو کند، این‌جا برای تأیید می‌آید.</Empty>}
        {past.length > 0 && (
          <details className="cr-past"><summary>درخواست‌های قبلی ({fa(past.length)})</summary>
            {past.map((r) => { const c = COACHES.find((x) => x.id === r.coach); return <div key={r.id}><b>{c?.name}</b><span>{day(r.date)}، <bdi dir="ltr">{range(r.start, r.dur)}</bdi>، {courtById(r.court).name}</span><em className={`badge-st ${ST[r.status][1]}`}><i />{ST[r.status][0]}</em></div> })}
          </details>
        )}
      </Card>
      <OpenCard />
      <Card title="دسترسی و سقف رزرو هر مربی" sub="نام کاربری و رمز بگذارید، ورود را تأیید کنید و سقف رزرو روزانه و هفتگی‌اش را تعیین کنید">
        <div className="ca-list">{club.coaches.map((c) => <Access key={c.id} c={c} />)}</div>
      </Card>
      <LimitsCard />
    </div>
  )
}

// سقف پشت‌سرهم برای همه: مربی‌ها و بازیکن‌های اپ (در «تنظیمات» هم هست)
export function LimitsCard() {
  const { club, adminLimits, toast } = useStore()
  const [l, setL] = useState(() => limitsOf(club))
  const changed = l.coachRun !== limitsOf(club).coachRun || l.playerRun !== limitsOf(club).playerRun
  return (
    <Card title="سقف رزرو پشت‌سرهم" sub="حداکثر چند ساعت پشت هم می‌شود یک زمین را گرفت">
      <div className="lim-row">
        <label><small>مربی‌ها</small><Step value={l.coachRun} set={(coachRun) => setL({ ...l, coachRun })} min={1} max={10} /></label>
        <label><small>بازیکن‌های اپ</small><Step value={l.playerRun} set={(playerRun) => setL({ ...l, playerRun })} min={1} max={6} /></label>
        <button className="adm-btn primary sm" disabled={!changed} onClick={() => { adminLimits(l); chime('success'); toast({ icon: '⏱', title: 'سقف پشت‌سرهم ذخیره شد', body: `مربی ${fa(l.coachRun)} ساعت، بازیکن ${fa(l.playerRun)} ساعت` }) }}>ذخیره</button>
      </div>
    </Card>
  )
}

function Req({ r }) {
  const { club, adminCoachReq, toast } = useStore()
  const c = club.coaches.find((x) => x.id === r.coach)
  const free = isFree(club, r.date, r.court, r.start, r.dur)
  const act = (ok) => {
    const res = adminCoachReq(r.id, ok)
    if (res.error === 'busy') { toast({ icon: '⛔', title: 'این ساعت دیگر خالی نیست', body: 'درخواست را رد کنید یا زمین را آزاد کنید' }); return }
    chime(ok ? 'success' : 'tap')
    toast({ icon: ok ? '✅' : '✖️', title: ok ? 'رزرو تأیید شد' : 'درخواست رد شد', body: ok ? `${c?.name}، ${day(r.date)}، در تقویم ثبت شد` : 'مربی در پنلش می‌بیند' })
  }
  return (
    <div className="cr">
      <div className="cr-ph" style={{ backgroundImage: `url(${c?.img})` }} />
      <div className="cr-m">
        <b>{c?.name}</b>
        <span>{day(r.date)}، <bdi dir="ltr">{range(r.start, r.dur)}</bdi>، {courtById(r.court).name}</span>
        <small>{r.student ? `شاگرد: ${who(r.student)}` : 'شاگرد مشخص نشده'}{r.note ? `، «${r.note}»` : ''}</small>
        {!free && <small className="cr-warn">این ساعت دیگر خالی نیست</small>}
      </div>
      <div className="cr-btns">
        <button className="adm-btn ghost sm" onClick={() => act(false)}>رد</button>
        <button className="adm-btn primary sm" disabled={!free} onClick={() => act(true)}><Icon name="check" size={15} />تأیید</button>
      </div>
    </div>
  )
}

function Access({ c }) {
  const { club, adminCoachLogin, toast } = useStore()
  const base = () => ({ on: false, user: '', pass: '', ...c.login, ...coachCaps(c) })
  const [f, setF] = useState(base)
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const user = f.user.trim().toLowerCase()
  const dup = user && (user === 'admin' || !!club.logins?.[user] || club.coaches.some((x) => x.id !== c.id && x.login?.user?.toLowerCase() === user))
  // رمز روی سرور به‌شکل رمزنگاری‌شده نگه داشته می‌شود و دوباره نمایش داده نمی‌شود؛ خالی گذاشتن = همان رمز قبلی
  const hasPass = !!c.login?.set
  const passOk = f.pass ? f.pass.length >= 6 : hasPass
  const valid = /^[a-z0-9._-]{3,}$/.test(user) && passOk && !dup
  const changed = JSON.stringify({ ...f, user }) !== JSON.stringify(base())
  const save = () => {
    const { hours, set, ...rest } = f // eslint-disable-line no-unused-vars
    adminCoachLogin(c.id, { ...rest, user })
    chime('success'); toast({ icon: '🔑', title: f.on ? `ورود ${c.name} فعال است` : `ورود ${c.name} بسته شد`, body: f.on ? (f.pass ? `نام کاربری ${user}، رمز ${f.pass} — همین حالا یادداشت کنید` : `نام کاربری ${user}`) : 'نمی‌تواند وارد پنل شود', duration: f.pass ? 9000 : 3200 })
    set0('')
  }
  const set0 = (pass) => setF((o) => ({ ...o, pass }))
  const lim = coachLimits(club, c, todayKey())
  return (
    <div className={`ca-row ${c.login?.on ? 'on' : ''}`}>
      <div className="ca-who">
        <div className="cr-ph" style={{ backgroundImage: `url(${c.img})` }} />
        <div><b>{c.name}</b><small>{c.login?.on ? `این هفته ${fa(lim.week)} از ${fa(lim.caps.week)} ساعت مانده` : c.login?.user ? 'منتظر تأیید شما' : 'هنوز دسترسی ندارد'}</small></div>
      </div>
      <label><small>نام کاربری</small><input dir="ltr" value={f.user} onChange={(e) => set({ user: e.target.value.replace(/\s/g, '') })} placeholder="مثلاً kimia" className={dup ? 'bad' : ''} /></label>
      <label><small>رمز</small><span className="pw-row"><input dir="ltr" value={f.pass} placeholder={hasPass ? 'بدون تغییر' : 'حداقل ۶ کاراکتر'} onChange={(e) => set({ pass: e.target.value })} /><button type="button" className="adm-btn ghost sm" onClick={() => set({ pass: String(Math.floor(100000 + Math.random() * 900000)) })} data-tip="رمز ۶ رقمی تازه">تازه</button></span></label>
      <label><small>سقف روزانه</small><Step value={f.day} set={(v) => set({ day: v })} max={12} /></label>
      <label><small>سقف هفتگی</small><Step value={f.week} set={(v) => set({ week: v })} max={60} /></label>
      <label><small>ورود</small><Seg value={f.on ? 'on' : 'off'} onChange={(v) => set({ on: v === 'on' })} options={{ off: 'بسته', on: 'تأیید' }} /></label>
      <button className="adm-btn primary sm ca-save" disabled={!changed || dup || (f.on && !valid) || (!!f.pass && f.pass.length < 6) || (!!user && !/^[a-z0-9._-]{3,}$/.test(user))} onClick={save} data-tip={dup ? 'این نام کاربری گرفته شده' : f.on && !valid ? 'نام کاربری انگلیسی (۳ حرف) و رمز حداقل ۶ کاراکتری لازم است' : ''}>ذخیره</button>
    </div>
  )
}

// ساعت‌هایی که مدیر تأیید کرده ولی مربی هنوز شاگردشان را مشخص نکرده
function OpenCard() {
  const { club } = useStore()
  const open = club.coaches.flatMap((c) => openHours(club, c.id).map((b) => ({ ...b, c })))
  if (!open.length) return null
  return (
    <Card title="ساعت‌های تأییدشده بدون شاگرد" sub="مربی باید شاگرد این ساعت‌ها را در پنلش مشخص کند؛ تا آن موقع درخواست تازه نمی‌تواند بدهد">
      <div className="cr-past open">{open.map((b) => <div key={b.id}><b>{b.c.name}</b><span>{day(b.date)}، <bdi dir="ltr">{range(b.start, b.dur)}</bdi>، {courtById(b.court).name}</span><em className="badge-st warn"><i />بدون شاگرد</em></div>)}</div>
    </Card>
  )
}
