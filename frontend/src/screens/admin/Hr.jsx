// منابع انسانی: پرونده‌ی پرسنل، شیفت هفتگی، حضور و غیاب، مرخصی، مساعده و حقوق و دستمزد
import { useMemo, useState } from 'react'
import { COACHES, addDays, dayLabel, fa, toman, todayKey } from '../../data'
import { PAY_FROM } from '../../accounting'
import {
  CONTRACTS, DOCS, HR_CFG, LEAVE_KIND, ROLES, SHIFTS, SHIFT_CYCLE, WEEK, attStats, contractAlert, dayStatus, fromHHMM, hhmm,
  leaveBalance, leaveDays, payroll, seniority, shiftOn,
} from '../../hr'
import { jDate, jDateFa, jMonthDays, jMonthKey, jMonthLabel, ord, recentMonths } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon } from '../../components/ui'
import { Badge, Card, Empty, Field, Kpi, Money, Search, Seg, Side, Tabs, XlsxBtn } from './kit'

const TONE = { ok: 'ok', in: 'ok', late: 'warn', absent: 'bad', leave: 'mute', off: 'mute', wait: 'mute' }
const ROLE_C = { manager: '#141413', reception: '#0E9F98', shop: '#B44C9A', service: '#3DA57E', security: '#24344F', tech: '#E07B39', accountant: '#5B6CF0', coach: '#C9A227' }
const iso = (k) => { const [y, m, d] = k.split('-'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
const unIso = (s) => s.split('-').map(Number).join('-')
const Av = ({ s, size = '' }) => <span className={`hr-av ${size}`} style={{ '--c': ROLE_C[s.role] }}>{s.name[0]}</span>
const hmL = (h) => hhmm(h).replace(/[۰-۹]/g, (x) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x))
const nowH = () => { const n = new Date(); return Math.round((n.getHours() + n.getMinutes() / 60) * 60) / 60 }
const DateSel = ({ value, onChange, back = 30, ahead = 30 }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>{Array.from({ length: back + ahead + 1 }, (_, i) => addDays(todayKey(), ahead - i)).map((k) => <option key={k} value={k}>{dayLabel(k)} {jDateFa(k)}</option>)}</select>
)

export function Hr() {
  const { club } = useStore()
  const [tab, setTab] = useState('staff')
  const pending = club.leaves.filter((l) => l.status === 'pending').length
  const S = { staff: Staff, shifts: Shifts, att: Attendance, leave: Leaves, pay: Payroll, adv: Advances }[tab]
  return (
    <div className="stack">
      <div className="sec-bar"><Tabs value={tab} onChange={setTab} tabs={[['staff', 'پرسنل', null, 'پرونده‌ی هر نفر: مشخصات، قرارداد، مدارک'], ['shifts', 'شیفت‌ها', null, 'برنامه‌ی هفتگی شیفت هر نفر؛ روی خانه‌ها بزنید تا عوض شود'], ['att', 'حضور و غیاب', null, 'ثبت ورود و خروج، تأخیر و اضافه‌کار'], ['leave', 'مرخصی', pending, 'درخواست‌ها و مانده‌ی مرخصی هر نفر'], ['pay', 'حقوق و دستمزد', null, 'محاسبه‌ی حقوق ماه، فیش و پرداخت'], ['adv', 'مساعده', null, 'پیش‌پرداخت حقوق؛ آخر ماه از حقوق کم می‌شود']]} /></div>
      <S />
    </div>
  )
}

// ---------- پرسنل ----------
function Staff() {
  const { club } = useStore()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [sel, setSel] = useState(null) // شناسه یا 'new'
  const today = todayKey()
  const active = club.staff.filter((s) => s.status !== 'ended')
  const list = club.staff.filter((s) => (role === 'all' || s.role === role) && (!q || s.name.includes(q) || s.phone?.includes(q)))
  const st = active.map((s) => dayStatus(club, s, today))
  const last = club.payrolls[0]
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi icon="users" label="پرسنل فعال" value={fa(active.length)} sub={`${fa(active.filter((s) => s.type === 'commission').length)} مربی قراردادی`} />
        <Kpi icon="check" label="در محل کار الان" value={fa(st.filter((x) => x.code === 'in').length)} sub={`${fa(st.filter((x) => ['in', 'ok', 'late'].includes(x.code)).length)} نفر امروز آمده‌اند`} />
        <Kpi icon="clock" label="تأخیر / غیبت امروز" tone={st.some((x) => x.code === 'absent') ? 'warn' : ''} value={`${fa(st.filter((x) => x.code === 'late' || (x.code === 'in' && x.late)).length)} / ${fa(st.filter((x) => x.code === 'absent').length)}`} />
        <Kpi icon="sun" label="مرخصی امروز / در انتظار" value={`${fa(st.filter((x) => x.code === 'leave').length)} / ${fa(club.leaves.filter((l) => l.status === 'pending').length)}`} />
        <Kpi icon="shield" label="قرارداد رو به پایان" tone={active.some(contractAlert) ? 'warn' : ''} value={fa(active.filter(contractAlert).length)} />
        <Kpi icon="cash" label={last ? `هزینه‌ی حقوق ${last.label}` : 'هزینه‌ی حقوق'} value={last ? toman(last.rows.reduce((s, r) => s + r.gross + r.er, 0)) : '—'} sub="ناخالص + بیمه‌ی کارفرما" />
      </div>
      <Card>
        <div className="filters-bar">
          <Search value={q} onChange={setQ} ph="نام یا موبایل" />
          <select value={role} onChange={(e) => setRole(e.target.value)}><option value="all">همه‌ی سمت‌ها</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <span className="grow" />
          <button className="adm-btn primary sm" onClick={() => setSel('new')} data-tip="افزودن کارمند یا مربی تازه"><Icon name="plus" size={16} />پرسنل جدید</button>
        </div>
        <div className="staff-grid">
          {list.map((s) => {
            const d = dayStatus(club, s, today), sh = shiftOn(club, s.id, today), alert = contractAlert(s)
            const missing = Object.keys(DOCS).filter((k) => !s.docs?.[k] && !(k === 'insurance' && s.type === 'commission')).length
            return (
              <button key={s.id} className={`staff-card ${s.status === 'ended' ? 'dim' : ''}`} onClick={() => setSel(s.id)}>
                <div className="sc-h"><Av s={s} /><div className="grow"><b>{s.name}</b><small>{ROLES[s.role]}، {CONTRACTS[s.type]}</small></div><Badge tone={TONE[d.code]}>{d.name}</Badge></div>
                <div className="sc-rows">
                  <span><Icon name="clock" size={14} />{sh === 'off' ? 'امروز شیفت ندارد' : `شیفت ${SHIFTS[sh].name} ${hhmm(SHIFTS[sh].from)}–${hhmm(SHIFTS[sh].to)}`}</span>
                  <span><Icon name="cal" size={14} />سابقه {seniority(s)}</span>
                  {d.rec?.in != null && <span><Icon name="check" size={14} />ورود {hhmm(d.rec.in)}{d.rec.out != null ? `، خروج ${hhmm(d.rec.out)}` : ''}</span>}
                </div>
                {(alert || missing > 0) && <div className="sc-alerts">{alert && <em className="w">{alert}</em>}{missing > 0 && <em>{fa(missing)} مدرک ناقص</em>}</div>}
              </button>
            )
          })}
        </div>
      </Card>
      <Side open={!!sel} onClose={() => setSel(null)} title={sel === 'new' ? 'پرسنل جدید' : null} wide>
        {sel === 'new' ? <StaffForm onDone={(id) => setSel(id)} /> : sel && <Profile key={sel} id={sel} />}
      </Side>
    </div>
  )
}

