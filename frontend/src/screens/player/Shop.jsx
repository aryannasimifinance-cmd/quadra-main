import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { BRANDS, CATEGORIES, PRODUCTS, fa, productById, stockOf, toman, variantOf } from '../../data'
import { COLORS } from '../../catalog'
import { celebrate, chime, haptic } from '../../fx'
import { useStore } from '../../store'
import { Button, Chips, Icon, Sheet, Stepper } from '../../components/ui'
import { MerchArt, ProductImage } from '../../components/Merch'
import { Loading } from '../../components/Logo'
import { ShopSwitch } from './Cafe'

const PRICES = [
  { id: 'any', name: 'همه', min: 0, max: Infinity },
  { id: 'p1', name: 'زیر ۱ میلیون', min: 0, max: 1e6 },
  { id: 'p2', name: '۱ تا ۵ میلیون', min: 1e6, max: 5e6 },
  { id: 'p3', name: '۵ تا ۱۰ میلیون', min: 5e6, max: 1e7 },
  { id: 'p4', name: 'بالای ۱۰ میلیون', min: 1e7, max: Infinity },
]
const SORTS = [{ id: 'pop', name: 'محبوب‌ترین' }, { id: 'cheap', name: 'ارزان‌ترین' }, { id: 'exp', name: 'گران‌ترین' }, { id: 'rate', name: 'بیشترین امتیاز' }]
const GENDERS = [{ id: 'any', name: 'همه' }, { id: 'men', name: 'آقایان' }, { id: 'women', name: 'بانوان' }, { id: 'unisex', name: 'یونیسکس' }]
const CAT_ICON = { all: '✦', racket: '🏓', shoes: '👟', apparel: '👕', balls: '🎾', bags: '🎒', acc: '🧢' }
const blank = { brands: [], sizes: [], colors: [], price: 'any', gender: 'any', stock: false, sale: false }

