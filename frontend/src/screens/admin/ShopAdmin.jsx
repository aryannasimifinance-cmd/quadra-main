// فروشگاه و انبار: سفارش‌ها، کاتالوگ کددار با سایز و رنگ، ورود کالا، فروش حضوری و پرفروش‌ها
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { CATEGORIES, METHOD_NAME, fa, productById, short, stockOf, toman, todayKey, addDays, dayLabel } from '../../data'
import { COLORS, GENDER_NAME, SIZE_SETS, TAGS, accCode, catName, colorByName, makeVariants, nextCode } from '../../catalog'
import { PAY_FROM } from '../../accounting'
import { dk, jDate, jDateFa } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon } from '../../components/ui'
import { MerchArt, ProductImage } from '../../components/Merch'
import { HBars } from './Charts'
import { who } from './derive'
import { Badge, Card, Empty, Field, Guide, ImageUpload, Kpi, Money, More, Search, Seg, Side, Tabs, XlsxBtn, usePage } from './kit'
import { CustomerField, Qty, Ticket, useCustomer } from './PosKit'
import { OrderLog } from './OrderLog'
import { errText } from '../../api'

const fmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const ART = ['tee', 'polo', 'hoodie', 'shorts', 'skirt', 'cap', 'bag', 'backpack', 'grip', 'band', 'bottle', 'towel']
const LOW = 3
const Sw = ({ c, title }) => <i className="sw" style={{ background: c }} title={title} />
const stockTone = (n) => (n === 0 ? ['bad', 'ناموجود'] : n <= LOW ? ['warn', 'کم'] : ['ok', 'موجود'])

const LOG_ST = { new: ['سفارش جدید', 'bad'], ready: ['آماده‌ی تحویل', 'ok'], delivered: ['تحویل شد', 'mute'] }
const logLines = (o) => o.items.map((x) => [productById(x.pid)?.name || x.sku, x.qty, [x.size, x.color].filter(Boolean).join(' / '), x.price])

export function ShopAdmin() {
  const { club } = useStore()
  const [tab, setTab] = useState('orders')
  const [edit, setEdit] = useState(null) // محصول یا 'new'
  const [recv, setRecv] = useState(null) // true یا شناسه‌ی محصول
  const [pos, setPos] = useState(false)
  const open = club.orders.filter((o) => o.status !== 'delivered').length
  return (
    <div className="stack">
      <div className="sec-bar">
        <Tabs value={tab} onChange={setTab} tabs={[
          ['orders', 'سفارش‌ها', open, 'سفارش‌های اپ: آماده کنید و در پذیرش تحویل دهید'],
          ['history', 'تاریخچه و جستجو', null, 'همه‌ی فروش‌ها؛ با نام مشتری ببینید چه کسی چه خریده'],
          ['products', 'کالاها', null, 'افزودن و ویرایش کالا، قیمت، سایز، رنگ و عکس'],
          ['stock', 'انبار و خرید', null, 'موجودی هر سایز و رنگ، ثبت خرید از تأمین‌کننده'],
          ['top', 'گزارش فروش', null, 'پرفروش‌ها و سود فروشگاه'],
        ]} />
        <div className="sec-actions">
          <button className="adm-btn ghost sm" onClick={() => setTab('history')} data-tip="همه‌ی سفارش‌ها؛ با نام یا شماره‌ی مشتری ببینید چه کسی چه خریده"><Icon name="search" size={16} />جستجوی سفارش‌ها</button>
          <button className={`adm-btn ${tab === 'orders' ? 'primary' : 'ghost'} sm`} onClick={() => setPos(true)} data-tip="فروش به مشتری حاضر در باشگاه؛ موجودی همان لحظه کم می‌شود"><Icon name="plus" size={16} />فروش حضوری</button>
          <button className="adm-btn ghost sm" onClick={() => setRecv(true)} data-tip="کالایی که از تأمین‌کننده خریدید را وارد انبار کنید"><Icon name="box" size={16} />ثبت خرید کالا</button>
          <button className={`adm-btn ${tab === 'orders' ? 'ghost' : 'primary'} sm`} onClick={() => setEdit('new')} data-tip="کالای تازه با عکس، قیمت، سایز و رنگ؛ در فروشگاه اپ و سایت نمایش داده می‌شود"><Icon name="plus" size={16} />ثبت کالای جدید در اپ (سایت)</button>
        </div>
      </div>
      <Guide>{{
        history: 'نام یا شماره‌ی مشتری را بنویسید تا ببینید چه چیزهایی خریده؛ روی هر ردیف بزنید تا جزئیات باز شود.',
        orders: 'سفارش‌هایی که مشتری‌ها از اپ ثبت کرده‌اند. وقتی آماده شد «آماده شد» و موقع تحویل «تحویل داده شد» را بزنید.',
        products: 'روی هر کالا بزنید تا ویرایش شود. کالای غیرفعال در اپ دیده نمی‌شود.',
        stock: 'موجودی هر سایز و رنگ. با «ثبت خرید کالا» انبار پر می‌شود؛ با − و + کسری یا اضافه‌ی شمارش را ثبت کنید.',
        top: 'فروش، قیمت خرید و سود فروشگاه در بازه‌ی انتخابی.',
      }[tab]}</Guide>
      {tab === 'orders' && <Orders onAll={() => setTab('history')} />}
      {tab === 'history' && <OrderLog orders={club.orders} lines={logLines} status={LOG_ST} title="فروش فروشگاه" file="quadra-shop-orders" />}
      {tab === 'products' && <Products onEdit={setEdit} onRecv={setRecv} />}
      {tab === 'stock' && <Stock onRecv={setRecv} />}
      {tab === 'top' && <Top />}
      <Side open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'کالای جدید' : 'ویرایش کالا'} wide>
        {edit && <ProductForm key={edit.id || 'new'} p={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onRecv={(id) => { setEdit(null); setRecv(id) }} />}
      </Side>
      <Side open={!!recv} onClose={() => setRecv(null)} title="ثبت خرید کالا" wide>
        {recv && <Receive preset={typeof recv === 'string' ? recv : null} onClose={() => setRecv(null)} />}
      </Side>
      <Side open={pos} onClose={() => setPos(false)} title="فروش حضوری" size="till">
        {pos && <Pos onClose={() => setPos(false)} />}
      </Side>
    </div>
  )
}

