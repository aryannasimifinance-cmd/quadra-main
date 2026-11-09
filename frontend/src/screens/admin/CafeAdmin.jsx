// کافه: سفارش‌ها (اپ، حضوری، سر زمین)، منو با دستور تهیه، انبار مواد اولیه، خریدها و گزارش فروش
import { motion } from 'framer-motion'
import { Fragment, useMemo, useState } from 'react'
import { METHOD_NAME, addDays, courtById, dayLabel, fa, fromKey, hourLabel, short, toman, todayKey } from '../../data'
import {
  BIG_K, CAFE_CATS, DRINKS, ING_CATS, NOTES, UNITS, bigCost, cafeCat, fits, fmtQty, ingAcc, itemAcc, itemCost, moreOf, nextIngCode, nextItemCode, portions, priceOf, shortage,
} from '../../cafe'
import { PAY_FROM } from '../../accounting'
import { daysOf, dk, inPeriod, jDate, jDateFa, ord, period } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon } from '../../components/ui'
import { Dish } from '../../components/Dish'
import { HBars } from './Charts'
import { who } from './derive'
import { Badge, Card, Empty, Field, Guide, ImageUpload, Kpi, Money, More, PeriodBar, Search, Seg, Side, Tabs, XlsxBtn, usePage } from './kit'
import { CustomerField, Qty, Ticket, useCustomer } from './PosKit'
import { OrderLog } from './OrderLog'
import { cafeOf, eventAt } from '../../events'
import { errText } from '../../api'

const fmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const NEXT = { new: ['prep', 'شروع آماده‌سازی'], prep: ['ready', 'آماده شد'], ready: ['delivered', 'تحویل داده شد'] }
const dest = (o) => (o.to ? `سر ${courtById(o.to)?.name || 'زمین ' + fa(o.to)}` : 'تحویل در کافه')
const ingTone = (g) => (g.stock <= 0 ? ['bad', 'تمام شده'] : g.stock <= g.min ? ['warn', 'زیر حداقل'] : ['ok', 'کافی'])
const fileDate = () => jDate(todayKey()).replace(/\//g, '-')

const LOG_ST = { new: ['ثبت شد', 'bad'], prep: ['در حال آماده‌سازی', 'warn'], ready: ['آماده‌ی تحویل', 'ok'], delivered: ['تحویل شد', 'mute'] }
const logLines = (o) => o.items.map((x) => [x.name + (x.big ? '، بزرگ' : ''), x.qty, x.note, x.price])

export function CafeAdmin() {
  const { club } = useStore()
  const [tab, setTab] = useState('orders')
  const [edit, setEdit] = useState(null) // آیتم منو یا 'new'
  const [ing, setIng] = useState(null) // ماده‌ی اولیه یا 'new'
  const [recv, setRecv] = useState(null) // true یا شناسه‌ی ماده
  const [adj, setAdj] = useState(null)
  const [pos, setPos] = useState(false)
  const open = club.cafeOrders.filter((o) => o.status !== 'delivered').length
  const low = club.cafeIngs.filter((g) => g.active !== false && g.stock <= g.min).length
  return (
    <div className="stack">
      <div className="sec-bar">
        <Tabs value={tab} onChange={setTab} tabs={[
          ['orders', 'سفارش‌ها', open, 'صف سفارش‌های امروز: آماده‌سازی و تحویل'],
          ['history', 'تاریخچه و جستجو', null, 'همه‌ی سفارش‌ها؛ با نام مشتری ببینید چه کسی چه سفارش داده'],
          ['menu', 'منو', null, 'آیتم‌های منو با عکس، قیمت و دستور تهیه'],
          ['stock', 'انبار و خرید', low, 'موجودی مواد اولیه، خریدها و ضایعات'],
          ['report', 'گزارش فروش', null, 'پرفروش‌ها، ساعت‌های شلوغ و سود کافه'],
        ]} />
        <div className="sec-actions">
          <button className={`adm-btn ${tab === 'events' ? 'primary' : 'ghost'} sm ev-btn`} onClick={() => setTab(tab === 'events' ? 'orders' : 'events')} data-tip="فروش کافه در آدینه‌ها و مسابقه‌ها، جدا از روزهای عادی">🏆 آدینه‌ها و مسابقات</button>
          <button className="adm-btn ghost sm" onClick={() => setTab('history')} data-tip="همه‌ی سفارش‌ها؛ با نام یا شماره‌ی مشتری ببینید چه کسی چه سفارش داده"><Icon name="search" size={16} />جستجوی سفارش‌ها</button>
          <button className={`adm-btn ${tab === 'orders' ? 'primary' : 'ghost'} sm`} onClick={() => setPos(true)} data-tip="ثبت دستی سفارش مشتری‌ای که حضوری به کافه آمده"><Icon name="plus" size={16} />ثبت سفارش حضوری</button>
          <button className="adm-btn ghost sm" onClick={() => setRecv(true)} data-tip="قهوه، شیر، نان و… که خریدید را وارد انبار کنید"><Icon name="box" size={16} />خرید مواد اولیه</button>
          {tab === 'stock'
            ? <button className="adm-btn primary sm" onClick={() => setIng('new')} data-tip="ماده‌ای که هنوز در انبار تعریف نشده"><Icon name="plus" size={16} />ماده‌ی اولیه‌ی جدید</button>
            : <button className={`adm-btn ${tab === 'orders' ? 'ghost' : 'primary'} sm`} onClick={() => setEdit('new')} data-tip="نوشیدنی یا غذای تازه با عکس و دستور تهیه"><Icon name="plus" size={16} />آیتم جدید منو</button>}
        </div>
      </div>
      <Guide>{{
        history: 'نام یا شماره‌ی مشتری را بنویسید تا ببینید چه چیزهایی سفارش داده؛ روی هر ردیف بزنید تا جزئیات باز شود.',
        orders: 'هر سفارش را به ستون بعد ببرید؛ وقتی «آماده شد» را بزنید، مشتری در اپ اعلان می‌گیرد. سفارش‌های بیش از ۲۰ دقیقه نارنجی می‌شوند.',
        menu: 'روی هر آیتم بزنید تا ویرایش شود. آیتمی که مواد اولیه‌اش تمام شده، در اپ «تمام شده» نشان داده می‌شود.',
        stock: 'با هر فروش، مواد اولیه طبق دستور تهیه خودکار کم می‌شود. خرید را ثبت کنید تا انبار پر شود؛ ضایعات را هم ثبت کنید تا حساب درست بماند.',
        report: 'فروش، هزینه‌ی مواد اولیه و سود کافه در بازه‌ی انتخابی؛ با «روزهای عادی» یا «مسابقه‌ها» فقط همان بخش را ببینید.',
        events: 'هر خرید کافه در روز آدینه یا مسابقه، درآمد همان روز مسابقه است و جدا از روزهای عادی حساب می‌شود. روی هر روز بزنید تا خریدها، ساعت‌های شلوغ و پرفروش‌هایش را ببینید.',
      }[tab]}</Guide>
      {tab === 'orders' && <Orders onAll={() => setTab('history')} />}
      {tab === 'history' && <OrderLog orders={club.cafeOrders} lines={logLines} status={LOG_ST} title="سفارش‌های کافه" file="quadra-cafe-orders" />}
      {tab === 'menu' && <Menu onEdit={setEdit} />}
      {tab === 'stock' && <><Stock onEdit={setIng} onRecv={setRecv} onAdj={setAdj} /><Buys onRecv={setRecv} /></>}
      {tab === 'report' && <Report />}
      {tab === 'events' && <CafeEvents />}
      <Side open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'آیتم جدید منو' : 'ویرایش آیتم منو'} wide>
        {edit && <ItemForm key={edit.id || 'new'} it={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      </Side>
      <Side open={!!ing} onClose={() => setIng(null)} title={ing === 'new' ? 'ماده‌ی اولیه‌ی جدید' : 'ویرایش ماده‌ی اولیه'}>
        {ing && <IngForm key={ing.id || 'new'} g={ing === 'new' ? null : ing} onClose={() => setIng(null)} onRecv={(id) => { setIng(null); setRecv(id) }} />}
      </Side>
      <Side open={!!recv} onClose={() => setRecv(null)} title="خرید مواد اولیه" wide>
        {recv && <Receive preset={typeof recv === 'string' ? recv : null} onClose={() => setRecv(null)} />}
      </Side>
      <Side open={!!adj} onClose={() => setAdj(null)} title="ضایعات و اصلاح موجودی">
        {adj && <Adjust g={adj} onClose={() => setAdj(null)} />}
      </Side>
      <Side open={pos} onClose={() => setPos(false)} title="سفارش حضوری کافه" size="till">
        {pos && <Pos onClose={() => setPos(false)} />}
      </Side>
    </div>
  )
}

// ---------- سفارش‌ها ----------
function Orders({ onAll }) {
  const { club, user, adminCafeOrder } = useStore()
  const [, tick] = useState(0)
  const today = club.cafeOrders.filter((o) => dk(o.at) === todayKey())
  const cols = [['new', 'جدید'], ['prep', 'در حال آماده‌سازی'], ['ready', 'آماده‌ی تحویل'], ['delivered', 'تحویل‌شده‌ی امروز']]
  const act = club.cafeOrders.filter((o) => o.status !== 'delivered')
  return (
    <div className="stack">
      <div className="kpis four">
        <Kpi icon="bag" label="سفارش‌های امروز" value={fa(today.length)} sub={`${fa(today.filter((o) => o.to).length)} سفارش سر زمین`} />
        <Kpi icon="cash" label="فروش امروز کافه" value={short(today.reduce((s, o) => s + o.total, 0))} />
        <Kpi icon="clock" label="در صف" tone={act.length > 4 ? 'warn' : ''} value={fa(act.length)} sub={act.length ? `قدیمی‌ترین ${fa(Math.round((Date.now() - Math.min(...act.map((o) => o.at))) / 6e4))} دقیقه پیش` : 'صف خالی است'} />
        <Kpi icon="chart" label="میانگین هر سفارش" value={today.length ? short(Math.round(today.reduce((s, o) => s + o.total, 0) / today.length)) : '—'} />
      </div>
      <div className="kanban four kb-scroll">
        {cols.map(([k, n]) => {
          const list = (k === 'delivered' ? today : club.cafeOrders).filter((o) => o.status === k)
          return (
            <div key={k} className="kb-col">
              <h4>{n} <span>{fa(list.length)}</span></h4>
              {list.map((o) => {
                const age = Math.round((Date.now() - o.at) / 6e4)
                return (
                  <motion.div key={o.id} layout className={`kb-card cafe-card ${k !== 'delivered' && age > 20 ? 'late' : ''}`}>
                    <div className="row-between"><b dir="ltr">{o.id}</b><small>{fmt.format(o.at)}{k !== 'delivered' && `، ${fa(age)} دقیقه`}</small></div>
                    <div className="row-gap"><span className={`dest ${o.to ? 'court' : ''}`}><Icon name={o.to ? 'court' : 'bag'} size={14} />{dest(o)}</span>{eventAt(club.events, o.at) && <span className="dest ev" data-tip={eventAt(club.events, o.at).title}>🏆 آدینه</span>}</div>
                    <small>{who(o.by, user)}، {o.source === 'desk' ? 'حضوری' : 'اپ'}، {METHOD_NAME[o.method]}</small>
                    <ul>{o.items.map((x, i) => <li key={i}><b>{fa(x.qty)}×</b> {x.name}{x.big ? '، بزرگ' : ''}{x.note && <em>{x.note}</em>}</li>)}</ul>
                    <div className="row-between"><b>{toman(o.total)}</b>
                      {NEXT[k] && <button className="adm-btn primary sm" data-tip={{ new: 'شروع درست کردن سفارش', prep: 'سفارش آماده است؛ مشتری اعلان می‌گیرد', ready: 'سفارش به مشتری رسید' }[k]} onClick={() => { adminCafeOrder(o.id, NEXT[k][0]); chime('tap'); tick((t) => t + 1) }}>{NEXT[k][1]}</button>}
                    </div>
                  </motion.div>
                )
              })}
              {!list.length && <Empty>—</Empty>}
              {k === 'delivered' && <button className="adm-btn ghost sm full kb-all" onClick={onAll}><Icon name="search" size={15} />همه‌ی سفارش‌ها و جستجو با نام</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- منو ----------
function Menu({ onEdit }) {
  const { club, adminCafeItem } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [st, setSt] = useState('all')
  const list = club.cafeItems.filter((it) => (cat === 'all' || it.cat === cat) && (!q || (it.name + it.code).includes(q))
    && (st === 'all' || (st === 'off' ? it.active === false : st === 'out' ? portions(it, club.cafeIngs) === 0 : it.active !== false)))
  const exp = () => downloadXlsx(`quadra-cafe-menu-${fileDate()}`, [{
    name: 'منوی کافه', rows: table(`منوی کافه‌ی کوادرا — ${jDateFa(todayKey())}`, ['کد', 'حساب درآمد', 'نام', 'دسته', 'قیمت', 'قیمت سایز بزرگ', 'بهای تمام‌شده', 'حاشیه‌ی سود ٪', 'پرس قابل تهیه', 'وضعیت'],
      list.map((it) => { const c = itemCost(it, club.cafeIngs); return [it.code, itemAcc(it), it.name, cafeCat(it.cat).name, it.price, it.big ? it.price + it.big : '', c, Math.round((1 - c / it.price) * 100), portions(it, club.cafeIngs), it.active === false ? 'غیرفعال' : 'فعال'] })),
  }, {
    name: 'دستور تهیه', rows: table(null, ['کد آیتم', 'آیتم', 'کد ماده', 'ماده‌ی اولیه', 'مقدار', 'واحد', 'بها'],
      list.flatMap((it) => it.recipe.map(([id, qty]) => { const g = club.cafeIngs.find((x) => x.id === id); return [it.code, it.name, g?.code, g?.name, qty, UNITS[g?.unit]?.n, Math.round(qty * (g?.cost || 0))] }))),
  }])
  return (
    <Card>
      <div className="filters-bar">
        <Search value={q} onChange={setQ} ph="نام یا کد آیتم" />
        <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">همه‌ی دسته‌ها</option>{CAFE_CATS.map((c) => <option key={c.id} value={c.id}>{c.ic} {c.name}</option>)}</select>
        <Seg value={st} onChange={setSt} options={{ all: 'همه', on: 'فعال', out: 'ناموجود', off: 'غیرفعال' }} />
        <span className="grow" /><XlsxBtn onClick={exp} />
      </div>
      <div className="row-between count"><span>{fa(list.length)} آیتم</span></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>آیتم</th><th>دسته</th><th>قیمت</th><th data-tip="جمع قیمت مواد اولیه‌ی یک پرس">قیمت تمام‌شده</th><th data-tip="چند درصد از قیمت فروش سود است">سود ٪</th><th data-tip="با موجودی فعلی انبار چند پرس می‌شود درست کرد">قابل تهیه</th><th>نمایش در اپ</th></tr></thead>
        <tbody>{list.map((it) => {
          const c = itemCost(it, club.cafeIngs), n = portions(it, club.cafeIngs)
          return (
            <tr key={it.id} className={`click ${it.active === false ? 'dim' : ''}`} onClick={() => onEdit(it)}>
              <td><div className="prod-cell"><Dish it={it} /><div><b>{it.name}</b><small data-tip={`حساب درآمد ${itemAcc(it)}`}>کد <code>{it.code}</code></small></div></div></td>
              <td>{cafeCat(it.cat).name}{it.tag && <small>{it.tag}</small>}</td>
              <td className="num">{toman(it.price)}{it.big > 0 && <small>بزرگ {toman(it.price + it.big)}</small>}</td>
              <td className="num">{toman(c)}</td>
              <td className="num">{fa(Math.round((1 - c / it.price) * 100))}٪</td>
              <td><Badge tone={n === 0 ? 'bad' : n <= 10 ? 'warn' : 'ok'}>{n === 0 ? 'ناموجود' : `${fa(n)} پرس`}</Badge></td>
              <td onClick={(e) => e.stopPropagation()}><button type="button" className={`tgl-adm ${it.active !== false ? 'on' : ''}`} onClick={() => adminCafeItem({ ...it, active: it.active === false })}><i /><span>{it.active !== false ? 'فعال' : 'غیرفعال'}</span></button></td>
            </tr>
          )
        })}</tbody>
      </table></div>
      {!list.length && <Empty>آیتمی با این فیلترها نیست.</Empty>}
    </Card>
  )
}

function ItemForm({ it, onClose }) {
  const { club, adminCafeItem, toast } = useStore()
  const ings = club.cafeIngs
  const [f, setF] = useState(() => it ? { ...it, recipe: it.recipe.map((r) => [...r]) } : { name: '', cat: 'hotcoffee', price: 0, big: 0, emoji: '☕', prep: 4, desc: '', tag: '', recipe: [[ings[0]?.id, 18]], active: true })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const setR = (i, x) => set({ recipe: f.recipe.map((r, j) => (j === i ? x : r)) })
  const code = it?.code || nextItemCode(club.cafeItems, f.cat)
  const cost = itemCost(f, ings), costBig = itemCost(f, ings, true), n = portions(f, ings)
  const drink = DRINKS.includes(f.cat)
  const ok = f.name.trim() && f.price > cost && f.recipe.length && f.recipe.every(([, q]) => q > 0)
  const save = () => {
    const s = adminCafeItem({ ...f, name: f.name.trim(), big: drink ? f.big : 0, recipe: f.recipe.filter(([, q]) => q > 0) })
    chime('success'); toast({ icon: '☕', title: it ? 'آیتم به‌روز شد' : 'آیتم به منو اضافه شد', body: `کد ${s.code}` }); onClose()
  }
  return (
    <div className="form">
      <h4 className="step"><i>۱</i>عکس و نام</h4>
      <ImageUpload value={f.img} onChange={(img) => set({ img })} hint="عکس واقعی از همین نوشیدنی یا غذا؛ مربع یا افقی" />
      <div className="form-2">
        <Field label="نام آیتم"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً آیس کارامل لاته" /></Field>
        <Field label="دسته" tip={it ? 'دسته بعد از ساخت تغییر نمی‌کند چون کد آیتم از آن ساخته شده' : 'در کدام بخش منو نشان داده شود'}><select value={f.cat} disabled={!!it} onChange={(e) => set({ cat: e.target.value, emoji: cafeCat(e.target.value).ic })}>{CAFE_CATS.map((c) => <option key={c.id} value={c.id}>{c.ic} {c.name}</option>)}</select></Field>
      </div>
      <Field label="توضیح در منو"><input value={f.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="مثلاً اسپرسو، شیر سرد و سس کارامل" /></Field>

      <h4 className="step"><i>۲</i>قیمت</h4>
      <div className="form-3">
        <Field label="قیمت فروش"><Money value={f.price} onChange={(price) => set({ price })} /></Field>
        {drink ? <Field label="اضافه‌ی لیوان بزرگ" tip={`اختیاری؛ مواد اولیه‌ی لیوان بزرگ ${fa(BIG_K)} برابر حساب می‌شود`}><Money value={f.big} onChange={(big) => set({ big })} placeholder="ندارد" /></Field> : <span />}
        <Field label="زمان آماده‌سازی (دقیقه)" tip="به مشتری در اپ گفته می‌شود سفارش حدوداً کی آماده است"><input type="number" min="1" value={f.prep} onChange={(e) => set({ prep: Math.max(1, +e.target.value) })} /></Field>
      </div>

      <h4 className="step"><i>۳</i>دستور تهیه</h4>
      <p className="muted small">برای یک پرس چه مقدار از هر ماده مصرف می‌شود؟ با هر فروش همین مقدار از انبار کم می‌شود و قیمت تمام‌شده از روی آن حساب می‌شود.</p>
      <div className="lines">
        {f.recipe.map(([id, q], i) => {
          const g = ings.find((x) => x.id === id)
          return (
            <div key={i} className="line recipe">
              <select value={id} onChange={(e) => setR(i, [e.target.value, q])}>{Object.entries(ING_CATS).map(([k, [n]]) => <optgroup key={k} label={n}>{ings.filter((x) => x.cat === k).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select>
              <div className="line-n">
                <label><small>مقدار ({UNITS[g?.unit]?.n})</small><input type="number" min="0" step="any" value={q} onChange={(e) => setR(i, [id, Math.max(0, +e.target.value)])} /></label>
                <label><small>در انبار</small><b>{g ? fmtQty(g, g.stock) : '—'}</b></label>
                <b className="num" data-tip="قیمت این مقدار از ماده">{toman(q * (g?.cost || 0))}</b>
                <button type="button" onClick={() => set({ recipe: f.recipe.filter((_, j) => j !== i) })} aria-label="حذف" data-tip="حذف از دستور تهیه"><Icon name="close" size={14} /></button>
              </div>
            </div>
          )
        })}
        <button type="button" className="adm-btn ghost sm" onClick={() => set({ recipe: [...f.recipe, [ings[0]?.id, 0]] })}><Icon name="plus" size={14} />افزودن ماده</button>
      </div>
      <div className="cost-sum">
        <div data-tip="جمع قیمت مواد اولیه‌ی یک پرس"><small>قیمت تمام‌شده</small><b>{toman(cost)}</b></div>
        <div><small>سود هر پرس</small><b className={f.price && f.price <= cost ? 'neg' : ''}>{f.price ? `${toman(f.price - cost)}، ${fa(Math.round((1 - cost / f.price) * 100))}٪` : '—'}</b></div>
        <div data-tip="با موجودی فعلی انبار"><small>قابل تهیه</small><b>{fa(n)} پرس</b></div>
        {drink && f.big > 0 && <div><small>لیوان بزرگ: هزینه / سود</small><b>{toman(costBig)} / {toman(f.price + f.big - costBig)}</b></div>}
      </div>

      <h4 className="step"><i>۴</i>نمایش</h4>
      <div className="form-2">
        <Field label="برچسب" tip="روی آیتم در منوی اپ دیده می‌شود"><select value={f.tag} onChange={(e) => set({ tag: e.target.value })}>{['', 'جدید', 'پرفروش', 'پیشنهاد سرآشپز'].map((t) => <option key={t} value={t}>{t || 'بدون برچسب'}</option>)}</select></Field>
        <label className="tgl-row" data-tip="آیتم غیرفعال در منوی اپ دیده نمی‌شود"><span>نمایش در منوی اپ</span><button type="button" className={`tgl-adm ${f.active !== false ? 'on' : ''}`} onClick={() => set({ active: f.active === false })}><i /><span>{f.active !== false ? 'فعال' : 'غیرفعال'}</span></button></label>
      </div>
      <p className="muted small" data-tip="برای حسابدار">کد آیتم <code>{code}</code>، حساب درآمد <code>6106-{cafeCat(f.cat).code}</code></p>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{ok ? (it ? 'ذخیره‌ی تغییرات' : 'افزودن به منو') : !f.name.trim() ? 'نام آیتم را بنویسید' : f.price <= cost ? 'قیمت باید از قیمت تمام‌شده بیشتر باشد' : 'دستور تهیه را کامل کنید'}</button>
    </div>
  )
}

// ---------- انبار مواد اولیه ----------
function Stock({ onEdit, onRecv, onAdj }) {
  const { club } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [only, setOnly] = useState('all')
  const all = club.cafeIngs
  const list = all.filter((g) => (cat === 'all' || g.cat === cat) && (!q || (g.name + g.code).includes(q)) && (only === 'all' || (only === 'low' ? g.stock <= g.min : g.stock <= 0)))
  const [rows, more] = usePage(list, 40)
  const value = all.reduce((s, g) => s + g.stock * g.cost, 0)
  // مصرف ۷ روز گذشته برای تخمین روزهای باقی‌مانده
  const used = useMemo(() => {
    const m = {}, since = Date.now() - 7 * 864e5
    club.cafeOrders.filter((o) => o.at >= since).forEach((o) => (o.use || []).forEach(([code, qty]) => { m[code] = (m[code] || 0) + qty }))
    return m
  }, [club.cafeOrders])
  const exp = () => downloadXlsx(`quadra-cafe-stock-${fileDate()}`, [{
    name: 'موجودی مواد اولیه', rows: table(`موجودی انبار کافه — ${jDateFa(todayKey())}`, ['کد', 'حساب تفصیلی', 'ماده‌ی اولیه', 'گروه', 'موجودی', 'واحد', 'حداقل', 'بهای واحد بزرگ', 'ارزش موجودی', 'مصرف ۷ روز', 'وضعیت'],
      list.map((g) => [g.code, ingAcc(g), g.name, ING_CATS[g.cat][0], Math.round(g.stock * 100) / 100, UNITS[g.unit].n, g.min, bigCost(g), Math.round(g.stock * g.cost), Math.round(used[g.code] || 0), ingTone(g)[1]]),
      ['جمع', '', '', '', null, '', null, null, Math.round(list.reduce((s, g) => s + g.stock * g.cost, 0)), null, '']),
  }])
  return (
    <div className="stack">
      <div className="kpis four">
        <Kpi icon="box" label="مواد اولیه" value={fa(all.length)} sub={`${fa(Object.keys(ING_CATS).length)} گروه`} />
        <Kpi icon="cash" label="ارزش انبار کافه" value={short(Math.round(value))} sub="به بهای میانگین موزون" />
        <Kpi icon="clock" label="زیر حداقل" tone={all.some((g) => g.stock <= g.min) ? 'warn' : ''} value={fa(all.filter((g) => g.stock > 0 && g.stock <= g.min).length)} sub="نیاز به سفارش خرید" />
        <Kpi icon="close" label="تمام شده" tone={all.some((g) => g.stock <= 0) ? 'bad' : ''} value={fa(all.filter((g) => g.stock <= 0).length)} sub={`${fa(club.cafeItems.filter((it) => it.active !== false && portions(it, all) === 0).length)} آیتم منو ناموجود`} />
      </div>
      <Card>
        <div className="filters-bar">
          <Search value={q} onChange={setQ} ph="نام یا کد ماده" />
          <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">همه‌ی گروه‌ها</option>{Object.entries(ING_CATS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select>
          <Seg value={only} onChange={setOnly} options={{ all: 'همه', low: 'زیر حداقل', out: 'تمام شده' }} />
          <span className="grow" /><XlsxBtn onClick={exp} />
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ماده‌ی اولیه</th><th>گروه</th><th>موجودی</th><th data-tip="زیر این مقدار هشدار خرید داده می‌شود">حداقل</th><th data-tip="میانگین قیمت خرید">قیمت واحد</th><th data-tip="موجودی × قیمت واحد">ارزش</th><th data-tip="با مصرف ۷ روز گذشته، موجودی چند روز کافی است">کفاف</th><th>وضعیت</th><th /></tr></thead>
          <tbody>{rows.map((g) => {
            const [tone, lbl] = ingTone(g), per = (used[g.code] || 0) / 7
            return (
              <tr key={g.id} className="click" onClick={() => onEdit(g)}>
                <td><b>{g.name}</b><small data-tip={`حساب انبار ${ingAcc(g)}`}>کد <code>{g.code}</code></small></td>
                <td>{ING_CATS[g.cat][0]}</td>
                <td className="num"><b>{fmtQty(g, g.stock)}</b></td>
                <td className="num">{fmtQty(g, g.min)}</td>
                <td className="num">{toman(bigCost(g))}<small>هر {UNITS[g.unit].big}</small></td>
                <td className="num">{toman(g.stock * g.cost)}</td>
                <td className="num">{per > 0 ? `${fa(Math.floor(g.stock / per))} روز` : '—'}</td>
                <td><Badge tone={tone}>{lbl}</Badge></td>
                <td onClick={(e) => e.stopPropagation()} className="nowrap">
                  <button className="adm-btn ghost sm" onClick={() => onRecv(g.id)} data-tip="ثبت خرید همین ماده">خرید</button>
                  <button className="adm-btn ghost sm" onClick={() => onAdj(g)} data-tip="ثبت دورریز یا اختلاف شمارش انبار">ضایعات</button>
                </td>
              </tr>
            )
          })}</tbody>
        </table></div>
        <More more={more} />
      </Card>
    </div>
  )
}

function IngForm({ g, onClose, onRecv }) {
  const { club, adminCafeIng, toast } = useStore()
  const [f, setF] = useState(() => g ? { ...g, bigCost: bigCost(g) } : { name: '', cat: 'coffee', unit: 'g', min: 1000, bigCost: 0, active: true })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const u = UNITS[f.unit]
  const code = g?.code || nextIngCode(club.cafeIngs, f.cat)
  const usedIn = g ? club.cafeItems.filter((it) => it.recipe.some(([id]) => id === g.id)) : []
  const save = () => {
    const { bigCost: bc, ...rest } = f
    const s = adminCafeIng({ ...rest, name: f.name.trim(), cost: g ? g.cost : bc / u.k })
    chime('success'); toast({ icon: '🧺', title: g ? 'ماده‌ی اولیه به‌روز شد' : 'ماده‌ی اولیه اضافه شد', body: `کد ${s.code}` })
    if (!g) onRecv(s.id); else onClose()
  }
  return (
    <div className="form">
      <div className="code-box">
        <div><small>کد ماده</small><b dir="ltr">{code}</b></div>
        <div><small>حساب تفصیلی</small><b dir="ltr">1302-{code}</b></div>
      </div>
      <Field label="نام"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً سیروپ فندق" /></Field>
      <div className="form-2">
        <Field label="گروه"><select value={f.cat} disabled={!!g} onChange={(e) => set({ cat: e.target.value })}>{Object.entries(ING_CATS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select></Field>
        <Field label="واحد شمارش"><select value={f.unit} disabled={!!g} onChange={(e) => set({ unit: e.target.value })}>{Object.entries(UNITS).map(([k, x]) => <option key={k} value={k}>{x.n}{x.k > 1 ? ` (خرید به ${x.big})` : ''}</option>)}</select></Field>
      </div>
      <div className="form-2">
        <Field label={`حداقل موجودی (${u.n})`} hint="پایین‌تر از این مقدار هشدار خرید داده می‌شود"><input type="number" min="0" value={f.min} onChange={(e) => set({ min: Math.max(0, +e.target.value) })} /></Field>
        <Field label={`بهای هر ${u.big}`} hint={g ? 'میانگین موزون؛ با هر خرید به‌روز می‌شود' : 'تخمینی؛ با اولین خرید اصلاح می‌شود'}><Money value={f.bigCost} onChange={(bigCost) => set({ bigCost })} disabled={!!g} /></Field>
      </div>
      {g && <p className="muted small">موجودی فعلی: <b>{fmtQty(g, g.stock)}</b>. موجودی فقط با «خرید مواد اولیه» یا «ضایعات و اصلاح» تغییر می‌کند تا سند حسابداری بخورد.</p>}
      {usedIn.length > 0 && <Field label="در دستور تهیه‌ی"><div className="size-chips">{usedIn.map((it) => <span key={it.id}>{it.emoji} {it.name}</span>)}</div></Field>}
      <button className="adm-btn primary full" disabled={!f.name.trim()} onClick={save}>{g ? 'ذخیره' : 'ذخیره و ثبت خرید اولیه'}</button>
    </div>
  )
}

function Receive({ preset, onClose }) {
  const { club, adminCafeReceive, toast } = useStore()
  const ings = club.cafeIngs
  const line = (id) => { const g = ings.find((x) => x.id === id); return { ing: id, qty: 1, big: bigCost(g) } } // مقدار و بها به واحد بزرگ
  const lowOnes = ings.filter((g) => g.stock <= g.min).map((g) => line(g.id))
  const [f, setF] = useState({ supplier: club.suppliers.at(-1) || '', invoice: '', date: todayKey(), pay: 'bank', lines: preset ? [line(preset)] : lowOnes.length ? lowOnes : [line(ings[0]?.id)] })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const setLine = (i, x) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...x } : l)) })
  const lines = f.lines.filter((l) => l.qty > 0 && l.big > 0)
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.big), 0)
  const save = () => {
    adminCafeReceive({ date: f.date, supplier: f.supplier.trim(), invoice: f.invoice.trim(), pay: f.pay, items: lines.map((l) => { const k = UNITS[ings.find((g) => g.id === l.ing).unit].k; return { ing: l.ing, qty: l.qty * k, cost: l.big / k } }) })
    chime('success'); toast({ icon: '🧺', title: 'خرید مواد اولیه ثبت شد', body: `${fa(lines.length)} قلم، ${toman(total)}` }); onClose()
  }
  return (
    <div className="form">
      {!preset && lowOnes.length > 0 && <p className="muted small">مواد زیر حداقل موجودی خودکار در فهرست آمده‌اند.</p>}
      <div className="form-2">
        <Field label="تأمین‌کننده"><input list="csups" value={f.supplier} onChange={(e) => set({ supplier: e.target.value })} /><datalist id="csups">{club.suppliers.map((s) => <option key={s} value={s} />)}</datalist></Field>
        <Field label="شماره‌ی فاکتور خرید"><input value={f.invoice} onChange={(e) => set({ invoice: e.target.value })} dir="ltr" /></Field>
      </div>
      <div className="form-2">
        <Field label="تاریخ"><select value={f.date} onChange={(e) => set({ date: e.target.value })}>{Array.from({ length: 10 }, (_, i) => addDays(todayKey(), -i)).map((k) => <option key={k} value={k}>{dayLabel(k)} {jDateFa(k)}</option>)}</select></Field>
        <Field label="پرداخت"><select value={f.pay} onChange={(e) => set({ pay: e.target.value })}>{Object.entries(PAY_FROM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <h4>اقلام</h4>
      <div className="lines">
        {f.lines.map((l, i) => {
          const g = ings.find((x) => x.id === l.ing), u = UNITS[g.unit]
          return (
            <div key={i} className="line">
              <select value={l.ing} onChange={(e) => setLine(i, line(e.target.value))}>{Object.entries(ING_CATS).map(([k, [n]]) => <optgroup key={k} label={n}>{ings.filter((x) => x.cat === k).map((x) => <option key={x.id} value={x.id}>{x.code}، {x.name} (موجودی {fmtQty(x, x.stock)})</option>)}</optgroup>)}</select>
              <div className="line-n">
                <label><small>مقدار ({u.big})</small><input type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(0, +e.target.value) })} /></label>
                <label><small>بهای هر {u.big}</small><Money value={l.big} onChange={(big) => setLine(i, { big })} /></label>
                <b className="num">{short(Math.round(l.qty * l.big))}</b>
                <button type="button" onClick={() => set({ lines: f.lines.filter((_, j) => j !== i) })} aria-label="حذف ردیف"><Icon name="close" size={14} /></button>
              </div>
            </div>
          )
        })}
        <button type="button" className="adm-btn ghost sm" onClick={() => set({ lines: [...f.lines, line(ings[0]?.id)] })}><Icon name="plus" size={14} />ردیف</button>
      </div>
      <div className="voucher-prev">
        <small>سند حسابداری</small>
        <div><span>بدهکار ۱۳۰۲ موجودی مواد اولیه‌ی کافه</span><b>{toman(total)}</b></div>
        <div><span>بستانکار {f.pay === 'payable' ? `۳۱۰۱ پرداختنی، ${f.supplier}` : f.pay === 'cash' ? '۱۱۰۱ صندوق' : '۱۱۰۲ بانک'}</span><b>{toman(total)}</b></div>
      </div>
      <button className="adm-btn primary full" disabled={!lines.length || !f.supplier.trim()} onClick={save}>ثبت خرید، {toman(total)}</button>
    </div>
  )
}

function Adjust({ g, onClose }) {
  const { adminCafeAdjust, toast } = useStore()
  const u = UNITS[g.unit]
  const [kind, setKind] = useState('waste')
  const [qty, setQty] = useState(0) // به واحد پایه
  const [count, setCount] = useState(Math.round(g.stock))
  const [note, setNote] = useState('فاسد شدن / تاریخ گذشته')
  const delta = kind === 'waste' ? -Math.min(qty, g.stock) : count - g.stock
  const amt = Math.round(delta * g.cost)
  const save = () => {
    adminCafeAdjust(g.id, delta, kind === 'waste' ? note : 'شمارش انبار')
    chime('success'); toast({ icon: delta < 0 ? '➖' : '➕', title: g.name, body: `${delta < 0 ? 'کسر' : 'اضافه'} ${fmtQty(g, Math.abs(delta))}` }); onClose()
  }
  return (
    <div className="form">
      <p className="muted small"><b>{g.name}</b>، موجودی فعلی {fmtQty(g, g.stock)}</p>
      <Seg value={kind} onChange={setKind} options={{ waste: 'ثبت ضایعات', count: 'شمارش انبار' }} />
      {kind === 'waste' ? (<>
        <Field label={`مقدار ضایعات (${u.n})`}><input type="number" min="0" value={qty} onChange={(e) => setQty(Math.max(0, +e.target.value))} /></Field>
        <Field label="دلیل"><input list="wreasons" value={note} onChange={(e) => setNote(e.target.value)} /><datalist id="wreasons">{['فاسد شدن / تاریخ گذشته', 'ریختن و شکستن', 'برگشتی مشتری', 'مصرف پرسنل'].map((x) => <option key={x} value={x} />)}</datalist></Field>
      </>) : (
        <Field label={`موجودی شمارش‌شده (${u.n})`} hint="اختلاف با موجودی سیستم سند اصلاح می‌خورد"><input type="number" min="0" value={count} onChange={(e) => setCount(Math.max(0, +e.target.value))} /></Field>
      )}
      <div className="voucher-prev">
        <small>سند حسابداری</small>
        {delta < 0 ? (<><div><span>بدهکار ۸۱۱۱ کسری و ضایعات</span><b>{toman(-amt)}</b></div><div><span>بستانکار ۱۳۰۲-{g.code}</span><b>{toman(-amt)}</b></div></>)
          : delta > 0 ? (<><div><span>بدهکار ۱۳۰۲-{g.code}</span><b>{toman(amt)}</b></div><div><span>بستانکار ۶۲۰۱ سایر درآمدها</span><b>{toman(amt)}</b></div></>)
            : <div><span>بدون اختلاف</span><b>—</b></div>}
      </div>
      <button className="adm-btn primary full" disabled={!delta} onClick={save}>ثبت</button>
    </div>
  )
}

// ---------- سفارش حضوری ----------
// چپ: منو؛ راست: فاکتور که همیشه دیده می‌شود. موجودی هر آیتم با کسر مواد کل سبد حساب می‌شود (قهوه، شیر و لیوان مشترک‌اند)
function Pos({ onClose }) {
  const { club, adminCafePos, toast } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [method, setMethod] = useState('card')
  const [to, setTo] = useState(0)
  const [now, setNow] = useState(false)
  const cu = useCustomer()
  const { cafeIngs: ings, cafeItems: all } = club
  const more = (it, big) => moreOf(it, big, ings, all, cart)
  const items = all.filter((it) => it.active !== false && (cat === 'all' || it.cat === cat) && (!q || (it.name + it.code).includes(q)))
    .map((it) => ({ it, n: more(it, false), nb: it.big > 0 ? more(it, true) : 0 }))
    .sort((a, b) => (b.n > 0 || b.nb > 0) - (a.n > 0 || a.nb > 0))
  const add = (it, big) => setCart((c) => {
    const k = c.findIndex((x) => x.iid === it.id && x.big === big && !x.note)
    return k >= 0 ? c.map((x, i) => (i === k ? { ...x, qty: x.qty + 1 } : x)) : [...c, { iid: it.id, big, qty: 1, note: '' }]
  })
  const setQty = (i, d) => setCart((c) => c.map((y, j) => (j === i ? { ...y, qty: y.qty + d } : y)).filter((y) => y.qty > 0))
  const lines = cart.filter((x) => all.some((y) => y.id === x.iid))
  const count = lines.reduce((s, x) => s + x.qty, 0)
  const total = lines.reduce((s, x) => s + x.qty * priceOf(all.find((y) => y.id === x.iid), x.big), 0)
  const lack = shortage(ings, all, lines)
  const inCart = (id) => lines.filter((x) => x.iid === id).reduce((s, x) => s + x.qty, 0)
  const instant = now && !to
  const live = eventAt(club.events, Date.now())
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    const o = await adminCafePos(lines, method, cu.by, to || null, instant)
    setBusy(false)
    if (!o) { chime('alarm'); toast({ icon: '⚠️', title: 'موجودی کافی نیست', body: 'انبار همین حالا تغییر کرده؛ سفارش را دوباره بررسی کنید.' }); return }
    if (o.failed) { chime('alarm'); toast({ icon: '⛔', title: 'سفارش ثبت نشد', body: errText(o) }); return }
    chime('success')
    toast({ icon: '☕', title: o.status === 'delivered' ? `سفارش ${o.id} تحویل شد` : `سفارش ${o.id} به آشپزخانه رفت`, body: `${toman(o.total)}، ${dest(o)}` })
    onClose()
  }
  return (
    <div className="pos2">
      <div className="pos-cat">
        {live && <p className="ev-live">🏆 امروز روز «{live.title}» است؛ این سفارش جزو فروش کافه‌ی روز مسابقه حساب می‌شود.</p>}
        <Search value={q} onChange={setQ} ph="جستجوی نام یا کد آیتم" />
        <div className="pick-chips">{[['all', 'همه', '✦'], ...CAFE_CATS.map((c) => [c.id, c.name, c.ic])].map(([k, n, ic]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{ic} {n}</button>)}</div>
        <div className="cafe-pos">
          {items.map(({ it, n, nb }) => {
            const c = inCart(it.id)
            return (
              <div key={it.id} className={`cp-item ${n <= 0 && nb <= 0 ? 'out' : ''} ${c ? 'in' : ''}`}>
                <button type="button" className="cp-main" disabled={n <= 0} onClick={() => add(it, false)} data-tip={n > 0 ? `${fa(n)} پرس دیگر قابل تهیه است` : 'مواد اولیه کافی نیست'}>
                  {c > 0 && <i className="cp-n">{fa(c)}</i>}
                  <Dish it={it} /><b>{it.name}</b><small>{toman(it.price)}</small><em>{n > 0 ? `${fa(n)} پرس` : 'ناموجود'}</em>
                </button>
                {it.big > 0 && <button type="button" className="cp-big" disabled={nb <= 0} onClick={() => add(it, true)}>بزرگ +{short(it.big)}</button>}
              </div>
            )
          })}
        </div>
        {!items.length && <Empty>آیتمی پیدا نشد</Empty>}
      </div>
      <Ticket count={count} total={total} onClear={() => setCart([])} empty="روی آیتم‌های منو بزنید تا به فاکتور اضافه شوند."
        disabled={!fits(ings, all, lines)} onSubmit={save} action={instant ? 'ثبت و تحویل' : 'ثبت و ارسال به آشپزخانه'}
        warn={lack.length > 0 && <p className="pt-warn">کمبود در انبار: {lack.map(([g, d]) => `${g.name} ${fmtQty(g, d)}`).join('، ')}</p>}
        options={<>
          <Field label="تحویل"><div className="pick-chips sm">{[0, 1, 2, 3, 4].map((c) => <button key={c} type="button" className={to === c ? 'on' : ''} onClick={() => setTo(c)}>{c ? `زمین ${fa(c)}` : 'در کافه'}</button>)}</div></Field>
          {!to && <Field label="آماده‌سازی"><Seg value={now ? 'now' : 'queue'} onChange={(v) => setNow(v === 'now')} options={{ queue: 'به صف آشپزخانه', now: 'تحویل همان لحظه' }} tips={{ queue: 'سفارش در ستون «در حال آماده‌سازی» می‌نشیند', now: 'برای آیتم آماده مثل آب و نوشابه؛ مستقیم تحویل‌شده ثبت می‌شود' }} /></Field>}
          <CustomerField c={cu} />
          <Field label="روش پرداخت"><Seg value={method} onChange={setMethod} options={{ card: 'کارتخوان', cash: 'نقدی' }} /></Field>
        </>}>
        {cart.map((x, i) => {
          const it = all.find((y) => y.id === x.iid)
          if (!it) return null
          return (
            <div key={i} className="pt-line">
              <Dish it={it} />
              <div className="grow"><b>{it.name}{x.big ? '، بزرگ' : ''}</b>
                <select className="note-sel" value={x.note} onChange={(e) => setCart(cart.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))}><option value="">بدون توضیح</option>{NOTES.map((n) => <option key={n}>{n}</option>)}</select></div>
              <div className="pt-r"><Qty qty={x.qty} onMinus={() => setQty(i, -1)} onPlus={() => setQty(i, 1)} canPlus={more(it, x.big) >= 1} /><b className="num">{toman(x.qty * priceOf(it, x.big))}</b></div>
            </div>
          )
        })}
      </Ticket>
    </div>
  )
}

// کافه در روزهای آدینه و مسابقه: هر خرید کافه در روز مسابقه، درآمد همان روز است
function CafeEvents() {
  const { club } = useStore()
  const [sel, setSel] = useState(null)
  const days = useMemo(() => (club.events || []).filter((e) => e.status !== 'draft' && e.status !== 'cancelled').map((e) => {
    const os = cafeOf(club, e)
    const top = {}, hours = {}
    os.forEach((o) => { hours[new Date(o.at).getHours()] = (hours[new Date(o.at).getHours()] || 0) + o.total; o.items.forEach((x) => { top[x.name] = (top[x.name] || 0) + x.qty }) })
    return { e, os, rev: os.reduce((s, o) => s + o.total, 0), top: Object.entries(top).sort((a, b) => b[1] - a[1]), hours }
  }).sort((a, b) => fromKey(b.e.date) - fromKey(a.e.date)), [club])
  // میانگین یک روز عادی (۳۰ روز اخیر، روزهایی که فروش داشته‌اند) برای مقایسه
  const normal = useMemo(() => {
    const by = {}
    club.cafeOrders.filter((o) => o.at >= Date.now() - 30 * 864e5 && !eventAt(club.events, o.at)).forEach((o) => { by[dk(o.at)] = (by[dk(o.at)] || 0) + o.total })
    const v = Object.values(by)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0
  }, [club])
  const held = days.filter((d) => d.os.length)
  const coming = days.filter((d) => !d.os.length && fromKey(d.e.date) >= fromKey(todayKey())).reverse()
  const avgEv = held.length ? Math.round(held.reduce((s, d) => s + d.rev, 0) / held.length) : 0
  const diff = (v) => (normal ? Math.round(((v - normal) / normal) * 100) : 0)
  const Up = ({ v }) => { const d = diff(v); return <em className={`cd-diff ${d >= 0 ? 'up' : 'down'}`}>{d >= 0 ? '▲' : '▼'} {fa(Math.abs(d))}٪ نسبت به روز عادی</em> }
  const allTop = {}
  held.forEach((d) => d.top.forEach(([n, q]) => { allTop[n] = (allTop[n] || 0) + q }))
  const best = Object.entries(allTop).sort((a, b) => b[1] - a[1])[0]
  const d = sel && days.find((x) => x.e.id === sel)
  if (d) return (
    <div className="stack">
      <button className="adm-btn ghost sm ev-back" onClick={() => setSel(null)}><Icon name="fwd" size={16} />همه‌ی روزهای مسابقه</button>
      <div className="cd-hero">
        <div className="cd-date"><b>{fa(+jDate(d.e.date).split('/')[2])}</b><small>{dayLabel(d.e.date)}</small></div>
        <div className="grow"><small>کافه در روز</small><h2>🏆 {d.e.title}</h2><span>{jDateFa(d.e.date)}، مسابقه {hourLabel(d.e.start)} تا {hourLabel(d.e.start + d.e.dur)}، {fa(d.e.regs.length)} شرکت‌کننده</span></div>
        <div className="cd-big"><small>درآمد کافه در این روز</small><b>{toman(d.rev)}</b><Up v={d.rev} /></div>
      </div>
      <div className="kpis four">
        <Kpi icon="bag" label="خریدها" value={fa(d.os.length)} sub={`${fa(d.os.filter((o) => o.to).length)} سفارش سر زمین`} />
        <Kpi icon="chart" label="میانگین هر خرید" value={d.os.length ? toman(Math.round(d.rev / d.os.length)) : '—'} />
        <Kpi icon="users" label="هر شرکت‌کننده" value={d.e.regs.length ? toman(Math.round(d.rev / d.e.regs.length)) : '—'} sub="درآمد کافه تقسیم بر نفرات" />
        <Kpi icon="sparkle" label="پرفروش" value={d.top[0]?.[0] || '—'} sub={d.top.slice(1, 4).map(([n, q]) => `${n} ${fa(q)}`).join('، ')} />
      </div>
      <div className="two">
        <Card title="فروش ساعت‌به‌ساعت" sub="ساعت‌های مسابقه پررنگ‌اند">
          <HBars rows={Object.keys(d.hours).map(Number).sort((a, b) => a - b).map((h) => ({ name: `${fa(h)}:۰۰`, value: d.hours[h], color: h >= d.e.start && h < d.e.start + d.e.dur ? '#C9A227' : '#D9CFB4' }))} />
        </Card>
        <Card title="چه چیزهایی فروخته شد">{d.top.slice(0, 10).map(([n, q]) => <div key={n} className="row-between ev-top"><span>{n}</span><b>{fa(q)}</b></div>)}</Card>
      </div>
      <OrderLog orders={d.os} lines={logLines} status={LOG_ST} title={`کافه — ${d.e.title}`} file={`quadra-cafe-${d.e.id}`} initialRange="all" />
    </div>
  )
  return (
    <div className="stack">
      <div className="cd-top">
        <div className="cd-tile gold"><small>درآمد کافه در روزهای مسابقه</small><b>{toman(held.reduce((s, x) => s + x.rev, 0))}</b><em>{fa(held.length)} روز مسابقه، {fa(held.reduce((s, x) => s + x.os.length, 0))} خرید</em></div>
        <div className="cd-tile"><small>میانگین یک روز مسابقه</small><b>{toman(avgEv)}</b><Up v={avgEv} /></div>
        <div className="cd-tile"><small>میانگین یک روز عادی</small><b>{toman(normal)}</b><em>۳۰ روز اخیر</em></div>
        <div className="cd-tile"><small>پرفروش روزهای مسابقه</small><b>{best ? best[0] : '—'}</b><em>{best ? `${fa(best[1])} عدد` : ''}</em></div>
      </div>
      {held.length > 0 && <Card title="درآمد کافه در هر روز مسابقه" sub="خط نقطه‌چین = میانگین روز عادی">
        <div className="cd-bars" style={{ '--avg': `${Math.min(100, (normal / Math.max(...held.map((x) => x.rev), normal, 1)) * 100)}%` }}>
          {held.slice(0, 10).map((x) => (
            <button key={x.e.id} onClick={() => setSel(x.e.id)} data-tip={`${x.e.title}: ${toman(x.rev)}`}>
              <i style={{ height: `${(x.rev / Math.max(...held.map((y) => y.rev), normal, 1)) * 100}%` }}><b>{short(x.rev)}</b></i>
              <small>{jDateFa(x.e.date).slice(5)}</small>
            </button>
          ))}
        </div>
      </Card>}
      <div className="cd-grid">
        {held.map((x) => (
          <button key={x.e.id} className="cd-card" onClick={() => setSel(x.e.id)}>
            <div className="cd-c-head"><span className="cd-date sm"><b>{fa(+jDate(x.e.date).split('/')[2])}</b><small>{dayLabel(x.e.date)}</small></span><div className="grow"><b>{x.e.title}</b><small>{jDateFa(x.e.date)}</small></div></div>
            <b className="cd-rev">{toman(x.rev)}</b>
            <Up v={x.rev} />
            <small>{fa(x.os.length)} خرید، میانگین {short(Math.round(x.rev / x.os.length))}</small>
            {x.top.length > 0 && <small className="cd-top3">☕ {x.top.slice(0, 3).map(([n]) => n).join('، ')}</small>}
          </button>
        ))}
        {coming.map((x) => (
          <div key={x.e.id} className="cd-card soon">
            <div className="cd-c-head"><span className="cd-date sm"><b>{fa(+jDate(x.e.date).split('/')[2])}</b><small>{dayLabel(x.e.date)}</small></span><div className="grow"><b>{x.e.title}</b><small>{jDateFa(x.e.date)}</small></div></div>
            <small>پیش‌رو؛ از همان روز خریدهای کافه این‌جا جمع می‌شود</small>
          </div>
        ))}
      </div>
      {!days.length && <Empty>هنوز آدینه یا مسابقه‌ای تعریف نشده.</Empty>}
    </div>
  )
}

// ---------- خریدها و ضایعات ----------
function Buys({ onRecv }) {
  const { club } = useStore()
  const [rows, more] = usePage(club.cafeReceipts, 15)
  const [open, setOpen] = useState(null)
  const exp = () => downloadXlsx(`quadra-cafe-purchases-${fileDate()}`, [{
    name: 'خرید مواد اولیه', rows: table('خریدهای کافه', ['شماره', 'تاریخ', 'تأمین‌کننده', 'فاکتور', 'کد', 'ماده‌ی اولیه', 'مقدار', 'واحد', 'بهای واحد', 'جمع', 'پرداخت'],
      club.cafeReceipts.flatMap((r) => r.items.map((x) => { const g = club.cafeIngs.find((y) => y.id === x.ing); return [r.id, jDate(r.date), r.supplier, r.invoice || '', x.code, x.name, x.qty, UNITS[g?.unit]?.n, Math.round(x.cost * 100) / 100, Math.round(x.qty * x.cost), PAY_FROM[r.pay]] }))),
  }, {
    name: 'ضایعات و اصلاح', rows: table(null, ['تاریخ', 'کد', 'ماده‌ی اولیه', 'مقدار', 'مبلغ', 'دلیل'], club.cafeMoves.map((m) => [jDate(m.date), m.code, m.name, m.qty, m.amount, m.note])),
  }])
  return (
    <div className="stack">
      <Card title="فاکتورهای خرید مواد اولیه" sub="هر فاکتور سند بدهکار ۱۳۰۲ می‌خورد" right={<div className="row-gap"><XlsxBtn onClick={exp} /><button className="adm-btn primary sm" onClick={() => onRecv(true)}><Icon name="plus" size={16} />خرید جدید</button></div>}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>شماره</th><th>تاریخ</th><th>تأمین‌کننده</th><th>اقلام</th><th>مبلغ</th><th>پرداخت</th></tr></thead>
          <tbody>{rows.map((r) => (<Fragment key={r.id}>
            <tr className="click" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <td dir="ltr" className="code">{r.id}</td><td className="nowrap">{jDateFa(r.date)}</td><td>{r.supplier}<small>{r.invoice}</small></td>
              <td className="num">{fa(r.items.length)} قلم</td><td className="num">{toman(r.total)}</td><td><small>{PAY_FROM[r.pay]}</small></td>
            </tr>
            {open === r.id && <tr className="subrow"><td colSpan={6}><div className="size-chips">{r.items.map((x) => { const g = club.cafeIngs.find((y) => y.id === x.ing); return <span key={x.code}>{x.name}: {g ? fmtQty(g, x.qty) : fa(x.qty)}، {toman(x.qty * x.cost)}</span> })}</div></td></tr>}
          </Fragment>))}</tbody>
        </table></div>
        <More more={more} />
      </Card>
      <Card title="ضایعات و اصلاح شمارش" sub="کسری سند ۸۱۱۱ و اضافه سند ۶۲۰۱ می‌خورد">
        {club.cafeMoves.length ? <div className="tbl-wrap small"><table className="tbl"><thead><tr><th>تاریخ</th><th>ماده</th><th>مقدار</th><th>مبلغ</th><th>دلیل</th></tr></thead>
          <tbody>{club.cafeMoves.map((m) => { const g = club.cafeIngs.find((y) => y.id === m.ing); return <tr key={m.id}><td>{jDateFa(m.date)}</td><td>{m.name}<small><code>{m.code}</code></small></td><td className={`num ${m.qty < 0 ? 'neg' : 'pos'}`}>{g ? fmtQty(g, m.qty) : fa(m.qty)}</td><td className="num">{toman(Math.abs(m.amount))}</td><td>{m.note}</td></tr> })}</tbody></table></div>
          : <Empty>هنوز ضایعات یا اصلاحی ثبت نشده است.</Empty>}
      </Card>
    </div>
  )
}

// ---------- گزارش فروش ----------
function Report() {
  const { club, user } = useStore()
  const [p, setP] = useState(() => period('week', todayKey()))
  const [mode, setMode] = useState('all')
  const orders = club.cafeOrders.filter((o) => inPeriod(dk(o.at), p) && (mode === 'all' || !!eventAt(club.events, o.at) === (mode === 'event')))
  const R = useMemo(() => {
    const items = {}, cats = {}, hours = {}, ingUse = {}, days = {}
    orders.forEach((o) => {
      const d = (days[dk(o.at)] ||= { n: 0, rev: 0, cogs: 0 }); d.n++; d.rev += o.total
      const h = new Date(o.at).getHours(); hours[h] = (hours[h] || 0) + o.total
      o.items.forEach((x) => {
        const r = (items[x.iid] ||= { name: x.name, code: x.code, cat: x.cat, qty: 0, rev: 0, cogs: 0 })
        r.qty += x.qty; r.rev += x.qty * x.price; r.cogs += x.cost
        cats[x.cat] = (cats[x.cat] || 0) + x.qty * x.price
        d.cogs += x.cost
      })
      ;(o.use || []).forEach(([code, qty, amt]) => { const u = (ingUse[code] ||= { qty: 0, amt: 0 }); u.qty += qty; u.amt += amt })
    })
    return { items: Object.values(items).sort((a, b) => b.rev - a.rev), cats, hours, ingUse, days }
  }, [orders])
  const T = orders.reduce((s, o) => ({ n: s.n + 1, rev: s.rev + o.total, cogs: s.cogs + o.items.reduce((a, x) => a + x.cost, 0), court: s.court + (o.to ? 1 : 0), app: s.app + (o.source === 'app' ? 1 : 0) }), { n: 0, rev: 0, cogs: 0, court: 0, app: 0 })
  const byCat = CAFE_CATS.map((c) => ({ name: `${c.ic} ${c.name}`, value: R.cats[c.id] || 0, color: '#B07A4E' })).filter((r) => r.value).sort((a, b) => b.value - a.value)
  const byHour = Array.from({ length: 16 }, (_, i) => i + 8).map((h) => ({ name: `${fa(h)}:۰۰`, value: R.hours[h] || 0, color: '#0E9F98' })).filter((r) => r.value)
  const ingName = (code) => club.cafeIngs.find((g) => g.code === code)
  const exp = () => downloadXlsx(`quadra-cafe-${p.file}`, [
    { name: 'خلاصه', rows: [[{ v: `گزارش فروش کافه‌ی کوادرا — ${p.label}`, s: 't' }], [`${jDate(p.from)} تا ${jDate(p.to)}`], [],
      [{ v: 'شرح', s: 'h' }, { v: 'مقدار', s: 'h' }], ['تعداد سفارش', T.n], ['فروش (تومان)', T.rev], ['بهای تمام‌شده', T.cogs], [{ v: 'سود ناخالص', s: 'b' }, { v: T.rev - T.cogs, s: 'b' }],
      ['میانگین هر سفارش', T.n ? Math.round(T.rev / T.n) : 0], ['سفارش سر زمین', T.court], ['سفارش از اپ', T.app]] },
    { name: 'روزانه', rows: table(null, ['تاریخ', 'روز', 'تعداد سفارش', 'فروش', 'بهای تمام‌شده', 'سود ناخالص'],
      daysOf(p).filter((k) => ord(k) <= ord(todayKey())).map((k) => { const d = R.days[k] || { n: 0, rev: 0, cogs: 0 }; return [jDate(k), dayLabel(k), d.n, d.rev, d.cogs, d.rev - d.cogs] }), ['جمع', '', T.n, T.rev, T.cogs, T.rev - T.cogs]) },
    { name: 'فروش آیتم‌ها', rows: table(null, ['کد', 'آیتم', 'دسته', 'تعداد', 'فروش', 'بهای تمام‌شده', 'سود ناخالص', 'حاشیه ٪'],
      R.items.map((r) => [r.code, r.name, cafeCat(r.cat).name, r.qty, r.rev, r.cogs, r.rev - r.cogs, r.rev ? Math.round(((r.rev - r.cogs) / r.rev) * 100) : 0])) },
    { name: 'مصرف مواد اولیه', rows: table(null, ['کد', 'ماده‌ی اولیه', 'مقدار مصرف', 'واحد', 'بهای مصرف'],
      Object.entries(R.ingUse).sort((a, b) => b[1].amt - a[1].amt).map(([code, u]) => { const g = ingName(code); return [code, g?.name, Math.round(u.qty), UNITS[g?.unit]?.n, u.amt] })) },
    { name: 'سفارش‌ها', rows: table(null, ['شماره', 'زمان', 'مشتری', 'منبع', 'تحویل', 'اقلام', 'مبلغ', 'پرداخت'],
      orders.map((o) => [o.id, `${jDate(dk(o.at))} ${fmt.format(o.at)}`, who(o.by, user), o.source === 'app' ? 'اپ' : 'حضوری', dest(o), o.items.map((x) => `${x.qty}× ${x.name}${x.big ? ' (بزرگ)' : ''}`).join('، '), o.total, METHOD_NAME[o.method]])) },
  ])
  return (
    <div className="stack">
      <PeriodBar p={p} setP={setP} right={<><Seg value={mode} onChange={setMode} options={{ all: 'همه', normal: 'روزهای عادی', event: '🏆 مسابقه‌ها' }} tips={{ normal: 'بدون فروش روزهای آدینه و مسابقه', event: 'فقط فروش روزهای آدینه و مسابقه' }} /><XlsxBtn label="گزارش اکسل کافه" onClick={exp} /></>} />
      <div className="kpis four">
        <Kpi icon="bag" label="سفارش‌ها" value={fa(T.n)} sub={`${fa(T.n ? Math.round((T.app / T.n) * 100) : 0)}٪ از اپ، ${fa(T.court)} سر زمین`} />
        <Kpi icon="cash" label="فروش کافه" value={short(T.rev)} sub={T.n ? `میانگین ${short(Math.round(T.rev / T.n))}` : null} />
        <Kpi icon="box" label="بهای تمام‌شده (مواد اولیه)" value={short(T.cogs)} />
        <Kpi icon="chart" label="سود ناخالص" value={short(T.rev - T.cogs)} sub={T.rev ? `حاشیه ${fa(Math.round(((T.rev - T.cogs) / T.rev) * 100))}٪` : null} />
      </div>
      <div className="two">
        <Card title="فروش به تفکیک دسته">{byCat.length ? <HBars rows={byCat} /> : <Empty>فروشی در این بازه نیست.</Empty>}</Card>
        <Card title="ساعت‌های شلوغ کافه" sub="فروش هر ساعت">{byHour.length ? <HBars rows={byHour} /> : <Empty>—</Empty>}</Card>
      </div>
      <div className="two">
        <Card title="پرفروش‌ترین آیتم‌ها">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>آیتم</th><th>تعداد</th><th>فروش</th><th>سود ناخالص</th></tr></thead>
            <tbody>{R.items.slice(0, 12).map((r) => <tr key={r.code}><td><b>{r.name}</b><small><code>{r.code}</code></small></td><td className="num">{fa(r.qty)}</td><td className="num">{short(r.rev)}</td><td className="num">{short(r.rev - r.cogs)}</td></tr>)}</tbody></table></div>
        </Card>
        <Card title="مصرف مواد اولیه" sub="بر اساس دستور تهیه‌ی آیتم‌های فروخته‌شده">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ماده</th><th>مقدار</th><th>بها</th></tr></thead>
            <tbody>{Object.entries(R.ingUse).sort((a, b) => b[1].amt - a[1].amt).slice(0, 12).map(([code, u]) => { const g = ingName(code); return <tr key={code}><td>{g?.name}<small><code>{code}</code></small></td><td className="num">{g ? fmtQty(g, u.qty) : fa(u.qty)}</td><td className="num">{short(u.amt)}</td></tr> })}</tbody></table></div>
        </Card>
      </div>
    </div>
  )
}
