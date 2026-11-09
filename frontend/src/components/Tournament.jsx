// نمایش مسابقه برای اپ و پنل مدیر: سکوی قهرمانی، جدول گروه‌ها، جدول حذفی و تیم‌ها
// اگر onScore داده شود (پنل مدیر)، نتیجه‌ی هر بازی قابل ثبت است.
import { useState } from 'react'
import { courtById, fa, levelById } from '../data'
import { ROUND, judge, koRounds, podium, scored, scoringOf, setsOf, standings, teamName, teamOf, winnerOf } from '../events'

export function Podium({ ev }) {
  const p = podium(ev)
  if (!p) return null
  return (
    <div className="trn-podium">
      <div className="tp second"><i>🥈</i><b>{teamName(ev, p.second)}</b><small>نایب‌قهرمان</small></div>
      <div className="tp first"><i>🏆</i><b>{teamName(ev, p.first)}</b><small>قهرمان</small></div>
      <div className="tp third"><i>🥉</i><b>{p.third.map((t) => teamName(ev, t)).join('، ') || '—'}</b><small>سوم</small></div>
    </div>
  )
}

export function Teams({ ev, onPick, picked }) {
  return (
    <div className="trn-teams">
      {ev.teams.map((t, i) => (
        <div key={t.id} className="trn-team">
          <em>{fa(i + 1)}</em>
          <div className="grow">{t.players.map((p) => {
            const r = ev.regs.find((x) => x.id === p)
            const Tag = onPick ? 'button' : 'span'
            return <Tag key={p} type={onPick ? 'button' : undefined} className={`trn-pl ${picked === p ? 'on' : ''}`} onClick={onPick && (() => onPick(p))}>{r?.name || '—'}{r?.level && <small style={{ color: levelById(r.level).color }}>{r.level}</small>}</Tag>
          })}{t.players.length < 2 && <span className="trn-pl miss">بدون یار</span>}</div>
        </div>
      ))}
    </div>
  )
}

// عدد فارسی یا انگلیسی، حداکثر دو رقم
const digits = (v) => v.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g, '').slice(0, 2)

// هر بازی ست به ست: هر تیم برای هر ست یک خانه‌ی گیم دارد؛ وقتی نتیجه طبق قانون کامل شد ذخیره می‌شود
export function Match({ ev, m, onScore }) {
  const sc = scoringOf(ev)
  const w = winnerOf(m)
  const saved = setsOf(m)
  const [raw, setD] = useState(() => Array.from({ length: sc.sets }, (_, i) => (saved[i] ? [String(saved[i][0]), String(saved[i][1])] : ['', ''])))
  // اگر روش امتیاز عوض شود تعداد ست‌ها فرق می‌کند؛ ردیف‌ها همیشه به اندازه‌ی روش فعلی‌اند
  const d = Array.from({ length: sc.sets }, (_, i) => raw[i] || ['', ''])
  const full = (rows) => rows.filter(([x, y]) => x !== '' && y !== '').map(([x, y]) => [+x, +y])
  const r = judge(ev, full(d))
  const put = (i, t, v) => {
    const n = d.map((x, j) => (j === i ? (t ? [x[0], digits(v)] : [digits(v), x[1]]) : x))
    setD(n)
    const sets = full(n), res = judge(ev, sets)
    if (!sets.length) { if (saved.length) onScore(m.id, null) } else if (res.done || m.sa != null) onScore(m.id, sets)
  }
  // ست سوم فقط وقتی لازم است که دو ست اول یکی‌یکی شده باشد
  const n = onScore ? (sc.sets === 1 ? 1 : d[2]?.some((x) => x !== '') || (r.a === 1 && r.b === 1) ? 3 : 2) : saved.length
  const side = (t) => {
    const id = t ? m.b : m.a
    return (
      <div className={`trn-side ${w && w === id ? 'win' : ''} ${!id ? 'tbd' : ''}`}>
        <span>{id ? teamName(ev, id) : 'منتظر نتیجه'}</span>
        <div className="trn-sets">{Array.from({ length: n }, (_, i) => (onScore
          ? <input key={i} className={`trn-in ${sc.stb && i === 2 ? 'stb' : ''}`} inputMode="numeric" value={d[i][t] && fa(d[i][t])} onChange={(e) => put(i, t, e.target.value)} aria-label={`${sc.stb && i === 2 ? 'سوپرتای‌بریک' : `ست ${i + 1}`} ${id ? teamName(ev, id) : ''}`} />
          : <b key={i} className={saved[i][t] > saved[i][1 - t] ? 'w' : ''}>{fa(saved[i][t])}</b>))}</div>
      </div>
    )
  }
  if (m.b == null) return <div className="trn-match bye"><div className="trn-side"><span>{teamName(ev, m.a)}</span></div><small>استراحت؛ مستقیم به دور بعد</small></div>
  return (
    <div className={`trn-match ${scored(m) ? 'done' : ''} ${onScore ? 'edit' : ''}`}>
      {m.court && <small className="trn-court">{courtById(m.court)?.name}</small>}
      {onScore && sc.sets > 1 && <div className="trn-sh">{Array.from({ length: n }, (_, i) => <small key={i}>{sc.stb && i === 2 ? 'تای‌بریک' : `ست ${fa(i + 1)}`}</small>)}</div>}
      <div className="trn-pair">{side(0)}{side(1)}</div>
      {onScore && r.why && <small className="trn-tie">{r.why}</small>}
    </div>
  )
}