// ---------- سفارش‌ها ----------
function Orders({ onAll }) {
  const { club, user, adminOrder } = useStore()
  const cols = [['new', 'سفارش جدید'], ['ready', 'آماده‌ی تحویل'], ['delivered', 'تحویل‌شده‌ی امروز']]
  const of = (k) => club.orders.filter((o) => o.status === k && (k !== 'delivered' || dk(o.at) === todayKey()))
  return (
    <div className="kanban kb-scroll">
      {cols.map(([k, n]) => (
        <div key={k} className="kb-col">
          <h4>{n} <span>{fa(of(k).length)}</span></h4>
          {of(k).map((o) => (
            <motion.div key={o.id} layout className="kb-card">
              <div className="row-between"><b dir="ltr">{o.id}</b><small>{fmt.format(o.at)}</small></div>
              <small>{who(o.by, user)}، {o.source === 'desk' ? 'فروش حضوری' : 'اپ'}، {METHOD_NAME[o.method]}</small>
              <ul>{o.items.map((x, i) => <li key={i}>{fa(x.qty)}× {club.products.find((p) => p.id === x.pid)?.name}{x.size ? `، ${x.size}` : ''}{x.color ? `، ${x.color}` : ''} <code>{x.sku}</code></li>)}</ul>
              <div className="row-between"><b>{toman(o.total)}</b>
                {k !== 'delivered' && <button className="adm-btn primary sm" data-tip={k === 'new' ? 'کالا جمع شد و در پذیرش منتظر مشتری است' : 'مشتری کالا را تحویل گرفت'} onClick={() => { adminOrder(o.id, k === 'new' ? 'ready' : 'delivered'); chime('tap') }}>{k === 'new' ? 'آماده شد' : 'تحویل داده شد'}</button>}
              </div>
            </motion.div>
          ))}
          {!of(k).length && <Empty>—</Empty>}
          {k === 'delivered' && <button className="adm-btn ghost sm full kb-all" onClick={onAll}><Icon name="search" size={15} />همه‌ی سفارش‌ها و جستجو با نام</button>}
        </div>
      ))}
    </div>
  )
}

