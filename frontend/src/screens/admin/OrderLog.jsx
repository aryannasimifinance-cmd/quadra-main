// تاریخچه‌ی سفارش‌های فروشگاه و کافه: جستجو با نام، شماره، کد سفارش یا نام کالا، و صفحه‌بندی به جای اسکرول بی‌پایان
import { Fragment, useMemo, useState } from 'react'
import { METHOD_NAME, courtById, fa, memberById, short, toman } from '../../data'
import { dk, jDate, jDateFa } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { useStore } from '../../store'
import { Badge, Empty, Kpi, Pager, Search, Seg, XlsxBtn, useSlice } from './kit'
import { who } from './derive'

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const RANGES = { today: 'امروز', week: '۷ روز', month: '۳۰ روز', all: 'همه' }
const SINCE = { today: () => new Date().setHours(0, 0, 0, 0), week: () => Date.now() - 7 * 864e5, month: () => Date.now() - 30 * 864e5, all: () => 0 }

// lines(o): [[نام, تعداد, توضیح, قیمت واحد]]؛ status: { کلید: [نام, رنگ] }
export function OrderLog({ orders, lines, status, title, file, initialRange = 'month' }) {
  const { user } = useStore()
  const [q, setQ] = useState('')
  const [range, setRange] = useState(initialRange)
  const [src, setSrc] = useState('all')
  const [open, setOpen] = useState(null)
  // متن قابل جستجوی هر سفارش یک بار ساخته می‌شود
  const rows = useMemo(() => orders.map((o) => {
    const name = who(o.by, user), phone = memberById(o.by)?.phone || ''
    const ls = lines(o)
    return { o, name, phone, ls, hay: [o.id, name, phone, ...ls.map((x) => x[0])].join(' ').toLowerCase() }
  }), [orders, lines, user])
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const since = SINCE[range]()
  const list = rows.filter((r) => r.o.at >= since && (src === 'all' || (r.o.source === 'desk') === (src === 'desk')) && words.every((w) => r.hay.includes(w)))
  const pg = useSlice(list, 20, `${q}|${range}|${src}`)
  const sum = list.reduce((s, r) => s + r.o.total, 0)
  // پرتکرارها و مشتری‌های همین نتیجه: «کی چی خورده / خریده»
  const top = useMemo(() => {
    const m = new Map()
    list.forEach((r) => r.ls.forEach(([n, qty]) => m.set(n, (m.get(n) || 0) + qty)))
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [list])
  const people = new Set(list.map((r) => r.o.by)).size
  const one = words.length && people === 1 ? list[0] : null
  const exp = () => downloadXlsx(`${file}-${jDate(dk(Date.now())).replace(/\//g, '-')}`, [{
    name: title, rows: table(`${title} — ${RANGES[range]}${q ? ` — «${q}»` : ''}`, ['شماره', 'تاریخ', 'ساعت', 'مشتری', 'تلفن', 'اقلام', 'مبلغ', 'پرداخت', 'منبع', 'وضعیت'],
      list.map(({ o, name, phone, ls }) => [o.id, jDate(dk(o.at)), time.format(o.at), name, phone, ls.map(([n, qty, x]) => `${qty}× ${n}${x ? ` (${x})` : ''}`).join('، '), o.total, METHOD_NAME[o.method] || o.method, o.source === 'desk' ? 'حضوری' : 'اپ', status[o.status]?.[0] || o.status])),
  }])
  return (
    <div className="stack">
      <div className="log-bar">
        <Search value={q} onChange={setQ} ph="نام مشتری، شماره، کد سفارش یا کالا" />
        <Seg value={range} onChange={setRange} options={RANGES} />
        <Seg value={src} onChange={setSrc} options={{ all: 'همه', app: 'اپ', desk: 'حضوری' }} tips={{ app: 'سفارش‌های ثبت‌شده از اپ', desk: 'سفارش‌های حضوری' }} />
        <XlsxBtn onClick={exp} tip="دانلود همین نتیجه‌ی جستجو به‌صورت اکسل" />
      </div>
      <div className="kpis four">
        <Kpi icon="bag" label={one ? one.name : 'سفارش‌ها'} value={fa(list.length)} sub={one ? one.phone && <span dir="ltr">{one.phone}</span> : `${fa(people)} مشتری`} />
        <Kpi icon="cash" label="جمع مبلغ" value={short(sum)} />
        <Kpi icon="chart" label="میانگین هر سفارش" value={list.length ? short(Math.round(sum / list.length)) : '—'} />
        <Kpi icon="sparkle" label={words.length ? 'بیشتر از همه' : 'پرفروش‌های این بازه'} value={top[0] ? top[0][0] : '—'} sub={top.slice(1, 4).map(([n, c]) => `${n} ${fa(c)}`).join('، ')} />
      </div>
      <div className="tbl-wrap">
        <table className="tbl log-tbl">
          <thead><tr><th>سفارش</th><th>مشتری</th><th>اقلام</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت</th></tr></thead>
          <tbody>
            {pg.rows.map(({ o, name, phone, ls }) => {
              const st = status[o.status] || [o.status, 'mute']
              return (
                <Fragment key={o.id}>
                  <tr className={`click ${open === o.id ? 'sel' : ''}`} onClick={() => setOpen(open === o.id ? null : o.id)}>
                    <td><b dir="ltr">{o.id}</b><small>{jDateFa(dk(o.at))}، {time.format(o.at)}</small></td>
                    <td><b>{name}</b><small>{o.source === 'desk' ? 'حضوری' : 'اپ'}{phone && <>، <span dir="ltr">{phone}</span></>}</small></td>
                    <td className="log-items">{ls.map(([n, qty], i) => <span key={i}>{fa(qty)}× {n}</span>)}</td>
                    <td className="num">{toman(o.total)}</td>
                    <td>{METHOD_NAME[o.method] || o.method}</td>
                    <td><Badge tone={st[1]}>{st[0]}</Badge></td>
                  </tr>
                  {open === o.id && (
                    <tr className="log-more"><td colSpan={6}>
                      {ls.map(([n, qty, x, price], i) => <div key={i}><span>{fa(qty)}× {n}{x && <em>{x}</em>}</span>{price != null && <b className="num">{toman(qty * price)}</b>}</div>)}
                      {o.to ? <div><span>تحویل</span><b>سر {courtById(o.to)?.name}</b></div> : null}
                    </td></tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!list.length && <Empty>{words.length ? `سفارشی با «${q}» در این بازه پیدا نشد؛ بازه را «همه» کنید.` : 'سفارشی در این بازه نیست.'}</Empty>}
      </div>
      <div className="log-foot">
        {list.length > 0 && <small>{fa(pg.from + 1)} تا {fa(pg.from + pg.rows.length)} از {fa(list.length)}</small>}
        <Pager {...pg} />
      </div>
    </div>
  )
}