function Profile({ id }) {
  const { club } = useStore()
  const [edit, setEdit] = useState(false)
  const s = club.staff.find((x) => x.id === id)
  if (!s) return null
  if (edit) return <StaffForm s={s} onDone={() => setEdit(false)} />
  const mk = jMonthKey(todayKey()), att = attStats(club, s, jMonthDays(mk)), lb = leaveBalance(club, s)
  const slips = club.payrolls.map((p) => ({ p, r: p.rows.find((r) => r.staff === s.id) })).filter((x) => x.r)
  const adv = club.advances.filter((a) => a.staff === s.id)
  return (
    <div className="hr-prof">
      <div className="hp-head"><Av s={s} size="lg" /><div><h2>{s.name}</h2><small>{ROLES[s.role]}، {CONTRACTS[s.type]}، سابقه {seniority(s)}</small></div>
        <button className="adm-btn ghost sm" onClick={() => setEdit(true)}><Icon name="cog" size={15} />ویرایش</button></div>
      {contractAlert(s) && <p className="cancelled">{contractAlert(s)}</p>}
      <h4>این ماه ({jMonthLabel(mk)})</h4>
      <div className="hp-stats">
        <div><b>{fa(att.present)}</b><small>روز حضور</small></div><div><b>{fa(att.hours)}</b><small>ساعت کار</small></div>
        <div><b>{fa(att.ot)}</b><small>ساعت اضافه‌کار</small></div><div><b>{fa(att.late)}</b><small>دقیقه تأخیر</small></div>
        <div><b>{fa(att.absent)}</b><small>غیبت</small></div><div><b>{fa(lb.left)}</b><small>مانده‌ی مرخصی از {fa(lb.total)}</small></div>
      </div>
      <h4>قرارداد و حقوق</h4>
      <div className="dr-rows">
        <div><span>نوع قرارداد</span><b>{CONTRACTS[s.type]}</b></div>
        {s.type === 'commission' ? <div><span>سهم مربی از درآمد کلاس</span><b>{fa(Math.round((s.share || 0.6) * 100))}٪</b></div>
          : s.type === 'hourly' ? <div><span>نرخ ساعتی</span><b>{toman(s.rate)}</b></div> : <div><span>حقوق پایه‌ی ماهانه</span><b>{toman(s.base)}</b></div>}
        {s.type === 'full' && <div><span>تعداد فرزند (حق اولاد)</span><b>{fa(s.children || 0)}</b></div>}
        <div><span>شروع همکاری</span><b>{jDateFa(s.start)}</b></div>
        {s.contractEnd && <div><span>پایان قرارداد</span><b>{jDateFa(s.contractEnd)}</b></div>}
      </div>
      <h4>اطلاعات هویتی و بانکی</h4>
      <div className="dr-rows">
        <div><span>کد ملی</span><b dir="ltr">{s.nationalId}</b></div><div><span>موبایل</span><b dir="ltr">{s.phone}</b></div>
        {s.insuranceNo && <div><span>شماره‌ی بیمه</span><b dir="ltr">{s.insuranceNo}</b></div>}
        <div><span>شبا</span><b dir="ltr" className="code">{s.iban}</b></div>
        {s.edu && <div><span>تحصیلات</span><b>{s.edu}</b></div>}
        {s.emergency?.phone && <div><span>تماس اضطراری</span><b>{s.emergency.name}، <span dir="ltr">{s.emergency.phone}</span></b></div>}
      </div>
      <h4>مدارک</h4>
      <div className="docs">{Object.entries(DOCS).map(([k, v]) => <span key={k} className={s.docs?.[k] ? 'ok' : ''}><Icon name={s.docs?.[k] ? 'check' : 'close'} size={14} />{v}</span>)}</div>
      {slips.length > 0 && (<><h4>فیش‌های حقوقی</h4>{slips.map(({ p, r }) => <Payslip key={p.id} p={p} r={r} />)}</>)}
      {adv.length > 0 && (<><h4>مساعده‌ها</h4><div className="dr-rows">{adv.map((a) => <div key={a.id}><span>{jDateFa(a.date)}{a.note ? `، ${a.note}` : ''}</span><b>{toman(a.amount)}</b></div>)}</div></>)}
    </div>
  )
}