// ---------- کاتالوگ ----------
function useFilters(products) {
  const [f, setF] = useState({ q: '', cat: 'all', brand: 'all', size: 'all', color: 'all', gender: 'all', stock: 'all', status: 'active' })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const brands = [...new Set(products.map((p) => p.brand))].sort()
  const sizes = [...new Set(products.flatMap((p) => p.sizes || []))]
  const colors = COLORS.filter((c) => products.some((p) => p.colors?.some((x) => x.n === c.n)))
  const list = products.filter((p) => {
    const n = stockOf(p)
    return (f.status === 'all' || (f.status === 'active' ? p.active !== false : p.active === false))
      && (!f.q || (p.name + p.code + p.brand).toLowerCase().includes(f.q.toLowerCase()) || p.variants.some((v) => v.sku.toLowerCase().includes(f.q.toLowerCase())))
      && (f.cat === 'all' || p.cat === f.cat) && (f.brand === 'all' || p.brand === f.brand)
      && (f.size === 'all' || p.sizes?.includes(f.size)) && (f.color === 'all' || p.colors?.some((c) => c.n === f.color))
      && (f.gender === 'all' || p.gender === f.gender)
      && (f.stock === 'all' || (f.stock === 'out' ? n === 0 : f.stock === 'low' ? n > 0 && n <= LOW : n > LOW))
  })
  const bar = (
    <div className="filters-bar">
      <Search value={f.q} onChange={(q) => set({ q })} ph="نام، کد یا SKU" />
      <select value={f.cat} onChange={(e) => set({ cat: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.id === 'all' ? 'همه‌ی دسته‌ها' : c.name}</option>)}</select>
      <select value={f.brand} onChange={(e) => set({ brand: e.target.value })}><option value="all">همه‌ی برندها</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>
      <select value={f.size} onChange={(e) => set({ size: e.target.value })}><option value="all">همه‌ی سایزها</option>{sizes.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={f.gender} onChange={(e) => set({ gender: e.target.value })}><option value="all">همه (جنسیت)</option>{Object.entries(GENDER_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select value={f.stock} onChange={(e) => set({ stock: e.target.value })}>{Object.entries({ all: 'همه‌ی موجودی‌ها', in: 'موجود', low: 'رو به اتمام', out: 'ناموجود' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <Seg value={f.status} onChange={(status) => set({ status })} options={{ active: 'فعال', inactive: 'غیرفعال', all: 'همه' }} />
      <div className="sw-filter">
        <button className={f.color === 'all' ? 'on' : ''} onClick={() => set({ color: 'all' })}>همه‌ی رنگ‌ها</button>
        {colors.map((c) => <button key={c.id} className={f.color === c.n ? 'on' : ''} onClick={() => set({ color: f.color === c.n ? 'all' : c.n })} title={c.n}><Sw c={c.c} /></button>)}
      </div>
    </div>
  )
  return { list, bar }
}

function Products({ onEdit, onRecv }) {
  const { club } = useStore()
  const { list, bar } = useFilters(club.products)
  const [rows, more] = usePage(list, 30)
  const exp = () => downloadXlsx(`quadra-catalog-${jDate(todayKey()).replace(/\//g, '-')}`, [{
    name: 'کاتالوگ کالا',
    rows: table(`کاتالوگ کالای فروشگاه کوادرا — ${jDateFa(todayKey())}`, ['کد کالا', 'کد حساب تفصیلی', 'نام کالا', 'دسته', 'برند', 'جنسیت', 'سایزها', 'رنگ‌ها', 'بهای خرید (میانگین)', 'قیمت فروش', 'حاشیه‌ی سود ٪', 'موجودی', 'وضعیت'],
      list.map((p) => [p.code, accCode(p), p.name, catName(p.cat), p.brand, GENDER_NAME[p.gender] || '', (p.sizes || []).join('، '), (p.colors || []).map((c) => c.n).join('، '), p.cost, p.price, Math.round((1 - p.cost / p.price) * 100), stockOf(p), p.active === false ? 'غیرفعال' : 'فعال'])),
  }, {
    name: 'تنوع‌ها (SKU)',
    rows: table(null, ['SKU', 'کد کالا', 'نام کالا', 'سایز', 'رنگ', 'موجودی', 'بهای واحد', 'ارزش موجودی'], list.flatMap((p) => p.variants.map((v) => [v.sku, p.code, p.name, v.size || '—', v.color || '—', v.stock, p.cost, v.stock * p.cost]))),
  }])
  return (
    <Card>
      {bar}
      <div className="row-between count"><span>{fa(list.length)} کالا، {fa(list.reduce((s, p) => s + p.variants.length, 0))} تنوع</span><XlsxBtn onClick={exp} /></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>کالا</th><th>دسته / برند</th><th>سایزها</th><th>رنگ‌ها</th><th data-tip="میانگین قیمتی که برای هر عدد پرداخت شده">قیمت خرید</th><th>قیمت فروش</th><th data-tip="چند درصد از قیمت فروش سود است">سود ٪</th><th data-tip="جمع موجودی همه‌ی سایزها و رنگ‌ها">موجودی</th><th /></tr></thead>
        <tbody>{rows.map((p) => {
          const n = stockOf(p), [tone, lbl] = stockTone(n)
          return (
            <tr key={p.id} className={`click ${p.active === false ? 'dim' : ''}`} onClick={() => onEdit(p)}>
              <td><div className="prod-cell"><ProductImage p={p} /><div><b>{p.name}</b><small data-tip={`کد حساب ${accCode(p)}`}>کد <code>{p.code}</code></small></div></div></td>
              <td>{catName(p.cat)}<small>{p.brand}</small></td>
              <td><div className="size-chips">{(p.sizes || []).slice(0, 6).map((s) => <span key={s}>{s}</span>)}{(p.sizes || []).length > 6 && <span>+{fa(p.sizes.length - 6)}</span>}{!p.sizes?.length && <small>—</small>}</div></td>
              <td><div className="sws">{(p.colors || []).map((c) => <Sw key={c.c} c={c.c} title={c.n} />)}{!p.colors?.length && <small>—</small>}</div></td>
              <td className="num">{toman(p.cost)}</td>
              <td className="num">{toman(p.price)}{p.was && <small><s>{toman(p.was)}</s></small>}</td>
              <td className="num">{fa(Math.round((1 - p.cost / p.price) * 100))}٪</td>
              <td><Badge tone={tone}>{fa(n)} {lbl === 'موجود' ? '' : lbl}</Badge></td>
              <td><button className="adm-btn ghost sm" data-tip="ثبت خرید و افزایش موجودی همین کالا" onClick={(e) => { e.stopPropagation(); onRecv(p.id) }}>خرید</button></td>
            </tr>
          )
        })}</tbody>
      </table></div>
      {!list.length && <Empty>کالایی با این فیلترها نیست.</Empty>}
      <More more={more} />
    </Card>
  )
}

function ProductForm({ p, onClose, onRecv }) {
  const { club, adminProduct, toast } = useStore()
  const imgs = [...new Set(club.products.filter((x) => x.img).map((x) => x.img))]
  const [f, setF] = useState(() => p ? { ...p, sizes: p.sizes || [], colors: p.colors || [], specs: p.specs || [] }
    : { name: '', cat: 'apparel', brand: 'Quadra', gender: 'unisex', price: 0, was: 0, cost: 0, tag: '', desc: '', sizes: ['S', 'M', 'L'], colors: [COLORS[0]], art: { type: 'tee', color: COLORS[0].c }, img: null, specs: [], rating: 5, reviews: 0, active: true })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const code = p?.code || nextCode(club.products, f.cat)
  const variants = makeVariants({ ...f, code }, p?.variants)
  const stocked = (kind, v) => p?.variants.some((x) => x.stock > 0 && x[kind] === v)
  const toggleSize = (s) => set({ sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s].sort((a, b) => (SIZE_SETS[f.cat] || []).indexOf(a) - (SIZE_SETS[f.cat] || []).indexOf(b)) })
  const toggleColor = (c) => {
    const colors = f.colors.some((x) => x.n === c.n) ? f.colors.filter((x) => x.n !== c.n) : [...f.colors, { n: c.n, c: c.c }]
    set({ colors, ...(f.art && colors[0] ? { art: { ...f.art, color: colors[0].c } } : {}) })
  }
  const [custom, setCustom] = useState('')
  const ok = f.name.trim() && f.brand.trim() && f.price > 0 && f.cost >= 0 && f.cost < f.price
  const save = () => {
    const saved = adminProduct({ ...f, was: f.was > f.price ? f.was : undefined, tag: f.tag || undefined, name: f.name.trim(), brand: f.brand.trim() })
    chime('success'); toast({ icon: '🏷', title: p ? 'کالا به‌روز شد' : 'کالا اضافه شد', body: `کد ${saved.code}، ${fa(saved.variants.length)} تنوع` })
    if (!p) onRecv(saved.id); else onClose()
  }
  const sizes = [...new Set([...(SIZE_SETS[f.cat] || []), ...f.sizes])]
  return (
    <div className="form">
      <h4 className="step"><i>۱</i>عکس و نام</h4>
      <ImageUpload value={f.art ? null : f.img} onChange={(img) => set({ img, art: img ? null : f.art || { type: 'tee', color: f.colors[0]?.c || '#141413' } })} />
      <details className="more-pick">
        <summary data-tip="اگر عکس ندارید، یکی از تصاویر آماده یا طرح ساده را انتخاب کنید">یا تصویر آماده</summary>
        <div className="img-pick">
          {imgs.map((src) => <button key={src} type="button" className={!f.art && f.img === src ? 'on' : ''} onClick={() => set({ img: src, art: null })}><img src={src} alt="" /></button>)}
          {ART.map((a) => <button key={a} type="button" className={f.art?.type === a ? 'on' : ''} onClick={() => set({ art: { type: a, color: f.colors[0]?.c || '#141413' }, img: null })}><MerchArt type={a} color={f.colors[0]?.c || '#141413'} /></button>)}
        </div>
      </details>
      <Field label="نام کالا"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً تی‌شرت کوادرا Pro" /></Field>
      <div className="form-2">
        <Field label="دسته" tip={p ? 'دسته بعد از ساخت تغییر نمی‌کند چون کد کالا از آن ساخته شده' : 'کد کالا بر اساس دسته ساخته می‌شود'}><select value={f.cat} disabled={!!p} onChange={(e) => set({ cat: e.target.value, sizes: [] })}>{CATEGORIES.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="برند"><input list="brands" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /><datalist id="brands">{[...new Set(club.products.map((x) => x.brand))].map((b) => <option key={b} value={b} />)}</datalist></Field>
      </div>

      <h4 className="step"><i>۲</i>قیمت</h4>
      <div className="form-3">
        <Field label="قیمت خرید" tip={p ? 'میانگین قیمت خریدهای قبلی؛ با هر خرید خودکار به‌روز می‌شود' : 'قیمتی که از تأمین‌کننده می‌خرید'}><Money value={f.cost} onChange={(cost) => set({ cost })} disabled={!!p} /></Field>
        <Field label="قیمت فروش"><Money value={f.price} onChange={(price) => set({ price })} /></Field>
        <Field label="قیمت قبل از تخفیف" tip="اختیاری؛ اگر بنویسید، در اپ خط‌خورده و با درصد تخفیف نشان داده می‌شود"><Money value={f.was} onChange={(was) => set({ was })} placeholder="اختیاری" /></Field>
      </div>
      {f.price > 0 && <p className={`margin-line ${f.cost >= f.price ? 'bad' : ''}`}>{f.cost >= f.price ? 'قیمت فروش باید از قیمت خرید بیشتر باشد.' : <>سود هر عدد <b>{toman(f.price - f.cost)}</b>، یعنی {fa(Math.round((1 - f.cost / f.price) * 100))}٪ از قیمت فروش</>}</p>}

      <h4 className="step"><i>۳</i>سایز و رنگ</h4>
      <Field label="سایزها" tip="هر سایز موجودی جدا دارد؛ سایزی که موجودی دارد قابل حذف نیست">
        <div className="pick-chips">
          {sizes.map((s) => <button key={s} type="button" className={f.sizes.includes(s) ? 'on' : ''} disabled={f.sizes.includes(s) && stocked('size', s)} onClick={() => toggleSize(s)}>{s}</button>)}
          <span className="add-chip"><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="سایز دیگر" /><button type="button" onClick={() => { if (custom.trim() && !f.sizes.includes(custom.trim())) set({ sizes: [...f.sizes, custom.trim()] }); setCustom('') }}>+</button></span>
        </div>
      </Field>
      <Field label="رنگ‌ها">
        <div className="pick-chips">
          {COLORS.map((c) => <button key={c.id} type="button" className={`sw-chip ${f.colors.some((x) => x.n === c.n) ? 'on' : ''}`} disabled={f.colors.some((x) => x.n === c.n) && stocked('color', c.n)} onClick={() => toggleColor(c)}><Sw c={c.c} />{c.n}</button>)}
        </div>
      </Field>
      <p className="muted small">{fa(variants.length)} ترکیب سایز و رنگ؛ موجودی هر کدام جدا شمرده می‌شود.</p>

      <h4 className="step"><i>۴</i>توضیحات و نمایش</h4>
      <div className="form-2">
        <Field label="مناسب برای"><select value={f.gender} onChange={(e) => set({ gender: e.target.value })}>{Object.entries(GENDER_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="برچسب" tip="روی عکس کالا در اپ دیده می‌شود"><select value={f.tag || ''} onChange={(e) => set({ tag: e.target.value })}>{TAGS.map((t) => <option key={t} value={t}>{t || 'بدون برچسب'}</option>)}</select></Field>
      </div>
      <Field label="توضیح"><textarea rows={2} value={f.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="یکی دو جمله درباره‌ی کالا" /></Field>
      <details className="more-pick">
        <summary>مشخصات فنی ({fa(f.specs.length)})</summary>
        <div className="specs-ed">
          {f.specs.map(([k, v], i) => (
            <div key={i}><input value={k} placeholder="ویژگی" onChange={(e) => set({ specs: f.specs.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })} />
              <input value={v} placeholder="مقدار" onChange={(e) => set({ specs: f.specs.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })} />
              <button type="button" onClick={() => set({ specs: f.specs.filter((_, j) => j !== i) })} aria-label="حذف"><Icon name="close" size={14} /></button></div>
          ))}
          <button type="button" className="adm-btn ghost sm" onClick={() => set({ specs: [...f.specs, ['', '']] })}><Icon name="plus" size={14} />ویژگی</button>
        </div>
      </details>
      {p && (
        <label className="tgl-row" data-tip="کالای غیرفعال در اپ دیده نمی‌شود ولی سابقه‌اش می‌ماند"><span>نمایش در فروشگاه اپ</span><button type="button" className={`tgl-adm ${f.active !== false ? 'on' : ''}`} onClick={() => set({ active: f.active === false })}><i /><span>{f.active !== false ? 'فعال' : 'غیرفعال'}</span></button></label>
      )}
      {p && (
        <details className="more-pick">
          <summary data-tip="برای حسابدار و انباردار">کدها و موجودی هر ترکیب</summary>
          <p className="muted small">کد کالا <code>{code}</code>، حساب انبار <code>1301-{code}</code></p>
          <div className="tbl-wrap small"><table className="tbl">
            <thead><tr><th>SKU</th><th>سایز</th><th>رنگ</th><th>موجودی</th></tr></thead>
            <tbody>{variants.map((v) => <tr key={v.sku}><td dir="ltr" className="code">{v.sku}</td><td>{v.size || '—'}</td><td>{v.color ? <span className="sw-name"><Sw c={colorByName(v.color)?.c} />{v.color}</span> : '—'}</td><td className="num">{fa(v.stock)}</td></tr>)}</tbody>
          </table></div>
        </details>
      )}
      {!p && <p className="muted small">بعد از ذخیره، فرم «ثبت خرید» باز می‌شود تا موجودی اولیه را وارد کنید. کد کالا خودکار ساخته می‌شود ({code}).</p>}
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{p ? 'ذخیره‌ی تغییرات' : 'ذخیره و ثبت موجودی'}</button>
    </div>
  )
}

// ---------- ورود کالا ----------
function VariantPick({ p, value, onChange }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)}>{p.variants.map((v) => <option key={v.sku} value={v.sku}>{[v.size, v.color].filter(Boolean).join(' / ') || 'تک'} ({v.sku})، موجودی {fa(v.stock)}</option>)}</select>
}
function Receive({ preset, onClose }) {
  const { club, adminReceive, toast } = useStore()
  const products = club.products.filter((p) => p.active !== false || p.id === preset)
  const line = (pid) => { const p = club.products.find((x) => x.id === pid); return { pid, sku: p.variants[0].sku, qty: 1, cost: p.cost } }
  const [f, setF] = useState({ supplier: club.suppliers[0] || '', invoice: '', date: todayKey(), pay: 'bank', lines: preset ? club.products.find((x) => x.id === preset).variants.map((v) => ({ pid: preset, sku: v.sku, qty: 0, cost: club.products.find((x) => x.id === preset).cost || 0 })) : [line(products[0]?.id)] })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const setLine = (i, x) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...x } : l)) })
  const lines = f.lines.filter((l) => l.qty > 0 && l.cost > 0)
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0)
  const save = () => {
    adminReceive({ date: f.date, supplier: f.supplier.trim(), invoice: f.invoice.trim(), pay: f.pay, items: lines.map((l) => ({ ...l, name: club.products.find((p) => p.id === l.pid).name })) })
    chime('success'); toast({ icon: '📦', title: 'ورود کالا ثبت شد', body: `${fa(lines.reduce((s, l) => s + l.qty, 0))} عدد، ${toman(total)}` }); onClose()
  }
  return (
    <div className="form">
      <div className="form-2">
        <Field label="تأمین‌کننده"><input list="sups" value={f.supplier} onChange={(e) => set({ supplier: e.target.value })} /><datalist id="sups">{club.suppliers.map((s) => <option key={s} value={s} />)}</datalist></Field>
        <Field label="شماره‌ی فاکتور خرید"><input value={f.invoice} onChange={(e) => set({ invoice: e.target.value })} dir="ltr" /></Field>
      </div>
      <div className="form-2">
        <Field label="تاریخ"><select value={f.date} onChange={(e) => set({ date: e.target.value })}>{Array.from({ length: 10 }, (_, i) => addDays(todayKey(), -i)).map((k) => <option key={k} value={k}>{dayLabel(k)} {jDateFa(k)}</option>)}</select></Field>
        <Field label="پرداخت"><select value={f.pay} onChange={(e) => set({ pay: e.target.value })}>{Object.entries(PAY_FROM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <h4>اقلام</h4>
      <div className="lines">
        {f.lines.map((l, i) => {
          const p = club.products.find((x) => x.id === l.pid)
          return (
            <div key={i} className="line">
              <select value={l.pid} onChange={(e) => setLine(i, line(e.target.value))}>{products.map((x) => <option key={x.id} value={x.id}>{x.code}، {x.name}</option>)}</select>
              <VariantPick p={p} value={l.sku} onChange={(sku) => setLine(i, { sku })} />
              <div className="line-n">
                <label><small>تعداد</small><input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(0, +e.target.value) })} /></label>
                <label><small>بهای واحد</small><Money value={l.cost} onChange={(cost) => setLine(i, { cost })} /></label>
                <b className="num">{short(l.qty * l.cost)}</b>
                <button type="button" onClick={() => set({ lines: f.lines.filter((_, j) => j !== i) })} aria-label="حذف ردیف"><Icon name="close" size={14} /></button>
              </div>
            </div>
          )
        })}
        <button type="button" className="adm-btn ghost sm" onClick={() => set({ lines: [...f.lines, line(products[0]?.id)] })}><Icon name="plus" size={14} />ردیف</button>
      </div>
      <div className="voucher-prev">
        <small>سند حسابداری</small>
        <div><span>بدهکار ۱۳۰۱ موجودی کالا</span><b>{toman(total)}</b></div>
        <div><span>بستانکار {f.pay === 'payable' ? `۳۱۰۱ پرداختنی، ${f.supplier}` : f.pay === 'cash' ? '۱۱۰۱ صندوق' : '۱۱۰۲ بانک'}</span><b>{toman(total)}</b></div>
      </div>
      <button className="adm-btn primary full" disabled={!lines.length || !f.supplier.trim()} onClick={save}>ثبت ورود کالا، {toman(total)}</button>
    </div>
  )
}

