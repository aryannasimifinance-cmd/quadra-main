// کافه‌ی باشگاه در اپ: منو، سفارش و تحویل در کافه یا سر زمین در حین بازی
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { courtById, fa, hourLabel, range, toman, todayKey } from '../../data'
import { CAFE_CATS, DRINKS, NOTES, ORDER_FLOW, ORDER_ST, available, cafeCat, fits, moreOf, priceOf, shortage } from '../../cafe'
import { myBookings, startsAt } from '../../select'
import { celebrate, chime, haptic } from '../../fx'
import { ME, useStore } from '../../store'
import { Button, Chips, Icon, Sheet, Stepper } from '../../components/ui'
import { Dish } from '../../components/Dish'
import { Loading } from '../../components/Logo'

// بازی‌های امروز کاربر که هنوز تمام نشده‌اند — برای تحویل سر زمین
export function courtTargets(club) {
  return myBookings(club).filter((b) => b.date === todayKey() && b.type !== 'block' && startsAt(b) + b.dur * 36e5 > Date.now() && startsAt(b) - 3 * 36e5 < Date.now())
}

export default function Cafe({ nav }) {
  const { club, cafeCart = [] } = useStore()
  const [cat, setCat] = useState('all')
  const [sel, setSel] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const n = cafeCart.reduce((s, x) => s + x.qty, 0)
  const total = cafeCart.reduce((s, x) => s + x.qty * priceOf(club.cafeItems.find((y) => y.id === x.iid), x.big), 0)
  const mine = club.cafeOrders.filter((o) => o.by === ME && o.status !== 'delivered')
  const targets = courtTargets(club)
  const list = club.cafeItems.filter((it) => it.active !== false && (cat === 'all' || it.cat === cat))
  const groups = (cat === 'all' ? CAFE_CATS : CAFE_CATS.filter((c) => c.id === cat)).map((c) => [c, list.filter((it) => it.cat === c.id)]).filter(([, l]) => l.length)

  return (
    <div className="page shop cafe">
      <header className="page-head">
        <ShopSwitch value="cafe" nav={nav} />
        <div className="row-between">
          <h1>کافه</h1>
          <motion.button className="cart-btn" whileTap={{ scale: 0.9 }} onClick={() => setShowCart(true)} aria-label="سفارش کافه">
            <Icon name="cup" />
            <AnimatePresence>{n > 0 && <motion.i key={n} initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} exit={{ scale: 0 }}>{fa(n)}</motion.i>}</AnimatePresence>
          </motion.button>
        </div>
      </header>

      {mine.map((o) => <Tracker key={o.id} o={o} />)}

      <motion.div className="cafe-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grow">
          <span className="pill-q">{targets.length ? 'تحویل سر زمین' : 'کافه‌ی کوادرا'}</span>
          <h3>{targets.length ? `${courtById(targets[0].court).name}، ${range(targets[0].start, targets[0].dur)}` : 'قبل یا بعد بازی، یه نوشیدنی خنک'}</h3>
          <p>{targets.length ? 'سفارش بدید، بین ست‌ها سر زمینتون میاریم.' : 'سفارش رو از اپ ثبت کنید، آماده که شد خبرتون می‌کنیم.'}</p>
        </div>
        <motion.span className="ch-art" animate={{ rotate: [-8, 6, -8], y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4 }}>{targets.length ? '🎾' : '🧋'}</motion.span>
      </motion.div>

      <div className="cats">
        {[{ id: 'all', name: 'همه', ic: '✦' }, ...CAFE_CATS].map((c) => (
          <motion.button key={c.id} className={`cat ${cat === c.id ? 'on' : ''}`} whileTap={{ scale: 0.92 }} onClick={() => { haptic(6); setCat(c.id) }}>
            {cat === c.id && <motion.span layoutId="cafe-cat-bg" className="cat-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <span className="cat-ic">{c.ic}</span><small>{c.name}</small>
          </motion.button>
        ))}
      </div>

      {groups.map(([c, items]) => (
        <section key={c.id} className="menu-sec">
          <h2>{c.ic} {c.name}</h2>
          {items.map((it) => {
            const ok = available(it, club.cafeIngs)
            const inCart = cafeCart.filter((x) => x.iid === it.id).reduce((s, x) => s + x.qty, 0)
            return (
              <motion.button key={it.id} layout className={`menu-row ${ok ? '' : 'out'}`} whileTap={ok ? { scale: 0.98 } : {}} onClick={() => ok && setSel(it.id)}>
                <Dish it={it} />
                <div className="grow">
                  <b>{it.name}{it.tag && <em className="m-tag">{it.tag}</em>}</b>
                  <small>{it.desc}</small>
                  <span>{ok ? toman(it.price) : 'فعلاً تمام شده'}</span>
                </div>
                {ok && <i className={`m-add ${inCart ? 'on' : ''}`}>{inCart ? fa(inCart) : <Icon name="plus" size={18} stroke={2.4} />}</i>}
              </motion.button>
            )
          })}
        </section>
      ))}

      <AnimatePresence>
        {n > 0 && (
          <motion.button className="cafe-bar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} onClick={() => setShowCart(true)}>
            <span><Icon name="cup" size={18} /> {fa(n)} قلم</span><b>مشاهده و پرداخت، {toman(total)}</b>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={!!sel} onClose={() => setSel(null)}>
        {sel && <Item key={sel} it={club.cafeItems.find((x) => x.id === sel)} onClose={() => setSel(null)} />}
      </Sheet>
      <Sheet open={showCart} onClose={() => setShowCart(false)} title="سفارش کافه" tall>
        <Cart onClose={() => setShowCart(false)} />
      </Sheet>
    </div>
  )
}

// سوییچ فروشگاه / کافه بالای هر دو صفحه
export function ShopSwitch({ value, nav }) {
  return (
    <div className="shop-switch" role="tablist">
      {[['shop', 'فروشگاه', 'bag'], ['cafe', 'کافه', 'cup']].map(([k, n, ic]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => value !== k && nav.tab(k)}>
          {value === k && <motion.span layoutId="shop-switch" className="ss-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span><Icon name={ic} size={17} />{n}</span>
        </button>
      ))}
    </div>
  )
}

export function Tracker({ o, onClick }) {
  const i = ORDER_FLOW.indexOf(o.status)
  return (
    <motion.div className="cafe-track" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={onClick}>
      <div className="row-between">
        <b>{o.status === 'ready' ? (o.to ? 'سفارشتون در راه زمینه' : 'سفارشتون آماده‌ست، از کافه بگیرید') : ORDER_ST[o.status]}</b>
        <small dir="ltr">{o.id}</small>
      </div>
      <small>{o.items.map((x) => `${fa(x.qty)}× ${x.name}`).join('، ')}، {o.to ? `سر ${courtById(o.to).name}` : 'تحویل در کافه'}</small>
      <div className="ct-steps">{ORDER_FLOW.slice(0, 3).map((s, k) => <i key={s} className={k <= i ? 'on' : ''}>{k === i && <motion.em animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }} />}</i>)}</div>
    </motion.div>
  )
}

