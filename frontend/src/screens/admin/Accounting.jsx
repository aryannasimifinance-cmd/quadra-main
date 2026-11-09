// حسابداری: خلاصه‌ی مالی، ثبت هزینه، دفتر روزنامه، دفتر کل و معین، تراز آزمایشی، صورت‌های مالی، کدینگ و گزارش اکسل
import { Fragment, useMemo, useState } from 'react'
import { COURTS, TYPE_NAME, addDays, dayLabel, fa, mil, range, short, toman, todayKey } from '../../data'
import { ACCOUNTS, GROUPS, KIND_NAME, PAY_FROM, accByCode, accountBook, balanceOf, balanceSheet, dailyPL, income, ledger, segments, trial } from '../../accounting'
import { catName, CAT_CODE } from '../../catalog'
import { CAFE_CATS, ING_CATS, UNITS, ingAcc } from '../../cafe'
import { ROLES, payroll } from '../../hr'
import { daysOf, inPeriod, jDate, jDateFa, jMonthKey, ord, period } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { payState, useStore } from '../../store'
import { Icon } from '../../components/ui'
import { STATUS, who } from './derive'
import { Card, Empty, Field, Guide, Kpi, Money, More, PeriodBar, Search, Seg, Side, Tabs, XlsxBtn, usePage } from './kit'

const n0 = (n) => (Math.round(n) ? toman(n) : '—')
const anchor = (p) => (ord(p.to) > ord(todayKey()) ? todayKey() : p.to)

// نام حساب تفصیلی
function useNames(club) {
  return useMemo(() => {
    const prod = Object.fromEntries(club.products.map((p) => [p.code, p.name]))
    const ing = Object.fromEntries(club.cafeIngs.map((g) => [g.code, g.name]))
    const staff = Object.fromEntries(club.staff.map((s) => [s.id, s.name]))
    return (acc, sub) => {
      if (!sub) return ''
      if (acc === '1301') return prod[sub] || sub
      if (acc === '1201') return who(sub)
      if (acc === '1501') return staff[sub] || sub
      if (acc === '6105') return catName(sub)
      if (acc === '1302') return ing[sub] || sub
      if (acc === '6106') return CAFE_CATS.find((c) => c.code === sub)?.name || sub
      return sub
    }
  }, [club.products, club.staff, club.cafeIngs])
}

// دسته‌های هزینه به زبان ساده — هر دسته به یک حساب کل وصل است
const EXP_CATS = [
  ['8104', 'اجاره', 'home', 'اجاره‌ی سالن و محل'], ['8105', 'آب، برق، گاز', 'bolt', 'قبض‌های مصرفی'], ['8108', 'اینترنت و تلفن', 'phone', 'اینترنت، تلفن، پیامک'],
  ['8106', 'تعمیر و نگهداری', 'wrench', 'چمن، توری، شیشه، تأسیسات'], ['8107', 'تبلیغات', 'msg', 'اینستاگرام، چاپ، بیلبورد'], ['8109', 'ملزومات و نظافت', 'box', 'مواد شوینده، دستمال، ملزومات'],
  ['8110', 'کارمزد بانکی', 'card', 'کارمزد کارتخوان و درگاه'], ['8199', 'سایر', 'sparkle', 'هر هزینه‌ی دیگر'],
]
const expName = (acc) => EXP_CATS.find((c) => c[0] === acc)?.[1] || accByCode(acc)?.name
const PAY3 = { cash: 'صندوق', bank: 'بانک', payable: 'نسیه' }
const PAY3_TIP = { cash: 'از پول نقد صندوق پذیرش پرداخت شد', bank: 'کارت به کارت یا از حساب بانکی', payable: 'هنوز پرداخت نشده؛ بدهی به طرف حساب ثبت می‌شود' }

export function Accounting() {
  const { club } = useStore()
  const [tab, setTab] = useState('summary')
  const [p, setP] = useState(() => period('month', todayKey()))
  const V = useMemo(() => ledger(club), [club])
  const names = useNames(club)
  const ctx = { club, V, p, setP, names }
  const S = { summary: Summary, expense: Expenses, debts: Debts, cash: Cash, reports: Reports, books: Books }[tab]
  return (
    <div className="stack">
      <div className="sec-bar">
        <Tabs value={tab} onChange={setTab} tabs={[
          ['summary', 'خلاصه', null, 'سود و زیان هر بخش باشگاه در یک نگاه'],
          ['expense', 'هزینه‌ها', null, 'ثبت و دیدن هزینه‌ها: اجاره، قبض، تعمیرات…'],
          ['debts', 'طلب و بدهی', null, 'چه کسی به باشگاه بدهکار است و باشگاه به چه کسی'],
          ['cash', 'صندوق و بانک', null, 'ورود و خروج پول هر روز در صندوق، بانک و درگاه'],
          ['reports', 'گزارش‌ها', null, 'صورت سود و زیان، ترازنامه و خروجی اکسل'],
          ['books', 'دفاتر حسابداری', null, 'برای حسابدار: روزنامه، دفتر کل، تراز آزمایشی، کدینگ'],
        ]} />
      </div>
      <PeriodBar p={p} setP={setP} right={<XlsxBtn label={`گزارش اکسل ${p.kind === 'day' ? 'روزانه' : p.kind === 'week' ? 'هفتگی' : 'ماهانه'}`} tip="یک فایل کامل از همین بازه: خلاصه، روزانه، سود و زیان، ترازنامه، هزینه‌ها، فروش و رزروها" onClick={() => exportReport(ctx)} />} />
      <S {...ctx} />
    </div>
  )
}

