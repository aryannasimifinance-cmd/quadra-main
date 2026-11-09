import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { MEMBERS, hash, coachById, courtById, dayKey, dayLabel, dayNum, fa, nextDays, range, toman } from '../../data'
import { chime, haptic } from '../../fx'
import { ME, useStore } from '../../store'
import { isUpcoming, myBookings, myInvites, openGames, startsAt } from '../../select'
import { Avatar, Button, Chips, Icon, LevelPill, Photo, Sheet } from '../../components/ui'
import { GameCard } from '../wizard/Wizard'

export default function Games({ nav }) {
  const { club, user, declineInvite, toast } = useStore()
  const [seg, setSeg] = useState('mine')
  const invites = myInvites(club)
  const [day, setDay] = useState('all')
  const mine = myBookings(club)
  const up = mine.filter(isUpcoming), past = mine.filter((b) => !isUpcoming(b)).reverse()
  const days = useMemo(() => nextDays(7), [])
  const open = openGames(club, user.level).filter((g) => !g.mine && (day === 'all' || g.date === day))
  const [sel, setSel] = useState(null)

  return (
    <div className="page">
      <header className="page-head">
        <h1>بازی‌ها</h1>
        <div className="seg">
          {[['mine', `بازی‌های من${up.length ? '، ' + fa(up.length) : ''}`], ['inv', `دعوت‌ها${invites.length ? '، ' + fa(invites.length) : ''}`], ['open', 'بازی‌های باز']].map(([id, n]) => (
            <button key={id} className={seg === id ? 'on' : ''} onClick={() => { haptic(6); setSeg(id) }}>
              {seg === id && <motion.span layoutId="seg-g" className="seg-bg" />}<span>{n}</span>
            </button>
          ))}
        </div>
      </header>
      <AnimatePresence mode="wait">
        {seg === 'mine' ? (
          <motion.div key="m" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="page-body">
            {up.length === 0 && (
              <div className="empty-hero">
                <Photo src="./img/ball-court.jpg" />
                <div><b>هنوز بازی‌ای ندارید</b><p>اولین بازیتون رو بسازید — کمتر از یک دقیقه.</p><Button variant="q" onClick={() => nav.start({})}>بازی بسازید</Button></div>
              </div>
            )}
            {up.map((b, i) => <MyGame key={b.id} b={b} i={i} onClick={() => setSel(b.id)} />)}
            {past.length > 0 && <p className="label">گذشته</p>}
            {past.slice(0, 8).map((b, i) => <MyGame key={b.id} b={b} i={i} past />)}
          </motion.div>
        ) : seg === 'inv' ? (
          <motion.div key="i" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="page-body">
            <p className="muted">بازی‌های خصوصی که دوستانتان شما را به آن دعوت کرده‌اند. فقط دعوت‌شده‌ها این بازی‌ها را می‌بینند.</p>
            {invites.length === 0 && <div className="empty-card">فعلاً دعوتی ندارید.</div>}
            {invites.map((g) => (
              <div key={g.id} className="invite-card">
                <div className="ic-top"><Avatar name={nameOf(g.by, user)} size={36} /><div className="grow"><b>{nameOf(g.by, user)}</b><small>شما را به بازی خصوصی دعوت کرده</small></div><span className="pill-ink">خصوصی</span></div>
                <div className="ic-mid"><b>{dayLabel(g.date)}، {range(g.start, g.dur)}</b><small>{courtById(g.court).name}، {fa(4 - g.players.length)} جای خالی، سهم شما {toman((g.full ?? g.price) / 4)}</small></div>
                <div className="ic-ppl">{g.players.map((p) => <Avatar key={p} name={nameOf(p, user)} size={28} />)}</div>
                <div className="ic-cta">
                  <Button small variant="q" onClick={() => nav.start({ intent: 'match', gameId: g.id })}>قبول و پرداخت سهم</Button>
                  <Button small variant="ghost" onClick={() => { declineInvite(g.id); toast({ icon: '👋', title: 'دعوت رد شد' }) }}>نمی‌آیم</Button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="o" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="page-body">
            <Chips id="gd" scroll small value={day} onChange={setDay} options={[{ id: 'all', name: 'همه' }, ...days.map((d) => ({ id: dayKey(d), name: `${dayLabel(d)} ${dayNum(d)}` }))]} />
            <div className="og-list">
              {open.length === 0 && <div className="empty-card">این روز بازی بازی نیست.</div>}
              {open.map((g) => <GameCard key={g.id} g={g} onClick={() => nav.start({ intent: 'match', gameId: g.id })} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <GameSheet id={sel} onClose={() => setSel(null)} />
    </div>
  )
}

export const refCode = (id) => 'Q' + String(Math.floor(hash(id) * 9e5) + 1e5)
export const nameOf = (id, user) => id === ME ? (user?.name || 'شما') : id?.startsWith('f:') ? id.slice(2) : MEMBERS.find((m) => m.id === id)?.name || 'بازیکن'

function MyGame({ b, i, past, onClick }) {
  const { user } = useStore()
  const c = courtById(b.court)
  const label = b.type === 'open' ? `بازی باز، ${fa(b.players.length)}/۴` : b.type === 'coach' ? `کلاس، ${coachById(b.coach)?.name}` : 'رزرو خصوصی'
  return (
    <motion.button className={`my-game ${past ? 'past' : ''}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={past ? {} : { scale: 0.98 }} onClick={onClick}>
      <div className="mg-date"><b>{dayNum(new Date(startsAt(b)))}</b><small>{dayLabel(b.date)}</small></div>
      <div className="grow">
        <b>{range(b.start, b.dur)}</b>
        <small>{c.name}، {label}</small>
        {b.players?.length > 0 && <small className="mg-names">{b.by === ME ? 'سازنده: شما' : `سازنده: ${nameOf(b.by, user)}`}{b.players.length > 1 && `، ${b.players.filter((p) => p !== b.by).map((p) => p === ME ? 'شما' : nameOf(p, user).split(' ')[0]).join('، ')}`}</small>}
      </div>
      {b.type === 'open' && !past && b.players.length < 4 && <span className="pulse-dot" />}
      <div className="mg-ppl">{b.players.slice(0, 4).map((p, k) => <Avatar key={k} name={nameOf(p, user)} size={24} me={p === ME} />)}</div>
    </motion.button>
  )
}

function GameSheet({ id, onClose }) {
  const { club, user, cancelMine, toast } = useStore()
  const b = id && club.bookings.find((x) => x.id === id)
  const [confirm, setConfirm] = useState(false)
  if (!b) return <Sheet open={false} onClose={onClose} />
  const c = courtById(b.court)
  const hoursLeft = (startsAt(b) - Date.now()) / 36e5
  const cancel = async () => {
    setConfirm(false)
    const r = await cancelMine(b.id)
    if (r.error) { if (!r.shown) toast({ icon: '⛔', title: r.error === 'late' ? 'کمتر از ۶ ساعت مانده و لغو ممکن نیست' : 'لغو انجام نشد', body: r.error === 'late' ? '' : 'این رزرو تغییر کرده؛ صفحه به‌روز شد.' }); return }
    chime('tap'); onClose()
    toast({ icon: '↩️', title: 'لغو شد', body: 'مبلغ پرداختی به کیف پولتون برگشت' })
  }
  const share = () => {
    const text = `بیا کوادرا پدل بازی کنیم! ${dayLabel(b.date)} ${range(b.start, b.dur)}، ${c.name}`
    if (navigator.share) navigator.share({ title: 'QUADRA', text }).catch(() => {})
    else { navigator.clipboard?.writeText(text); toast({ icon: '🔗', title: 'دعوت کپی شد' }) }
  }
  return (
    <Sheet open={!!id} onClose={() => { setConfirm(false); onClose() }}>
      <div className="gs">
        <div className="gs-photo"><Photo src={c.img} /><div className="gs-shade" /><div><small>{c.name}، {c.kind}</small><h3>{dayLabel(b.date)}، {range(b.start, b.dur)}</h3></div></div>
        <div className="gs-ppl">
          {[0, 1, 2, 3].map((k) => b.players[k] ? (
            <div key={k} className="gs-p"><Avatar name={nameOf(b.players[k], user)} me={b.players[k] === ME} size={48} /><small>{b.players[k] === ME ? 'شما' : nameOf(b.players[k]).split(' ')[0]}</small>
              {MEMBERS.find((m) => m.id === b.players[k]) && <LevelPill id={MEMBERS.find((m) => m.id === b.players[k]).level} />}</div>
          ) : <div key={k} className="gs-p"><Avatar empty size={48} /><small>{b.type === 'open' ? 'در جستجو' : 'خالی'}</small></div>)}
        </div>
        <div className="gs-rows">
          <div><span>نوع</span><b>{b.type === 'open' ? 'بازی باز' : b.type === 'coach' ? 'کلاس مربی' : 'رزرو خصوصی'}</b></div>
          <div><span>مبلغ کل</span><b>{toman(b.price)}</b></div>
          {b.levels && <div><span>سطح‌ها</span><b>{b.levels.join('، ')}</b></div>}
          <div><span>کد رزرو</span><b dir="ltr">{refCode(b.id)}</b></div>
        </div>
        <div className="gs-cta">
          <Button variant="dark" icon="users" onClick={share}>دعوت دوست</Button>
          {!confirm ? (
            <Button variant="ghost" disabled={hoursLeft < 6} onClick={() => setConfirm(true)}>{hoursLeft < 6 ? 'لغو ممکن نیست' : 'لغو'}</Button>
          ) : (
            <Button variant="danger" onClick={cancel}>مطمئنم، لغو شود</Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
