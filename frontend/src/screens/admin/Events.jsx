// آدینه‌ها و تورنمنت‌ها: تعریف مسابقه، ثبت‌نام‌های دونفره، تیم‌بندی، طراحی گروه‌ها، مرحله‌ی حذفی، برنده‌ها، ورودی‌ها و فروش کافه‌ی روز مسابقه
import { Fragment, useEffect, useMemo, useState } from 'react'
import { courtById, EVENT_KIND, EV_IMG, VIBORA_IMG, LEVELS, MEMBERS, METHOD_NAME, addDays, hoursOf, levelById, dayLabel, fa, fromKey, hourLabel, short, toman, todayKey } from '../../data'
import {
  EV_FORMAT, EV_STATUS, GROUP_IDS, ROUND, SCORING, addGroup, dropGroup, emptyGroups, fillGroups, scored, scoringOf, setsOf, cafeOf, clashes, entryTotal, eventAt, fillTeams, finished, groupsDone, isLive, loosePairs, withPairs, koRounds, makeGroups, makeKnockout, makeTeams, moveTeam, pairUp, plan, podium, regPower, setScore, showsResults, singles, standings, teamName, unpair, upcoming, audienceText,
} from '../../events'
import { dk, jDate, jDateFa, jMonthDays, jMonthKey, jMonthLabel, jParts } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon, LevelPill } from '../../components/ui'
import { Match } from '../../components/Tournament'
import { EventBoard } from './EventBoard'
import { who } from './derive'
import { Badge, Card, Empty, Field, Guide, ImageUpload, Kpi, Money, Pager, Search, Seg, Side, Tabs, XlsxBtn, useSlice } from './kit'

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const when = (e) => `${dayLabel(e.date)} ${jDateFa(e.date)}، ${hourLabel(e.start)} تا ${hourLabel(e.start + e.dur)}`
const St = ({ s }) => <Badge tone={EV_STATUS[s][1]}>{EV_STATUS[s][0]}</Badge>
const sum = (l, f) => l.reduce((s, x) => s + f(x), 0)
const courtsText = (cs) => (cs.length === 4 ? 'همه‌ی زمین‌ها' : cs.map((c) => courtById(c).name).join('، '))
// وضعیت به زبان ساده: هر گزینه یعنی بازیکن‌ها در اپ چه می‌بینند
const STATUS_HELP = {
  draft: ['پیش‌نویس', 'فقط شما می‌بینید؛ در اپ نشان داده نمی‌شود و زمین‌ها هنوز رزرو نمی‌شوند.'],
  open: ['منتشر، ثبت‌نام باز', 'در اپ دیده می‌شود و بازیکن‌ها می‌توانند تیم دونفره ثبت‌نام کنند.'],
  closed: ['منتشر، ثبت‌نام بسته', 'در اپ دیده می‌شود ولی ثبت‌نام تازه نمی‌گیرد؛ وقت تیم‌بندی است.'],
  done: ['برگزار شد', 'به «برگزارشده‌ها» می‌رود؛ برنده‌ها و جدول‌ها در اپ دیده می‌شوند.'],
  cancelled: ['لغو شد', 'در اپ دیده نمی‌شود و زمین‌ها آزاد می‌شوند.'],
}

// مرحله‌ای که مسابقه در آن است، به زبان ساده (برای فهرست و سربرگ)
function stageOf(e) {
  const p = podium(e)
  if (e.status === 'cancelled') return ['لغو شد', 'bad']
  if (e.status === 'draft') return ['پیش‌نویس', 'mute']
  if (p) return ['قهرمان مشخص شد', 'gold']
  if (e.matches.some((m) => m.stage === 'ko')) return ['مرحله‌ی حذفی', 'q']
  if (e.groups.length) return ['بازی‌های گروهی', 'q']
  if (e.teams.length) return ['تیم‌بندی', 'warn']
  return e.status === 'closed' ? ['ثبت‌نام بسته', 'warn'] : ['ثبت‌نام باز', 'ok']
}
const Stage = ({ e }) => { const [n, t] = stageOf(e); return <span className={`ev-stage ${t}`}>{n}</span> }
const DateBox = ({ e, big }) => <span className={`ev-dbox ${big ? 'big' : ''}`}><small>{dayLabel(e.date)}</small><b>{fa(+jDate(e.date).split('/')[2])}</b><small>{jMonthLabel(jMonthKey(e.date)).split(' ')[0]}</small></span>
const waitingOf = (e) => singles(e).filter((r) => !r.pair).length
const pairsOf = (e) => new Set(e.regs.filter((r) => r.pair).map((r) => r.pair)).size

export function Events() {
  const { club } = useStore()
  const [tab, setTab] = useState('next')
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(null) // رویداد یا 'new'
  const [unlock, setUnlock] = useState(null) // آدینه‌ی برگزارشده‌ای که موقتاً برای اصلاح باز شده
  const ev = sel && club.events.find((e) => e.id === sel)
  const back = () => { setSel(null); setUnlock(null) }
  return (
    <div className="stack">
      {ev ? (ev.status === 'done' && unlock !== ev.id ? <DoneDetail ev={ev} onBack={back} onUnlock={() => setUnlock(ev.id)} /> : <Detail ev={ev} onBack={back} onEdit={() => setForm(ev)} />)
        : <List tab={tab} setTab={setTab} onOpen={setSel} onNew={() => setForm('new')} />}
      <Side open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'آدینه یا ایونت جدید' : 'ویرایش مسابقه'} wide>
        {form && <EventForm key={form.id || 'new'} ev={form === 'new' ? null : club.events.find((e) => e.id === form.id)} onClose={(id) => { setForm(null); if (id) setSel(id) }} />}
      </Side>
    </div>
  )
}