// نتیجه‌ی یک بازی برای اپ: دو ردیف، کنار هر تیم گیم‌های هر ست؛ برنده پررنگ
function MatchLine({ ev, m, final }) {
  const sets = setsOf(m), w = winnerOf(m)
  if (m.b == null) return <div className="ml bye"><b>{teamName(ev, m.a)}</b><small>استراحت؛ مستقیم به دور بعد</small></div>
  const side = (id, t) => (
    <div className={`ml-t ${w && w === id ? 'win' : ''} ${!id ? 'tbd' : ''}`}>
      <span>{id ? teamName(ev, id) : 'منتظر نتیجه'}</span>
      <div className="ml-s">{sets.length ? sets.map((s, i) => <b key={i} className={s[t] > s[1 - t] ? 'w' : ''}>{fa(s[t])}</b>) : <b className="none">–</b>}</div>
    </div>
  )
  return <div className={`ml ${scored(m) ? 'done' : ''} ${final ? 'final' : ''}`}>{side(m.a, 0)}{side(m.b, 1)}{m.court && <small className="ml-c">{courtById(m.court)?.name}</small>}</div>
}

// گروه‌ها در اپ: جدول ساده و بازی‌های هر گروه
export function Groups({ ev }) {
  const [open, setOpen] = useState(null)
  if (!ev.groups.length) return null
  const adv = ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)
  return (
    <div className="ag">
      {ev.groups.map((g) => {
        const ms = ev.matches.filter((m) => m.stage === 'group' && m.group === g.id)
        return (
          <section key={g.id} className="ag-g">
            <header><span>{g.id}</span><b>گروه {g.id}</b><small>{fa(adv)} تیم اول صعود می‌کند</small></header>
            <div className="ag-h"><em>#</em><b>تیم</b><span>برد</span><span>ست</span><strong>امتیاز</strong></div>
            {standings(ev, g.id).map((r, i) => (
              <div key={r.id} className={`ag-r ${i < adv ? 'up' : ''}`}>
                <em>{fa(i + 1)}</em><b>{r.name}</b><span>{fa(r.w)}–{fa(r.l)}</span><span dir="ltr">{r.sf - r.sa > 0 ? '+' : ''}{fa(r.sf - r.sa)}</span><strong>{fa(r.w)}</strong>
              </div>
            ))}
            {ms.length > 0 && <button type="button" className="ag-more" onClick={() => setOpen(open === g.id ? null : g.id)}>{open === g.id ? 'بستن بازی‌ها' : `${fa(ms.length)} بازی این گروه`}</button>}
            {open === g.id && <div className="ag-ms">{ms.map((m) => <MatchLine key={m.id} ev={ev} m={m} />)}</div>}
          </section>
        )
      })}
    </div>
  )
}

// جدول حذفی در اپ: دورها زیر هم، از اولین دور تا فینال و قهرمان
export function Bracket({ ev }) {
  const rounds = koRounds(ev)
  if (!rounds.length) return null
  const p = podium(ev)
  return (
    <div className="kb">
      {rounds.map((r) => {
        const ms = ev.matches.filter((m) => m.stage === 'ko' && m.round === r).sort((x, y) => x.idx - y.idx)
        return (
          <section key={r} className={`kb-r ${r === 2 ? 'final' : ''}`}>
            <h4><i />{ROUND[r] || `دور ${fa(r)} تیمی`}<small>{fa(ms.filter((m) => winnerOf(m)).length)} از {fa(ms.length)} بازی</small></h4>
            <div className="kb-ms">{ms.map((m) => <MatchLine key={m.id} ev={ev} m={m} final={r === 2} />)}</div>
          </section>
        )
      })}
      <section className="kb-r champ"><h4><i />قهرمان</h4>
        <div className={`kb-champ ${p ? 'on' : ''}`}><span>🏆</span><b>{p ? teamName(ev, p.first) : 'بعد از فینال مشخص می‌شود'}</b>{p && <small>نایب‌قهرمان: {teamName(ev, p.second)}</small>}</div>
      </section>
    </div>
  )
}

export const champion = (ev) => { const p = podium(ev); return p ? teamOf(ev, p.first) : null }