// ---------- فروش حضوری ----------
// چپ: کالاها با سایز و رنگ موجود؛ راست: فاکتور که همیشه دیده می‌شود. سقف هر ردیف موجودی همان سایز و رنگ است
function Pos({ onClose }) {
  const { club, adminPos, toast } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState([])
  const [method, setMethod] = useState('card')
  const cu = useCustomer()
  const left = (v) => v.stock - (cart.find((x) => x.sku === v.sku)?.qty || 0)
  const found = club.products.filter((p) => p.active !== false && (cat === 'all' || p.cat === cat) && (!q || (p.name + p.code + p.brand).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (stockOf(b) > 0) - (stockOf(a) > 0))
  const add = (p, v) => setCart((c) => {
    const k = c.findIndex((x) => x.sku === v.sku)
    if (k >= 0) return c.map((x, i) => (i === k ? { ...x, qty: Math.min(v.stock, x.qty + 1) } : x))
    return [...c, { pid: p.id, sku: v.sku, size: v.size, color: v.color, colorHex: colorByName(v.color)?.c || null, qty: 1, price: p.price, name: p.name, max: v.stock }]
  })
  const setQty = (i, d) => setCart((c) => c.map((y, j) => (j === i ? { ...y, qty: Math.min(y.max, y.qty + d) } : y)).filter((y) => y.qty > 0))
  const count = cart.reduce((s, x) => s + x.qty, 0)
  const total = cart.reduce((s, x) => s + x.qty * x.price, 0)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    const o = await adminPos(cart.map(({ name, max, ...x }) => x), method, cu.by)
    setBusy(false)
    if (!o) { chime('alarm'); toast({ icon: '⚠️', title: 'موجودی کافی نیست', body: 'موجودی همین حالا تغییر کرده؛ فاکتور را دوباره بررسی کنید.' }); return }
    if (o.failed) { chime('alarm'); toast({ icon: '⛔', title: 'فاکتور ثبت نشد', body: errText(o) }); return }
    chime('success'); toast({ icon: '🧾', title: `فاکتور ${o.id} ثبت شد`, body: `${toman(o.total)}، ${METHOD_NAME[method]}` }); onClose()
  }
  return (
    <div className="pos2">
      <div className="pos-cat">
        <Search value={q} onChange={setQ} ph="نام، برند یا کد کالا" />
        <div className="pick-chips">{CATEGORIES.map((c) => <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
        <div className="shop-pos">
          {found.map((p) => {
            const vs = p.variants.filter((v) => v.stock > 0)
            return (
              <div key={p.id} className={`sp-item ${vs.length ? '' : 'out'}`}>
                <ProductImage p={p} />
                <div className="grow"><b>{p.name}</b><small><code>{p.code}</code> {toman(p.price)}</small>
                  {vs.length ? <div className="pick-chips sm">{vs.map((v) => <button key={v.sku} type="button" disabled={left(v) <= 0} onClick={() => add(p, v)} data-tip={`${fa(left(v))} عدد باقی مانده`}>{v.color && <Sw c={colorByName(v.color)?.c} />}{[v.size, v.color].filter(Boolean).join(' / ') || 'افزودن'} <em>{fa(left(v))}</em></button>)}</div>
                    : <small className="neg">ناموجود</small>}
                </div>
              </div>
            )
          })}
          {!found.length && <Empty>کالایی پیدا نشد.</Empty>}
        </div>
      </div>
      <Ticket count={count} total={total} onClear={() => setCart([])} empty="سایز یا رنگ کالا را بزنید تا به فاکتور اضافه شود."
        onSubmit={save} action="ثبت فروش و تحویل"
        options={<>
          <CustomerField c={cu} />
          <Field label="روش پرداخت"><Seg value={method} onChange={setMethod} options={{ card: 'کارتخوان', cash: 'نقدی' }} /></Field>
        </>}>
        {cart.map((x, i) => (
          <div key={x.sku} className="pt-line">
            <div className="grow"><b>{x.name}</b><small>{x.colorHex && <Sw c={x.colorHex} />}{[x.size, x.color].filter(Boolean).join(' / ')} <code>{x.sku}</code></small></div>
            <div className="pt-r"><Qty qty={x.qty} onMinus={() => setQty(i, -1)} onPlus={() => setQty(i, 1)} canPlus={x.qty < x.max} /><b className="num">{toman(x.qty * x.price)}</b></div>
          </div>
        ))}
      </Ticket>
    </div>
  )
}

// ---------- انبار ----------
function Stock({ onRecv }) {
  const { club, adminAdjust, toast } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [only, setOnly] = useState('all')
  const all = club.products.flatMap((p) => p.variants.map((v) => ({ ...v, p })))
  const list = all.filter((v) => (cat === 'all' || v.p.cat === cat) && (!q || (v.sku + v.p.name).toLowerCase().includes(q.toLowerCase())) && (only === 'all' || (only === 'low' ? v.stock <= LOW : v.stock === 0)))
  const [rows, more] = usePage(list, 40)
  const value = all.reduce((s, v) => s + v.stock * v.p.cost, 0), retail = all.reduce((s, v) => s + v.stock * v.p.price, 0)
  const adj = (v, d) => {
    const note = d < 0 ? prompt('دلیل کسری (مثلاً خرابی، شمارش انبار):', 'شمارش انبار') : 'شمارش انبار'
    if (note === null) return
    adminAdjust(v.p.id, v.sku, d, note); toast({ icon: d < 0 ? '➖' : '➕', title: `${v.sku}: ${fa(v.stock + d)} عدد`, body: 'سند اصلاح انبار ثبت شد' })
  }
  const exp = () => downloadXlsx(`quadra-stock-${jDate(todayKey()).replace(/\//g, '-')}`, [{
    name: 'موجودی انبار', rows: table(`موجودی انبار — ${jDateFa(todayKey())}`, ['SKU', 'کد کالا', 'نام کالا', 'دسته', 'سایز', 'رنگ', 'موجودی', 'بهای واحد', 'ارزش به بهای تمام‌شده', 'ارزش به قیمت فروش'],
      list.map((v) => [v.sku, v.p.code, v.p.name, catName(v.p.cat), v.size || '—', v.color || '—', v.stock, v.p.cost, v.stock * v.p.cost, v.stock * v.p.price]), ['جمع', null, null, null, null, null, list.reduce((s, v) => s + v.stock, 0), null, list.reduce((s, v) => s + v.stock * v.p.cost, 0), list.reduce((s, v) => s + v.stock * v.p.price, 0)]),
  }, {
    name: 'ورود کالا', rows: table(null, ['شماره', 'تاریخ', 'تأمین‌کننده', 'فاکتور', 'SKU', 'کالا', 'تعداد', 'بهای واحد', 'جمع', 'پرداخت'], club.receipts.flatMap((r) => r.items.map((x) => [r.id, jDate(r.date), r.supplier, r.invoice || '', x.sku, x.name, x.qty, x.cost, x.qty * x.cost, PAY_FROM[r.pay]]))),
  }])
  return (
    <div className="stack">
      <div className="kpis four">
        <Kpi icon="box" label="تعداد کالا / SKU" value={`${fa(club.products.length)} / ${fa(all.length)}`} />
        <Kpi icon="bag" label="تعداد کل در انبار" value={`${fa(all.reduce((s, v) => s + v.stock, 0))} عدد`} />
        <Kpi icon="cash" label="ارزش انبار (بهای تمام‌شده)" value={short(value)} sub={`به قیمت فروش ${short(retail)}`} />
        <Kpi icon="clock" label="SKU رو به اتمام / ناموجود" tone={all.some((v) => v.stock === 0) ? 'warn' : ''} value={`${fa(all.filter((v) => v.stock > 0 && v.stock <= LOW).length)} / ${fa(all.filter((v) => v.stock === 0).length)}`} />
      </div>
      <Card>
        <div className="filters-bar">
          <Search value={q} onChange={setQ} ph="SKU یا نام کالا" />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.id === 'all' ? 'همه‌ی دسته‌ها' : c.name}</option>)}</select>
          <Seg value={only} onChange={setOnly} options={{ all: 'همه', low: 'رو به اتمام', out: 'ناموجود' }} />
          <span className="grow" />
          <XlsxBtn onClick={exp} />
          <button className="adm-btn primary sm" onClick={() => onRecv(true)}><Icon name="plus" size={16} />ورود کالا</button>
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>SKU</th><th>کالا</th><th>سایز</th><th>رنگ</th><th>موجودی</th><th>بهای واحد</th><th>ارزش</th><th>وضعیت</th></tr></thead>
          <tbody>{rows.map((v) => {
            const [tone, lbl] = stockTone(v.stock)
            return (
              <tr key={v.sku}>
                <td dir="ltr" className="code">{v.sku}</td>
                <td><div className="prod-cell"><ProductImage p={v.p} color={colorByName(v.color)?.c} /><b>{v.p.name}</b></div></td>
                <td>{v.size || '—'}</td><td>{v.color ? <span className="sw-name"><Sw c={colorByName(v.color)?.c} />{v.color}</span> : '—'}</td>
                <td><div className="qty"><button onClick={() => adj(v, -1)} aria-label="کم کردن">−</button><b>{fa(v.stock)}</b><button onClick={() => adj(v, 1)} aria-label="اضافه کردن">+</button></div></td>
                <td className="num">{toman(v.p.cost)}</td><td className="num">{toman(v.stock * v.p.cost)}</td>
                <td><Badge tone={tone}>{lbl}</Badge></td>
              </tr>
            )
          })}</tbody>
        </table></div>
        <More more={more} />
      </Card>
      <div className="two">
        <Card title="فاکتورهای خرید (ورود کالا)" sub="هر فاکتور سند بدهکار موجودی کالا می‌خورد">
          <div className="tbl-wrap small"><table className="tbl"><thead><tr><th>شماره</th><th>تاریخ</th><th>تأمین‌کننده</th><th>اقلام</th><th>مبلغ</th><th>پرداخت</th></tr></thead>
            <tbody>{club.receipts.map((r) => <tr key={r.id}><td dir="ltr" className="code">{r.id}</td><td className="nowrap">{jDateFa(r.date)}</td><td>{r.supplier}<small>{r.invoice}</small></td><td className="num">{fa(r.items.reduce((s, x) => s + x.qty, 0))}</td><td className="num">{toman(r.total)}</td><td><small>{PAY_FROM[r.pay]}</small></td></tr>)}</tbody></table></div>
        </Card>
        <Card title="اصلاحات انبار" sub="کسری و اضافه‌ی شمارش">
          {(club.stockMoves || []).length ? <div className="tbl-wrap small"><table className="tbl"><thead><tr><th>تاریخ</th><th>SKU</th><th>تعداد</th><th>دلیل</th></tr></thead>
            <tbody>{club.stockMoves.map((m) => <tr key={m.id}><td>{jDateFa(m.date)}</td><td dir="ltr" className="code">{m.sku}</td><td className={`num ${m.qty < 0 ? 'neg' : 'pos'}`}>{m.qty > 0 ? '+' : ''}{fa(m.qty)}</td><td>{m.note}</td></tr>)}</tbody></table></div>
            : <Empty>هنوز اصلاحی ثبت نشده است.</Empty>}
        </Card>
      </div>
    </div>
  )
}