// ---------- فهرست: مسابقه‌ی بعدی بزرگ، بقیه ردیف‌های ساده ----------
function List({ tab, setTab, onOpen, onNew }) {
  const { club } = useStore()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const base = tab === 'next' ? upcoming(club).concat(club.events.filter((e) => e.status === 'draft')) : tab === 'past' ? finished(club) : [...club.events].sort((a, b) => fromKey(b.date) - fromKey(a.date))
    return base.map((e) => ({ e, money: entryTotal(e) + sum(cafeOf(club, e), (o) => o.total), champ: podium(e) && teamName(e, podium(e).first) }))
  }, [tab, club])
  // جستجو با عنوان یا نام شرکت‌کننده: «این آدم کدام آدینه‌ها آمده»
  const w = q.trim()
  const list = rows.filter((r) => !w || r.e.title.includes(w) || r.e.regs.some((x) => x.name?.includes(w) || x.phone?.includes(w)))
  const spot = tab === 'next' && !w ? list.find((r) => r.e.status !== 'draft') : null
  const rest = list.filter((r) => r !== spot)
  const pg = useSlice(rest, 12, tab + w)
  const exp = () => downloadXlsx(`quadra-events-${jDate(todayKey()).replace(/\//g, '-')}`, [{
    name: 'مسابقه‌ها', rows: table('آدینه‌ها و ایونت‌های ویبورای کوادرا', ['تاریخ', 'ساعت', 'عنوان', 'نوع', 'وضعیت', 'ثبت‌نام', 'ظرفیت', 'ورودی هر نفر', 'جمع ورودی', 'فروش کافه', 'جمع درآمد', 'قهرمان'],
      list.map(({ e, champ }) => { const c = sum(cafeOf(club, e), (o) => o.total); return [jDate(e.date), hourLabel(e.start), e.title, EVENT_KIND[e.kind].name, EV_STATUS[e.status][0], e.regs.length, e.cap, e.fee, entryTotal(e), c, entryTotal(e) + c, champ || ''] })),
  }])
  const months = []
  pg.rows.forEach((r) => { const k = jMonthKey(r.e.date); const g = months[months.length - 1]; if (g?.k === k) g.rows.push(r); else months.push({ k, rows: [r] }) })
  return (
    <div className="stack">
      <div className="sec-bar">
        <Tabs value={tab} onChange={setTab} tabs={[
          ['next', 'پیش‌رو', upcoming(club).length, 'مسابقه‌هایی که هنوز برگزار نشده‌اند'],
          ['past', 'برگزارشده‌ها', null, 'نتیجه‌ها و قهرمان‌ها'],
          ['all', 'همه', null, 'همه، از جمله پیش‌نویس و لغوشده'],
        ]} />
        <div className="sec-actions">
          <div className="ev-q"><Search value={q} onChange={setQ} ph="اسم مسابقه یا بازیکن" /></div>
          <XlsxBtn onClick={exp} label="اکسل" />
          <button className="adm-btn primary sm" onClick={onNew} data-tip="بعد از انتشار در اپ دیده می‌شود و زمین‌هایش در تقویم رزرو می‌شود"><Icon name="plus" size={16} />آدینه‌ی جدید</button>
        </div>
      </div>
      {spot && (() => {
        const e = spot.e, wt = waitingOf(e)
        return (
          <button className="evs" onClick={() => onOpen(e.id)}>
            <DateBox e={e} big />
            <div className="evs-main">
              <span className="evs-tag">مسابقه‌ی بعدی، {EVENT_KIND[e.kind].name}</span>
              <h3>{e.title}</h3>
              <small>{hourLabel(e.start)} تا {hourLabel(e.start + e.dur)}، {courtsText(e.courts)}، سطح {e.levels.join(' / ')}{audienceText(e) && `، ${audienceText(e)}`}</small>
              <div className="evs-cap"><i style={{ width: `${Math.min(100, (e.regs.length / e.cap) * 100)}%` }} /></div>
              <div className="evs-meta"><span><b>{fa(e.regs.length)}</b> از {fa(e.cap)} نفر</span><span><b>{fa(pairsOf(e))}</b> تیم دونفره</span>{wt > 0 && <span className="warn"><b>{fa(wt)}</b> نفر منتظر یار</span>}</div>
            </div>
            <div className="evs-side"><Stage e={e} /><span className="evs-go">مدیریت<Icon name="back" size={15} /></span></div>
          </button>
        )
      })()}
      {months.map(({ k, rows: rs }) => (
        <Fragment key={k}>
          <h4 className="ev-month">{jMonthLabel(k)}</h4>
          <div className="evr-list">
            {rs.map(({ e, money, champ }) => (
              <button key={e.id} className={`evr ${e.status}`} onClick={() => onOpen(e.id)}>
                <DateBox e={e} />
                <span className="evr-main"><b>{e.title}</b><small>{hourLabel(e.start)} تا {hourLabel(e.start + e.dur)}، {courtsText(e.courts)}</small></span>
                {e.status === 'done' ? <span className="evr-champ">{champ ? `🏆 ${champ}` : '—'}</span>
                  : <span className="evr-cap"><i><em style={{ width: `${Math.min(100, (e.regs.length / e.cap) * 100)}%` }} /></i><small>{fa(e.regs.length)} از {fa(e.cap)}</small></span>}
                <Stage e={e} />
                <span className="evr-money">{short(money)}</span>
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      {!list.length && <Empty>{w ? `مسابقه‌ای با «${w}» پیدا نشد.` : 'مسابقه‌ای در این فهرست نیست.'}</Empty>}
      {rest.length > 12 && <div className="log-foot"><small>{fa(pg.from + 1)} تا {fa(pg.from + pg.rows.length)} از {fa(rest.length)}</small><Pager {...pg} /></div>}
    </div>
  )
}

// سربرگ هر مرحله: عنوان و راهنما، و دکمه‌ی مرحله‌ی بعد کنار آن
export const StepHead = ({ title, sub, children }) => (
  <div className="sth"><div className="grow"><h3>{title}</h3>{sub && <small>{sub}</small>}</div><div className="sth-act">{children}</div></div>
)
const NextBtn = ({ onClick, children, ghost }) => <button className={`adm-btn ${ghost ? 'ghost' : 'primary'} sth-next`} onClick={onClick}>{children}<Icon name="back" size={15} /></button>

// ---------- جزئیات یک مسابقه: سربرگ ساده، مسیر مرحله‌ای و یک صفحه برای هر مرحله ----------
function Detail({ ev, onBack, onEdit }) {
  const { club, adminEventSave, adminEventDel, toast } = useStore()
  const ko = ev.matches.some((m) => m.stage === 'ko')
  const cafe = cafeOf(club, ev)
  const p = podium(ev)
  const busy = isLive(ev) && fromKey(ev.date) >= fromKey(todayKey()) ? clashes(club.bookings, ev).filter((b) => !b.event) : []
  const setStatus = (status) => { adminEventSave({ id: ev.id, status }); chime('tap'); toast({ icon: '🏆', title: `«${ev.title}»: ${STATUS_HELP[status][0]}`, body: STATUS_HELP[status][1] }) }
  const del = () => {
    if (ev.regs.some((r) => r.paid > 0)) { if (window.confirm(`«${ev.title}» ورودی پرداخت‌شده دارد؛ لغو شود؟ زمین‌ها آزاد می‌شوند.`)) setStatus('cancelled'); return }
    if (window.confirm(`«${ev.title}» پاک شود؟`)) { adminEventDel(ev.id); onBack() }
  }
  const left = ev.matches.filter((m) => m.stage === 'group' && !scored(m)).length
  const waiting = waitingOf(ev)
  const placed = new Set(ev.groups.flatMap((g) => g.teams))
  const outside = ev.teams.filter((t) => !placed.has(t.id)).length
  const steps = [
    ['people', 'ثبت‌نام', `${fa(ev.regs.length)} از ${fa(ev.cap)} نفر`, ev.status !== 'open' && ev.status !== 'draft' && ev.regs.length >= 2],
    ['teams', 'تیم‌ها', ev.teams.length ? `${fa(ev.teams.length)} تیم${waiting ? `، ${fa(waiting)} بی‌یار` : ''}` : waiting ? `${fa(waiting)} نفر بی‌یار` : 'هنوز چیده نشده', ev.teams.length > 1 && waiting < 2],
    ev.format === 'groups' && ['groups', 'گروه‌ها', !ev.groups.length ? 'ساخته نشده' : outside ? `${fa(outside)} تیم بیرون` : left ? `${fa(left)} بازی مانده` : 'تمام شد', groupsDone(ev) && !outside],
    ['ko', 'حذفی', ko ? (p ? 'فینال انجام شد' : 'در جریان') : 'ساخته نشده', !!p],
    ['champ', 'قهرمان', p ? teamName(ev, p.first) : 'بعد از فینال', !!p && ev.status === 'done'],
  ].filter(Boolean)
  const cur = steps.find((s) => !s[3])
  const [tab, setTab] = useState(() => cur?.[0] || 'champ')
  const nextOf = (k) => steps[steps.findIndex((s) => s[0] === k) + 1]?.[0]
  const go = (k) => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const headPeople = ev.status === 'draft' ? <NextBtn onClick={() => setStatus('open')}>انتشار در اپ</NextBtn>
    : ev.status === 'open' ? <NextBtn onClick={() => { setStatus('closed'); go('teams') }}>بستن ثبت‌نام و تیم‌بندی</NextBtn>
    : <NextBtn onClick={() => go('teams')}>تیم‌ها</NextBtn>
  return (
    <div className="stack">
      <button className="adm-btn ghost sm ev-back" onClick={onBack}><Icon name="fwd" size={16} />همه‌ی مسابقه‌ها</button>
      <div className="evh">
        <DateBox e={ev} big />
        <div className="grow">
          <div className="evh-t"><h2>{ev.title}</h2><Stage e={ev} /></div>
          <small>{hourLabel(ev.start)} تا {hourLabel(ev.start + ev.dur)}، {courtsText(ev.courts)}، سطح {ev.levels.join(' / ')}{audienceText(ev) && `، ${audienceText(ev)}`}، {toman(ev.fee)} هر نفر، {scoringOf(ev).name}</small>
          <div className="evh-nums">
            <span>ثبت‌نام <b>{fa(ev.regs.length)}/{fa(ev.cap)}</b></span>
            <span>ورودی‌ها <b>{short(entryTotal(ev))}</b></span>
            <button onClick={() => setTab('cafe')} data-tip="خریدهای کافه در روز مسابقه">کافه <b>{short(sum(cafe, (o) => o.total))}</b></button>
          </div>
        </div>
        <div className="evh-act">
          <select value={ev.status} onChange={(e) => setStatus(e.target.value)} data-tip={STATUS_HELP[ev.status][1]}>{['draft', 'open', 'closed', 'done'].map((k) => <option key={k} value={k}>{STATUS_HELP[k][0]}</option>)}</select>
          <button className="adm-btn ghost sm" onClick={onEdit}><Icon name="cog" size={15} />ویرایش</button>
          <button className="icon-btn" onClick={del} data-tip={ev.regs.some((r) => r.paid > 0) ? 'لغو مسابقه' : 'حذف'} aria-label="حذف"><Icon name="close" size={16} /></button>
        </div>
      </div>
      {busy.length > 0 && <p className="pt-warn">{fa(busy.length)} رزرو عادی در همین ساعت روی این زمین‌ها هست؛ در تقویم جابه‌جا یا لغوشان کنید.</p>}
      <div className="flow">
        {steps.map(([k, n, sub, ok], i) => (
          <button key={k} className={`flow-s ${tab === k ? 'on' : ''} ${ok ? 'ok' : ''} ${cur?.[0] === k ? 'cur' : ''}`} onClick={() => setTab(k)}>
            <i>{ok ? '✓' : k === 'champ' ? '🏆' : fa(i + 1)}</i><span><b>{n}</b><small>{sub}</small></span>
          </button>
        ))}
      </div>
      {tab === 'people' && <><StepHead title="ثبت‌نام" sub={STATUS_HELP[ev.status][1]}>{headPeople}</StepHead><People ev={ev} /></>}
      {tab === 'teams' && <><StepHead title="تیم‌ها" sub="هر دو نفری که با هم ثبت‌نام کرده‌اند یک تیم‌اند؛ بی‌یارها را دو به دو انتخاب کنید و تیم بسازید.">{ev.teams.length > 1 && <NextBtn onClick={() => go(nextOf('teams'))}>{ev.format === 'groups' ? 'گروه‌ها' : 'جدول حذفی'}</NextBtn>}</StepHead><TeamsTab ev={ev} /></>}
      {tab === 'groups' && <GroupsStep ev={ev} go={go} />}
      {tab === 'ko' && <KoStep ev={ev} go={go} />}
      {tab === 'champ' && <ChampStep ev={ev} go={go} onDone={() => setStatus('done')} />}
      {tab === 'cafe' && <CafeTab ev={ev} orders={cafe} />}
    </div>
  )
}

// ---------- آدینه‌ی برگزارشده: فقط خواندنی ----------
function DoneDetail({ ev, onBack, onUnlock }) {
  const { club } = useStore()
  const [tab, setTab] = useState('champ')
  const cafe = cafeOf(club, ev)
  const entry = entryTotal(ev), cafeT = sum(cafe, (o) => o.total)
  return (
    <div className="stack">
      <button className="adm-btn ghost sm ev-back" onClick={onBack}><Icon name="fwd" size={16} />همه‌ی مسابقه‌ها</button>
      <div className="evh">
        <DateBox e={ev} big />
        <div className="grow">
          <div className="evh-t"><h2>{ev.title}</h2><span className="evd-lock"><Icon name="lock" size={14} />برگزار شده</span></div>
          <small>{hourLabel(ev.start)} تا {hourLabel(ev.start + ev.dur)}، {fa(ev.teams.length)} تیم، {fa(ev.regs.length)} نفر</small>
          <div className="evh-nums"><span>ورودی‌ها <b>{short(entry)}</b></span><span>کافه <b>{short(cafeT)}</b></span><span>جمع <b>{short(entry + cafeT)}</b></span></div>
        </div>
        <div className="evh-act"><button className="adm-btn ghost sm" onClick={onUnlock} data-tip="فقط برای اصلاح؛ با برگشتن به فهرست دوباره قفل می‌شود">باز کردن قفل</button></div>
      </div>
      <Seg value={tab} onChange={setTab} options={{ champ: 'قهرمان', board: 'جدول مسابقه', teams: 'تیم‌ها', cafe: 'کافه' }} />
      {tab === 'champ' && <ChampStep ev={ev} locked />}
      {tab === 'board' && <Card><EventBoard ev={ev} locked /></Card>}
      {tab === 'teams' && <Card>
        <div className="evd-teams">{ev.teams.map((t, i) => <div key={t.id}><em>{fa(i + 1)}</em><b>{t.name}</b></div>)}</div>
        {!ev.teams.length && <Empty>تیمی ثبت نشده.</Empty>}
      </Card>}
      {tab === 'cafe' && <CafeTab ev={ev} orders={cafe} />}
    </div>
  )
}

// ---------- ثبت‌نام‌ها: تیم‌های دونفره و ثبت‌نام حضوری ----------
function useWho(ev, exclude) {
  const [q, setQ] = useState('')
  const [m, setM] = useState(null)
  const [level, setLevel] = useState('C')
  const found = q && !m ? MEMBERS.filter((x) => !x.inactive && (x.name.includes(q) || x.phone.includes(q)) && !ev.regs.some((r) => r.by === x.id) && !exclude.includes(x.id)).slice(0, 5) : []
  const guest = q.trim()
  const person = m ? { by: m.id, name: m.name, level: m.level, phone: m.phone } : guest ? { by: 'f:' + guest, name: guest, level } : null
  return { q, setQ, m, setM, level, setLevel, found, guest, person, reset: () => { setQ(''); setM(null) } }
}
function WhoField({ label, w, hint }) {
  return (<>
    <Field label={label} hint={hint}>
      {w.m ? <div className="picked"><b>{w.m.name} <LevelPill id={w.m.level} /></b><button type="button" className="link" onClick={() => w.setM(null)}>تغییر</button></div>
        : <><input placeholder="جستجوی عضو یا نام مهمان" value={w.q} onChange={(e) => w.setQ(e.target.value)} />
          {w.found.length > 0 && <div className="pick-list">{w.found.map((m) => <button type="button" key={m.id} onClick={() => w.setM(m)}><b>{m.name}</b><small>{m.level}</small><small dir="ltr">{m.phone}</small></button>)}</div>}</>}
    </Field>
    {!w.m && w.guest && <Field label={`سطح ${w.guest}`} tip="برای تیم‌بندی هم‌سطح"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={w.level === l.id ? 'on' : ''} onClick={() => w.setLevel(l.id)}>{l.id}</button>)}</div></Field>}
  </>)
}

function People({ ev }) {
  const { adminEventReg, adminEventUnreg, toast } = useStore()
  const a = useWho(ev, [])
  const b = useWho(ev, [a.m?.id].filter(Boolean))
  const [method, setMethod] = useState('cash')
  const [each, setEach] = useState(ev.fee)
  const n = b.person ? 2 : 1
  const full = ev.regs.length + n > ev.cap
  const add = () => {
    adminEventReg(ev.id, a.person, method, method === 'free' ? 0 : each, b.person)
    chime('success'); toast({ icon: '🎾', title: b.person ? `تیم ${a.person.name} و ${b.person.name} ثبت شد` : `${a.person.name} ثبت‌نام شد`, body: method === 'free' ? 'بدون ورودی' : `${toman(each * n)}، ${METHOD_NAME[method]}` })
    a.reset(); b.reset()
  }
  const remove = (r) => {
    const mate = r.pair && ev.regs.find((x) => x.pair === r.pair && x.id !== r.id)
    if (!window.confirm(`${mate ? `تیم ${r.name} و ${mate.name}` : r.name} از مسابقه حذف شود؟${r.paid ? ' ورودی برگشت داده شده حساب می‌شود.' : ''}${ev.teams.length ? ' تیم‌بندی هم پاک می‌شود.' : ''}`)) return
    adminEventUnreg(ev.id, r.id)
  }
  // ثبت‌نام‌ها به ترتیب، هر زوج کنار هم
  const groups = []
  ev.regs.forEach((r) => { const k = r.pair || r.id; const g = groups.find((x) => x.k === k); if (g) g.rs.push(r); else groups.push({ k, rs: [r] }) })
  return (
    <div className="two wide-first">
      <Card title="ثبت‌نام‌ها" sub={`${fa(ev.regs.length)} از ${fa(ev.cap)} نفر، ${fa(groups.length)} ثبت‌نام؛ هر تیم دونفره یک پرداخت دارد`}>
        <div className="reg-list">
          {groups.map(({ k, rs }, i) => {
            const payer = rs[0].payer && rs.find((r) => r.by === rs[0].payer)
            return (
              <div key={k} className={`reg ${rs.length > 1 ? 'pair' : ''}`}>
                <em>{fa(i + 1)}</em>
                <div className="grow">
                  {rs.map((r) => <span key={r.id} className="reg-p"><b>{r.name}</b>{r.level && <LevelPill id={r.level} />}{r.by?.startsWith('f:') && <small>مهمان</small>}</span>)}
                  <small>{rs.length > 1 ? 'تیم دونفره' : 'تکی، یار با تیم‌بندی'}، {rs[0].source === 'app' ? 'از اپ' : 'حضوری'}، {jDateFa(dk(rs[0].at))}{payer ? `، پرداخت: ${payer.name.split(' ')[0]}` : ''}</small>
                </div>
                <span className="num">{rs[0].paid ? <>{toman(sum(rs, (r) => r.paid))}<small>{METHOD_NAME[rs[0].method] || rs[0].method}</small></> : 'رایگان'}</span>
                <button className="icon-btn" onClick={() => remove(rs[0])} aria-label="حذف" data-tip="حذف و برگرداندن ورودی"><Icon name="close" size={15} /></button>
              </div>
            )
          })}
        </div>
        {!ev.regs.length && <Empty>هنوز کسی ثبت‌نام نکرده.</Empty>}
      </Card>
      <Card title="ثبت‌نام حضوری" sub={ev.regs.length >= ev.cap ? 'ظرفیت تکمیل است' : `${fa(ev.cap - ev.regs.length)} جای خالی`}>
        <div className="form">
          <WhoField label="بازیکن (پرداخت‌کننده)" w={a} />
          {a.person && <WhoField label="یار" w={b} hint="اختیاری؛ اگر خالی بماند، در تیم‌بندی یار هم‌سطح می‌گیرد" />}
          <Field label="پرداخت"><Seg value={method} onChange={setMethod} options={{ cash: 'نقدی', card: 'کارتخوان', free: 'رایگان' }} /></Field>
          {method !== 'free' && <Field label="ورودی هر نفر" hint={n > 1 ? `جمع ${toman(each * n)} از ${a.person?.name}` : null}><Money value={each} onChange={setEach} /></Field>}
          <button className="adm-btn primary full" disabled={full || !a.person} onClick={add}>{b.person ? 'ثبت تیم' : 'ثبت‌نام'}</button>
        </div>
      </Card>
    </div>
  )
}

// ---------- تیم‌ها: تیم‌سازی دستی برای منتظرها، جفت‌کردن خودکار، جدا کردن ----------
function TeamsTab({ ev }) {
  const { adminEventSet, toast } = useStore()
  const [sel, setSel] = useState([])
  const started = ev.matches.some((m) => m.sa != null)
  // زوج‌های ثبت‌نامی خودکار تیم می‌شوند؛ «منتظر یار» فقط کسانی است که واقعاً یار ندارند
  const loose = loosePairs(ev).length
  useEffect(() => { if (loose && !started) adminEventSet(ev.id, withPairs) }, [loose, started])
  const wait = singles(ev).filter((r) => !r.pair)
  const ok = () => { if (started) { toast({ icon: '⚠️', title: 'بازی‌ها شروع شده‌اند', body: 'اول نتیجه‌ها را پاک کنید یا تیم‌بندی را از نو بچینید' }); return false } return !ev.groups.length || window.confirm('گروه‌ها و برنامه‌ی بازی پاک و باید دوباره ساخته شوند. ادامه؟') }
  const pick = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)))
  const make = () => { if (!ok()) return; adminEventSet(ev.id, (e) => pairUp(e, sel[0], sel[1])); setSel([]); chime('success'); toast({ icon: '🤝', title: 'تیم ساخته شد' }) }
  const auto = () => { if (!ok()) return; adminEventSet(ev.id, fillTeams); setSel([]); chime('success'); toast({ icon: '🎾', title: 'منتظرها جفت شدند', body: 'تیم‌های ساخته‌شده دست نخوردند؛ بقیه هم‌سطح جفت شدند' }) }
  const split = (t) => { if (!ok()) return; adminEventSet(ev.id, (e) => unpair(e, t.id)); chime('tap') }
  const reg = (id) => ev.regs.find((r) => r.id === id) || {}
  const [view, setView] = useState('court')
  const power = (t) => t.players.reduce((s, pid) => s + regPower(reg(pid)), 0)
  const maxP = Math.max(1, ...ev.teams.map(power))
  return (
    <div className="two wide-first">
      <Card title={`تیم‌ها ${ev.teams.length ? `(${fa(ev.teams.length)})` : ''}`} sub="تیم‌هایی که در اپ دونفره ثبت‌نام کرده‌اند با برچسب «ثبت‌نامی» مشخص‌اند"
        right={ev.teams.length > 0 && <Seg value={view} onChange={setView} options={{ court: 'زمین', cards: 'کارت' }} tips={{ court: 'هر تیم روی نیمه‌ی زمین خودش', cards: 'کارت‌های جمع‌وجور' }} />}>
        {view === 'court' && <div className="tc-grid">
          {ev.teams.map((t, i) => (
            <div key={t.id} className={`tc ${t.pair ? 'pair' : ''}`}>
              <div className="tc-court">
                <i className="tc-net" /><i className="tc-svc" />
                {t.players.map((pid, k) => { const r = reg(pid); return <span key={pid} className={`tc-pl p${k}`} style={{ '--lv': levelById(r.level)?.color || '#888' }}>{(r.name || '?')[0]}</span> })}
                {t.players.length < 2 && <span className="tc-pl p1 empty">؟</span>}
                <em className="tc-n">{fa(i + 1)}</em>
                <button className="tc-x" onClick={() => split(t)} data-tip="جدا کردن؛ هر دو به «منتظر یار» برمی‌گردند" aria-label="جدا کردن"><Icon name="close" size={13} /></button>
              </div>
              <div className="tc-names">{t.players.map((pid) => { const r = reg(pid); return <span key={pid}><b>{r.name}</b>{r.level && <LevelPill id={r.level} />}</span> })}</div>
              <div className="tc-pw" data-tip={`قدرت تیم ${fa(power(t))}`}><i style={{ width: `${(power(t) / maxP) * 100}%` }} /></div>
              <small className="tc-tag">{t.pair ? 'با هم ثبت‌نام کرده‌اند' : 'دستی چیده شده'}</small>
            </div>
          ))}
        </div>}
        {view === 'cards' && <div className="tm-grid">
          {ev.teams.map((t, i) => (
            <div key={t.id} className={`tm ${t.pair ? 'pair' : ''}`}>
              <div className="tm-h"><em>{fa(i + 1)}</em>{t.pair ? <span className="tm-tag">ثبت‌نامی</span> : <span className="tm-tag man">چیده‌شده</span>}
                <button className="icon-btn" onClick={() => split(t)} data-tip="جدا کردن؛ هر دو به «منتظر یار» برمی‌گردند" aria-label="جدا کردن"><Icon name="close" size={14} /></button></div>
              {t.players.map((pid) => { const r = reg(pid); return <div key={pid} className="tm-p"><b>{r.name}</b>{r.level && <LevelPill id={r.level} />}</div> })}
              <small>قدرت {fa(power(t))}</small>
            </div>
          ))}
        </div>}
        {!ev.teams.length && <Empty>هنوز تیمی نیست. از ستون «منتظر یار» دو نفر را انتخاب کنید یا «جفت کردن خودکار» را بزنید.</Empty>}
      </Card>
      <Card title={`منتظر یار ${wait.length ? `(${fa(wait.length)})` : ''}`} sub={wait.length ? 'دو نفر را انتخاب کنید و «ساخت تیم» را بزنید' : 'همه تیم دارند'}>
        <div className="wt-list">
          {wait.map((r) => (
            <button key={r.id} className={`wt ${sel.includes(r.id) ? 'on' : ''}`} onClick={() => pick(r.id)}>
              <i>{sel.includes(r.id) ? fa(sel.indexOf(r.id) + 1) : ''}</i>
              <span className="grow"><b>{r.name}</b><small>{r.pair ? 'یار ثبت‌نامی دارد' : r.waiting ? 'در اپ: منتظر یار' : r.source === 'app' ? 'از اپ' : 'حضوری'}</small></span>
              {r.level && <LevelPill id={r.level} />}
            </button>
          ))}
        </div>
        {!wait.length && <div className="all-good"><Icon name="check" size={20} /><b>کسی منتظر یار نیست</b></div>}
        {wait.length > 0 && <div className="row-btns wt-act">
          <button className="adm-btn primary sm" disabled={sel.length !== 2} onClick={make}><Icon name="plus" size={15} />ساخت تیم</button>
          <button className="adm-btn ghost sm" disabled={wait.length < 2} onClick={auto} data-tip="منتظرها بر اساس سطح جفت می‌شوند؛ قوی‌ترین با ضعیف‌ترین">جفت کردن خودکار</button>
        </div>}
        {wait.length % 2 === 1 && <p className="pt-warn">{fa(wait.length)} نفر منتظرند؛ یک نفر بی‌یار می‌ماند.</p>}
      </Card>
    </div>
  )
}