function Item({ it, onClose }) {
  const { club, cafeAdd, cafeCart = [], toast } = useStore()
  const [big, setBig] = useState(false)
  const [note, setNote] = useState('')
  const [qty, setQty] = useState(1)
  const drink = DRINKS.includes(it.cat)
  // مواد کل سبد (حتی آیتم‌های دیگر با ماده‌ی مشترک) کنار گذاشته می‌شود
  const max = moreOf(it, big, club.cafeIngs, club.cafeItems, cafeCart)
  const add = () => {
    cafeAdd({ iid: it.id, big, note, qty })
    chime('success'); haptic([10, 30, 10])
    toast({ icon: it.emoji, title: 'به سفارش اضافه شد', body: it.name })
    onClose()
  }
  return (
    <div className="product cafe-item">
      <div className="ci-art"><Dish it={it} big /></div>
      <small className="pd-brand">{cafeCat(it.cat).name}، آماده در حدود {fa(it.prep)} دقیقه</small>
      <h2>{it.name}</h2>
      <p className="muted">{it.desc}</p>
      {it.big > 0 && (<><p className="label">سایز</p>
        <Chips id="cs" value={big ? 'b' : 'n'} onChange={(v) => { setBig(v === 'b'); setQty(1) }} options={[{ id: 'n', name: 'معمولی' }, { id: 'b', name: `بزرگ، +${toman(it.big)}` }]} /></>)}
      <p className="label">توضیح برای {drink ? 'باریستا' : 'آشپزخانه'}</p>
      <Chips id="cn" small scroll value={note} onChange={(v) => setNote(note === v ? '' : v)} options={NOTES.filter((x, i) => (drink ? i < 4 : i >= 4)).map((x) => ({ id: x, name: x }))} />
      <div className="pd-cta">
        <Stepper value={qty} onChange={setQty} min={1} max={Math.max(1, max)} />
        <Button full variant="q" disabled={!max} onClick={add}>{max ? `افزودن، ${toman(priceOf(it, big) * qty)}` : 'موجودی کافی نیست'}</Button>
      </div>
    </div>
  )
}