// ---------- خلاصه: سود هر بخش ----------
function Summary({ V, p, setP, club }) {
  const seg = segments(V, p)
  const end = anchor(p)
  const cash = ['1101', '1102', '1103'].reduce((s, c) => s + balanceOf(V, c, end), 0)
  const owedToUs = Math.max(0, balanceOf(V, '1201', end))
  const weOwe = ['3101', '3201', '3202'].reduce((s, c) => s + balanceOf(V, c, end), 0)
  const daily = dailyPL(V, p)
  const days = daysOf(p).filter((k) => ord(k) <= ord(todayKey()))
  const maxRev = Math.max(1, ...seg.units.map((u) => u.revenue))
  // حقوق ماه جاری تا آخر ماه ثبت نمی‌شود؛ برای اینکه سود گول‌زننده نباشد تخمینش نشان داده می‌شود
  const mk = jMonthKey(todayKey())
  const unposted = p.kind === 'month' && jMonthKey(p.to) === mk && !club.payrolls.some((x) => x.month === mk)
    ? payroll(club, mk).reduce((s, r) => s + r.gross + (r.er || 0), 0) : 0
  return (
    <div className="stack">
      <Guide>درآمد هر بخش منهای هزینه‌ی مستقیم همان بخش، سود آن بخش است؛ بعد هزینه‌های عمومی باشگاه کم می‌شود و سود خالص می‌ماند. باشگاه معاف از مالیات فرض شده است.</Guide>
      <div className="kpis four">
        <Kpi icon="cash" label="درآمد" value={mil(seg.R)} tip="همه‌ی فروش‌های این بازه: زمین، کلاس، پکیج، فروشگاه، کافه و…" />
        <Kpi icon="box" label="هزینه‌ها" value={mil(seg.D + seg.O)} sub={`مستقیم ${short(seg.D)}، عمومی ${short(seg.O)}`} tip="هزینه‌ی مستقیم: خرید کالا، مواد کافه، سهم مربی. عمومی: حقوق، اجاره، قبض…" />
        <Kpi icon="chart" label="سود خالص" tone={seg.net < 0 ? 'warn' : 'good'} value={mil(seg.net)} sub={seg.R ? `${fa(Math.round((seg.net / seg.R) * 100))}٪ از درآمد` : null} tip="درآمد منهای همه‌ی هزینه‌ها" />
        <Kpi icon="wallet" label="نقد و بانک" value={mil(cash)} sub={`طلب ${short(owedToUs)}، بدهی ${short(weOwe)}`} tip="پول موجود در صندوق، حساب بانکی و درگاه در پایان بازه" />
      </div>
      <div className="two wide-first">
        <Card title="سود هر بخش" sub={p.label} tip="کدام بخش باشگاه پول درمی‌آورد">
          <div className="seg-pl">
            <div className="sp-h"><span>بخش</span><span>درآمد</span><span>هزینه‌ی مستقیم</span><span>سود بخش</span></div>
            {seg.units.filter((u) => u.revenue || u.direct).map((u) => (
              <div key={u.id} className="sp-row" data-tip={u.tip}>
                <span className="sp-n"><Icon name={u.icon} size={16} />{u.name}</span>
                <span className="sp-rev"><i style={{ width: `${(u.revenue / maxRev) * 100}%` }} /><b>{short(u.revenue)}</b></span>
                <span className="num muted">{u.direct ? short(u.direct) : '—'}</span>
                <span className={`num ${u.profit < 0 ? 'neg' : ''}`}><b>{short(u.profit)}</b>{u.revenue > 0 && u.direct > 0 && <small>{fa(Math.round((u.profit / u.revenue) * 100))}٪</small>}</span>
              </div>
            ))}
            <div className="sp-row tot"><span>سود بخش‌ها</span><span><b>{short(seg.R)}</b></span><span className="num">{short(seg.D)}</span><span className="num"><b>{short(seg.contrib)}</b></span></div>
          </div>
        </Card>
        <Card title="هزینه‌های عمومی" sub="هزینه‌هایی که مال یک بخش خاص نیست" tip="این‌ها از سود بخش‌ها کم می‌شود تا سود خالص بماند">
          <div className="bal-list">
            {seg.over.map((o) => <div key={o.id}><span>{o.name}</span><b>{toman(o.amount)}</b></div>)}
            {!seg.over.length && <Empty>هزینه‌ای در این بازه نیست.</Empty>}
            {unposted > 0 && <div className="pending" data-tip="حقوق آخر ماه در «منابع انسانی ← حقوق» ثبت می‌شود؛ تا آن موقع در سود حساب نشده"><span>حقوق پرسنل و سهم مربی‌های این ماه (هنوز ثبت نشده، تخمینی)<small>سود واقعی حدود {short(seg.net - unposted)} است</small></span><b>{toman(unposted)}</b></div>}
            <div className="tot"><span>جمع هزینه‌های عمومی</span><b>{toman(seg.O)}</b></div>
            <div className={`tot big ${seg.net < 0 ? 'neg' : ''}`}><span>{seg.net < 0 ? 'زیان خالص' : 'سود خالص'}</span><b>{toman(seg.net)}</b></div>
          </div>
        </Card>
      </div>
      <Card title="درآمد و هزینه‌ی هر روز" sub="روی هر ستون بروید؛ با کلیک همان روز باز می‌شود">
        {days.length > 1 ? <RevCost days={days} daily={daily} onPick={(k) => setP(period('day', k))} /> : <DayBreak inc={income(V, p)} />}
      </Card>
    </div>
  )
}

function DayBreak({ inc }) {
  return <div className="stmt">{[...inc.rev.map((r) => [r, 1]), ...inc.cogs.map((r) => [r, -1]), ...inc.exp.map((r) => [r, -1])].map(([r, s]) => <div key={r.code}><span><code>{r.code}</code>{r.name}</span><b className={s < 0 ? 'neg' : ''}>{toman(r.amt)}</b></div>)}
    <div className="tot"><span>سود خالص روز</span><b>{toman(inc.net)}</b></div>{!inc.rev.length && <Empty>در این روز سندی نیست.</Empty>}</div>
}