export default function Shop({ nav }) {
  const { cart, wish, club, toggleWish } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('pop')
  const [f, setF] = useState(blank)
  const [showF, setShowF] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [sel, setSel] = useState(null)
  const active = f.brands.length + f.sizes.length + f.colors.length + (f.price !== 'any') + (f.gender !== 'any') + f.stock + f.sale
  const cartN = cart.reduce((s, x) => s + x.qty, 0)

  const list = useMemo(() => {
    const pr = PRICES.find((p) => p.id === f.price)
    let l = PRODUCTS.filter((p) => p.active !== false && (cat === 'all' || p.cat === cat)
      && (!q || (p.name + p.brand).toLowerCase().includes(q.toLowerCase()))
      && (!f.brands.length || f.brands.includes(p.brand))
      && (!f.sizes.length || f.sizes.some((z) => p.sizes?.includes(z)))
      && (!f.colors.length || f.colors.some((c) => p.colors?.some((x) => x.n === c)))
      && p.price >= pr.min && p.price < pr.max
      && (f.gender === 'any' || p.gender === f.gender || p.gender === 'unisex')
      && (!f.stock || stockOf(p) > 0) && (!f.sale || p.was))
    const by = { pop: (a, b) => b.reviews - a.reviews, cheap: (a, b) => a.price - b.price, exp: (a, b) => b.price - a.price, rate: (a, b) => b.rating - a.rating }[sort]
    return [...l].sort(by)
  }, [cat, q, f, sort, club.products])

  return (
    <div className="page shop">
      <header className="page-head">
        <ShopSwitch value="shop" nav={nav} />
        <div className="row-between">
          <h1>فروشگاه</h1>
          <motion.button className="cart-btn" whileTap={{ scale: 0.9 }} onClick={() => setShowCart(true)} aria-label="سبد خرید">
            <Icon name="bag" />
            <AnimatePresence>{cartN > 0 && <motion.i key={cartN} initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} exit={{ scale: 0 }}>{fa(cartN)}</motion.i>}</AnimatePresence>
          </motion.button>
        </div>
        <div className="search-row">
          <label className="search"><Icon name="search" size={18} /><input placeholder="راکت، کفش، توپ…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}><Icon name="close" size={16} /></button>}</label>
          <motion.button className={`filter-btn ${active ? 'on' : ''}`} whileTap={{ scale: 0.9 }} onClick={() => setShowF(true)}>
            <Icon name="filter" size={18} />{active > 0 && <i>{fa(active)}</i>}
          </motion.button>
        </div>
      </header>

      {cat === 'all' && !q && !active && (
        <motion.div className="merch-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onClick={() => { setCat('apparel') }}>
          <div className="mh-txt"><span className="pill-q">کالکشن باشگاه</span><h3>لباس رسمی کوادرا</h3><p>تی‌شرت، پولو، هودی و کلاه با لوگوی باشگاه</p></div>
          <div className="mh-art">
            <motion.div animate={{ rotate: [-6, -2, -6] }} transition={{ repeat: Infinity, duration: 5 }}><MerchArt type="tee" color="#141413" /></motion.div>
            <motion.div animate={{ rotate: [6, 2, 6], y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4 }}><MerchArt type="cap" color="#19C9C1" /></motion.div>
          </div>
        </motion.div>
      )}

      <div className="cats">
        {CATEGORIES.map((c) => (
          <motion.button key={c.id} className={`cat ${cat === c.id ? 'on' : ''}`} whileTap={{ scale: 0.92 }} onClick={() => { haptic(6); setCat(c.id) }}>
            {cat === c.id && <motion.span layoutId="cat-bg" className="cat-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <span className="cat-ic">{CAT_ICON[c.id]}</span><small>{c.name}</small>
          </motion.button>
        ))}
      </div>

      <div className="sort-row">
        <small>{fa(list.length)} کالا</small>
        <Chips id="sort" small scroll value={sort} onChange={setSort} options={SORTS} />
      </div>

      <motion.div className="p-grid" layout>
        <AnimatePresence mode="popLayout">
          {list.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="p-card" onClick={() => setSel(p.id)}>
              <ProductImage p={p} />
              {p.tag && <span className={`p-tag ${p.tag === 'تخفیف' ? 'sale' : p.tag === 'جدید' ? 'new' : ''}`}>{p.tag === 'تخفیف' ? `٪${fa(Math.round((1 - p.price / p.was) * 100))}` : p.tag}</span>}
              <motion.button className={`wish ${wish.includes(p.id) ? 'on' : ''}`} whileTap={{ scale: 0.7 }} onClick={(e) => { e.stopPropagation(); haptic(8); toggleWish(p.id) }} aria-label="علاقه‌مندی">
                <Icon name="heart" size={16} fill={wish.includes(p.id) ? 'currentColor' : 'none'} />
              </motion.button>
              {stockOf(p) <= 3 && <span className="p-low">{stockOf(p) ? `فقط ${fa(stockOf(p))} عدد` : 'ناموجود'}</span>}
              <div className="p-info">
                <small>{p.brand}، ★ {fa(p.rating)}</small>
                <b>{p.name}</b>
                <div className="p-price">{p.was && <s>{fa(p.was / 1000)}</s>}<span>{toman(p.price)}</span></div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && <div className="empty-card">چیزی با این فیلترها پیدا نشد. <button className="link" onClick={() => { setF(blank); setQ(''); setCat('all') }}>پاک کردن فیلترها</button></div>}

      <Sheet open={showF} onClose={() => setShowF(false)} title="فیلترها">
        <Filters f={f} setF={setF} count={list.length} onClose={() => setShowF(false)} />
      </Sheet>
      <ProductSheet id={sel} onClose={() => setSel(null)} />
      <Sheet open={showCart} onClose={() => setShowCart(false)} title="سبد خرید" tall>
        <Cart onClose={() => setShowCart(false)} />
      </Sheet>
    </div>
  )
}

