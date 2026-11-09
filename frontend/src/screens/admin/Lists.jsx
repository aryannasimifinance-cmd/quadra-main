import { useMemo, useState } from 'react'
import {
  COACHES, COACH_PACKS, COURTS, COURT_IMGS, LEVELS, MEMBERS, METHOD_NAME, PACKAGES, TYPE_NAME, coachById, coachPackPrice, courtById, dayLabel, dayMonth, fa, fromKey,
  hourLabel, hoursOf, levelById, memberById, priceFor, productById, range, short, toman, todayKey,
} from '../../data'
import { chime } from '../../fx'
import { ME, payState, useStore } from '../../store'
import { podium, ageOf, GENDER } from '../../events'
import { CHANNEL, TodayIn, channelOf } from './Payins'
import { Icon, LevelPill } from '../../components/ui'
import { Badge, Card, Empty, Field, Guide, ImageUpload, Kpi, Money, More, Pager, Search, Seg, Side, Status, Tabs, XlsxBtn, usePage, useSlice } from './kit'
import { HBars } from './Charts'
import { SEGMENTS, SPANS, coachFile, coachStats, memberStats, payments, who } from './derive'
import { dk, inPeriod, jDate, jDateFa, jMonthKey, jMonthLabel, period } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'

const fmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// ---------- دریافت‌ها: دو کار ساده — گرفتن مانده‌ها، و دیدن پول‌های رسیده ----------
const KINDS = [['court', 'زمین'], ['coach', 'کلاس'], ['pack', 'پکیج و تورنمنت'], ['shop', 'فروشگاه'], ['cafe', 'کافه'], ['manual', 'دریافت دستی']]
const WHEN = { today: 'امروز', week: '۷ روز', month: '۳۰ روز' }
const isToday = (t) => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() }