function Cart({ onClose }) {
  const { club, cafeCart = [], cafeQty, cafeCheckout, wallet, toast, config } = useStore()
  const payOn = !!config?.pay
  const targets = courtTargets(club)
  const [to, setTo] = useState(() => targets[0]?.court || 0)
  const [method, setMethod] = useState('wallet')
  const [busy, setBusy] = useState(false)
  const lines = useMemo(() => cafeCart.map((x) => ({ ...x, it: club.cafeItems.find((y) => y.id === x.iid) })).filter((x) => x.it), [cafeCart, club.cafeItems])
  const total = lines.reduce((s, x) => s + x.qty * priceOf(x.it, x.big), 0)
  const prep = Math.max(0, ...lines.map((x) => x.it.prep))
  const short = shortage(club.cafeIngs, club.cafeItems, cafeCart)
  const inStock = fits(club.cafeIngs, club.cafeItems, cafeCart)
  const ok = inStock && (method === 'wallet' ? wallet >= total : payOn)
  const pay = async () => {
    if (busy) return
    setBusy(true)
    const r = await cafeCheckout(method, to || null)
    setBusy(false)
    if (r.error) { if (!r.shown) toast({ icon: '⚠️', title: 'موجودی کافه تغییر کرد', body: 'بعضی آیتم‌ها همین حالا تمام شد؛ سبد را اصلاح کنید.' }); return }
    celebrate(); chime('level')
    toast({ icon: '☕', title: `سفارش ${r.order.id} ثبت شد`, body: `${to ? `سر ${courtById(to).name}` : 'تحویل در کافه'}، حدود ${fa(prep + 3)} دقیقه، +${fa(r.xp)} XP؛ آماده که شد خبرتون می‌کنیم.`, duration: 5000 })
    onClose()
  }
  if (!lines.length) return <div className="empty-card">هنوز چیزی انتخاب نکردید. یه آیس آمریکانو بعد بازی می‌چسبه 🧊</div>
  return (
    <div className="cart">
      {lines.map((x, i) => (
        <motion.div key={i} layout className="cart-item cafe-line" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Dish it={x.it} />
          <div className="grow"><b>{x.it.name}</b><small>{[x.big && 'بزرگ', x.note].filter(Boolean).join('، ') || cafeCat(x.it.cat).name}</small><span>{toman(priceOf(x.it, x.big) * x.qty)}</span></div>
          <Stepper value={x.qty} onChange={(q) => cafeQty(i, q)} max={x.qty + moreOf(x.it, x.big, club.cafeIngs, club.cafeItems, cafeCart)} />
        </motion.div>
      ))}
      {short.length > 0 && <div className="empty-card">این تعداد الان در کافه موجود نیست ({short.map(([g]) => g.name).join('، ')})؛ تعداد را کم کنید.</div>}
      {lines.some((x) => x.it.active === false) && <div className="empty-card">بعضی آیتم‌ها از منو برداشته شده‌اند؛ حذفشان کنید.</div>}
      <p className="label">تحویل</p>
      <div className="methods">
        {targets.map((b) => (
          <button key={b.id} className={`method ${to === b.court ? 'on' : ''}`} onClick={() => setTo(b.court)}>
            <Icon name="court" /><div className="grow"><b>سر {courtById(b.court).name}</b><small>بازی شما {hourLabel(b.start)} تا {hourLabel(b.start + b.dur)}</small></div><span className={`radio ${to === b.court ? 'on' : ''}`} />
          </button>
        ))}
        <button className={`method ${!to ? 'on' : ''}`} onClick={() => setTo(0)}>
          <Icon name="cup" /><div className="grow"><b>تحویل در کافه</b><small>آماده که شد اعلان می‌گیرید</small></div><span className={`radio ${!to ? 'on' : ''}`} />
        </button>
        {!targets.length && <small className="muted">برای تحویل سر زمین، امروز باید رزرو داشته باشید.</small>}
      </div>
      <div className="pay-lines">
        <div><span>زمان آماده‌سازی</span><b>حدود {fa(prep + 3)} دقیقه</b></div>
        <div className="big"><span>جمع کل</span><b>{toman(total)}</b></div>
      </div>
      <div className="methods">
        {[['wallet', 'کیف پول', toman(wallet), 'wallet', true], ['online', 'کارت بانکی', payOn ? 'درگاه شتاب' : 'پرداخت آنلاین به‌زودی فعال می‌شود', 'card', payOn]].map(([id, n, sub, ic, on]) => (
          <button key={id} disabled={!on} className={`method ${method === id ? 'on' : ''}`} onClick={() => setMethod(id)}><Icon name={ic} /><div className="grow"><b>{n}</b><small>{sub}</small></div><span className={`radio ${method === id ? 'on' : ''}`} /></button>
        ))}
      </div>
      <Loading show={busy} text={method === 'online' ? 'اتصال به درگاه پرداخت…' : 'ثبت سفارش…'} />
      <Button full variant="q" disabled={!ok || busy} onClick={pay}>{busy ? 'در حال ثبت…' : ok ? `پرداخت و ثبت سفارش، ${toman(total)}` : !inStock ? 'موجودی کافه کافی نیست' : 'موجودی کیف پول کافی نیست'}</Button>
    </div>
  )
}