// ---------- گروه‌ها: هر تیم یک کارت کوچک است که در گروه‌ها چیده می‌شود؛ نتیجه‌ها ست به ست ----------
function ScoringPick({ ev, locked }) {
  const { adminEventSave } = useStore()
  const sc = scoringOf(ev)
  if (locked) return <span className="sc-now" data-tip="بعد از ثبت اولین نتیجه عوض نمی‌شود">🎾 {sc.name}<small>{sc.sub}</small></span>
  return <Seg value={ev.scoring || 'set6'} onChange={(scoring) => adminEventSave({ id: ev.id, scoring })} options={Object.fromEntries(Object.entries(SCORING).map(([k, v]) => [k, v.name]))} tips={Object.fromEntries(Object.entries(SCORING).map(([k, v]) => [k, v.sub]))} />
}

// ساخت گروه‌ها در یک نگاه: چند گروه، چند صعود، روش امتیاز؛ پیش‌نمایش زنده و یک دکمه
function GroupSetup({ ev }) {
  const { adminEventSet, toast } = useStore()
  const n = ev.teams.length
  const maxG = Math.max(1, Math.min(16, Math.floor(n / 2)))
  const [g, setG] = useState(() => Math.max(1, Math.min(maxG, Math.round(n / 4) || 1)))
  const per = Math.floor(n / g), extra = n % g
  const [adv, setAdv] = useState(2)
  const a = Math.max(1, Math.min(adv, per))
  const pl = plan(n, g, a)
  const build = () => {
    adminEventSet(ev.id, (e) => makeGroups(e, { groups: g, advance: a }))
    chime('success'); toast({ icon: '🏆', title: `${fa(g)} گروه ساخته شد`, body: 'تیم‌ها هم‌سطح پخش شدند؛ هر کارت را می‌توانید به گروه دیگری بکشید' })
  }
  return (
    <>
      <StepHead title="ساخت گروه‌ها" sub={`${fa(n)} تیم آماده است. تیم‌ها هم‌سطح پخش می‌شوند و بعد هر کدام را می‌توانید جابه‌جا کنید.`}>
        <NextBtn onClick={build}>ساخت {fa(g)} گروه</NextBtn>
      </StepHead>
      <Card>
        <div className="gsu">
          <div className="gsu-q"><span>چند گروه؟</span>
            <div className="num-step"><button onClick={() => setG(Math.max(1, g - 1))} disabled={g <= 1}><Icon name="minus" size={14} /></button><b>{fa(g)}</b><button onClick={() => setG(Math.min(maxG, g + 1))} disabled={g >= maxG}><Icon name="plus" size={14} /></button></div></div>
          <div className="gsu-q"><span>از هر گروه چند تیم بالا برود؟</span>
            <div className="gs-adv">{[1, 2, 3, 4].filter((x) => x <= per).map((x) => <button key={x} className={a === x ? 'on' : ''} onClick={() => setAdv(x)}>{fa(x)}</button>)}</div></div>
          <div className="gsu-q"><span>روش امتیاز هر بازی</span><ScoringPick ev={ev} /></div>
        </div>
        <div className="gsu-prev">
          {Array.from({ length: g }, (_, i) => (
            <div key={i} className="gsu-g"><span>{GROUP_IDS[i]}</span><small>{fa(per + (i < extra ? 1 : 0))} تیم</small>
              <div>{Array.from({ length: per + (i < extra ? 1 : 0) }, (_, k) => <i key={k} className={k < a ? 'up' : ''} />)}</div></div>
          ))}
        </div>
        <p className="gsu-sum">{fa(pl.games)} بازی گروهی؛ {fa(pl.q)} تیم صعود می‌کنند و حذفی از <b>{ROUND[pl.size] || `دور ${fa(pl.size)} تیمی`}</b> شروع می‌شود{pl.byes ? `؛ ${fa(pl.byes)} تیم مستقیم به دور بعد می‌رود` : ''}.</p>
      </Card>
    </>
  )
}