function StaffForm({ s, onDone }) {
  const { adminStaff, toast } = useStore()
  const [f, setF] = useState(() => s ? { ...s, emergency: s.emergency || {}, docs: s.docs || {} } : { name: '', role: 'reception', type: 'full', base: 14000000, rate: 0, share: 0.6, children: 0, phone: '', nationalId: '', insuranceNo: '', iban: 'IR', edu: '', emergency: {}, start: todayKey(), contractEnd: addDays(todayKey(), 365), docs: {}, status: 'active' })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const ok = f.name.trim() && /^\d{10}$/.test(f.nationalId) && /^09\d{9}$/.test(f.phone)
  const save = () => { const id = adminStaff({ ...f, name: f.name.trim() }); chime('success'); toast({ icon: '👤', title: s ? 'پرونده به‌روز شد' : 'پرسنل اضافه شد', body: f.name }); onDone(id) }
  return (
    <div className="form">
      {s && <h2 className="dr-h">ویرایش {s.name}</h2>}
      <div className="form-2">
        <Field label="نام و نام خانوادگی"><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="سمت"><select value={f.role} onChange={(e) => set({ role: e.target.value, ...(e.target.value === 'coach' ? { type: 'commission' } : {}) })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="form-2">
        <Field label="نوع قرارداد"><select value={f.type} onChange={(e) => set({ type: e.target.value })}>{Object.entries(CONTRACTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {f.type === 'commission' ? <Field label="سهم از درآمد کلاس (٪)"><input type="number" min="0" max="100" value={Math.round(f.share * 100)} onChange={(e) => set({ share: +e.target.value / 100 })} /></Field>
          : f.type === 'hourly' ? <Field label="نرخ ساعتی (تومان)"><Money value={f.rate} onChange={(rate) => set({ rate })} /></Field>
          : <Field label="حقوق پایه‌ی ماهانه (تومان)"><Money value={f.base} onChange={(base) => set({ base })} /></Field>}
      </div>
      {f.type === 'commission' && <Field label="مربی مرتبط در اپ"><select value={f.coach || ''} onChange={(e) => set({ coach: e.target.value })}><option value="">—</option>{COACHES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      <div className="form-3">
        <Field label="موبایل"><input dir="ltr" value={f.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="09…" /></Field>
        <Field label="کد ملی"><input dir="ltr" value={f.nationalId} onChange={(e) => set({ nationalId: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field>
        <Field label="تعداد فرزند"><input type="number" min="0" value={f.children} onChange={(e) => set({ children: +e.target.value })} /></Field>
      </div>
      <div className="form-2">
        <Field label="شماره‌ی بیمه"><input dir="ltr" value={f.insuranceNo || ''} onChange={(e) => set({ insuranceNo: e.target.value })} /></Field>
        <Field label="شبا"><input dir="ltr" value={f.iban} onChange={(e) => set({ iban: e.target.value.toUpperCase() })} /></Field>
      </div>
      <div className="form-2">
        <Field label="شروع همکاری"><input type="date" value={iso(f.start)} onChange={(e) => e.target.value && set({ start: unIso(e.target.value) })} /></Field>
        <Field label="پایان قرارداد"><input type="date" value={f.contractEnd ? iso(f.contractEnd) : ''} onChange={(e) => set({ contractEnd: e.target.value ? unIso(e.target.value) : null })} /></Field>
      </div>
      <Field label="تحصیلات"><input value={f.edu || ''} onChange={(e) => set({ edu: e.target.value })} /></Field>
      <div className="form-2">
        <Field label="تماس اضطراری، نسبت"><input value={f.emergency.name || ''} onChange={(e) => set({ emergency: { ...f.emergency, name: e.target.value } })} /></Field>
        <Field label="تماس اضطراری، شماره"><input dir="ltr" value={f.emergency.phone || ''} onChange={(e) => set({ emergency: { ...f.emergency, phone: e.target.value } })} /></Field>
      </div>
      <Field label="مدارک تحویل‌شده"><div className="pick-chips">{Object.entries(DOCS).map(([k, v]) => <button key={k} type="button" className={f.docs[k] ? 'on' : ''} onClick={() => set({ docs: { ...f.docs, [k]: !f.docs[k] } })}>{f.docs[k] && '✓ '}{v}</button>)}</div></Field>
      {s && <Field label="وضعیت همکاری"><Seg value={f.status} onChange={(status) => set({ status })} options={{ active: 'فعال', leave: 'مرخصی طولانی', ended: 'پایان همکاری' }} /></Field>}
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{s ? 'ذخیره' : 'افزودن به پرسنل'}</button>
      {!ok && <p className="muted small">نام، موبایل ۱۱ رقمی و کد ملی ۱۰ رقمی لازم است.</p>}
    </div>
  )
}

// ---------- شیفت‌ها ----------
function Shifts() {
  const { club, adminShift } = useStore()
  const staff = club.staff.filter((s) => s.status === 'active' && s.type !== 'commission')
  const today = (new Date().getDay() + 1) % 7
  const cover = (d, code, role) => staff.filter((s) => club.shifts[s.id]?.[d] === code && (!role || s.role === role)).length
  return (
    <Card title="برنامه‌ی شیفت هفتگی" sub="روی هر خانه بزنید تا شیفت عوض شود: صبح ← عصر ← اداری ← شب ← تعطیل">
      <div className="tbl-wrap"><table className="tbl shifts">
        <thead><tr><th>پرسنل</th>{WEEK.map((w, i) => <th key={w} className={i === today ? 'today' : ''}>{w}</th>)}<th>ساعت در هفته</th></tr></thead>
        <tbody>
          {staff.map((s) => {
            const row = club.shifts[s.id] || []
            const hrs = row.reduce((a, c) => a + (c === 'off' ? 0 : SHIFTS[c].to - SHIFTS[c].from), 0)
            return (
              <tr key={s.id}>
                <td><div className="prod-cell"><Av s={s} size="sm" /><div><b>{s.name}</b><small>{ROLES[s.role]}</small></div></div></td>
                {WEEK.map((_, d) => {
                  const c = row[d] || 'off'
                  return <td key={d} className={d === today ? 'today' : ''}><button className={`shift s-${c}`} onClick={() => { adminShift(s.id, d, SHIFT_CYCLE[(SHIFT_CYCLE.indexOf(c) + 1) % SHIFT_CYCLE.length]); chime('tap') }}>
                    <b>{SHIFTS[c].short}</b>{c !== 'off' && <small>{fa(SHIFTS[c].from)}–{fa(SHIFTS[c].to)}</small>}</button></td>
                })}
                <td className={`num ${hrs > 44 ? 'neg' : ''}`}>{fa(hrs)}</td>
              </tr>
            )
          })}
          <tr className="total"><td>پوشش پذیرش (صبح / عصر)</td>{WEEK.map((_, d) => {
            const m = cover(d, 'm', 'reception'), e = cover(d, 'e', 'reception')
            return <td key={d} className={!m || !e ? 'neg' : ''}>{fa(m)} / {fa(e)}</td>
          })}<td /></tr>
        </tbody>
      </table></div>
      <p className="muted small">سقف ساعت کار عادی طبق قانون کار ۴۴ ساعت در هفته است؛ بیشتر از آن اضافه‌کار با ضریب {fa(HR_CFG.otRate)} حساب می‌شود.</p>
    </Card>
  )
}

// ---------- حضور و غیاب ----------
function Attendance() {
  const { club, adminAttend, toast } = useStore()
  const [mode, setMode] = useState('day')
  const [date, setDate] = useState(todayKey())
  const [mk, setMk] = useState(jMonthKey(todayKey()))
  const staff = club.staff.filter((s) => s.status !== 'ended' && s.type !== 'commission')
  const isToday = date === todayKey()
  const days = useMemo(() => jMonthDays(mk), [mk])
  const exp = () => downloadXlsx(`quadra-attendance-${mk}`, [{
    name: 'خلاصه‌ی حضور', rows: table(`حضور و غیاب ${jMonthLabel(mk)}`, ['پرسنل', 'سمت', 'روز حضور', 'غیبت', 'مرخصی', 'ساعت کار', 'اضافه‌کار', 'تأخیر (دقیقه)'],
      staff.map((s) => { const a = attStats(club, s, days); return [s.name, ROLES[s.role], a.present, a.absent, a.leave, a.hours, a.ot, a.late] })),
  }, {
    name: 'جزئیات روزانه', rows: table(null, ['تاریخ', 'پرسنل', 'شیفت', 'ورود', 'خروج', 'ساعت', 'وضعیت'],
      days.filter((k) => ord(k) <= ord(todayKey())).flatMap((k) => staff.map((s) => { const d = dayStatus(club, s, k); return [jDate(k), s.name, SHIFTS[d.sh].name, d.rec?.in != null ? hhmm(d.rec.in) : '', d.rec?.out != null ? hhmm(d.rec.out) : '', d.rec?.out != null ? Math.round((d.rec.out - d.rec.in) * 10) / 10 : '', d.name] }))),
  }])
  return (
    <Card>
      <div className="filters-bar">
        <Seg value={mode} onChange={setMode} options={{ day: 'روزانه', month: 'خلاصه‌ی ماه' }} />
        {mode === 'day' ? (
          <div className="period-nav">
            <button className="adm-btn ghost sm" onClick={() => setDate(addDays(date, -1))} aria-label="روز قبل" data-tip="روز قبل"><Icon name="back" size={16} /></button>
            <b>{dayLabel(date)} {jDateFa(date)}</b>
            <button className="adm-btn ghost sm" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="روز بعد"><Icon name="fwd" size={16} /></button>
          </div>
        ) : <select value={mk} onChange={(e) => setMk(e.target.value)}>{recentMonths(4).map((m) => <option key={m} value={m}>{jMonthLabel(m)}</option>)}</select>}
        <span className="grow" />
        <XlsxBtn onClick={exp} label="اکسل حضور ماه" />
      </div>
      {mode === 'day' ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>پرسنل</th><th>شیفت</th><th>ورود</th><th>خروج</th><th>کارکرد</th><th>وضعیت</th><th /></tr></thead>
          <tbody>{staff.map((s) => {
            const d = dayStatus(club, s, date), r = d.rec
            return (
              <tr key={s.id}>
                <td><div className="prod-cell"><Av s={s} size="sm" /><div><b>{s.name}</b><small>{ROLES[s.role]}</small></div></div></td>
                <td>{d.sh === 'off' ? '—' : `${SHIFTS[d.sh].name} ${fa(SHIFTS[d.sh].from)}–${fa(SHIFTS[d.sh].to)}`}</td>
                <td><input type="time" className="time" value={r?.in != null ? hmL(r.in) : ''} onChange={(e) => adminAttend(date, s.id, { in: e.target.value ? fromHHMM(e.target.value) : null })} /></td>
                <td><input type="time" className="time" disabled={r?.in == null} value={r?.out != null ? hmL(r.out) : ''} onChange={(e) => adminAttend(date, s.id, { out: e.target.value ? fromHHMM(e.target.value) : null })} /></td>
                <td className="num">{r?.out != null ? `${fa(Math.round((r.out - r.in) * 10) / 10)} ساعت` : '—'}</td>
                <td><Badge tone={TONE[d.code]}>{d.name}</Badge></td>
                <td>{isToday && r?.in == null && d.code !== 'leave' && <button className="adm-btn primary sm" data-tip="ساعت ورود همین الان ثبت می‌شود" onClick={() => { adminAttend(date, s.id, { in: nowH(), out: null }); chime('tap'); toast({ icon: '🟢', title: `ورود ${s.name}`, body: hhmm(nowH()) }) }}>ثبت ورود</button>}
                  {isToday && r?.in != null && r.out == null && <button className="adm-btn ghost sm" data-tip="ساعت خروج همین الان ثبت می‌شود" onClick={() => { adminAttend(date, s.id, { out: nowH() }); chime('tap'); toast({ icon: '🔴', title: `خروج ${s.name}`, body: hhmm(nowH()) }) }}>ثبت خروج</button>}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      ) : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>پرسنل</th><th>روز حضور</th><th>غیبت</th><th>مرخصی</th><th>ساعت کار</th><th>اضافه‌کار</th><th>تأخیر</th></tr></thead>
          <tbody>{staff.map((s) => { const a = attStats(club, s, days); return (
            <tr key={s.id}><td><div className="prod-cell"><Av s={s} size="sm" /><b>{s.name}</b></div></td><td className="num">{fa(a.present)}</td><td className={`num ${a.absent ? 'neg' : ''}`}>{fa(a.absent)}</td><td className="num">{fa(a.leave)}</td><td className="num">{fa(a.hours)}</td><td className="num">{fa(a.ot)}</td><td className="num">{a.late ? `${fa(a.late)} دقیقه` : '—'}</td></tr>
          ) })}</tbody>
        </table></div>
      )}
    </Card>
  )
}

// ---------- مرخصی ----------
function Leaves() {
  const { club, adminLeave, adminLeaveStatus, toast } = useStore()
  const staff = club.staff.filter((s) => s.status !== 'ended')
  const [f, setF] = useState({ staff: staff[0]?.id || '', kind: 'annual', from: addDays(todayKey(), 1), to: addDays(todayKey(), 1), note: '' })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const days = Math.max(0, leaveDays(f.from, f.to))
  const save = () => {
    if (!f.staff || !days) { toast({ icon: '⛔', title: f.staff ? 'بازه‌ی مرخصی درست نیست' : 'اول پرسنل را در بخش پرسنل اضافه کنید' }); return }
    adminLeave({ ...f, days }); chime('success'); toast({ icon: '🗓', title: 'درخواست مرخصی ثبت شد', body: `${fa(days)} روز` })
  }
  const list = [...club.leaves].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || ord(b.from) - ord(a.from))
  const name = (id) => club.staff.find((s) => s.id === id)?.name
  return (
    <div className="two wide-first">
      <Card title="درخواست‌ها">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>پرسنل</th><th>نوع</th><th>از</th><th>تا</th><th>روز</th><th>توضیح</th><th>وضعیت</th></tr></thead>
          <tbody>{list.map((l) => (
            <tr key={l.id}><td>{name(l.staff)}</td><td>{LEAVE_KIND[l.kind]}</td><td className="nowrap">{jDateFa(l.from)}</td><td className="nowrap">{jDateFa(l.to)}</td><td className="num">{fa(l.days)}</td><td>{l.note}</td>
              <td>{l.status === 'pending' ? <div className="row-btns"><button className="adm-btn primary sm" onClick={() => { adminLeaveStatus(l.id, 'ok'); chime('success') }}>تأیید</button><button className="adm-btn ghost sm" onClick={() => adminLeaveStatus(l.id, 'no')}>رد</button></div>
                : <Badge tone={l.status === 'ok' ? 'ok' : 'bad'}>{l.status === 'ok' ? 'تأیید شد' : 'رد شد'}</Badge>}</td></tr>
          ))}</tbody>
        </table></div>
        {!list.length && <Empty>درخواستی نیست.</Empty>}
      </Card>
      <div className="stack">
        <Card title="ثبت مرخصی">
          <div className="form">
            <Field label="پرسنل"><select value={f.staff} onChange={(e) => set({ staff: e.target.value })}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="نوع"><Seg value={f.kind} onChange={(kind) => set({ kind })} options={LEAVE_KIND} /></Field>
            <div className="form-2">
              <Field label="از"><DateSel value={f.from} onChange={(from) => set({ from, to: ord(f.to) < ord(from) ? from : f.to })} /></Field>
              <Field label="تا"><DateSel value={f.to} onChange={(to) => set({ to })} /></Field>
            </div>
            <Field label="توضیح"><input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
            <button className="adm-btn primary full" disabled={!days} onClick={save}>ثبت درخواست {fa(days)} روزه</button>
          </div>
        </Card>
        <Card title="مانده‌ی مرخصی استحقاقی" sub={`سال جاری، ${fa(club.hrCfg.annualLeave)} روز در سال`}>
          <div className="bal-list">{staff.filter((s) => s.type !== 'commission').map((s) => { const b = leaveBalance(club, s); return <div key={s.id}><span>{s.name}</span><div className="lv-bar"><i style={{ width: `${(b.used / b.total) * 100}%` }} /></div><b>{fa(b.left)} روز</b></div> })}</div>
        </Card>
      </div>
    </div>
  )
}

// ---------- حقوق و دستمزد ----------
function Payslip({ p, r }) {
  const lines = [['حقوق پایه', r.base], ['حق مسکن', r.housing], ['بن خواربار', r.bon], ['حق اولاد', r.child], ['اضافه‌کار', r.otPay], ['کارمزد کلاس', r.commission], ['کسر غیبت', -r.absence]].filter(([, v]) => v)
  return (
    <details className="slip">
      <summary><b>{p.label}</b><span>خالص {toman(r.net)}</span><small>{p.paidAt ? `پرداخت ${jDateFa(p.paidAt)}` : 'پرداخت‌نشده'}</small></summary>
      <div className="dr-rows">
        {lines.map(([k, v]) => <div key={k}><span>{k}</span><b className={v < 0 ? 'neg' : ''}>{toman(v)}</b></div>)}
        <div><span><b>جمع ناخالص</b></span><b>{toman(r.gross)}</b></div>
        {r.emp > 0 && <div><span>بیمه‌ی سهم کارگر ({fa(7)}٪)</span><b className="neg">{toman(-r.emp)}</b></div>}
        {r.adv > 0 && <div><span>کسر مساعده</span><b className="neg">{toman(-r.adv)}</b></div>}
        <div className="hl"><span>خالص پرداختی</span><b>{toman(r.net)}</b></div>
      </div>
    </details>
  )
}

function Payroll() {
  const { club, adminPayroll, adminPayrollPay, adminPayrollUndo, adminHrCfg, toast } = useStore()
  const months = recentMonths(4)
  const [mk, setMk] = useState(months[0])
  const [slip, setSlip] = useState(null)
  const posted = club.payrolls.find((p) => p.month === mk)
  const rows = posted ? posted.rows : payroll(club, mk)
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0)
  const days = jMonthDays(mk), ended = ord(days[days.length - 1]) < ord(todayKey())
  const [cfg, setCfg] = useState(club.hrCfg)
  const COLS = [['base', 'پایه / کارکرد'], ['housing', 'مسکن'], ['bon', 'بن'], ['child', 'اولاد'], ['otPay', 'اضافه‌کار'], ['absence', 'کسر غیبت'], ['commission', 'کارمزد مربی'], ['gross', 'ناخالص'], ['emp', 'بیمه ۷٪'], ['adv', 'مساعده'], ['net', 'خالص'], ['er', 'بیمه کارفرما ۲۳٪']]
  const exp = () => downloadXlsx(`quadra-payroll-${mk}`, [{ name: `حقوق ${jMonthLabel(mk)}`, rows: table(`لیست حقوق و دستمزد ${jMonthLabel(mk)}${posted ? '' : ' (پیش‌نویس)'}`, ['نام', 'سمت', 'نوع قرارداد', 'روز حضور', 'ساعت کار', 'اضافه‌کار (ساعت)', ...COLS.map((c) => c[1]), 'شبا'],
    rows.map((r) => { const s = club.staff.find((x) => x.id === r.staff); return [r.name, ROLES[r.role], CONTRACTS[r.type], r.att.present, r.att.hours, r.att.ot, ...COLS.map(([k]) => (k === 'absence' ? -r[k] : r[k] || 0)), s?.iban || ''] }),
    ['جمع', '', '', null, null, null, ...COLS.map(([k]) => (k === 'absence' ? -sum(k) : sum(k))), '']) }])
  return (
    <div className="stack">
      <div className="filters-bar">
        <select value={mk} onChange={(e) => setMk(e.target.value)}>{months.map((m) => <option key={m} value={m}>{jMonthLabel(m)}</option>)}</select>
        <Badge tone={posted ? (posted.paidAt ? 'ok' : 'warn') : 'mute'}>{posted ? (posted.paidAt ? `پرداخت شد ${jDateFa(posted.paidAt)}` : `سند ثبت شد ${jDateFa(posted.date)}`) : ended ? 'آماده‌ی ثبت سند' : 'ماه جاری — پیش‌نویس تا امروز'}</Badge>
        <span className="grow" />
        <XlsxBtn onClick={exp} label="اکسل لیست حقوق" />
        {!posted && <button className="adm-btn primary sm" data-tip="حقوق همه با کارکرد این ماه حساب و سند آن ثبت می‌شود" onClick={() => { if (ended || confirm('این ماه هنوز تمام نشده؛ سند با کارکرد تا امروز ثبت شود؟')) { adminPayroll(mk); chime('success'); toast({ icon: '📒', title: 'سند حقوق ثبت شد', body: `هزینه ${toman(sum('gross') + sum('er'))}` }) } }}>ثبت سند حقوق</button>}
        {posted && !posted.paidAt && <><button className="adm-btn ghost sm" onClick={() => confirm('سند حقوق حذف شود تا دوباره محاسبه شود؟') && adminPayrollUndo(mk)}>حذف و محاسبه‌ی دوباره</button>
          <button className="adm-btn primary sm" data-tip="خالص حقوق از بانک پرداخت شد" onClick={() => { adminPayrollPay(mk, 'paidAt'); chime('success'); toast({ icon: '🏦', title: 'حقوق پرداخت شد', body: toman(sum('net')) }) }}>پرداخت خالص {toman(sum('net'))}</button></>}
        {posted?.paidAt && !posted.insPaidAt && <button className="adm-btn primary sm" data-tip="حق بیمه‌ی سهم کارگر و کارفرما به تأمین اجتماعی پرداخت شد" onClick={() => { adminPayrollPay(mk, 'insPaidAt'); toast({ icon: '🛡', title: 'حق بیمه پرداخت شد', body: toman(sum('emp') + sum('er')) }) }}>پرداخت بیمه {toman(sum('emp') + sum('er'))}</button>}
      </div>
      <div className="kpis four">
        <Kpi icon="users" label="تعداد" value={`${fa(rows.length)} نفر`} />
        <Kpi icon="cash" label="جمع ناخالص" value={toman(sum('gross'))} />
        <Kpi icon="shield" label="بیمه (کارگر + کارفرما)" value={toman(sum('emp') + sum('er'))} />
        <Kpi icon="wallet" label="خالص پرداختی" value={toman(sum('net'))} sub={`هزینه‌ی کل باشگاه ${toman(sum('gross') + sum('er'))}`} />
      </div>
      <Card title={`لیست حقوق ${jMonthLabel(mk)}`} sub="روی هر ردیف بزنید تا فیش حقوقی باز شود">
        <div className="tbl-wrap"><table className="tbl pay">
          <thead><tr><th>نام</th><th>کارکرد</th>{COLS.map(([k, v]) => <th key={k} className={k === 'net' ? 'hl' : ''}>{v}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff} className="click" onClick={() => setSlip(r)}>
                <td><b>{r.name}</b><small>{ROLES[r.role]}، {CONTRACTS[r.type]}</small></td>
                <td className="num">{r.type === 'commission' ? `${fa(r.sessions || 0)} جلسه` : r.type === 'hourly' ? `${fa(r.att.hours)} ساعت` : `${fa(r.att.present)} روز`}</td>
                {COLS.map(([k]) => <td key={k} className={`num ${k === 'net' ? 'hl' : ''} ${k === 'absence' && r[k] ? 'neg' : ''}`}>{r[k] ? (k === 'absence' ? '−' : '') + fa(Math.round(r[k] / 1000)) : '—'}</td>)}
              </tr>
            ))}
            <tr className="total"><td>جمع (هزار تومان)</td><td />{COLS.map(([k]) => <td key={k} className={`num ${k === 'net' ? 'hl' : ''}`}>{fa(Math.round(sum(k) / 1000))}</td>)}</tr>
          </tbody>
        </table></div>
        <p className="muted small">ارقام جدول به هزار تومان. بدون مالیات بر حقوق؛ بیمه‌ی تأمین اجتماعی ۷٪ سهم کارگر و ۲۳٪ سهم کارفرما. سند: بدهکار ۸۱۰۱ حقوق، ۸۱۰۳ حق‌الزحمه‌ی مربیان، ۸۱۰۲ بیمه‌ی کارفرما؛ بستانکار ۳۲۰۱ حقوق پرداختنی، ۳۲۰۲ بیمه، ۱۵۰۱ مساعده.</p>
      </Card>
      <Card title="تنظیمات قانون کار" sub="مقادیر نمونه‌اند؛ هر سال با مصوبه‌ی شورای عالی کار به‌روز کنید">
        <div className="cfg-grid">
          {[['housing', 'حق مسکن ماهانه'], ['bon', 'بن خواربار ماهانه'], ['child', 'حق اولاد هر فرزند']].map(([k, v]) => <Field key={k} label={v}><Money value={cfg[k]} onChange={(x) => setCfg({ ...cfg, [k]: x })} /></Field>)}
          {[['otRate', 'ضریب اضافه‌کار', 0.1], ['emp', 'بیمه‌ی سهم کارگر', 0.01], ['er', 'بیمه‌ی سهم کارفرما', 0.01], ['monthHours', 'ساعت کار ماهانه', 1], ['dayHours', 'ساعت کار روزانه', 0.5], ['annualLeave', 'مرخصی سالانه (روز)', 1]].map(([k, v, st]) => <Field key={k} label={v}><input type="number" step={st} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: +e.target.value })} /></Field>)}
        </div>
        <button className="adm-btn primary" onClick={() => { adminHrCfg(cfg); chime('success'); toast({ icon: '💾', title: 'تنظیمات ذخیره شد', body: 'محاسبه‌ی ماه‌های ثبت‌نشده به‌روز شد' }) }}>ذخیره</button>
      </Card>
      <Side open={!!slip} onClose={() => setSlip(null)} title={slip && `فیش حقوقی ${slip.name}`}>
        {slip && <><p className="muted">{jMonthLabel(mk)}، {ROLES[slip.role]}</p><Payslip p={posted || { label: jMonthLabel(mk) + ' (پیش‌نویس)' }} r={slip} /></>}
      </Side>
    </div>
  )
}

// ---------- مساعده ----------
function Advances() {
  const { club, adminAdvance, toast } = useStore()
  const staff = club.staff.filter((s) => s.status !== 'ended' && s.type !== 'commission')
  const [f, setF] = useState({ staff: staff[0]?.id || '', amount: 0, pay: 'cash', note: '' })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const save = () => { const s = club.staff.find((x) => x.id === f.staff); if (!s || !(+f.amount > 0)) { toast({ icon: '⛔', title: s ? 'مبلغ را وارد کنید' : 'اول پرسنل را اضافه کنید' }); return } adminAdvance({ ...f, name: s.name }); chime('success'); toast({ icon: '💵', title: 'مساعده ثبت شد', body: `${s.name}، ${toman(f.amount)}` }); set({ amount: 0, note: '' }) }
  return (
    <div className="two wide-first">
      <Card title="مساعده‌ها" sub="از حقوق همان ماه کسر می‌شود">
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>تاریخ</th><th>پرسنل</th><th>مبلغ</th><th>پرداخت از</th><th>توضیح</th><th>کسر در</th></tr></thead>
          <tbody>{club.advances.map((a) => <tr key={a.id}><td>{jDateFa(a.date)}</td><td>{a.name}</td><td className="num">{toman(a.amount)}</td><td><small>{PAY_FROM[a.pay]}</small></td><td>{a.note}</td><td>{jMonthLabel(jMonthKey(a.date))}</td></tr>)}</tbody></table></div>
        {!club.advances.length && <Empty>مساعده‌ای ثبت نشده است.</Empty>}
      </Card>
      <Card title="پرداخت مساعده">
        <div className="form">
          <Field label="پرسنل"><select value={f.staff} onChange={(e) => set({ staff: e.target.value })}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="مبلغ (تومان)"><Money value={f.amount} onChange={(amount) => set({ amount })} /></Field>
          <Field label="پرداخت از"><Seg value={f.pay} onChange={(pay) => set({ pay })} options={{ cash: 'صندوق', bank: 'بانک' }} /></Field>
          <Field label="توضیح"><input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          <div className="voucher-prev"><small>سند</small><div><span>بدهکار ۱۵۰۱ مساعده‌ی کارکنان</span><b>{toman(f.amount)}</b></div><div><span>بستانکار {f.pay === 'cash' ? '۱۱۰۱ صندوق' : '۱۱۰۲ بانک'}</span><b>{toman(f.amount)}</b></div></div>
          <button className="adm-btn primary full" disabled={!f.amount} onClick={save}>ثبت مساعده</button>
        </div>
      </Card>
    </div>
  )
}