export function Payments({ ctx }) {
  const { club, user, adminSettle, toast } = useStore()
  const pays = useMemo(() => payments(club, user), [club])
  const [tab, setTab] = useState('due')
  const [when, setWhen] = useState('week')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [ch, setCh] = useState('all')
  const now = Date.now()
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)
  const dueNow = pays.filter((p) => p.due > 0 && p.at <= endToday.getTime()).sort((a, b) => b.at - a.at)
  const dueLater = pays.filter((p) => p.due > 0 && p.at > endToday.getTime()).sort((a, b) => a.at - b.at)
  const since = now - { today: 0, week: 7, month: 30 }[when] * 864e5
  const hist = pays.filter((p) => p.paid > 0 && p.at <= now && (when === 'today' ? isToday(p.at) : p.at >= since) && (kind === 'all' || p.kind === kind) && (ch === 'all' || channelOf(p.method) === ch) && (!q || (p.who + p.title + p.sub).includes(q)))
  const [rows, more] = usePage(hist, 30)
  const month = period('month', todayKey())
  const appMonth = pays.filter((p) => p.paid > 0 && p.at <= now && channelOf(p.method) === 'app' && inPeriod(dk(p.at), month))
  const appCourt = appMonth.filter((p) => p.kind === 'court')
  const settle = (p, m) => { adminSettle(p.id, m); chime('success'); toast({ icon: '✅', title: `${toman(p.due)} دریافت شد`, body: `${p.who}، ${METHOD_NAME[m]}` }) }
  const exp = () => downloadXlsx('quadra-payments', [{ name: 'دریافت‌ها', rows: table(`دریافت‌های باشگاه کوادرا — ${WHEN[when]}`, ['تاریخ', 'ساعت', 'شرح', 'جزئیات', 'مشتری', 'روش', 'مبلغ'],
    hist.map((p) => { const d = new Date(p.at); return [jDate(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`), d.toTimeString().slice(0, 5), p.title, p.sub, p.who, METHOD_NAME[p.method] || '', p.paid] }), ['جمع', '', '', '', '', '', hist.reduce((s, p) => s + p.paid, 0)]) }])
  const Due = ({ p }) => (
    <div className="pay-due">
      <div className="grow" onClick={() => p.ref && ctx.open({ kind: 'booking', id: p.bid || p.id })}>
        <b>{p.who}</b><small>{p.title}، {p.sub}</small>
      </div>
      <b className="num">{toman(p.due)}</b>
      <div className="row-btns">
        <button className="adm-btn primary sm" onClick={() => settle(p, 'card')} data-tip="مشتری با کارتخوان پرداخت کرد">کارتخوان</button>
        <button className="adm-btn ghost sm" onClick={() => settle(p, 'cash')} data-tip="پول نقد به صندوق آمد">نقدی</button>
      </div>
    </div>
  )
  return (
    <div className="stack">
      <TodayIn />
      <div className="kpis four">
        <Kpi icon="court" label="رزرو زمین از اپ" tone="good" value={toman(appCourt.reduce((s, p) => s + p.paid, 0))} sub={`${fa(appCourt.length)} رزرو، ${jMonthLabel(jMonthKey(todayKey()))}`} tip="پولی که این ماه بابت رزرو زمین از درگاه و کیف پول اپ رسیده" onClick={() => { setTab('got'); setCh('app'); setKind('court'); setWhen('month') }} />
        <Kpi icon="phone" label="کل درآمد از اپ" tone="good" value={toman(appMonth.reduce((s, p) => s + p.paid, 0))} sub={`${fa(appMonth.length)} پرداخت، زمین، کلاس، فروشگاه، کافه…`} tip="همه‌ی پرداخت‌های این ماه که از داخل اپ انجام شده" onClick={() => { setTab('got'); setCh('app'); setKind('all'); setWhen('month') }} />
        <Kpi icon="clock" label="باید همین حالا گرفته شود" tone={dueNow.length ? 'warn' : ''} value={toman(dueNow.reduce((s, p) => s + p.due, 0))} sub={`${fa(dueNow.length)} رزرو امروز یا گذشته`} onClick={() => setTab('due')} tip="بازی انجام شده یا امروز است و هنوز کامل پرداخت نشده" />
        <Kpi icon="cal" label="در پذیرش گرفته می‌شود" value={toman(dueLater.reduce((s, p) => s + p.due, 0))} sub={`${fa(dueLater.length)} رزرو آینده`} tip="رزروهای آینده‌ای که موقع بازی پرداخت می‌شوند" />
      </div>
      <Seg value={tab} onChange={setTab} options={{ due: `باید دریافت شود (${fa(dueNow.length + dueLater.length)})`, got: 'دریافت‌شده‌ها' }} tips={{ due: 'مانده‌ها را با یک کلیک تسویه کنید', got: 'تاریخچه‌ی پول‌های رسیده' }} />
      {tab === 'due' ? (
        <div className="two">
          <Card title="امروز و گذشته" sub="اول این‌ها را بگیرید">
            <div className="pay-list">{dueNow.map((p) => <Due key={p.id} p={p} />)}{!dueNow.length && <div className="all-good"><Icon name="check" size={20} /><b>چیزی برای گرفتن نمانده</b></div>}</div>
          </Card>
          <Card title="رزروهای آینده" sub="روز بازی در پذیرش گرفته می‌شود">
            <div className="pay-list">{dueLater.slice(0, 30).map((p) => <Due key={p.id} p={p} />)}{!dueLater.length && <Empty>رزرو پرداخت‌نشده‌ای در آینده نیست.</Empty>}</div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="bk-row">
            <Seg value={when} onChange={setWhen} options={WHEN} />
            <Seg value={ch} onChange={setCh} options={{ all: 'همه', app: 'اپ', card: 'کارتخوان', cash: 'نقدی' }} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} data-tip="از کدام بخش"><option value="all">همه‌ی بخش‌ها</option>{KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            <Search value={q} onChange={setQ} ph="مشتری یا شرح" />
            <XlsxBtn onClick={exp} />
          </div>
          <p className="count">{fa(hist.length)} دریافت، جمع <b>{toman(hist.reduce((s, p) => s + p.paid, 0))}</b></p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>زمان</th><th>شرح</th><th>مشتری</th><th>روش</th><th>مبلغ</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className={p.ref ? 'click' : ''} onClick={() => p.ref && ctx.open({ kind: 'booking', id: p.bid || p.id })}>
                <td className="nowrap">{fmt.format(p.at)}</td><td><b>{p.title}</b><small>{p.sub}</small></td><td>{p.who}</td>
                <td><span className={`ch-pill ch-${channelOf(p.method)}`}>{CHANNEL[channelOf(p.method)][0]}</span>{p.manual && <small>ثبت دستی</small>}</td><td className="num">{toman(p.paid)}</td>
              </tr>))}</tbody>
          </table></div>
          {!hist.length && <Empty>در این بازه دریافتی نیست.</Empty>}
          <More more={more} />
        </Card>
      )}
    </div>
  )
}

// ---------- اعضا ----------
const SRC = { all: 'همه', app: 'از اپ', desk: 'پذیرش' }
export function Members() {
  const { club, user } = useStore()
  const all = useMemo(() => memberStats(club, user), [club])
  const [seg, setSeg] = useState('all')
  const [src, setSrc] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('spent')
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(null) // 'new' یا عضو
  const list = all.filter((m) => (seg === 'all' || m.seg === seg) && (src === 'all' || (src === 'desk' ? m.source !== 'app' : m.source === 'app')) && (!q || m.name.includes(q) || m.phone?.includes(q)))
    .sort((a, b) => sort === 'last' ? a.lastDays - b.lastDays : sort === 'new' ? (b.at || 0) - (a.at || 0) : b[sort] - a[sort])
  const pg = useSlice(list, 30, seg + src + q + sort)
  const counts = Object.fromEntries(Object.keys(SEGMENTS).map((k) => [k, k === 'all' ? all.length : all.filter((m) => m.seg === k).length]))
  const m = sel && all.find((x) => x.id === sel)
  const exp = () => downloadXlsx('quadra-members', [{ name: 'اعضا', rows: table('اعضای باشگاه کوادرا', ['نام', 'موبایل', 'سطح', 'عضویت از', 'بخش', 'تعداد حضور', 'آخرین حضور (روز پیش)', 'رنکینگ', 'مجموع خرید'],
    list.map((x) => [x.name, x.phone, x.level, x.source === 'app' ? 'اپ' : 'پذیرش', SEGMENTS[x.seg], x.visits, x.lastDays >= 99 ? '' : x.lastDays, x.points || '', x.spent]), ['جمع', '', '', '', '', list.reduce((s, x) => s + x.visits, 0), '', '', list.reduce((s, x) => s + x.spent, 0)]) }])
  return (
    <div className="stack">
      <div className="sec-bar">
        <div className="segs-big">
          {Object.entries(SEGMENTS).map(([k, v]) => (
            <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)} data-tip={SEG_TIP[k]}><b>{fa(counts[k])}</b><small>{v}</small></button>
          ))}
        </div>
        <div className="sec-actions"><button className="adm-btn primary sm" onClick={() => setForm('new')} data-tip="ثبت عضوی که حضوری یا تلفنی آمده"><Icon name="plus" size={16} />عضو جدید</button></div>
      </div>
      <Guide>روی هر عضو بزنید تا پرونده‌اش باز شود: رزروها، کلاس‌ها و مربی‌ها، آدینه‌ها و نتیجه‌ها، خریدها؛ از همان‌جا اطلاعاتش را ویرایش یا غیرفعال کنید.</Guide>
      <Card>
        <div className="bk-row">
          <Search value={q} onChange={setQ} ph="نام یا موبایل" />
          <Seg value={src} onChange={setSrc} options={SRC} tips={{ app: 'کسانی که خودشان در اپ ثبت‌نام کرده‌اند', desk: 'اعضای ثبت‌شده در پذیرش' }} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} data-tip="ترتیب فهرست"><option value="spent">بیشترین خرید</option><option value="visits">بیشترین حضور</option><option value="last">آخرین حضور</option><option value="new">تازه‌ترین عضو</option><option value="points">رنکینگ</option></select>
          <XlsxBtn onClick={exp} />
        </div>
        <p className="count">{fa(list.length)} عضو</p>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>عضو</th><th>موبایل</th><th>سطح</th><th data-tip="چند بار رزرو یا بازی داشته">حضور</th><th>آخرین حضور</th><th data-tip="جمع پول رزرو، فروشگاه، کافه و پکیج">مجموع خرید</th><th>وضعیت</th></tr></thead>
          <tbody>{pg.rows.map((x) => (
            <tr key={x.id} className={`click ${sel === x.id ? 'sel' : ''}`} onClick={() => setSel(x.id)}>
              <td><div className="prod-cell"><span className="adm-av sm">{x.name[0]}</span><div><b>{x.name}</b><small>{x.source === 'app' ? 'از اپ' : x.source === 'desk' ? 'ثبت در پذیرش' : 'عضو باشگاه'}{coachOfMember(x.id) ? '، مربی' : ''}</small></div>{x.member && <span className="vip">{x.member === 'black' ? 'BLACK' : 'GOLD'}</span>}</div></td>
              <td dir="ltr" className="num">{x.phone}</td><td><LevelPill id={x.level} /></td><td className="num">{fa(x.visits)}</td>
              <td>{x.lastDays === 0 ? 'امروز' : x.lastDays >= 99 ? '—' : `${fa(x.lastDays)} روز پیش`}</td>
              <td className="num">{toman(x.spent)}</td><td><span className={`seg-pill s-${x.seg}`}>{SEGMENTS[x.seg]}</span></td>
            </tr>))}</tbody>
        </table></div>
        {!list.length && <Empty>عضوی پیدا نشد.</Empty>}
        <div className="log-foot">{list.length > 0 && <small>{fa(pg.from + 1)} تا {fa(pg.from + pg.rows.length)} از {fa(list.length)}</small>}<Pager {...pg} /></div>
      </Card>
      <Side open={!!m} onClose={() => setSel(null)} title={m?.name} wide>
        {m && <MemberFile key={m.id} m={m} onEdit={() => setForm(m)} />}
      </Side>
      <Side open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'عضو جدید' : `ویرایش ${form?.name || ''}`}>
        {form && <MemberForm key={form.id || 'new'} m={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      </Side>
    </div>
  )
}
const SEG_TIP = { all: 'همه‌ی اعضا', vip: 'عضویت طلایی یا مشکی دارند', active: 'در ۱۰ روز اخیر آمده‌اند', new: 'تازه عضو شده‌اند', risk: 'بیش از ۱۰ روز است نیامده‌اند', off: 'غیرفعال‌شده توسط مدیر؛ در فهرست‌های انتخاب دیده نمی‌شوند' }
const coachOfMember = (id) => COACHES.find((c) => c.member === id)
const toPhone = (v) => v.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '')

// پرونده‌ی عضو: هر چیزی که به او وصل است، در یک جا
function MemberFile({ m, onEdit }) {
  const { club, user, adminMemberEdit, toast } = useStore()
  const flip = () => {
    if (!m.inactive && !window.confirm(`${m.name} غیرفعال شود؟ در فهرست‌های انتخاب (رزرو، کافه، آدینه، یارها) دیده نمی‌شود ولی سابقه‌اش می‌ماند.`)) return
    adminMemberEdit(m.id, { inactive: !m.inactive }); chime('tap'); toast({ icon: '👤', title: m.inactive ? 'عضو دوباره فعال شد' : 'عضو غیرفعال شد', body: m.name })
  }
  const [tab, setTab] = useState('book')
  const bookings = club.bookings.filter((b) => b.type !== 'coach' && (b.by === m.id || b.players?.includes(m.id))).sort((a, b) => fromKey(b.date) - fromKey(a.date))
  const classes = club.bookings.filter((b) => b.type === 'coach' && b.status !== 'cancelled' && (b.by === m.id || b.players?.includes(m.id))).sort((a, b) => fromKey(b.date) - fromKey(a.date))
  const packs = club.sales.filter((s) => s.by === m.id && s.kind === 'coach')
  const coaches = [...new Set([...classes.map((b) => b.coach), ...packs.map((s) => s.item)])].map(coachById).filter(Boolean)
  const evs = (club.events || []).map((e) => ({ e, r: e.regs.find((r) => r.by === m.id) })).filter((x) => x.r).sort((a, b) => fromKey(b.e.date) - fromKey(a.e.date))
  const orders = [...club.orders.filter((o) => o.by === m.id).map((o) => ({ ...o, k: 'shop' })), ...(club.cafeOrders || []).filter((o) => o.by === m.id).map((o) => ({ ...o, k: 'cafe' }))].sort((a, b) => b.at - a.at)
  const coach = coachOfMember(m.id)
  const place = (e, rid) => {
    const t = e.teams.find((x) => x.players.includes(rid)), p = podium(e)
    if (!t) return e.status === 'done' ? '—' : 'هنوز تیم‌بندی نشده'
    const medal = p && (p.first === t.id ? '🏆 قهرمان' : p.second === t.id ? '🥈 نایب‌قهرمان' : p.third.includes(t.id) ? '🥉 سوم' : '')
    return `${t.name}${medal ? '، ' + medal : ''}`
  }
  const tabs = [['book', 'رزروها', bookings.length], ['class', 'کلاس و مربی', classes.length + packs.length], ['ev', 'آدینه‌ها', evs.length], ['buy', 'خریدها', orders.length]]
  return (
    <div className="mf">
      <div className="mf-head">
        <span className="adm-av">{m.name[0]}</span>
        <div className="grow"><b>{m.name}</b><small dir="ltr">{m.phone}</small>{(m.gender || m.birth) && <small>{[m.gender && GENDER[m.gender], m.birth && `${fa(ageOf(m))} ساله`].filter(Boolean).join('، ')}</small>}<div className="row-gap"><LevelPill id={m.level} /><span className={`seg-pill s-${m.seg}`}>{SEGMENTS[m.seg]}</span>{m.member && <span className="vip">{m.member === 'black' ? 'BLACK' : 'GOLD'}</span>}{coach && <Badge tone="ok">مربی: {coach.title}</Badge>}{m.inactive && <Badge tone="bad">غیرفعال</Badge>}</div></div>
      </div>
      <div className="row-btns">
        {m.id !== ME && <button className="adm-btn ghost sm" onClick={onEdit}><Icon name="cog" size={15} />ویرایش اطلاعات</button>}
        {m.id !== ME && <button className={`adm-btn ${m.inactive ? 'primary' : 'ghost'} sm`} onClick={flip} data-tip={m.inactive ? 'دوباره در فهرست‌ها دیده می‌شود' : 'از فهرست‌های انتخاب پنهان می‌شود؛ سابقه می‌ماند'}>{m.inactive ? 'فعال کردن دوباره' : 'غیرفعال کردن'}</button>}
      </div>
      {m.id === ME && <p className="guide">این کاربر اطلاعاتش را خودش در اپ ویرایش می‌کند.</p>}
      {m.note && <p className="mf-note">{m.note}</p>}
      <div className="mf-kpis">
        <div><small>حضور</small><b>{fa(m.visits)}</b></div><div><small>مجموع خرید</small><b>{short(m.spent)}</b></div>
        <div><small>کلاس با مربی</small><b>{fa(classes.length)}</b></div><div><small>آدینه</small><b>{fa(evs.length)}</b></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs.map(([k, n, c]) => [k, n, c || null])} />
      {tab === 'book' && <MiniTable empty="رزروی ندارد." head={['تاریخ', 'ساعت', 'زمین', 'نوع', 'پرداخت']} rows={bookings.slice(0, 30).map((b) => [`${dayLabel(b.date)} ${dayMonth(fromKey(b.date))}`, range(b.start, b.dur), courtById(b.court).name, TYPE_NAME[b.type], <Status s={payState(b)} />])} />}
      {tab === 'class' && (<>
        {coaches.length > 0 && <div className="mf-coaches">{coaches.map((c) => <span key={c.id}><i style={{ backgroundImage: `url(${c.img})` }} />{c.name}<small>{fa(classes.filter((b) => b.coach === c.id).length)} جلسه</small></span>)}</div>}
        {packs.length > 0 && <MiniTable head={['پکیج', 'تاریخ خرید', 'مبلغ']} rows={packs.map((s) => [s.name, jDateFa(dk(s.at)), toman(s.price)])} />}
        <MiniTable empty="کلاسی نداشته." head={['تاریخ', 'ساعت', 'مربی', 'وضعیت']} rows={classes.slice(0, 30).map((b) => [`${dayLabel(b.date)} ${dayMonth(fromKey(b.date))}`, range(b.start, b.dur), coachById(b.coach)?.name || '—', fromKey(b.date) < fromKey(todayKey()) ? 'برگزار شد' : 'آینده'])} />
      </>)}
      {tab === 'ev' && <MiniTable empty="در آدینه‌ای شرکت نکرده." head={['مسابقه', 'تاریخ', 'تیم و نتیجه', 'ورودی']} rows={evs.map(({ e, r }) => [e.title, jDateFa(e.date), place(e, r.id), r.paid ? toman(r.paid) : 'رایگان'])} />}
      {tab === 'buy' && <MiniTable empty="خریدی ندارد." head={['شماره', 'تاریخ', 'بخش', 'اقلام', 'مبلغ']} rows={orders.slice(0, 40).map((o) => [o.id, jDateFa(dk(o.at)), o.k === 'cafe' ? 'کافه' : 'فروشگاه', o.k === 'cafe' ? o.items.map((x) => `${fa(x.qty)}× ${x.name}`).join('، ') : o.items.map((x) => `${fa(x.qty)}× ${productById(x.pid)?.name || x.sku}`).join('، '), toman(o.total)])} />}
    </div>
  )
}
const MiniTable = ({ head, rows, empty }) => (rows.length
  ? <div className="tbl-wrap"><table className="tbl"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  : empty ? <Empty>{empty}</Empty> : null)

function MemberForm({ m, onClose }) {
  const { adminMember, adminMemberEdit, toast } = useStore()
  const [f, setF] = useState(() => (m ? { name: m.name, phone: m.phone || '09', level: m.level, side: m.side || 'both', gender: m.gender || '', birth: m.birth || '', member: m.member || '', note: m.note || '', inactive: !!m.inactive } : { name: '', phone: '09', level: 'C', side: 'both', gender: '', birth: '', member: '', note: '' }))
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const phone = toPhone(f.phone)
  const dup = MEMBERS.some((x) => x.phone === phone && x.id !== m?.id)
  const ok = f.name.trim().length > 2 && /^09\d{9}$/.test(phone) && !dup
  const save = () => {
    const p = { name: f.name.trim(), phone, level: f.level, side: f.side, gender: f.gender || null, birth: +f.birth || null, member: f.member || null, note: f.note.trim(), ...(m ? { inactive: !!f.inactive } : {}) }
    if (m) adminMemberEdit(m.id, p); else adminMember(p)
    chime('success'); toast({ icon: '👤', title: m ? 'اطلاعات عضو ذخیره شد' : 'عضو اضافه شد', body: p.name }); onClose()
  }
  return (
    <div className="form">
      <Field label="نام و نام خانوادگی"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً سارا محمدی" /></Field>
      <Field label="موبایل" hint={dup ? 'این شماره برای عضو دیگری ثبت شده است' : 'با همین شماره در اپ وارد می‌شود'}><input dir="ltr" inputMode="numeric" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
      <Field label="سطح بازی" tip="در تیم‌بندی آدینه‌ها و پیدا کردن بازی هم‌سطح استفاده می‌شود"><select value={f.level} onChange={(e) => set({ level: e.target.value })}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.id}، {l.title}</option>)}</select></Field>
      <Field label="سمت بازی"><Seg value={f.side} onChange={(side) => set({ side })} options={{ right: 'راست', left: 'چپ', both: 'هر دو' }} /></Field>
      <div className="form-2">
        <Field label="جنسیت" hint="برای رویدادهای ویژه‌ی بانوان / آقایان"><Seg value={f.gender} onChange={(gender) => set({ gender })} options={{ '': 'نامشخص', f: 'خانم', m: 'آقا' }} /></Field>
        <Field label="سال تولد (شمسی)" hint={f.birth && ageOf({ birth: +f.birth }) != null ? `${fa(ageOf({ birth: +f.birth }))} ساله` : 'برای رده‌های سنی'}><input dir="ltr" inputMode="numeric" maxLength={4} value={f.birth} placeholder="1375" onChange={(e) => set({ birth: toPhone(e.target.value).slice(0, 4) })} /></Field>
      </div>
      <Field label="عضویت ویژه"><Seg value={f.member} onChange={(member) => set({ member })} options={{ '': 'ندارد', gold: 'طلایی', black: 'مشکی' }} /></Field>
      <Field label="یادداشت مدیر" hint="فقط در پنل دیده می‌شود"><textarea rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      {m && <Field label="وضعیت عضو" hint={f.inactive ? 'در فهرست‌های انتخاب دیده نمی‌شود؛ سابقه‌اش می‌ماند' : 'در همه‌ی فهرست‌ها قابل انتخاب است'}><Seg value={f.inactive ? 'off' : 'on'} onChange={(v) => set({ inactive: v === 'off' })} options={{ on: 'فعال', off: 'غیرفعال' }} /></Field>}
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{m ? 'ذخیره' : 'ثبت عضو'}</button>
    </div>
  )
}

// ---------- مربی‌ها ----------
export function Coaches() {
  const { club } = useStore()
  const [span, setSpan] = useState('month')
  const stats = coachStats(club, span).sort((a, b) => (b.active !== false) - (a.active !== false) || b.rating - a.rating)
  const [sel, setSel] = useState(stats[0]?.id)
  const [form, setForm] = useState(null) // 'new' یا مربی
  const pk = PACKAGES.map((p) => ({ name: p.name, value: club.sales.filter((s) => s.item === p.id).reduce((a, s) => a + s.price, 0), color: '#E07B39' }))
  const pick = (id) => { setSel(id); setTimeout(() => document.getElementById('coach-file')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  const c = stats.find((x) => x.id === sel)
  return (
    <div className="stack">
      <div className="sec-bar">
        <div className="row-gap"><span className="muted-l">بازه‌ی آمار:</span><Seg value={span} onChange={setSpan} options={SPANS} /></div>
        <div className="sec-actions"><button className="adm-btn primary sm" onClick={() => setForm('new')} data-tip="مربی تازه با عکس، سطح، نرخ و پکیج‌ها؛ در اپ هم دیده می‌شود"><Icon name="plus" size={16} />مربی جدید</button></div>
      </div>
      <Guide>آمار هر کارت مربوط به بازه‌ی انتخابی است. روی کارت بزنید تا پرونده‌ی شاگردها، پکیج‌ها و نظرهای همان مربی باز شود.</Guide>
      <div className="coach-grid">
        {stats.map((x) => (
          <button key={x.id} className={`coach-adm ${sel === x.id ? 'on' : ''} ${x.active === false ? 'off' : ''}`} onClick={() => pick(x.id)}>
            <div className="ca-photo" style={{ backgroundImage: `url(${x.img})` }}>{x.active === false && <span className="ca-off">در اپ نمایش داده نمی‌شود</span>}</div>
            <div className="ca-body">
              <div className="row-between"><b>{x.name}</b><LevelPill id={x.level} /></div>
              <small>{x.title}، {toman(x.price)}/جلسه</small>
              <div className="ca-stats">
                <div><b>{fa(x.sessions)}</b><small>جلسه‌ی برگزارشده</small></div>
                <div><b>{fa(x.students)}</b><small>شاگرد</small></div>
                <div><b>{fa(x.packsSold)}</b><small>پکیج ({COACH_PACKS.filter((p) => p.sessions > 1).map((p) => `${fa(p.sessions)}: ${fa(x.byPack[p.id])}`).join('، ')})</small></div>
                <div><b>{short(x.revenue)}</b><small>درآمد</small></div>
              </div>
              <div className="ca-foot"><span>★ {fa(x.rating)} <small>از {fa(x.reviews)} امتیاز</small></span>{x.pending > 0 && <span className="ca-pending">{fa(x.pending)} نظر منتظر تأیید</span>}{x.login?.on && <span className="ca-login" data-tip={`پنل مربی فعال؛ نام کاربری ${x.login.user}`}>پنل فعال</span>}</div>
            </div>
          </button>
        ))}
      </div>
      {c && <CoachFile key={c.id + span} c={c} span={span} onEdit={() => setForm(c)} />}
      <div className="two">
        <Card title="فروش پکیج‌های باشگاه"><HBars rows={pk} /></Card>
        <Card title="نرخ پکیج‌های مربی" sub="دستی یا خودکار از نرخ جلسه؛ «—» یعنی این پکیج برای مربی فعال نیست">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>مربی</th>{COACH_PACKS.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
            <tbody>{stats.map((x) => <tr key={x.id}><td>{x.name}</td>{COACH_PACKS.map((p) => <td key={p.id} className="num">{x.packs?.[p.id] === false ? '—' : <>{short(coachPackPrice(x, p))}{x.prices?.[p.id] ? <small>دستی</small> : null}</>}</td>)}</tr>)}</tbody></table></div>
        </Card>
      </div>
      <Side open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'مربی جدید' : `ویرایش ${form?.name || ''}`} wide>
        {form && <CoachForm key={form.id || 'new'} co={form === 'new' ? null : club.coaches.find((x) => x.id === form.id)} onClose={(id) => { setForm(null); if (id) setSel(id) }} />}
      </Side>
    </div>
  )
}

// پرونده‌ی یک مربی در بازه‌ی انتخابی
function CoachFile({ c, span, onEdit }) {
  const { club, user } = useStore()
  const [tab, setTab] = useState('students')
  const [q, setQ] = useState('')
  const f = useMemo(() => coachFile(club, c.id, user, span), [club, c.id, user, span])
  const list = f.students.filter((s) => !q || s.name.includes(q) || s.phone?.includes(q))
  const pg = useSlice(list, 12, q + tab)
  const { adminReview, toast } = useStore()
  const day = (n) => ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][n]
  const pend = f.reviews.filter((r) => r.text && r.ok === false && !r.hidden)
  const moderate = (r, patch, msg) => { adminReview(r.id, patch); chime('tap'); toast({ icon: '💬', title: msg }) }
  const exp = () => downloadXlsx(`quadra-coach-${c.id}-${jDate(todayKey()).replace(/\//g, '-')}`, [
    { name: 'شاگردها', rows: table(`شاگردهای ${c.name} — ${SPANS[span]}`, ['شاگرد', 'تلفن', 'سطح', 'پکیج‌ها', 'جلسه‌ی برگزارشده', 'جلسه‌ی آینده', 'آخرین جلسه', 'جلسه‌ی بعدی', 'پرداختی'],
      f.students.map((s) => [s.name, s.phone || '', s.level || '', s.packs.map((p) => p.name).join('، '), s.past, s.next, s.last ? jDate(s.last) : '', s.upcoming ? jDate(s.upcoming) : '', s.paid])) },
    { name: 'پکیج‌ها', rows: table(null, ['تاریخ خرید', 'شاگرد', 'پکیج', 'شروع', 'پایان', 'روزها', 'ساعت', 'جلسه‌ها', 'مبلغ', 'روش'], f.packs.map((p) => [jDate(dk(p.at)), p.student, p.packName, p.first ? jDate(p.first.date) : '', p.last ? jDate(p.last.date) : '', p.days.map(day).join('، '), p.hours.join('، '), `${p.used}/${p.total}`, p.price, METHOD_NAME[p.method] || p.method])) },
    { name: 'نظرها', rows: table(null, ['تاریخ', 'امتیاز', 'نظر'], f.reviews.map((r) => [jDate(dk(r.at)), r.stars, r.text || ''])) },
  ])
  return (
    <Card className="coach-file" title={<span id="coach-file">پرونده‌ی {c.name}</span>} sub={`${c.title}، ${SPANS[span]}`}
      right={<div className="row-btns"><button className="adm-btn ghost sm" onClick={onEdit}><Icon name="cog" size={15} />ویرایش مربی</button><XlsxBtn onClick={exp} /></div>}>
      <div className="kpis four">
        <Kpi icon="users" label="شاگردها" value={fa(f.students.length)} sub={`${fa(f.active)} نفر جلسه‌ی آینده دارند`} />
        <Kpi icon="ticket" label="پکیج‌های فروخته" value={fa(f.packs.length)} sub={COACH_PACKS.map((p) => `${p.name.replace('پکیج ', '')}: ${fa(f.packs.filter((s) => s.pack === p.id).length)}`).join('، ')} />
        <Kpi icon="cal" label="جلسه‌های برگزارشده" value={fa(c.sessions)} sub={`${fa(c.upcoming)} جلسه‌ی آینده`} />
        <Kpi icon="cash" label="درآمد" value={short(c.revenue)} sub={`★ ${fa(c.rating)} از ${fa(c.reviews)} نظر`} />
      </div>
      <div className="row-between coach-bar">
        <Seg value={tab} onChange={setTab} options={{ students: `شاگردها ${fa(f.students.length)}`, packs: `پکیج‌ها و جلسه‌ها ${fa(f.packs.length)}`, next: `برنامه‌ی پیش‌رو ${fa(f.upcoming.length)}`, reviews: pend.length ? `نظرها (${fa(pend.length)} منتظر)` : `نظرها ${fa(f.reviews.length)}` }} />
        {tab === 'students' && <Search value={q} onChange={setQ} ph="نام یا شماره‌ی شاگرد" />}
      </div>
      {tab === 'students' && (<>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>شاگرد</th><th>سطح</th><th>پکیج‌ها</th><th>جلسه‌ها</th><th>آخرین / بعدی</th><th>پرداختی</th></tr></thead>
          <tbody>{pg.rows.map((s) => (
            <tr key={s.id}><td><b>{s.name}</b>{s.phone && <small dir="ltr">{s.phone}</small>}</td><td>{s.level ? <LevelPill id={s.level} /> : '—'}</td>
              <td>{s.packs.length ? <div className="log-items">{s.packs.map((p, i) => <span key={i}>{(COACH_PACKS.find((x) => x.id === p.pack)?.name) || p.name}</span>)}</div> : <small>تک جلسه</small>}</td>
              <td className="num">{fa(s.past)} برگزارشده{s.next > 0 && <small>{fa(s.next)} آینده</small>}</td>
              <td><small>{s.last ? `آخرین: ${jDateFa(s.last)}` : '—'}</small>{s.upcoming && <small className="pos">بعدی: {dayLabel(s.upcoming)} {jDateFa(s.upcoming)}</small>}</td>
              <td className="num">{toman(s.paid)}</td></tr>
          ))}</tbody>
        </table></div>
        {!list.length && <Empty>{q ? `شاگردی با «${q}» پیدا نشد.` : 'در این بازه شاگردی نداشته.'}</Empty>}
        <div className="log-foot">{list.length > 0 && <small>{fa(pg.from + 1)} تا {fa(pg.from + pg.rows.length)} از {fa(list.length)}</small>}<Pager {...pg} /></div>
      </>)}
      {tab === 'packs' && <MiniTable empty="در این بازه پکیج یا جلسه‌ای فروخته نشده." head={['شاگرد', 'پکیج', 'شروع', 'پایان', 'روزها و ساعت', 'جلسه‌ها', 'هزینه']}
        rows={f.packs.slice(0, 80).map((p) => [<><b>{p.student}</b><small>خرید {jDateFa(dk(p.at))}</small></>, <span className={`pk-pill pk-${p.pack}`}>{p.packName}</span>, p.first ? jDateFa(p.first.date) : <small>هنوز رزرو نشده</small>, p.last ? jDateFa(p.last.date) : '—',
          p.days.length ? <>{p.days.map(day).join('، ')}<small>{p.hours.map((h) => hourLabel(h)).join('، ')}</small></> : '—',
          <span className="num">{fa(p.used)} از {fa(p.total)}{p.nextS && <small>بعدی: {jDateFa(p.nextS.date)}</small>}</span>, <span className="num">{toman(p.price)}<small>{METHOD_NAME[p.method] || ''}</small></span>])} />}
      {tab === 'next' && <MiniTable empty="جلسه‌ی آینده‌ای ندارد." head={['روز', 'ساعت', 'زمین', 'شاگرد', 'پرداخت']}
        rows={f.upcoming.map((b) => [`${dayLabel(b.date)} ${jDateFa(b.date)}`, range(b.start, b.dur), courtById(b.court).name, b.players.map((p) => who(p, user)).join('، '), b.method === 'package' || b.method === 'coach-pack' ? 'از پکیج' : b.paid >= b.price ? 'پرداخت‌شده' : 'در محل'])} />}
      {tab === 'reviews' && (f.reviews.length
        ? <div className="rv-list">
          <p className="ds-banner">امتیاز ستاره‌ای همان لحظه در میانگین حساب می‌شود. <b>متن نظرها</b> فقط بعد از تأیید شما در اپ نمایش داده می‌شود.</p>
          {[...pend, ...f.reviews.filter((r) => !pend.includes(r))].map((r) => {
            const st = !r.text ? 'stars' : r.hidden ? 'hidden' : r.ok === false ? 'pending' : 'shown'
            return (
              <div key={r.id} className={`rv rv-${st}`}>
                <div className="row-between"><span className="rv-stars">{'★'.repeat(r.stars)}<i>{'★'.repeat(5 - r.stars)}</i></span>
                  <span className="rv-st">{{ stars: 'فقط امتیاز', hidden: 'پنهان', pending: 'منتظر تأیید', shown: 'در اپ نمایش داده می‌شود' }[st]}</span></div>
                {r.text && <p>{r.text}</p>}
                <div className="row-between"><small>{jDateFa(dk(r.at))}، ناشناس</small>
                  {r.text && <div className="row-btns">
                    {st !== 'shown' && <button className="adm-btn primary sm" onClick={() => moderate(r, { ok: true, hidden: false }, 'نظر در اپ نمایش داده می‌شود')}>تأیید و نمایش</button>}
                    {st !== 'hidden' && <button className="adm-btn ghost sm" onClick={() => moderate(r, { hidden: true }, 'نظر پنهان شد؛ امتیازش می‌ماند')}>پنهان</button>}
                  </div>}
                </div>
              </div>
            )
          })}
        </div>
        : <Empty>هنوز نظری ثبت نشده.</Empty>)}
    </Card>
  )
}

// فرم مربی: بالا «نمایش در اپ» (عمومی)، پایین «فقط مدیر» (خصوصی)
function CoachForm({ co, from, onClose }) {
  const { adminCoachSave, toast } = useStore()
  const [f, setF] = useState(() => co ? { ...co, recordText: (co.record || []).join('\n') } : {
    name: from?.name || '', title: 'مربی پدل', level: from?.level || 'B', exp: 1, price: 1500000, img: null, bio: '', recordText: '', active: true,
    packs: { one: true, five: true, ten: true, group: true }, prices: {}, phone: from?.phone || '', since: '', share: 50, note: '', member: from?.id || null,
  })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const phone = toPhone(f.phone || '')
  const ok = f.name.trim().length > 2 && f.price > 0 && (!phone || /^09\d{9}$/.test(phone))
  const auto = (p) => coachPackPrice({ ...f, prices: {} }, p)
  const save = () => {
    const { recordText, ...rest } = f
    const s = adminCoachSave({ ...rest, id: co?.id, name: f.name.trim(), phone, record: recordText.split('\n').map((x) => x.trim()).filter(Boolean), img: f.img || './img/coach-a.jpg' })
    chime('success'); toast({ icon: '🎾', title: co ? 'مربی به‌روز شد' : 'مربی اضافه شد', body: f.active ? 'در اپ دیده می‌شود' : 'در اپ نمایش داده نمی‌شود' })
    onClose(s.id)
  }
  const linked = f.member && memberById(f.member)
  return (
    <div className="form">
      <h4 className="form-sec">نمایش در اپ <small>همه‌ی بازیکن‌ها این‌ها را می‌بینند</small></h4>
      <ImageUpload value={f.img} onChange={(img) => set({ img })} hint="عکس چهره یا در حال بازی، روشن و واضح" />
      <div className="form-2">
        <Field label="نام و نام خانوادگی"><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="عنوان" hint="مثلاً «مربی بانوان»"><input value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      </div>
      <div className="form-3">
        <Field label="سطح مربی"><select value={f.level} onChange={(e) => set({ level: e.target.value })}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.id}، {l.title}</option>)}</select></Field>
        <Field label="سابقه (سال)"><input type="number" min="0" value={f.exp} onChange={(e) => set({ exp: +e.target.value })} /></Field>
        <Field label="نرخ هر جلسه"><Money value={f.price} onChange={(price) => set({ price })} /></Field>
      </div>
      <Field label="معرفی کوتاه"><textarea rows={2} value={f.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="مثلاً: کلاس‌های خصوصی و گروهی از پایه تا پیشرفته" /></Field>
      <Field label="سوابق و افتخارات" hint="هر خط یک مورد"><textarea rows={3} value={f.recordText} onChange={(e) => set({ recordText: e.target.value })} /></Field>
      <Field label="پکیج‌ها و قیمت" tip="خاموش = این پکیج برای این مربی در اپ نیست؛ قیمت خالی = خودکار از نرخ جلسه">
        <div className="pack-ed">{COACH_PACKS.map((p) => {
          const on = f.packs?.[p.id] !== false
          return (
            <div key={p.id} className={on ? '' : 'off'}>
              <label className="chk"><input type="checkbox" checked={on} onChange={(e) => set({ packs: { ...f.packs, [p.id]: e.target.checked } })} />{p.name}</label>
              <Money value={f.prices?.[p.id] || ''} onChange={(v) => set({ prices: { ...f.prices, [p.id]: v || undefined } })} placeholder={`خودکار: ${auto(p).toLocaleString('en')}`} disabled={!on} />
            </div>
          )
        })}</div>
      </Field>
      <Field label="نمایش در اپ"><Seg value={f.active ? 'on' : 'off'} onChange={(v) => set({ active: v === 'on' })} options={{ on: 'فعال', off: 'پنهان' }} tips={{ off: 'جلسه‌های قبلی و آمار می‌ماند ولی در اپ قابل انتخاب نیست' }} /></Field>

      <h4 className="form-sec priv">فقط برای مدیر <small>در اپ نشان داده نمی‌شود</small></h4>
      <div className="form-3">
        <Field label="موبایل"><input dir="ltr" inputMode="numeric" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="09…" /></Field>
        <Field label="شروع همکاری"><input value={f.since} onChange={(e) => set({ since: e.target.value })} placeholder="۱۴۰۳/۰۷/۰۱" /></Field>
        <Field label="سهم مربی ٪" tip="درصد از درآمد کلاس‌ها"><input type="number" min="0" max="100" value={f.share} onChange={(e) => set({ share: +e.target.value })} /></Field>
      </div>
      <Field label="حساب عضو در اپ" hint={linked ? 'کلاس‌ها و آدینه‌هایی که به‌عنوان بازیکن آمده هم در پرونده‌اش دیده می‌شود' : 'اگر مربی با شماره‌ی خودش در اپ عضو است، وصل کنید'}>
        <select value={f.member || ''} onChange={(e) => set({ member: e.target.value || null })}><option value="">— وصل نیست —</option>{[...MEMBERS].sort((a, b) => (b.phone === phone) - (a.phone === phone) || a.name.localeCompare(b.name, 'fa')).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.phone})</option>)}</select>
      </Field>
      <Field label="یادداشت خصوصی"><textarea rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="قرارداد، ساعت‌های آزاد، …" /></Field>

      <p className="muted small">نام کاربری، رمز و تأیید ورود این مربی در بخش «پنل مربی‌ها» است.</p>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{co ? 'ذخیره' : 'افزودن مربی'}</button>
    </div>
  )
}

// ساعت کاری: همه‌ی بازه‌های رزرو، تقویم، اپ و داشبورد از همین دو ساعت ساخته می‌شوند
import { LimitsCard } from './CoachAccess'
function HoursCard() {
  const { club, adminHours, toast } = useStore()
  const [h, setH] = useState(hoursOf(club))
  const today = todayKey()
  const outside = club.bookings.filter((b) => b.status !== 'cancelled' && !b.event && fromKey(b.date) >= fromKey(today) && (b.start < h.open || b.start + b.dur > h.close))
  const changed = h.open !== hoursOf(club).open || h.close !== hoursOf(club).close
  const save = () => { adminHours(h); chime('success'); toast({ icon: '🕘', title: 'ساعت کاری ذخیره شد', body: `${hourLabel(h.open)} تا ${hourLabel(h.close)}؛ رزرو در اپ و پذیرش فقط در همین ساعت‌ها` }) }
  return (
    <Card title="ساعت کاری مجموعه" sub="رزرو در اپ و پذیرش، تقویم زمین‌ها و درصد پر بودن بر اساس همین ساعت‌ها">
      <div className="form">
        <div className="form-2">
          <label>شروع فعالیت<select value={h.open} onChange={(e) => setH({ ...h, open: +e.target.value })}>{Array.from({ length: 9 }, (_, i) => i + 5).filter((x) => x < h.close - 1).map((x) => <option key={x} value={x}>{hourLabel(x)}</option>)}</select></label>
          <label>پایان فعالیت<select value={h.close} onChange={(e) => setH({ ...h, close: +e.target.value })}>{Array.from({ length: 9 }, (_, i) => i + 16).filter((x) => x > h.open + 1).map((x) => <option key={x} value={x}>{x === 24 ? '۲۴:۰۰ (نیمه‌شب)' : hourLabel(x)}</option>)}</select></label>
        </div>
        <div className="hours-bar" aria-hidden="true">{Array.from({ length: 19 }, (_, i) => i + 5).map((x) => <i key={x} className={x >= h.open && x < h.close ? 'on' : ''} title={hourLabel(x)} />)}</div>
        <p className="muted small">هر روز {fa(h.close - h.open)} ساعت؛ {hourLabel(h.open)} تا {h.close === 24 ? 'نیمه‌شب' : hourLabel(h.close)}.</p>
        {outside.length > 0 && <p className="pt-warn">{fa(outside.length)} رزرو پیش‌رو بیرون از این ساعت‌هاست؛ سر جایشان می‌مانند، ولی رزرو تازه در آن ساعت‌ها گرفته نمی‌شود.</p>}
        <button className="adm-btn primary" disabled={!changed} onClick={save}>ذخیره‌ی ساعت کاری</button>
      </div>
    </Card>
  )
}

// زمین‌ها: نام، عکس و فعال/تعمیرات؛ تغییر در کل اپ و پنل دیده می‌شود
function CourtsCard() {
  const { club, adminCourt } = useStore()
  const [edit, setEdit] = useState(null)
  return (
    <Card title="زمین‌ها" sub="نام و عکس هر زمین را عوض کنید؛ زمین غیرفعال در اپ قابل رزرو نیست">
      <div className="courts-set">
        {COURTS.map((c) => edit === c.id ? <CourtEdit key={c.id} c={c} onDone={() => setEdit(null)} /> : (
          <div key={c.id} className="court-set">
            <div className="cs-photo" style={{ backgroundImage: `url(${c.img})` }} />
            <div className="grow"><b>{c.name}</b><small>{c.kind}، {c.indoor ? 'سرپوشیده' : 'روباز'}</small></div>
            <button className="adm-btn ghost sm" onClick={() => setEdit(c.id)} data-tip="تغییر نام و عکس"><Icon name="cog" size={14} />ویرایش</button>
            <button className={`tgl-adm ${club.off[c.id] ? '' : 'on'}`} onClick={() => { adminCourt(c.id, !club.off[c.id]); chime('tap') }}><i /><span>{club.off[c.id] ? 'تعمیرات' : 'فعال'}</span></button>
          </div>
        ))}
      </div>
    </Card>
  )
}
function CourtEdit({ c, onDone }) {
  const { club, adminCourtEdit, toast } = useStore()
  const [name, setName] = useState(c.name)
  const [pic, setPic] = useState(c.img)
  const ok = name.trim().length >= 2 && !COURTS.some((x) => x.id !== c.id && x.name === name.trim())
  const save = () => {
    adminCourtEdit(c.id, { ...club.courtEdits?.[c.id], name: name.trim(), img: pic })
    chime('success'); toast({ icon: '🏟', title: 'زمین به‌روز شد', body: `«${name.trim()}» در اپ و همه‌ی بخش‌ها` }); onDone()
  }
  const reset = () => { adminCourtEdit(c.id, undefined); chime('tap'); onDone() }
  return (
    <div className="court-edit">
      <label className="fld"><span>نام زمین</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="مثلاً زمین مرکزی" autoFocus /></label>
      <div className="fld"><span>عکس</span>
        <div className="ce-pics">
          {(COURT_IMGS.includes(pic) ? COURT_IMGS : [...COURT_IMGS, pic]).map((u) => <button key={u.slice(-40)} type="button" className={pic === u ? 'on' : ''} style={{ backgroundImage: `url(${u})` }} onClick={() => setPic(u)} aria-label="انتخاب عکس" />)}
        </div>
        <ImageUpload value={null} onChange={(v) => v && setPic(v)} hint="یا عکس واقعی زمین را آپلود کنید (افقی)" />
      </div>
      <div className="row-btns">
        {club.courtEdits?.[c.id] && <button className="adm-btn ghost sm" onClick={reset}>برگشت به پیش‌فرض</button>}
        <span className="grow" />
        <button className="adm-btn ghost sm" onClick={onDone}>انصراف</button>
        <button className="adm-btn primary sm" disabled={!ok} onClick={save}>ذخیره</button>
      </div>
    </div>
  )
}

// هدیه‌ی ثبت‌نام بازیکن تازه در اپ (اعتبار کیف پول و XP)
function WelcomeCard() {
  const { club, adminWelcome, toast } = useStore()
  const cur = { wallet: club.welcome?.wallet ?? 0, xp: club.welcome?.xp ?? 20 }
  const [w, setW] = useState(cur)
  const changed = +w.wallet !== cur.wallet || +w.xp !== cur.xp
  const ok = +w.wallet >= 0 && +w.wallet <= 100000000 && +w.xp >= 0 && +w.xp <= 1000
  const save = () => { adminWelcome({ wallet: +w.wallet || 0, xp: +w.xp || 0 }); chime('success'); toast({ icon: '🎁', title: 'هدیه‌ی ثبت‌نام ذخیره شد', body: +w.wallet ? `${toman(+w.wallet)} اعتبار برای هر عضو تازه` : 'بدون اعتبار کیف پول' }) }
  return (
    <Card title="هدیه‌ی ثبت‌نام" sub="به هر شماره‌ی تازه‌ای که در اپ عضو می‌شود داده می‌شود">
      <div className="form">
        <div className="form-2">
          <label>اعتبار کیف پول (تومان)<input type="number" step="50000" min="0" value={w.wallet} onChange={(e) => setW({ ...w, wallet: e.target.value })} /></label>
          <label>امتیاز (XP)<input type="number" min="0" value={w.xp} onChange={(e) => setW({ ...w, xp: e.target.value })} /></label>
        </div>
        <p className="muted small">اعتبار هدیه قابل سوءاستفاده است (ساخت شماره‌ی تازه)؛ اگر می‌گذارید، مبلغ کم باشد.</p>
        <button className="adm-btn primary" disabled={!changed || !ok} onClick={save}>ذخیره</button>
      </div>
    </Card>
  )
}

export function Settings() {
  const { club, adminPricing, resetDemo, toast, config } = useStore()
  const [p, setP] = useState(club.pricing)
  const ex = (h) => priceFor(todayKey(), h, 1, p)
  const save = () => { adminPricing({ offpeak: +p.offpeak, peak: +p.peak, peakFrom: +p.peakFrom }); chime('success'); toast({ icon: '💾', title: 'نرخ‌ها ذخیره شد', body: 'در اپ بازیکن‌ها هم اعمال شد' }) }
  return (
    <div className="two">
      <Card title="نرخ زمین" sub="هر ساعت، کل زمین (۴ نفر)">
        <div className="form">
          <label>نرخ عادی (تومان)<input type="number" step="50000" value={p.offpeak} onChange={(e) => setP({ ...p, offpeak: e.target.value })} /></label>
          <label>نرخ پیک (تومان)<input type="number" step="50000" value={p.peak} onChange={(e) => setP({ ...p, peak: e.target.value })} /></label>
          <label>شروع ساعت پیک<select value={p.peakFrom} onChange={(e) => setP({ ...p, peakFrom: e.target.value })}>{[15, 16, 17, 18, 19].map((h) => <option key={h} value={h}>{fa(h)}:۰۰</option>)}</select></label>
          <p className="muted small">پنجشنبه و جمعه تمام روز پیک حساب می‌شود.</p>
          <div className="preview">
            <div><small>۱ ساعت، ساعت ۱۰ (امروز)</small><b>{toman(ex(10))}</b><small>هر نفر {toman(ex(10) / 4)}</small></div>
            <div><small>۱ ساعت، ساعت ۲۰ (امروز)</small><b>{toman(ex(20))}</b><small>هر نفر {toman(ex(20) / 4)}</small></div>
          </div>
          <button className="adm-btn primary" onClick={save} data-tip="قیمت تازه فقط برای رزروهای بعدی اعمال می‌شود">ذخیره‌ی نرخ‌ها</button>
        </div>
      </Card>
      <div className="stack">
        <HoursCard />
      <LimitsCard />
        <CourtsCard />
        <WelcomeCard />
        {config.demo && <Card title="داده‌های نمایشی">
          <p className="muted small">این نسخه در حالت نمایشی است؛ همه‌ی داده‌ها روی سرور ذخیره می‌شوند و با این دکمه به حالت اولیه برمی‌گردند.</p>
          <button className="adm-btn danger" onClick={() => confirm('همه‌ی داده‌ها پاک شود و داده‌ی نمایشی برگردد؟') && resetDemo()}><Icon name="refresh" size={16} />بازنشانی داده‌ها</button>
        </Card>}
      </div>
    </div>
  )
}