function RevCost({ days, daily, onPick }) {
  const [hov, setHov] = useState(null)
  const data = days.map((k) => ({ k, ...(daily.get(k) || { rev: 0, cost: 0 }) }))
  const max = Math.max(1, ...data.map((d) => Math.max(d.rev, d.cost)))
  const W = 720, H = 220, pb = 22, pt = 8, bw = W / data.length
  const y = (v) => pt + (H - pt - pb) * (1 - v / max)
  const h = hov != null ? data[hov] : null
  return (
    <div className="chart" onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="درآمد و هزینه‌ی روزانه">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="grid" />
        {data.map((d, i) => {
          const x = i * bw, w = Math.max(2, bw * 0.32)
          return (
            <g key={d.k} opacity={hov == null || hov === i ? 1 : 0.45} onClick={() => onPick(d.k)} style={{ cursor: 'pointer' }}>
              <rect x={x + bw * 0.16} y={y(d.rev)} width={w} height={y(0) - y(d.rev)} rx="2" fill="#0E9F98" />
              <rect x={x + bw * 0.16 + w + 1} y={y(d.cost)} width={w} height={y(0) - y(d.cost)} rx="2" fill="#D0692F" />
              <rect x={x} y="0" width={bw} height={H} fill="transparent" onMouseEnter={() => setHov(i)} />
              {(data.length <= 10 || i % 5 === 0) && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">{jDateFa(d.k).slice(5)}</text>}
            </g>
          )
        })}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${((hov + 0.5) / data.length) * 100}%` }}>
          <b>{dayLabel(h.k)} {jDateFa(h.k)}</b>
          <div><i style={{ background: '#0E9F98' }} /><span>درآمد</span><em>{toman(h.rev)}</em></div>
          <div><i style={{ background: '#D0692F' }} /><span>هزینه</span><em>{toman(h.cost)}</em></div>
          <div className="tip-total"><span>سود</span><em>{toman(h.rev - h.cost)}</em></div>
        </div>
      )}
      <div className="legend"><span><i style={{ background: '#0E9F98' }} />درآمد</span><span><i style={{ background: '#D0692F' }} />هزینه و بهای تمام‌شده</span></div>
    </div>
  )
}

// ---------- هزینه‌ها ----------
function Expenses({ club, p }) {
  const { adminExpense, adminExpenseDel, toast } = useStore()
  const blank = { date: todayKey(), acc: '', amount: 0, pay: 'bank', vendor: '', title: '', invoice: '' }
  const [f, setF] = useState(blank)
  const [cat, setCat] = useState('all')
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const all = club.expenses.filter((e) => inPeriod(e.date, p)).sort((a, b) => ord(b.date) - ord(a.date))
  const list = all.filter((e) => cat === 'all' || e.acc === cat)
  const [rows, more] = usePage(list, 20)
  const ok = f.acc && f.amount > 0 && (f.pay !== 'payable' || f.vendor.trim())
  const save = () => {
    adminExpense({ ...f, title: f.title.trim() || expName(f.acc), vendor: f.vendor.trim() })
    chime('success'); toast({ icon: '🧾', title: 'هزینه ثبت شد', body: `${expName(f.acc)}، ${toman(f.amount)}` }); setF(blank)
  }
  const totalOf = (acc) => all.filter((e) => e.acc === acc).reduce((s, e) => s + e.amount, 0)
  return (
    <div className="two wide-first">
      <Card title="هزینه‌های این بازه" sub={`${fa(list.length)} مورد، جمع ${toman(list.reduce((s, e) => s + e.amount, 0))}`}
        tip="حقوق پرسنل، خرید کالا و مواد کافه اینجا نیستند؛ از بخش خودشان خودکار ثبت می‌شوند">
        <div className="pick-chips">
          <button type="button" className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>همه</button>
          {EXP_CATS.filter(([c]) => totalOf(c)).map(([c, n]) => <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)} data-tip={`جمع ${toman(totalOf(c))}`}>{n}</button>)}
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>تاریخ</th><th>دسته</th><th>شرح</th><th>پرداخت</th><th>مبلغ</th><th /></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}><td className="nowrap">{jDateFa(e.date)}</td><td>{expName(e.acc)}</td><td>{e.title}{e.vendor && <small>{e.vendor}{e.invoice ? `، فاکتور ${e.invoice}` : ''}</small>}</td>
              <td><small>{PAY3[e.pay] || PAY_FROM[e.pay]}</small></td><td className="num">{toman(e.amount)}</td>
              <td><button className="icon-btn" data-tip="حذف این هزینه" onClick={() => confirm('این هزینه حذف شود؟') && adminExpenseDel(e.id)} aria-label="حذف"><Icon name="close" size={14} /></button></td></tr>
          ))}</tbody>
        </table></div>
        {!list.length && <Empty>در این بازه هزینه‌ای ثبت نشده است.</Empty>}
        <More more={more} />
      </Card>
      <Card title="ثبت هزینه‌ی جدید" sub="۱. دسته را انتخاب کنید ۲. مبلغ و پرداخت ۳. ثبت">
        <div className="form">
          <div className="cat-tiles">
            {EXP_CATS.map(([c, n, ic, tip]) => <button key={c} type="button" className={f.acc === c ? 'on' : ''} onClick={() => set({ acc: c })} data-tip={tip}><Icon name={ic} size={18} /><span>{n}</span></button>)}
          </div>
          <div className="form-2">
            <Field label="مبلغ (تومان)"><Money value={f.amount} onChange={(amount) => set({ amount })} placeholder="مثلاً ۲,۵۰۰,۰۰۰" /></Field>
            <Field label="تاریخ"><select value={f.date} onChange={(e) => set({ date: e.target.value })}>{Array.from({ length: 31 }, (_, i) => addDays(todayKey(), -i)).map((k) => <option key={k} value={k}>{dayLabel(k)} {jDateFa(k)}</option>)}</select></Field>
          </div>
          <Field label="از کجا پرداخت شد؟"><Seg value={f.pay} onChange={(pay) => set({ pay })} options={PAY3} tips={PAY3_TIP} /></Field>
          <Field label="شرح (اختیاری)"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={f.acc ? expName(f.acc) : 'مثلاً قبض برق آبان'} /></Field>
          <div className="form-2">
            <Field label={f.pay === 'payable' ? 'طرف حساب (الزامی)' : 'طرف حساب'} tip="فروشنده یا شرکتی که پول را گرفته؛ برای نسیه لازم است"><input list="vendors" value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} /><datalist id="vendors">{club.suppliers.map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="شماره‌ی فاکتور"><input value={f.invoice} dir="ltr" onChange={(e) => set({ invoice: e.target.value })} /></Field>
          </div>
          {f.acc && <p className="muted small" data-tip="سندی که حسابدار در دفاتر می‌بیند">سند خودکار: بدهکار {f.acc} {accByCode(f.acc).name}، بستانکار {f.pay === 'cash' ? '1101 صندوق' : f.pay === 'bank' ? '1102 بانک' : '3101 پرداختنی'}</p>}
          <button className="adm-btn primary full" disabled={!ok} onClick={save}>{ok ? `ثبت هزینه، ${toman(f.amount)}` : !f.acc ? 'اول دسته را انتخاب کنید' : !f.amount ? 'مبلغ را وارد کنید' : 'طرف حساب را بنویسید'}</button>
        </div>
      </Card>
    </div>
  )
}

// ---------- طلب و بدهی ----------
function Debts({ V, p, names }) {
  const { adminApPay, toast } = useStore()
  const end = anchor(p)
  const subs = trial(V, { from: end, to: end }, { bySub: true })
  const bal = (r) => { const a = accByCode(r.acc); return a.debit ? r.odr + r.dr - r.ocr - r.cr : r.ocr + r.cr - r.odr - r.dr }
  const ar = subs.filter((r) => r.acc === '1201' && r.sub && Math.round(bal(r)) > 0).map((r) => ({ id: r.sub, who: names('1201', r.sub), amt: bal(r) })).sort((a, b) => b.amt - a.amt)
  const ap = subs.filter((r) => r.acc === '3101' && r.sub && Math.round(bal(r)) > 0).map((r) => ({ who: r.sub, amt: bal(r) })).sort((a, b) => b.amt - a.amt)
  const salary = balanceOf(V, '3201', end), ins = balanceOf(V, '3202', end), pre = balanceOf(V, '3301', end), adv = balanceOf(V, '1501', end)
  const [pay, setPay] = useState(null)
  const [amt, setAmt] = useState(0)
  const [from, setFrom] = useState('bank')
  const [rows, more] = usePage(ar, 12)
  const doPay = () => {
    adminApPay({ supplier: pay.who, amount: Math.min(amt, Math.round(pay.amt)), pay: from })
    chime('success'); toast({ icon: '🏦', title: 'پرداخت ثبت شد', body: `${pay.who}، ${toman(amt)}` }); setPay(null)
  }
  return (
    <div className="stack">
      <Guide>سمت راست: پول‌هایی که باید به باشگاه برسد. سمت چپ: پول‌هایی که باشگاه باید بپردازد. مانده‌ها تا پایان {jDateFa(end)} است.</Guide>
      <div className="two">
        <Card title="طلب باشگاه" sub={`جمع ${toman(ar.reduce((s, r) => s + r.amt, 0) + Math.max(0, adv))}`} tip="رزروهای بازی‌شده که کامل پرداخت نشده و مساعده‌ی پرسنل">
          <div className="bal-list">
            {rows.map((r) => <div key={r.id}><span>{r.who}<small>بازی انجام شده، تسویه نشده</small></span><b>{toman(r.amt)}</b></div>)}
            {adv > 0 && <div><span>مساعده‌ی پرسنل<small>از حقوق ماه کم می‌شود</small></span><b>{toman(adv)}</b></div>}
            {!ar.length && adv <= 0 && <Empty>طلبی نیست.</Empty>}
          </div>
          <More more={more} />
          {ar.length > 0 && <p className="muted small">برای تسویه از بخش «دریافت‌ها» یا روی رزرو، دکمه‌ی تسویه را بزنید.</p>}
        </Card>
        <Card title="بدهی باشگاه" sub={`جمع ${toman(ap.reduce((s, r) => s + r.amt, 0) + salary + ins)}`} tip="خریدهای نسیه، حقوق و بیمه‌ی پرداخت‌نشده">
          <div className="bal-list">
            {ap.map((r) => <div key={r.who}><span>{r.who}<small>خرید نسیه</small></span><b>{toman(r.amt)}</b><button className="adm-btn ghost sm" data-tip="ثبت پرداخت به این تأمین‌کننده" onClick={() => { setPay(r); setAmt(Math.round(r.amt)) }}>پرداخت</button></div>)}
            {salary > 0 && <div><span>حقوق پرسنل<small>از منابع انسانی ← حقوق پرداخت کنید</small></span><b>{toman(salary)}</b></div>}
            {ins > 0 && <div><span>حق بیمه‌ی تأمین اجتماعی<small>از منابع انسانی ← حقوق پرداخت کنید</small></span><b>{toman(ins)}</b></div>}
            {!ap.length && salary <= 0 && ins <= 0 && <Empty>بدهی‌ای نیست.</Empty>}
          </div>
          {pre > 0 && <p className="muted small" data-tip="این پول گرفته شده ولی چون بازی هنوز انجام نشده، درآمد حساب نمی‌شود">پیش‌دریافت رزروهای آینده: <b>{toman(pre)}</b> (روز بازی به درآمد منتقل می‌شود)</p>}
        </Card>
      </div>
      <Side open={!!pay} onClose={() => setPay(null)} title="پرداخت به تأمین‌کننده">
        {pay && (
          <div className="form">
            <p className="muted small"><b>{pay.who}</b>، بدهی فعلی {toman(pay.amt)}</p>
            <Field label="مبلغ پرداخت"><Money value={amt} onChange={setAmt} /></Field>
            <Field label="از کجا"><Seg value={from} onChange={setFrom} options={{ bank: 'بانک', cash: 'صندوق' }} /></Field>
            <button className="adm-btn primary full" disabled={!amt} onClick={doPay}>ثبت پرداخت، {toman(Math.min(amt, Math.round(pay.amt)))}</button>
          </div>
        )}
      </Side>
    </div>
  )
}

// ---------- صندوق و بانک ----------
const CASH_ACCS = [['1101', 'صندوق پذیرش', 'cash', 'پول نقد داخل صندوق'], ['1102', 'بانک و کارتخوان', 'card', 'حساب جاری و پرداخت با کارتخوان'], ['1103', 'درگاه آنلاین', 'wallet', 'پرداخت‌های اپ و کیف پول']]
function Cash({ V, p }) {
  const [acc, setAcc] = useState('1101')
  const [open, setOpen] = useState(null)
  const book = accountBook(V, acc, p)
  const byDay = []
  book.rows.forEach((r) => {
    let d = byDay[byDay.length - 1]
    if (!d || d.date !== r.date) { d = { date: r.date, in: 0, out: 0, rows: [] }; byDay.push(d) }
    d.in += r.dr; d.out += r.cr; d.rows.push(r); d.bal = r.bal
  })
  const tin = byDay.reduce((s, d) => s + d.in, 0), tout = byDay.reduce((s, d) => s + d.out, 0)
  return (
    <div className="stack">
      <div className="kpis three">
        {CASH_ACCS.map(([c, n, ic, tip]) => <Kpi key={c} icon={ic} label={n} value={toman(balanceOf(V, c, anchor(p)))} tone={acc === c ? 'sel' : ''} onClick={() => setAcc(c)} tip={`${tip}؛ برای دیدن گردش کلیک کنید`} />)}
      </div>
      <Card title={`گردش روزانه‌ی ${CASH_ACCS.find((c) => c[0] === acc)[1]}`} sub={`مانده‌ی اول بازه ${toman(book.open)}، ورودی ${toman(tin)}، خروجی ${toman(tout)}`} tip="برای تطبیق آخر شب صندوق با پول واقعی؛ روی هر روز بزنید تا ریز آن باز شود">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>روز</th><th>ورودی</th><th>خروجی</th><th>مانده‌ی آخر روز</th></tr></thead>
          <tbody>{[...byDay].reverse().map((d) => (
            <Fragment key={d.date}>
              <tr className="click" onClick={() => setOpen(open === d.date ? null : d.date)}><td className="nowrap">{dayLabel(d.date)} {jDateFa(d.date)}</td><td className="num pos">{n0(d.in)}</td><td className="num neg">{n0(d.out)}</td><td className="num"><b>{toman(d.bal)}</b></td></tr>
              {open === d.date && d.rows.map((r, i) => <tr key={i} className="subrow"><td>{r.title}{r.desc && <small>{r.desc}</small>}</td><td className="num">{n0(r.dr)}</td><td className="num">{n0(r.cr)}</td><td /></tr>)}
            </Fragment>
          ))}</tbody>
        </table></div>
        {!byDay.length && <Empty>در این بازه گردشی نیست.</Empty>}
      </Card>
    </div>
  )
}

// ---------- گزارش‌ها ----------
function Reports(ctx) {
  return (
    <div className="stack">
      <Card title="گزارش اکسل این بازه" sub={ctx.p.label}>
        <div className="report-cta">
          <p>یک فایل اکسل با ۹ برگه: خلاصه، درآمد و هزینه‌ی روزانه، سود و زیان، ترازنامه، تراز آزمایشی، دفتر روزنامه، هزینه‌ها، فروش کالا و رزروها. برای گزارش روزانه، هفتگی یا ماهانه، بازه را از نوار بالا عوض کنید.</p>
          <button className="adm-btn primary" onClick={() => exportReport(ctx)}><Icon name="download" size={16} />دانلود گزارش {ctx.p.label}</button>
        </div>
      </Card>
      <Statements {...ctx} />
    </div>
  )
}

// ---------- دفاتر (حسابدار) ----------
function Books(ctx) {
  const [v, setV] = useState('journal')
  const S = { journal: Journal, book: Book, trial: Trial, coa: Chart }[v]
  return (
    <div className="stack">
      <Guide>این بخش برای حسابدار است. همه‌ی اسناد از رزرو، فروشگاه، کافه، هزینه و حقوق خودکار ساخته می‌شوند و نیازی به ثبت دستی نیست.</Guide>
      <Seg value={v} onChange={setV} options={{ journal: 'دفتر روزنامه', book: 'دفتر کل و معین', trial: 'تراز آزمایشی', coa: 'کدینگ حساب‌ها' }}
        tips={{ journal: 'همه‌ی اسناد به ترتیب تاریخ؛ سند دستی هم از اینجا', book: 'گردش و مانده‌ی هر حساب', trial: 'کنترل برابری بدهکار و بستانکار', coa: 'فهرست حساب‌ها و کدهای تفصیلی' }} />
      <S {...ctx} />
    </div>
  )
}

// ---------- دفتر روزنامه ----------
function Journal({ V, p, names }) {
  const { adminJournalDel } = useStore()
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpen] = useState(null)
  const [form, setForm] = useState(false)
  const list = V.filter((v) => inPeriod(v.date, p) && (kind === 'all' || v.kind === kind) && (!q || v.title.includes(q) || String(v.no) === q || v.lines.some((l) => l.acc.startsWith(q)))).reverse()
  const [rows, more] = usePage(list, 25)
  return (
    <Card>
      <div className="filters-bar">
        <Search value={q} onChange={setQ} ph="شرح، شماره سند یا کد حساب" />
        <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">همه‌ی اسناد</option>{Object.entries(KIND_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="grow" />
        <button className="adm-btn primary sm" onClick={() => setForm(true)}><Icon name="plus" size={16} />سند دستی</button>
      </div>
      <p className="count">{fa(list.length)} سند، گردش {toman(list.reduce((s, v) => s + v.dr, 0))}</p>
      <div className="tbl-wrap"><table className="tbl jr">
        <thead><tr><th>شماره</th><th>تاریخ</th><th>نوع</th><th>شرح سند</th><th>بدهکار</th><th>بستانکار</th><th /></tr></thead>
        <tbody>{rows.map((v) => (
          <Fragment key={v.no}>
            <tr className={`click ${openId === v.no ? 'sel' : ''}`} onClick={() => setOpen(openId === v.no ? null : v.no)}>
              <td className="num"><b>{fa(v.no)}</b></td><td className="nowrap">{jDateFa(v.date)}</td><td><span className={`kind k-${v.kind}`}>{KIND_NAME[v.kind]}</span></td>
              <td>{v.title}</td><td className="num">{toman(v.dr)}</td><td className="num">{toman(v.cr)}</td><td><Icon name={openId === v.no ? 'minus' : 'plus'} size={14} /></td>
            </tr>
            {openId === v.no && (
              <tr className="jr-lines"><td colSpan={7}>
                <table className="tbl inner"><thead><tr><th>کد</th><th>حساب</th><th>تفصیلی</th><th>شرح ردیف</th><th>بدهکار</th><th>بستانکار</th></tr></thead>
                  <tbody>{v.lines.map((l, i) => <tr key={i}><td><code>{l.acc}{l.sub && ['1301', '1302'].includes(l.acc) ? '-' + l.sub : ''}</code></td><td>{accByCode(l.acc)?.name}</td><td>{names(l.acc, l.sub)}</td><td>{l.desc}</td><td className="num">{n0(l.dr)}</td><td className="num">{n0(l.cr)}</td></tr>)}</tbody></table>
                {v.kind === 'manual' && <button className="adm-btn danger sm" onClick={() => confirm('سند دستی حذف شود؟') && adminJournalDel(v.ref)}>حذف سند</button>}
              </td></tr>
            )}
          </Fragment>
        ))}</tbody>
      </table></div>
      {!list.length && <Empty>در این بازه سندی نیست.</Empty>}
      <More more={more} />
      <Side open={form} onClose={() => setForm(false)} title="سند حسابداری دستی" wide>{form && <JournalForm onClose={() => setForm(false)} />}</Side>
    </Card>
  )
}

function JournalForm({ onClose }) {
  const { adminJournal, toast } = useStore()
  const L = () => ({ acc: '1101', dr: 0, cr: 0, desc: '' })
  const [f, setF] = useState({ date: todayKey(), title: '', lines: [L(), { ...L(), acc: '5101' }] })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const setLine = (i, x) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...x } : l)) })
  const dr = f.lines.reduce((s, l) => s + l.dr, 0), cr = f.lines.reduce((s, l) => s + l.cr, 0)
  const ok = f.title.trim() && dr > 0 && dr === cr && f.lines.every((l) => !(l.dr && l.cr))
  const save = () => { adminJournal({ date: f.date, title: f.title.trim(), lines: f.lines.filter((l) => l.dr || l.cr) }); chime('success'); toast({ icon: '📒', title: 'سند ثبت شد', body: toman(dr) }); onClose() }
  return (
    <div className="form">
      <div className="form-2">
        <Field label="تاریخ"><select value={f.date} onChange={(e) => set({ date: e.target.value })}>{Array.from({ length: 31 }, (_, i) => addDays(todayKey(), -i)).map((k) => <option key={k} value={k}>{jDateFa(k)}</option>)}</select></Field>
        <Field label="شرح سند"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً آورده‌ی نقدی شریک" /></Field>
      </div>
      <div className="lines">
        {f.lines.map((l, i) => (
          <div key={i} className="line">
            <select value={l.acc} onChange={(e) => setLine(i, { acc: e.target.value })}>{GROUPS.map((g) => <optgroup key={g.id} label={g.name}>{ACCOUNTS.filter((a) => a.g === g.id).map((a) => <option key={a.code} value={a.code}>{a.code}، {a.name}</option>)}</optgroup>)}</select>
            <div className="line-n">
              <label><small>بدهکار</small><Money value={l.dr} onChange={(v) => setLine(i, { dr: v, cr: v ? 0 : l.cr })} /></label>
              <label><small>بستانکار</small><Money value={l.cr} onChange={(v) => setLine(i, { cr: v, dr: v ? 0 : l.dr })} /></label>
              <button type="button" onClick={() => f.lines.length > 2 && set({ lines: f.lines.filter((_, j) => j !== i) })} aria-label="حذف ردیف"><Icon name="close" size={14} /></button>
            </div>
            <input value={l.desc} placeholder="شرح ردیف (اختیاری)" onChange={(e) => setLine(i, { desc: e.target.value })} />
          </div>
        ))}
        <button type="button" className="adm-btn ghost sm" onClick={() => set({ lines: [...f.lines, L()] })}><Icon name="plus" size={14} />ردیف</button>
      </div>
      <div className={`voucher-prev ${dr === cr && dr ? 'ok' : 'bad'}`}>
        <div><span>جمع بدهکار</span><b>{toman(dr)}</b></div>
        <div><span>جمع بستانکار</span><b>{toman(cr)}</b></div>
        <div><span>{dr === cr ? (dr ? 'سند تراز است ✓' : 'مبلغی وارد نشده') : `اختلاف ${toman(Math.abs(dr - cr))}`}</span></div>
      </div>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>ثبت سند</button>
    </div>
  )
}

// ---------- دفتر کل و معین ----------
function Book({ V, p, names }) {
  const used = [...new Set(V.flatMap((v) => v.lines.map((l) => l.acc)))].sort()
  const [acc, setAcc] = useState('1101')
  const [sub, setSub] = useState('*')
  const subs = [...new Set(V.flatMap((v) => v.lines.filter((l) => l.acc === acc && l.sub).map((l) => l.sub)))]
  const book = accountBook(V, acc, p, sub === '*' ? undefined : sub)
  const [rows, more] = usePage(book.rows, 40)
  const a = accByCode(acc)
  const exp = () => downloadXlsx(`quadra-ledger-${acc}-${p.file}`, [{ name: `دفتر ${acc}`, rows: table(`دفتر حساب ${acc} ${a.name}${sub !== '*' ? '، ' + names(acc, sub) : ''} — ${p.label}`, ['شماره سند', 'تاریخ', 'شرح', 'تفصیلی', 'بدهکار', 'بستانکار', 'مانده'], [['', '', 'مانده‌ی ابتدای دوره', '', '', '', book.open], ...book.rows.map((r) => [r.no, jDate(r.date), r.title + (r.desc ? '، ' + r.desc : ''), names(acc, r.sub), r.dr, r.cr, r.bal])], ['', '', 'جمع / مانده‌ی پایان دوره', '', book.rows.reduce((s, r) => s + r.dr, 0), book.rows.reduce((s, r) => s + r.cr, 0), book.close]) }])
  return (
    <Card>
      <div className="filters-bar">
        <select value={acc} onChange={(e) => { setAcc(e.target.value); setSub('*') }}>{GROUPS.map((g) => <optgroup key={g.id} label={g.name}>{ACCOUNTS.filter((x) => x.g === g.id && used.includes(x.code)).map((x) => <option key={x.code} value={x.code}>{x.code}، {x.name}</option>)}</optgroup>)}</select>
        {subs.length > 0 && <select value={sub} onChange={(e) => setSub(e.target.value)}><option value="*">همه‌ی تفصیلی‌ها</option>{subs.map((s) => <option key={s} value={s}>{names(acc, s)}</option>)}</select>}
        <span className="grow" />
        <XlsxBtn onClick={exp} />
      </div>
      <div className="book-sum">
        <div><small>ماهیت</small><b>{a.debit ? 'بدهکار' : 'بستانکار'}</b></div>
        <div><small>مانده‌ی ابتدای دوره</small><b>{toman(book.open)}</b></div>
        <div><small>گردش بدهکار</small><b>{toman(book.rows.reduce((s, r) => s + r.dr, 0))}</b></div>
        <div><small>گردش بستانکار</small><b>{toman(book.rows.reduce((s, r) => s + r.cr, 0))}</b></div>
        <div className="hl"><small>مانده‌ی پایان دوره</small><b>{toman(book.close)}</b></div>
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>سند</th><th>تاریخ</th><th>شرح</th><th>تفصیلی</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td className="num">{fa(r.no)}</td><td className="nowrap">{jDateFa(r.date)}</td><td>{r.title}{r.desc && <small>{r.desc}</small>}</td><td>{names(acc, r.sub)}</td><td className="num">{n0(r.dr)}</td><td className="num">{n0(r.cr)}</td><td className="num"><b>{toman(r.bal)}</b></td></tr>)}</tbody>
      </table></div>
      {!book.rows.length && <Empty>در این بازه گردشی نیست.</Empty>}
      <More more={more} />
    </Card>
  )
}

// ---------- تراز آزمایشی ----------
function Trial({ V, p, names }) {
  const [level, setLevel] = useState('gl')
  const rows = trial(V, p, { bySub: level === 'sub' }).filter((r) => Math.round(r.open) || r.dr || r.cr)
  const T = rows.reduce((s, r) => ({ dr: s.dr + r.dr, cr: s.cr + r.cr, cdr: s.cdr + r.closeDr, ccr: s.ccr + r.closeCr }), { dr: 0, cr: 0, cdr: 0, ccr: 0 })
  const ok = Math.abs(T.dr - T.cr) < 1 && Math.abs(T.cdr - T.ccr) < 1
  return (
    <Card title="تراز آزمایشی ۶ ستونی" sub={p.label} right={<div className="card-tools"><span className={`badge-st ${ok ? 'ok' : 'bad'}`}><i />{ok ? 'تراز است' : 'تراز نیست'}</span><Seg value={level} onChange={setLevel} options={{ gl: 'سطح کل', sub: 'با تفصیلی' }} /></div>}>
      <div className="tbl-wrap"><table className="tbl trial">
        <thead><tr><th>کد</th><th>حساب</th><th>مانده‌ی ابتدای دوره</th><th>گردش بدهکار</th><th>گردش بستانکار</th><th>مانده بدهکار</th><th>مانده بستانکار</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.acc + (r.sub || '')} className={r.sub ? 'subrow' : ''}><td><code>{r.acc}{r.sub && ['1301', '1302'].includes(r.acc) ? '-' + r.sub : ''}</code></td><td>{r.sub ? names(r.acc, r.sub) : r.name}</td><td className="num">{n0(Math.abs(r.open))}{Math.round(r.open) ? <small>{r.open > 0 ? 'بد' : 'بس'}</small> : null}</td><td className="num">{n0(r.dr)}</td><td className="num">{n0(r.cr)}</td><td className="num">{n0(r.closeDr)}</td><td className="num">{n0(r.closeCr)}</td></tr>)}
          <tr className="total"><td /><td>جمع</td><td /><td className="num">{toman(T.dr)}</td><td className="num">{toman(T.cr)}</td><td className="num">{toman(T.cdr)}</td><td className="num">{toman(T.ccr)}</td></tr>
        </tbody>
      </table></div>
    </Card>
  )
}

// ---------- صورت‌های مالی ----------
function Statements({ V, p }) {
  const inc = income(V, p)
  const end = anchor(p)
  const bs = balanceSheet(V, end)
  const Row = ({ r, neg }) => <div><span><code>{r.code}</code>{r.name}</span><b className={neg ? 'neg' : ''}>{neg ? `(${toman(r.amt)})` : toman(r.amt)}</b></div>
  return (
    <div className="two">
      <Card title="صورت سود و زیان" sub={p.label}>
        <div className="stmt">
          <h5>درآمدهای عملیاتی</h5>{inc.rev.map((r) => <Row key={r.code} r={r} />)}
          <div className="sub"><span>جمع درآمد</span><b>{toman(inc.R)}</b></div>
          {inc.cogs.map((r) => <Row key={r.code} r={r} neg />)}
          <div className="sub"><span>سود ناخالص</span><b>{toman(inc.gross)}</b></div>
          <h5>هزینه‌های عملیاتی</h5>{inc.exp.map((r) => <Row key={r.code} r={r} neg />)}
          <div className="sub"><span>جمع هزینه‌ها</span><b>({toman(inc.E)})</b></div>
          <div className={`tot ${inc.net < 0 ? 'loss' : ''}`}><span>{inc.net < 0 ? 'زیان خالص' : 'سود خالص'}</span><b>{toman(Math.abs(inc.net))}</b></div>
          <p className="muted small">بدون مالیات بر درآمد و ارزش افزوده. درآمد رزرو در روز بازی شناسایی می‌شود.</p>
        </div>
      </Card>
      <Card title="ترازنامه" sub={`در پایان ${dayLabel(end)} ${jDateFa(end)}`} right={<span className={`badge-st ${Math.abs(bs.A - bs.L - bs.Q) < 1 ? 'ok' : 'bad'}`}><i />{Math.abs(bs.A - bs.L - bs.Q) < 1 ? 'دارایی = بدهی + حقوق مالکانه' : 'نابرابر'}</span>}>
        <div className="stmt">
          <h5>دارایی‌های جاری</h5>{bs.current.map((r) => <Row key={r.code} r={r} />)}
          <h5>دارایی‌های غیرجاری</h5>{bs.fixed.map((r) => <Row key={r.code} r={r} />)}
          <div className="sub"><span>جمع دارایی‌ها</span><b>{toman(bs.A)}</b></div>
          <h5>بدهی‌های جاری</h5>{bs.liab.map((r) => <Row key={r.code} r={r} />)}
          <div className="sub"><span>جمع بدهی‌ها</span><b>{toman(bs.L)}</b></div>
          <h5>حقوق مالکانه</h5>{bs.equity.map((r) => <Row key={r.code} r={r} />)}
          <div className="tot"><span>جمع بدهی‌ها و حقوق مالکانه</span><b>{toman(bs.L + bs.Q)}</b></div>
        </div>
      </Card>
    </div>
  )
}

// ---------- کدینگ ----------
function Chart({ club, V }) {
  const [q, setQ] = useState('')
  const match = (s) => !q || s.includes(q)
  return (
    <div className="two">
      <Card title="کدینگ حساب‌ها" sub="گروه / کل — مانده تا امروز">
        <Search value={q} onChange={setQ} ph="کد یا نام حساب" />
        <div className="coa">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <h5><code>{g.id}</code>{g.name}</h5>
              {ACCOUNTS.filter((a) => a.g === g.id && match(a.code + a.name)).map((a) => <div key={a.code}><code>{a.code}</code><span>{a.name}</span><small>{a.debit ? 'بد' : 'بس'}</small><b>{n0(balanceOf(V, a.code))}</b></div>)}
            </div>
          ))}
        </div>
      </Card>
      <div className="stack">
        <Card title="حساب‌های تفصیلی کالا" sub="۱۳۰۱-کد کالا؛ هر کالای جدید خودکار کد می‌گیرد">
          <div className="coa scroll">{club.products.filter((p) => match(p.code + p.name)).map((p) => <div key={p.id}><code>1301-{p.code}</code><span>{p.name}</span><small>{catName(p.cat)}</small></div>)}</div>
        </Card>
        <Card title="حساب‌های تفصیلی مواد اولیه‌ی کافه" sub="۱۳۰۲-کد ماده؛ درآمد کافه ۶۱۰۶-کد دسته‌ی منو">
          <div className="coa scroll">
            {CAFE_CATS.map((c) => <div key={c.id}><code>6106-{c.code}</code><span>فروش {c.name}</span><small>درآمد</small></div>)}
            {club.cafeIngs.filter((g) => match(g.code + g.name)).map((g) => <div key={g.id}><code>{ingAcc(g)}</code><span>{g.name}</span><small>{ING_CATS[g.cat][0]}، {UNITS[g.unit].n}</small></div>)}
          </div>
        </Card>
        <Card title="تفصیلی درآمد فروش کالا" sub="۶۱۰۵-کد دسته">
          <div className="coa">{Object.entries(CAT_CODE).map(([k, c]) => <div key={k}><code>6105-{c}</code><span>فروش {catName(k)}</span></div>)}</div>
        </Card>
        <Card title="تفصیلی پرسنل و تأمین‌کنندگان">
          <div className="coa scroll">
            {club.staff.map((s) => <div key={s.id}><code>1501-{s.id}</code><span>{s.name}</span><small>{ROLES[s.role]}</small></div>)}
            {club.suppliers.map((s, i) => <div key={s}><code>3101-{String(i + 1).padStart(3, '0')}</code><span>{s}</span><small>تأمین‌کننده</small></div>)}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ---------- گزارش اکسل کامل یک بازه ----------
function exportReport({ club, V, p, names }) {
  const inc = income(V, p), end = anchor(p), bs = balanceSheet(V, end)
  const trows = trial(V, p).filter((r) => Math.round(r.open) || r.dr || r.cr)
  const daily = dailyPL(V, p)
  const days = daysOf(p).filter((k) => ord(k) <= ord(todayKey()))
  const cash = ['1101', '1102', '1103'].map((c) => [c, accByCode(c).name, balanceOf(V, c, end)])
  const revCols = ['6101', '6102', '6103', '6104', '6105', '6106', '6201']
  const orders = club.orders.filter((o) => inPeriod(`${new Date(o.at).getFullYear()}-${new Date(o.at).getMonth() + 1}-${new Date(o.at).getDate()}`, p))
  const prod = {}
  orders.forEach((o) => o.items.forEach((x) => { const r = (prod[x.sku || x.pid] ||= { x, qty: 0, rev: 0, cogs: 0 }); r.qty += x.qty; r.rev += x.qty * x.price; r.cogs += x.qty * (x.cost || 0) }))
  const bookings = club.bookings.filter((b) => b.type !== 'block' && inPeriod(b.date, p)).sort((a, b) => ord(a.date) - ord(b.date) || a.start - b.start)
  const head = (t) => [[{ v: `باشگاه پدل کوادرا — ${t}`, s: 't' }], [`بازه: ${p.label} (${jDate(p.from)} تا ${jDate(p.to)})`], [`تاریخ تهیه: ${jDate(todayKey())}`], []]
  downloadXlsx(`quadra-report-${p.file}`, [
    { name: 'خلاصه', rows: [...head('گزارش مالی'),
      [{ v: 'شرح', s: 'h' }, { v: 'مبلغ (تومان)', s: 'h' }],
      ...inc.rev.map((r) => [r.name, r.amt]), [{ v: 'جمع درآمد', s: 'b' }, { v: inc.R, s: 'b' }],
      ...inc.cogs.map((r) => [r.name, -r.amt]), [{ v: 'سود ناخالص', s: 'b' }, { v: inc.gross, s: 'b' }],
      ...inc.exp.map((r) => [r.name, -r.amt]), [{ v: 'جمع هزینه‌ها', s: 'b' }, { v: -inc.E, s: 'b' }],
      [{ v: inc.net < 0 ? 'زیان خالص' : 'سود خالص', s: 'b' }, { v: inc.net, s: 'b' }], [],
      [{ v: 'موجودی نقد و بانک در پایان دوره', s: 'h' }, { v: '', s: 'h' }], ...cash.map(([c, n, v]) => [`${c} ${n}`, v]),
      [{ v: 'جمع', s: 'b' }, { v: cash.reduce((s, c) => s + c[2], 0), s: 'b' }], [],
      ['تعداد رزروهای دوره', bookings.filter((b) => b.status !== 'cancelled').length], ['تعداد سفارش فروشگاه', orders.length], ['تعداد سفارش کافه', club.cafeOrders.filter((o) => inPeriod(`${new Date(o.at).getFullYear()}-${new Date(o.at).getMonth() + 1}-${new Date(o.at).getDate()}`, p)).length], ['تعداد اسناد حسابداری', V.filter((v) => inPeriod(v.date, p)).length]] },
    { name: 'درآمد و هزینه روزانه', rows: table(null, ['تاریخ', 'روز', ...revCols.map((c) => accByCode(c).name), 'جمع درآمد', 'بهای تمام‌شده و هزینه', 'سود / زیان'],
      days.map((k) => { const d = daily.get(k) || { rev: 0, cost: 0, byAcc: {} }; return [jDate(k), dayLabel(k), ...revCols.map((c) => d.byAcc[c] || 0), d.rev, d.cost, d.rev - d.cost] }),
      ['جمع', '', ...revCols.map((c) => days.reduce((s, k) => s + (daily.get(k)?.byAcc[c] || 0), 0)), inc.R, inc.C + inc.E, inc.net]) },
    { name: 'سود و زیان', rows: [...head('صورت سود و زیان'), [{ v: 'کد', s: 'h' }, { v: 'شرح', s: 'h' }, { v: 'مبلغ', s: 'h' }],
      ...inc.rev.map((r) => [r.code, r.name, r.amt]), ['', { v: 'جمع درآمدهای عملیاتی', s: 'b' }, { v: inc.R, s: 'b' }],
      ...inc.cogs.map((r) => [r.code, r.name, -r.amt]), ['', { v: 'سود ناخالص', s: 'b' }, { v: inc.gross, s: 'b' }],
      ...inc.exp.map((r) => [r.code, r.name, -r.amt]), ['', { v: 'جمع هزینه‌های عملیاتی', s: 'b' }, { v: -inc.E, s: 'b' }],
      ['', { v: 'سود (زیان) خالص', s: 'b' }, { v: inc.net, s: 'b' }]] },
    { name: 'ترازنامه', rows: [...head(`ترازنامه در پایان ${jDate(end)}`), [{ v: 'کد', s: 'h' }, { v: 'شرح', s: 'h' }, { v: 'مبلغ', s: 'h' }],
      ...bs.assets.map((r) => [r.code, r.name, r.amt]), ['', { v: 'جمع دارایی‌ها', s: 'b' }, { v: bs.A, s: 'b' }], [],
      ...bs.liab.map((r) => [r.code, r.name, r.amt]), ['', { v: 'جمع بدهی‌ها', s: 'b' }, { v: bs.L, s: 'b' }],
      ...bs.equity.map((r) => [r.code, r.name, r.amt]), ['', { v: 'جمع بدهی‌ها و حقوق مالکانه', s: 'b' }, { v: bs.L + bs.Q, s: 'b' }]] },
    { name: 'تراز آزمایشی', rows: table(`تراز آزمایشی — ${p.label}`, ['کد', 'حساب', 'مانده‌ی ابتدای دوره', 'گردش بدهکار', 'گردش بستانکار', 'مانده بدهکار', 'مانده بستانکار'],
      trows.map((r) => [r.acc, r.name, r.open, r.dr, r.cr, r.closeDr, r.closeCr]), ['', 'جمع', null, trows.reduce((s, r) => s + r.dr, 0), trows.reduce((s, r) => s + r.cr, 0), trows.reduce((s, r) => s + r.closeDr, 0), trows.reduce((s, r) => s + r.closeCr, 0)]) },
    { name: 'دفتر روزنامه', rows: table(`دفتر روزنامه — ${p.label}`, ['شماره سند', 'تاریخ', 'نوع', 'شرح سند', 'کد حساب', 'نام حساب', 'تفصیلی', 'شرح ردیف', 'بدهکار', 'بستانکار'],
      V.filter((v) => inPeriod(v.date, p)).flatMap((v) => v.lines.map((l) => [v.no, jDate(v.date), KIND_NAME[v.kind], v.title, l.acc + (l.sub && ['1301', '1302'].includes(l.acc) ? '-' + l.sub : ''), accByCode(l.acc)?.name, names(l.acc, l.sub), l.desc || '', l.dr, l.cr]))) },
    { name: 'هزینه‌ها', rows: table(null, ['تاریخ', 'کد حساب', 'حساب', 'شرح', 'طرف حساب', 'فاکتور', 'پرداخت از', 'مبلغ'],
      club.expenses.filter((e) => inPeriod(e.date, p)).sort((a, b) => ord(a.date) - ord(b.date)).map((e) => [jDate(e.date), e.acc, accByCode(e.acc)?.name, e.title, e.vendor, e.invoice || '', PAY_FROM[e.pay], e.amount]),
      ['جمع', '', '', '', '', '', '', club.expenses.filter((e) => inPeriod(e.date, p)).reduce((s, e) => s + e.amount, 0)]) },
    { name: 'فروش کالا', rows: table(null, ['SKU', 'کالا', 'سایز', 'رنگ', 'تعداد', 'فروش', 'بهای تمام‌شده', 'سود ناخالص'],
      Object.values(prod).sort((a, b) => b.rev - a.rev).map((r) => [r.x.sku || '', club.products.find((q) => q.id === r.x.pid)?.name, r.x.size || '', r.x.color || '', r.qty, r.rev, r.cogs, r.rev - r.cogs])) },
    { name: 'رزروها', rows: table(null, ['تاریخ', 'ساعت', 'زمین', 'نوع', 'مشتری', 'مبلغ', 'دریافتی', 'وضعیت'],
      bookings.map((b) => [jDate(b.date), range(b.start, b.dur), COURTS.find((c) => c.id === b.court).name, TYPE_NAME[b.type], who(b.by), b.price, b.paid, STATUS[payState(b)].name])) },
  ])
}