function GroupsStep({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const [pick, setPick] = useState(null) // تیمی که برای گذاشتن در گروه انتخاب شده (برای لمسی)
  const [over, setOver] = useState(null)
  const set = (fn) => adminEventSet(ev.id, fn)
  const score = (id, sets) => set((e) => setScore(e, id, sets))
  const anyScore = ev.matches.some((m) => setsOf(m).length)
  const ko = ev.matches.some((m) => m.stage === 'ko')
  const where = (tid) => ev.groups.find((x) => x.teams.includes(tid))?.id || null
  const pool = ev.teams.filter((t) => !where(t.id))
  const left = ev.matches.filter((m) => m.stage === 'group' && !scored(m)).length
  const advance = ev.setup?.advance || 2
  const risky = (gids) => ko || ev.matches.some((m) => m.stage === 'group' && gids.includes(m.group) && setsOf(m).length)
  const place = (tid, gid) => {
    const from = where(tid)
    setPick(null); setOver(null)
    if (from === gid) return
    if (risky([from, gid]) && !window.confirm('نتیجه‌های ثبت‌شده‌ی این گروه‌ها و جدول حذفی پاک می‌شود. ادامه؟')) return
    set((e) => moveTeam(e, tid, gid)); chime('tap')
  }
  const drag = (tid) => ({ draggable: true, onDragStart: (e) => { e.dataTransfer.setData('text/plain', tid); e.dataTransfer.effectAllowed = 'move' } })
  const zone = (gid) => ({
    onDragOver: (e) => { e.preventDefault(); setOver(gid || '') },
    onDragLeave: () => setOver((o) => (o === (gid || '') ? null : o)),
    onDrop: (e) => { e.preventDefault(); const tid = e.dataTransfer.getData('text/plain'); if (tid) place(tid, gid || null) },
  })
  const chip = (t, gid) => (
    <span key={t.id} className={`tchip ${pick === t.id ? 'on' : ''}`} {...drag(t.id)} onClick={(e) => { e.stopPropagation(); setPick(pick === t.id ? null : t.id) }} data-tip="بکشید روی گروه دیگر، یا بزنید و بعد روی گروه بزنید">
      <i>⋮⋮</i><b>{t.name}</b>
      {gid && <button className="tchip-x" onClick={(e) => { e.stopPropagation(); place(t.id, null) }} aria-label="بیرون از گروه">×</button>}
    </span>
  )
  if (ev.teams.length < 2) return <><StepHead title="گروه‌ها" sub="اول تیم‌ها را بسازید." ><NextBtn ghost onClick={() => go('teams')}>تیم‌ها</NextBtn></StepHead></>
  if (!ev.groups.length) return <GroupSetup ev={ev} />
  const buildKo = () => {
    if (pool.length && !window.confirm(`${fa(pool.length)} تیم بیرون از گروه‌هاست و به حذفی نمی‌رود. ادامه؟`)) return
    if (left && !window.confirm(`${fa(left)} بازی گروهی هنوز نتیجه ندارد. با جدول فعلی جدول حذفی ساخته شود؟`)) return
    if (ko && !window.confirm('جدول حذفی فعلی از نو ساخته شود؟')) return
    set((e) => makeKnockout({ ...e, matches: e.matches.filter((m) => m.stage === 'group') }))
    chime('success'); toast({ icon: '🏆', title: 'جدول حذفی ساخته شد', body: `${fa(advance)} تیم اول هر گروه` }); go('ko')
  }
  return (
    <div className="stack">
      <StepHead title="گروه‌ها و بازی‌ها" sub={left ? `نتیجه‌ی هر بازی را ست به ست بنویسید؛ ${fa(left)} بازی مانده. از هر گروه ${fa(advance)} تیم اول بالا می‌رود.` : `همه‌ی بازی‌ها نتیجه دارند؛ از هر گروه ${fa(advance)} تیم اول به حذفی می‌رود.`}>
        <ScoringPick ev={ev} locked={anyScore} />
        <button className="adm-btn ghost sm" disabled={ev.groups.length >= 16} onClick={() => set(addGroup)} data-tip="تا ۱۶ گروه"><Icon name="plus" size={14} />گروه</button>
        {ko ? <NextBtn ghost={!!left} onClick={() => go('ko')}>جدول حذفی</NextBtn> : <NextBtn ghost={!!left || pool.length > 0} onClick={buildKo}>ساخت جدول حذفی</NextBtn>}
      </StepHead>
      {pool.length > 0 && (
        <div className={`gs-pool ${over === '' ? 'over' : ''}`} {...zone(null)} onClick={() => pick && place(pick, null)}>
          <small>{fa(pool.length)} تیم بیرون از گروه‌ها؛ هر کارت را روی یک گروه بکشید</small>
          <div className="gs-chips">{pool.map((t) => chip(t, null))}</div>
          <button className="adm-btn ghost sm" onClick={(e) => { e.stopPropagation(); set(fillGroups); chime('tap') }}>پخش خودکار</button>
        </div>
      )}
      <div className="gs-grid">
        {ev.groups.map((gr) => {
          const rows = standings(ev, gr.id)
          const ms = ev.matches.filter((m) => m.stage === 'group' && m.group === gr.id)
          return (
            <section key={gr.id} className={`gs-g ${over === gr.id ? 'over' : ''} ${pick && where(pick) !== gr.id ? 'can' : ''}`} {...zone(gr.id)} onClick={() => pick && place(pick, gr.id)}>
              <header><span>{gr.id}</span><b>گروه {gr.id}</b><small>{fa(ms.filter(scored).length)} از {fa(ms.length)} بازی</small>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); if (!gr.teams.length || window.confirm(`گروه ${gr.id} حذف شود؟ تیم‌هایش بیرون می‌آیند.`)) set((x) => dropGroup(x, gr.id)) }} aria-label="حذف گروه" data-tip="حذف گروه"><Icon name="close" size={14} /></button></header>
              {rows.length > 0 && <table className="gs-tbl"><thead><tr><th>#</th><th>تیم</th><th>بازی</th><th>ست</th><th>گیم</th><th>امتیاز</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={r.id} className={i < advance ? 'up' : ''}><td>{fa(i + 1)}</td><td><span className="gs-tn" {...drag(r.id)} onClick={(e) => { e.stopPropagation(); setPick(pick === r.id ? null : r.id) }} data-tip="بکشید روی گروه دیگر">{pick === r.id ? '↔ ' : ''}{r.name}</span></td><td>{fa(r.p)}</td><td dir="ltr">{r.sf - r.sa > 0 ? '+' : ''}{fa(r.sf - r.sa)}</td><td dir="ltr">{r.gf - r.ga > 0 ? '+' : ''}{fa(r.gf - r.ga)}</td><td><b>{fa(r.w)}</b></td></tr>)}</tbody></table>}
              {!gr.teams.length && <em className="gs-drop">تیم را اینجا رها کنید</em>}
              {ms.length > 0 && <div className="gs-ms" onClick={(e) => e.stopPropagation()}>{ms.map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={score} />)}</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ---------- جدول حذفی: پوستر با نتیجه‌ی هر خانه و ثبت نتیجه‌ی هر دور ----------
function KoStep({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const [poster, setPoster] = useState(false)
  const score = (id, sets) => adminEventSet(ev.id, (e) => setScore(e, id, sets))
  const built = ev.matches.some((m) => m.stage === 'ko')
  const p = podium(ev)
  const rounds = koRounds(ev)
  const build = () => { adminEventSet(ev.id, (e) => makeKnockout({ ...e, groups: [], matches: [] })); chime('success'); toast({ icon: '🏆', title: 'جدول حذفی ساخته شد' }) }
  const open = ev.matches.filter((m) => m.stage === 'ko' && m.b != null && !scored(m)).length
  return (
    <div className="stack">
      <StepHead title="جدول حذفی" sub={!built ? (ev.format === 'knockout' ? `${fa(ev.teams.length)} تیم آماده است؛ تیم‌های قوی‌تر سید می‌شوند تا دیرتر به هم برسند.` : 'بعد از بازی‌های گروهی، از تیم‌های صعودکرده ساخته می‌شود.') : p ? 'فینال انجام شد و قهرمان مشخص است.' : `نتیجه‌ی هر بازی را بنویسید؛ برنده خودکار به دور بعد می‌رود. ${fa(open)} بازی مانده.`}>
        {built && <button className={`adm-btn ghost sm ${poster ? 'on' : ''}`} onClick={() => setPoster(!poster)} data-tip="نمای پوستر، قابل پر کردن دستی"><Icon name="grid" size={14} />{poster ? 'ثبت نتیجه' : 'نمای پوستر'}</button>}
        {!built && (ev.format === 'knockout'
          ? (ev.teams.length > 1 && <><ScoringPick ev={ev} /><NextBtn onClick={build}>ساخت جدول حذفی</NextBtn></>)
          : <NextBtn ghost onClick={() => go('groups')}>گروه‌ها</NextBtn>)}
        {p && <NextBtn onClick={() => go('champ')}>قهرمان</NextBtn>}
      </StepHead>
      {(!built || poster) && <Card><EventBoard ev={ev} /></Card>}
      {built && !poster && (
        <div className="ko-rounds">
          {rounds.map((r) => (
            <div key={r} className={`ko-r ${r === 2 ? 'final' : ''}`}>
              <h5>{ROUND[r] || `دور ${fa(r)} تیمی`}</h5>
              <div className="ko-ms">{ev.matches.filter((m) => m.stage === 'ko' && m.round === r).sort((a, b) => a.idx - b.idx).map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={score} />)}</div>
            </div>
          ))}
          <div className="ko-r champ"><h5>قهرمان</h5><div className={`ko-champ ${p ? 'on' : ''}`}><i>🏆</i><b>{p ? teamName(ev, p.first) : 'بعد از فینال'}</b></div></div>
        </div>
      )}
    </div>
  )
}

// ---------- قهرمان: صفحه‌ی پایانی، و اینکه در اپ نمایش داده شود یا نه ----------
function ChampStep({ ev, go, onDone, locked }) {
  const { adminEventSave, toast } = useStore()
  const p = podium(ev)
  const on = ev.champPub !== false, tables = showsResults(ev)
  const set = (patch, msg) => { adminEventSave({ id: ev.id, ...patch }); chime('tap'); toast(msg) }
  if (!p) return <StepHead title="قهرمان" sub="بعد از ثبت نتیجه‌ی فینال، قهرمان‌ها اینجا مشخص می‌شوند.">{go && <NextBtn ghost onClick={() => go('ko')}>جدول حذفی</NextBtn>}</StepHead>
  return (
    <div className="stack">
      {!locked && <StepHead title="قهرمان" sub={ev.status === 'done' ? 'مسابقه بسته شد؛ به «برگزارشده‌ها» رفته است.' : 'همه‌ی بازی‌ها انجام شد. مسابقه را ببندید تا به «برگزارشده‌ها» برود.'}>
        {ev.status !== 'done' && <NextBtn onClick={onDone}>پایان مسابقه</NextBtn>}
      </StepHead>}
      <div className="champ-page">
        <div className="chp-card">
          <span className="chp-tag">🏆 {ev.title}، {dayLabel(ev.date)} {jDateFa(ev.date)}</span>
          <div className="chp-pod">
            <div className="chp-p second"><i>🥈</i><b>{teamName(ev, p.second)}</b><small>دوم</small></div>
            <div className="chp-p first"><i>🏆</i><b>{teamName(ev, p.first)}</b><small>قهرمان</small></div>
            <div className="chp-p third"><i>🥉</i><b>{p.third.map((t) => teamName(ev, t)).join('، ') || '—'}</b><small>سوم</small></div>
          </div>
          <small className="chp-prize">جایزه: {ev.prize}</small>
        </div>
        <div className="chp-opts">
          <h4>نمایش در اپ</h4>
          <label className="chp-opt"><span><b>صفحه‌ی قهرمان</b><small>کارت قهرمان‌ها در صفحه‌ی اول اپ و صفحه‌ی همین مسابقه</small></span>
            <button className={`tgl ${on ? 'on' : ''}`} onClick={() => set({ champPub: !on }, { icon: on ? '🙈' : '🏆', title: on ? 'صفحه‌ی قهرمان از اپ برداشته شد' : 'صفحه‌ی قهرمان در اپ نمایش داده می‌شود' })} aria-pressed={on}><i /></button></label>
          <label className="chp-opt"><span><b>جدول‌ها و نتیجه‌ها</b><small>تیم‌ها، گروه‌ها و جدول حذفی برای بازیکن‌ها</small></span>
            <button className={`tgl ${tables ? 'on' : ''}`} onClick={() => set({ showResults: !tables }, { icon: tables ? '🙈' : '👁', title: tables ? 'جدول‌ها در اپ پنهان شد' : 'جدول‌ها در اپ نمایش داده می‌شود' })} aria-pressed={tables}><i /></button></label>
          <p className="chp-note">{on ? 'بازیکن‌ها همین کارت را در صفحه‌ی اول اپ می‌بینند.' : 'الان در اپ نشان داده نمی‌شود.'}</p>
        </div>
      </div>
    </div>
  )
}

function CafeTab({ ev, orders }) {
  const { user } = useStore()
  const top = {}
  orders.forEach((o) => o.items.forEach((x) => { top[x.name] = (top[x.name] || 0) + x.qty }))
  return (
    <div className="two wide-first">
      <Card title="خریدهای کافه در روز مسابقه" sub={`${dayLabel(ev.date)} ${jDateFa(ev.date)}، کل روز؛ جدا از فروش روزهای عادی`}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>سفارش</th><th>مشتری</th><th>اقلام</th><th>مبلغ</th></tr></thead>
          <tbody>{orders.map((o) => <tr key={o.id}><td><b dir="ltr">{o.id}</b><small>{time.format(o.at)}</small></td><td>{who(o.by, user)}</td><td><small>{o.items.map((x) => `${fa(x.qty)}× ${x.name}`).join('، ')}</small></td><td className="num">{toman(o.total)}</td></tr>)}</tbody>
        </table></div>
        {!orders.length && <Empty>در روز این مسابقه خریدی از کافه ثبت نشده.</Empty>}
      </Card>
      <Card title="پرفروش‌های روز مسابقه">
        {Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => <div key={n} className="row-between ev-top"><span>{n}</span><b>{fa(c)}</b></div>)}
        {!orders.length && <Empty>—</Empty>}
      </Card>
    </div>
  )
}

// ---------- فرم تعریف مسابقه ----------
// تقویم شمسی: هر روزی قابل انتخاب است (جمعه پررنگ‌تر)؛ روزهایی که مسابقه دارند نقطه می‌خورند
const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
function JCal({ value, onChange, events }) {
  const t = todayKey()
  const [mk, setMk] = useState(() => jMonthKey(value || t))
  const days = useMemo(() => jMonthDays(mk), [mk])
  const lead = (fromKey(days[0]).getDay() + 1) % 7
  const go = (dir) => setMk(jMonthKey(dir > 0 ? addDays(days[days.length - 1], 1) : addDays(days[0], -1)))
  return (
    <div className="jcal">
      <header>
        <button type="button" onClick={() => go(-1)} disabled={mk <= jMonthKey(t)} aria-label="ماه قبل"><Icon name="back" size={16} /></button>
        <b>{jMonthLabel(mk)}</b>
        <button type="button" onClick={() => go(1)} aria-label="ماه بعد"><Icon name="fwd" size={16} /></button>
      </header>
      <div className="jcal-g">
        {WD.map((w, i) => <small key={w} className={i === 6 ? 'fri' : ''}>{w}</small>)}
        {Array.from({ length: lead }, (_, i) => <i key={'x' + i} />)}
        {days.map((k) => {
          const past = fromKey(k) < fromKey(t) && k !== value
          const ev = events.find((x) => x.date === k)
          return (
            <button key={k} type="button" disabled={past} onClick={() => onChange(k)} data-tip={ev ? `«${ev.title}» در این روز` : undefined}
              className={[value === k && 'on', fromKey(k).getDay() === 5 && 'fri', k === t && 'today', ev && 'has'].filter(Boolean).join(' ')}>{fa(jParts(k).d)}</button>
          )
        })}
      </div>
    </div>
  )
}
function nextFriday() { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

// فرم مسابقه در پنج بخش مرتب؛ دکمه‌ی ذخیره همیشه پایین فرم دیده می‌شود
const KINDS = { friday: ['☀️', 'مسابقه‌ی آدینه', 'دوستانه؛ جمعه یا هر روز دیگر'], official: ['🎉', 'ایونت ویبورا', 'دورهمی ورزشی؛ همان روال آدینه'] }
const KIND_DEF = {
  friday: { title: 'آدینه‌ی کوادرا', desc: 'تیم‌های دونفره، گروهی + حذفی', start: 9, dur: 3, cap: 16, fee: 750000, prize: 'راکت + توپ', levels: ['B', 'C+', 'C'], scoring: 'set6' },
  official: { title: 'ایونت ویبورا', desc: 'تیم‌های دونفره، گروهی + حذفی', start: 17, dur: 4, cap: 24, fee: 900000, prize: 'راکت + کارت هدیه‌ی کافه', levels: ['B', 'C+', 'C'], scoring: 'set6', img: VIBORA_IMG },
}
const Sec = ({ n, title, sub, children }) => (
  <section className="efs"><header><i>{fa(n)}</i><div><b>{title}</b>{sub && <small>{sub}</small>}</div></header><div className="efs-b">{children}</div></section>
)

function EventForm({ ev, onClose }) {
  const { club, adminEventSave, toast } = useStore()
  const { open, close } = hoursOf(club)
  const [f, setF] = useState(() => ev || { kind: 'friday', img: EV_IMG[1], ...KIND_DEF.friday, format: 'groups', date: nextFriday(), courts: [1, 2, 3, 4], status: 'open', note: '' })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const tog = (k, v) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v].sort() })
  const same = eventAt(club.events.filter((e) => e.id !== ev?.id), fromKey(f.date).getTime() + f.start * 36e5)
  const busy = clashes(club.bookings, { ...f, id: ev?.id }).filter((b) => !b.event)
  const custom = f.img && !EV_IMG.includes(f.img)
  const ok = f.title.trim() && f.date && f.cap > 1 && f.courts.length && f.levels.length && !(f.ageMin && f.ageMax && f.ageMax < f.ageMin)
  const save = () => {
    const s = adminEventSave({ ...f, title: f.title.trim(), id: ev?.id })
    chime('success'); toast({ icon: '🏆', title: ev ? 'مسابقه به‌روز شد' : 'مسابقه ساخته شد', body: f.status === 'draft' ? 'پیش‌نویس؛ هنوز در اپ دیده نمی‌شود' : `در اپ دیده می‌شود؛ ${courtsText(f.courts)} در تقویم رزرو شد` })
    onClose(s.id)
  }
  return (
    <div className="ef">
      <Sec n={1} title="چه مسابقه‌ای؟">
        <div className="ef-kinds">{Object.entries(KINDS).map(([k, [ic, n, d]]) => (
          <button key={k} type="button" className={f.kind === k ? 'on' : ''} onClick={() => set({ kind: k, ...(ev ? {} : { img: EV_IMG[1], ...KIND_DEF[k] }) })}><i>{ic}</i><b>{n}</b><small>{d}</small></button>
        ))}</div>
        <Field label="اسم مسابقه"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً آدینه‌ی بانوان" /></Field>
        <Field label="توضیح کوتاه" hint="زیر اسم در اپ"><input value={f.desc} onChange={(e) => set({ desc: e.target.value })} /></Field>
      </Sec>

      <Sec n={2} title="کی و کجا؟" sub="همین ساعت‌ها روی زمین‌های انتخابی برای مسابقه بسته می‌شود">
        <div className="ef-when">
          <JCal value={f.date} onChange={(date) => set({ date })} events={club.events.filter((x) => x.id !== ev?.id && x.status !== 'cancelled')} />
          <div className="ef-when-side">
            <div className="ef-picked"><small>روز انتخاب‌شده</small><b>{dayLabel(f.date)}</b><span>{jDateFa(f.date)}</span></div>
        <div className="form-2">
          <Field label="از ساعت"><select value={f.start} onChange={(e) => { const start = +e.target.value; set({ start, dur: Math.min(f.dur, close - start) || 1 }) }}>{Array.from({ length: close - open }, (_, i) => open + i).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
          <Field label="تا ساعت"><select value={f.start + f.dur} onChange={(e) => set({ dur: +e.target.value - f.start })}>{Array.from({ length: Math.max(1, close - f.start) }, (_, i) => f.start + i + 1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
        </div>
          </div>
        </div>
        <div className="ef-courts">
          {[1, 2, 3, 4].map((c) => <button key={c} type="button" className={f.courts.includes(c) ? 'on' : ''} onClick={() => tog('courts', c)}><i />{courtById(c).name}</button>)}
          <button type="button" className="ef-all" onClick={() => set({ courts: f.courts.length === 4 ? [] : [1, 2, 3, 4] })}>{f.courts.length === 4 ? 'هیچ‌کدام' : 'همه'}</button>
        </div>
        <p className="ef-sum"><Icon name="cal" size={15} />{f.courts.length ? `${dayLabel(f.date)} ${jDateFa(f.date)}، ${hourLabel(f.start)} تا ${hourLabel(f.start + f.dur)}، ${courtsText(f.courts)}` : 'حداقل یک زمین انتخاب کنید.'}</p>
        {busy.length > 0 && <p className="pt-warn">{fa(busy.length)} رزرو در همین ساعت هست ({busy.slice(0, 3).map((b) => `${courtById(b.court).name} ${hourLabel(b.start)}`).join('، ')}{busy.length > 3 ? '، …' : ''})؛ بعد از ذخیره در تقویم جابه‌جا یا لغوشان کنید.</p>}
        {same && <p className="pt-warn">در همین روز «{same.title}» هم هست.</p>}
      </Sec>

      <Sec n={3} title="چه کسانی؟">
        <Field label="سطح‌های مجاز" hint="در اپ فقط اعضای همین سطح‌ها ثبت‌نام می‌کنند؛ یارِ مهمان هم باید یکی از همین سطح‌ها باشد"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={f.levels.includes(l.id) ? 'on' : ''} onClick={() => tog('levels', l.id)}>{l.id}</button>)}</div></Field>
        <div className="form-3 ef-3">
          <Field label="جنسیت" hint={f.gender === 'f' ? 'فقط بانوان (و یار مهمان خانم)' : f.gender === 'm' ? 'فقط آقایان' : 'برای همه'}><Seg value={f.gender || 'all'} onChange={(gender) => set({ gender })} options={{ all: 'همه', f: 'بانوان', m: 'آقایان' }} /></Field>
          <Field label="حداقل سن" hint="خالی یعنی بدون محدودیت"><input inputMode="numeric" value={f.ageMin || ''} placeholder="مثلاً ۱۸" onChange={(e) => set({ ageMin: +e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').slice(0, 2) || null })} /></Field>
          <Field label="حداکثر سن" hint={f.ageMin && f.ageMax && f.ageMax < f.ageMin ? 'از حداقل کمتر است' : 'مثلاً ۱۷ برای نوجوانان'}><input inputMode="numeric" value={f.ageMax || ''} placeholder="مثلاً ۴۰" onChange={(e) => set({ ageMax: +e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').slice(0, 2) || null })} /></Field>
        </div>
        <div className="form-3 ef-3">
          <Field label="ظرفیت" hint={`${fa(Math.floor(f.cap / 2))} تیم دونفره`}><div className="num-step wide"><button type="button" onClick={() => set({ cap: Math.max(4, f.cap - 2) })}><Icon name="minus" size={14} /></button><b>{fa(f.cap)} نفر</b><button type="button" onClick={() => set({ cap: Math.min(64, f.cap + 2) })}><Icon name="plus" size={14} /></button></div></Field>
          <Field label="ورودی هر نفر" hint={`هر تیم ${toman(f.fee * 2)}`}><Money value={f.fee} onChange={(fee) => set({ fee })} /></Field>
          <Field label="جایزه" hint="مثلاً راکت + توپ"><input value={f.prize} onChange={(e) => set({ prize: e.target.value })} /></Field>
        </div>
      </Sec>

      <Sec n={4} title="قالب بازی">
        <Field label="روش برگزاری"><Seg value={f.format} onChange={(format) => set({ format })} options={EV_FORMAT} tips={{ groups: 'اول دوره‌ای در گروه‌ها، بعد حذفی', knockout: 'از اول حذفی' }} /></Field>
        <Field label="امتیاز هر بازی" hint={SCORING[f.scoring || 'set6'].sub}><Seg value={f.scoring || 'set6'} onChange={(scoring) => set({ scoring })} options={Object.fromEntries(Object.entries(SCORING).map(([k, v]) => [k, v.name]))} /></Field>
      </Sec>

      <Sec n={5} title="عکس و انتشار">
        <div className="ef-imgs">
          {EV_IMG.map((s) => <button key={s} type="button" className={f.img === s ? 'on' : ''} style={{ backgroundImage: `url(${s})` }} onClick={() => set({ img: s })} aria-label="عکس آماده" />)}
          {custom && <button type="button" className="on" style={{ backgroundImage: `url(${f.img})` }} aria-label="عکس شما" />}
        </div>
        <ImageUpload value={custom ? f.img : null} onChange={(img) => set({ img: img || EV_IMG[0] })} hint="یا عکس خودتان؛ افقی" />
        <Field label="یادداشت برای بازیکن‌ها" hint="اختیاری؛ مثلاً «۱۵ دقیقه زودتر بیایید»"><input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
        <Field label="انتشار" hint={STATUS_HELP[f.status][1]}><Seg value={f.status} onChange={(status) => set({ status })} options={{ draft: 'پیش‌نویس', open: 'ثبت‌نام باز', closed: 'ثبت‌نام بسته' }} /></Field>
      </Sec>

      <div className="ef-foot">
        <span><b>{f.title || 'بی‌نام'}</b><small>{dayLabel(f.date)} {jDateFa(f.date)}، {fa(f.cap)} نفر، {toman(f.fee)} هر نفر</small></span>
        <button className="adm-btn primary" disabled={!ok} onClick={save}>{ev ? 'ذخیره‌ی تغییرات' : 'ساخت مسابقه'}</button>
      </div>
    </div>
  )
}