// ---------- گزارش فروش کالا ----------
function Top() {
  const { club } = useStore()
  const [days, setDays] = useState('30')
  const since = Date.now() - +days * 864e5
  const rows = useMemo(() => {
    const m = {}
    club.orders.filter((o) => o.at >= since).forEach((o) => o.items.forEach((x) => {
      const r = (m[x.pid] ||= { qty: 0, rev: 0, cogs: 0 })
      r.qty += x.qty; r.rev += x.qty * x.price; r.cogs += x.qty * (x.cost || 0)
    }))
    return Object.entries(m).map(([pid, r]) => ({ p: club.products.find((p) => p.id === pid), ...r })).filter((r) => r.p).sort((a, b) => b.rev - a.rev)
  }, [club.orders, days])
  const byCat = CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({ name: c.name, value: rows.filter((r) => r.p.cat === c.id).reduce((s, r) => s + r.rev, 0), color: '#B44C9A' })).filter((r) => r.value).sort((a, b) => b.value - a.value)
  const T = rows.reduce((s, r) => ({ qty: s.qty + r.qty, rev: s.rev + r.rev, cogs: s.cogs + r.cogs }), { qty: 0, rev: 0, cogs: 0 })
  return (
    <div className="stack">
      <div className="filters-bar"><Seg value={days} onChange={setDays} options={{ 7: '۷ روز', 30: '۳۰ روز', 90: '۹۰ روز' }} /></div>
      <div className="kpis four">
        <Kpi icon="bag" label="تعداد فروش" value={`${fa(T.qty)} عدد`} />
        <Kpi icon="cash" label="فروش" value={short(T.rev)} />
        <Kpi icon="box" label="بهای تمام‌شده" value={short(T.cogs)} />
        <Kpi icon="chart" label="سود ناخالص" value={short(T.rev - T.cogs)} sub={T.rev ? `حاشیه ${fa(Math.round(((T.rev - T.cogs) / T.rev) * 100))}٪` : null} />
      </div>
      <div className="two">
        <Card title="فروش به تفکیک دسته"><HBars rows={byCat} /></Card>
        <Card title="پرفروش‌ترین کالاها">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>کالا</th><th>تعداد</th><th>فروش</th><th>سود ناخالص</th></tr></thead>
            <tbody>{rows.slice(0, 12).map((r) => <tr key={r.p.id}><td><b>{r.p.name}</b><small><code>{r.p.code}</code></small></td><td className="num">{fa(r.qty)}</td><td className="num">{short(r.rev)}</td><td className="num">{short(r.rev - r.cogs)}</td></tr>)}</tbody></table></div>
        </Card>
      </div>
    </div>
  )
}