function Filters({ f, setF, count, onClose }) {
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const flip = (k, v) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  const live = PRODUCTS.filter((p) => p.active !== false)
  const sizes = [...new Set(live.flatMap((p) => p.sizes || []))]
  const colors = COLORS.filter((c) => live.some((p) => p.colors?.some((x) => x.n === c.n)))
  return (
    <div className="filters">
      <p className="label">برند</p>
      <Chips id="fb" value={f.brands} onChange={(b) => set({ brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b] })} options={BRANDS.map((b) => ({ id: b, name: b }))} />
      <p className="label">سایز</p>
      <Chips id="fz" small value={f.sizes} onChange={(z) => flip('sizes', z)} options={sizes.map((z) => ({ id: z, name: z }))} />
      <p className="label">رنگ</p>
      <div className="swatches">{colors.map((c) => <motion.button key={c.id} whileTap={{ scale: 0.85 }} className={f.colors.includes(c.n) ? 'on' : ''} style={{ '--c': c.c }} onClick={() => flip('colors', c.n)} aria-label={c.n} title={c.n} />)}</div>
      <p className="label">قیمت</p>
      <Chips id="fp" value={f.price} onChange={(price) => set({ price })} options={PRICES} />
      <p className="label">مناسب برای</p>
      <Chips id="fg" value={f.gender} onChange={(gender) => set({ gender })} options={GENDERS} />
      <div className="toggles">
        <button className={`tgl ${f.stock ? 'on' : ''}`} onClick={() => set({ stock: !f.stock })}><span>فقط کالاهای موجود</span><i className={`switch ${f.stock ? 'on' : ''}`}><motion.i layout /></i></button>
        <button className={`tgl ${f.sale ? 'on' : ''}`} onClick={() => set({ sale: !f.sale })}><span>فقط تخفیف‌دارها</span><i className={`switch ${f.sale ? 'on' : ''}`}><motion.i layout /></i></button>
      </div>
      <div className="row2">
        <Button variant="ghost" onClick={() => setF(blank)}>پاک کردن</Button>
        <Button variant="dark" onClick={onClose}>نمایش {fa(count)} کالا</Button>
      </div>
    </div>
  )
}

function ProductSheet({ id, onClose }) {
  const p = id && productById(id)
  return (
    <Sheet open={!!p} onClose={onClose} tall>
      {p && <Product key={p.id} p={p} onClose={onClose} />}
    </Sheet>
  )
}

function Product({ p, onClose }) {
  const { addToCart, toast } = useStore()
  const [size, setSize] = useState(p.sizes?.[1] || p.sizes?.[0] || null)
  const [color, setColor] = useState(p.colors?.[0] || null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { cart } = useStore()
  const inCart = cart.filter((x) => x.pid === p.id && x.size === size && x.color === (color?.n || null)).reduce((s, x) => s + x.qty, 0)
  const stock = Math.max(0, (variantOf(p, size, color?.n)?.stock ?? stockOf(p)) - inCart)
  const add = () => {
    addToCart({ pid: p.id, size, color: color?.n || null, colorHex: color?.c || null, qty })
    setAdded(true); chime('success'); haptic([10, 30, 10])
    toast({ icon: '🛍', title: 'به سبد اضافه شد', body: p.name })
    setTimeout(() => { setAdded(false); onClose() }, 900)
  }
  return (
    <div className="product">
      <div className="pd-img">
        <AnimatePresence mode="wait">
          <motion.div key={color?.c || 'x'} initial={{ opacity: 0, scale: 0.94, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.94 }}>
            <ProductImage p={p} color={color?.c} />
          </motion.div>
        </AnimatePresence>
      </div>
      <small className="pd-brand">{p.brand}، ★ {fa(p.rating)} ({fa(p.reviews)} نظر)</small>
      <h2>{p.name}</h2>
      <div className="pd-price">{p.was && <s>{toman(p.was)}</s>}<b>{toman(p.price)}</b></div>
      <p className="muted">{p.desc}</p>
      {p.colors && (<><p className="label">رنگ، {color.n}</p>
        <div className="swatches">{p.colors.map((c) => (
          <motion.button key={c.c} whileTap={{ scale: 0.85 }} className={color.c === c.c ? 'on' : ''} style={{ '--c': c.c }} onClick={() => { haptic(6); setColor(c) }} aria-label={c.n} />
        ))}</div></>)}
      {p.sizes && (<><p className="label">سایز</p><Chips id="sz" small value={size} onChange={setSize} options={p.sizes.map((s) => ({ id: s, name: s }))} /></>)}
      <div className="specs">{p.specs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}{p.level && <div><span>سطح</span><b>{p.level}</b></div>}</div>
      <p className="pickup"><Icon name="box" size={16} /> تحویل از پذیرش باشگاه، همان روز</p>
      <div className="pd-cta">
        <Stepper value={qty} onChange={setQty} min={1} max={Math.max(1, stock)} />
        <Button full variant="q" disabled={!stock || added} onClick={add}>
          {!stock ? (inCart ? 'همه‌ی موجودی در سبد شماست' : 'ناموجود') : added ? '✓ اضافه شد' : `افزودن، ${toman(p.price * qty)}`}
        </Button>
      </div>
    </div>
  )
}

function Cart({ onClose }) {
  const s = useStore()
  const { cart, setQty, wallet, checkout, toast } = s
  const payOn = !!s.config?.pay
  // کالایی که از کاتالوگ حذف شده از سبد کنار گذاشته می‌شود
  const items = cart.filter((x) => productById(x.pid))
  const [method, setMethod] = useState(() => (wallet >= items.reduce((a, x) => a + x.qty * productById(x.pid).price, 0) || !payOn ? 'wallet' : 'online'))
  const [busy, setBusy] = useState(false)
  const total = items.reduce((a, x) => a + x.qty * productById(x.pid).price, 0)
  const save = items.reduce((a, x) => a + x.qty * ((productById(x.pid).was || productById(x.pid).price) - productById(x.pid).price), 0)
  const ok = method === 'wallet' ? wallet >= total : payOn
  const pay = async () => {
    if (busy) return
    setBusy(true)
    const r = await checkout(method)
    setBusy(false)
    if (r?.error) { chime('alarm'); if (!r.shown) toast({ icon: '⛔', title: 'موجودی کافی نیست', body: r.name ? `از «${r.name}» به این تعداد نمانده؛ تعداد را کم کنید` : 'سبد را دوباره بررسی کنید' }); return }
    celebrate(); chime('level')
    toast({ icon: '📦', title: `سفارش ${r.order.id} ثبت شد`, body: `+${fa(r.xp)} XP، آماده‌ی تحویل در پذیرش`, duration: 4500 })
    onClose()
  }
  if (!items.length) return <div className="empty-card">سبدتون خالیه. یه نگاه به راکت‌ها بندازید 🎾</div>
  return (
    <div className="cart">
      {cart.map((x, i) => {
        const p = productById(x.pid)
        if (!p) return null
        return (
          <motion.div key={i} layout className="cart-item" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <ProductImage p={p} color={x.colorHex} />
            <div className="grow"><b>{p.name}</b><small>{[x.size && `سایز ${x.size}`, x.color].filter(Boolean).join('، ')}</small><span>{toman(p.price * x.qty)}</span></div>
            <Stepper value={x.qty} onChange={(n) => setQty(i, n)} max={variantOf(p, x.size, x.color)?.stock ?? stockOf(p)} />
          </motion.div>
        )
      })}
      <div className="pay-lines">
        {save > 0 && <div><span>سود شما از تخفیف</span><b className="q-ink">{toman(save)}</b></div>}
        <div><span>تحویل</span><b>رایگان — پذیرش باشگاه</b></div>
        <div className="big"><span>جمع کل</span><b>{toman(total)}</b></div>
      </div>
      <div className="methods">
        {[['wallet', 'کیف پول', toman(wallet), 'wallet', true], ['online', 'کارت بانکی', payOn ? 'درگاه شتاب' : 'پرداخت آنلاین به‌زودی فعال می‌شود', 'card', payOn]].map(([id, n, sub, ic, on]) => (
          <button key={id} disabled={!on} className={`method ${method === id ? 'on' : ''}`} onClick={() => setMethod(id)}><Icon name={ic} /><div className="grow"><b>{n}</b><small>{sub}</small></div><span className={`radio ${method === id ? 'on' : ''}`} /></button>
        ))}
      </div>
      <Loading show={busy} text={method === 'online' ? 'اتصال به درگاه پرداخت…' : 'ثبت سفارش…'} />
      <Button full variant="q" disabled={!ok || busy} onClick={pay}>{busy ? 'در حال پرداخت…' : ok ? `پرداخت ${toman(total)}` : 'موجودی کیف پول کافی نیست'}</Button>
    </div>
  )
}
