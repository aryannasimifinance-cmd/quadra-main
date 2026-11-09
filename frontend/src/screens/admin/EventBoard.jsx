// جدول نمایشی مسابقه: براکت دوطرفه که در وسط به فینال می‌رسد، سکوی قهرمانی و گروه‌ها در پایین.
// هر خانه از داده‌ی واقعی مسابقه پر می‌شود و مدیر می‌تواند هر خانه را دستی پر یا عوض کند (ev.board).
import { useEffect, useState } from 'react'
import { dayLabel, fa, hourLabel } from '../../data'
import { GROUP_IDS, ROUND, podium, setsOf, standings, teamName, winnerOf } from '../../events'
import { jDateFa } from '../../jalali'
import { useStore } from '../../store'
import { Icon } from '../../components/ui'

const SIZES = [4, 8, 16, 32]
const ROW = 46 // فاصله‌ی خانه‌های دور اول در هر طرف (px)
const MAX_G = 16, DEF_G = 8, MAX_ROWS = 8

// خانه‌ی قابل ویرایش: تا وقتی فوکوس دارد محلی است و با خروج ذخیره می‌شود؛ خالی کردن یعنی برگشت به مقدار خودکار
function Cell({ value, auto = '', edit, onSave, ph, className = '', list, style }) {
  const shown = value ?? auto
  const [v, setV] = useState(shown)
  useEffect(() => setV(shown), [shown])
  if (!edit) return <span className={`pb-cell ${className} ${shown ? '' : 'empty'}`} style={style}>{shown || '—'}</span>
  const commit = () => { const t = v.trim(); if (t !== shown) onSave(t === auto || !t ? null : t) }
  return <input className={`pb-cell ${className} ${value != null ? 'man' : ''}`} style={style} value={v} placeholder={ph} list={list} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
}

export function EventBoard({ ev, locked }) {
  const { adminEventSet, toast } = useStore()
  const bd = ev.board || {}
  const edit = !locked
  const save = (fn) => adminEventSet(ev.id, (e) => ({ ...e, board: fn(e.board || {}) }))
  const put = (k, key, val) => save((b) => { const m = { ...(b[k] || {}) }; if (val == null) delete m[key]; else m[key] = val; return { ...b, [k]: m } })
  const ko = ev.matches.filter((m) => m.stage === 'ko')
  const koSize = ko.length ? Math.max(...ko.map((m) => m.round)) : 0
  const size = bd.size || (koSize >= 4 ? Math.min(32, koSize) : 16)
  const list = `pb-teams-${ev.id}`
  const p = podium(ev)

  // نام خودکار هر خانه: بازیکن‌های دور R به ترتیب [بازی۱.a، بازی۱.b، بازی۲.a …]
  const matchOf = (R, i) => ko.find((m) => m.round === R && m.idx === i)
  const autoOf = (R, j) => { const m = matchOf(R, j >> 1); const id = m && (j % 2 ? m.b : m.a); return id ? teamName(ev, id) : '' }
  // نتیجه‌ی همان بازی برای این تیم، ست به ست (مثلاً «۶ ۷»)
  const scoreOf = (R, j) => { const m = matchOf(R, j >> 1); const st = m && m.b != null ? setsOf(m) : []; return st.length ? st.map((x) => fa(x[j % 2])).join(' ') : null }
  // نتیجه‌ی ریز بالای خانه از دید همین تیم، مثل «۶–۳»
  const resOf = (R, j) => { const m = matchOf(R, j >> 1); const st = m && m.b != null ? setsOf(m) : []; return st.length ? st.map((x) => fa(x[j % 2]) + '–' + fa(x[1 - (j % 2)])).join('  ') : null }
  const wonOf = (R, j) => { const m = matchOf(R, j >> 1); const id = m && (j % 2 ? m.b : m.a); return !!id && winnerOf(m) === id && m.b != null }

  // هندسه: هر طرف C ستون (از دور اول تا نیمه‌نهایی)، وسط فینال؛ طرف راست نیمه‌ی اول جدول است
  const C = Math.log2(size) - 1
  const U = 2 * C + 1.6
  const H = Math.max(220, (size / 2) * ROW)
  const colX = (side, c) => (side ? (c + 0.5) / U : 1 - (c + 0.5) / U)
  const colW = 0.86 / U
  const yOf = (c, k) => ((k + 0.5) * H) / ((size / 2) >> c)
  const finY = [H / 2 - 36, H / 2 + 36]
  const lines = []
  for (let side = 0; side < 2; side++) {
    const dir = side ? 1 : -1
    for (let c = 0; c < C; c++) {
      const n = (size / 2) >> c
      for (let k = 0; k < n; k += 2) {
        const x = colX(side, c) + (dir * colW) / 2
        const nx = c + 1 < C ? colX(side, c + 1) - (dir * colW) / 2 : 0.5 - (dir * 1.3) / U / 2
        const xm = (x + nx) / 2
        const y1 = yOf(c, k), y2 = yOf(c, k + 1), yp = c + 1 < C ? (y1 + y2) / 2 : finY[side]
        lines.push(`M${x * 1000} ${y1}H${xm * 1000}M${x * 1000} ${y2}H${xm * 1000}M${xm * 1000} ${Math.min(y1, yp)}V${Math.max(y2, yp)}M${xm * 1000} ${yp}H${nx * 1000}`)
      }
    }
  }
  const slots = [], labels = []
  for (let side = 0; side < 2; side++) {
    for (let c = 0; c < C; c++) {
      const R = size >> c, n = R / 2
      for (let k = 0; k < n; k++) {
        const j = side * n + k, key = `${R}-${j}`, sc = scoreOf(R, j)
        slots.push(
          <div key={key} className={`pb-slot ${wonOf(R, j) ? 'won' : ''}`} style={{ left: `${colX(side, c) * 100}%`, top: yOf(c, k), width: `${colW * 100}%` }}>
            {resOf(R, j) && <small className="pb-res">{resOf(R, j)}</small>}
            <Cell value={bd.ko?.[key]} auto={autoOf(R, j)} edit={edit} onSave={(v) => put('ko', key, v)} ph="نام تیم" list={list} />
            {sc != null && bd.ko?.[key] == null && <b className="pb-sc">{sc}</b>}
          </div>,
        )
        if (k % 2 === 0) {
          const mk = `${R}-${j >> 1}`, val = bd.at?.[mk]
          if (edit || val) labels.push(<div key={'l' + mk} className="pb-at" style={{ left: `${colX(side, c) * 100}%`, top: (yOf(c, k) + yOf(c, k + 1)) / 2, width: `${colW * 100}%` }}><Cell value={val} edit={edit} onSave={(v) => put('at', mk, v)} ph="ساعت و زمین" className="at" /></div>)
        }
      }
    }
  }
  const third = p ? p.third.map((t) => teamName(ev, t)).join('، ') : ''

  // گروه‌ها: پیش‌فرض ۸ گروه، تا ۱۶؛ هر گروه از جدول واقعی همان حرف پر می‌شود
  const gN = bd.gN || Math.max(DEF_G, ev.groups.length)
  const groups = Array.from({ length: gN }, (_, i) => {
    const L = GROUP_IDS[i], real = ev.groups.find((g) => g.id === L)
    const auto = real ? standings(ev, L).map((r) => ({ n: r.name, p: r.p ? fa(r.w) : '' })) : []
    const n = bd.gr?.[L] || Math.max(4, auto.length)
    const rows = Array.from({ length: n }, (_, r) => ({ r, auto: auto[r] || { n: '', p: '' }, man: bd.gc?.[`${L}-${r}`] || {} }))
    return { L, n, rows, filled: rows.filter((x) => (x.man.n ?? x.auto.n)) }
  })
  const shownGroups = edit ? groups : groups.filter((g) => g.filled.length)
  const putCell = (L, r, k, v) => save((b) => {
    const gc = { ...(b.gc || {}) }, id = `${L}-${r}`, cur = { ...(gc[id] || {}) }
    if (v == null) delete cur[k]; else cur[k] = v
    if (Object.keys(cur).length) gc[id] = cur; else delete gc[id]
    return { ...b, gc }
  })
  const setRows = (L, n) => save((b) => ({ ...b, gr: { ...(b.gr || {}), [L]: Math.max(1, Math.min(MAX_ROWS, n)) } }))
  const setG = (n) => save((b) => ({ ...b, gN: Math.max(1, Math.min(MAX_G, n)) }))
  const clear = () => { if (!window.confirm('همه‌ی نوشته‌های دستی این جدول پاک شود؟ خانه‌ها دوباره از نتیجه‌های مسابقه پر می‌شوند.')) return; save(() => ({})); toast({ icon: '↺', title: 'جدول به حالت خودکار برگشت' }) }
  const manual = Object.keys(bd.ko || {}).length + Object.keys(bd.gc || {}).length + Object.keys(bd.at || {}).length + Object.keys(bd.pod || {}).length

  return (
    <div className={`pb ${edit ? 'edit' : ''}`}>
      {edit && (
        <div className="pb-tools">
          <span>اندازه‌ی جدول</span>
          <div className="pb-sizes">{SIZES.map((s) => <button key={s} className={size === s ? 'on' : ''} onClick={() => save((b) => ({ ...b, size: s }))}>{fa(s)} تیم</button>)}</div>
          <small className="pb-hint"><i className="pb-dot" />خانه‌های دستی؛ بقیه از نتیجه‌ها پر می‌شوند</small>
          {manual > 0 && <button className="adm-btn ghost sm" onClick={clear}><Icon name="refresh" size={14} />پاک کردن دستی‌ها</button>}
        </div>
      )}
      <datalist id={list}>{ev.teams.map((t) => <option key={t.id} value={t.name} />)}</datalist>
      <div className="pb-scroll">
        <div className="pb-sheet" style={{ minWidth: Math.round(U * 128) }}>
          <header className="pb-head">
            <h3>{ev.title}</h3>
            <small>{dayLabel(ev.date)} {jDateFa(ev.date)}، {hourLabel(ev.start)} تا {hourLabel(ev.start + ev.dur)}</small>
          </header>
          <div className="pb-rounds" style={{ '--u': U }}>
            {[0, 1].map((side) => Array.from({ length: C }, (_, c) => <span key={side + '-' + c} style={{ left: `${colX(side, c) * 100}%`, width: `${colW * 100}%` }}>{ROUND[size >> c] || `${fa(size >> c)} تیمی`}</span>))}
            <span className="fin" style={{ left: '50%', width: `${(1.3 / U) * 100}%` }}>فینال</span>
          </div>
          <div className="pb-tree" style={{ height: H }}>
            <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" aria-hidden="true"><path d={lines.join('')} /></svg>
            {slots}{labels}
            {[0, 1].map((side) => {
              const key = `2-${side}`, sc = scoreOf(2, side)
              return (
                <div key={key} className={`pb-slot fin ${wonOf(2, side) ? 'won' : ''}`} style={{ left: '50%', top: finY[side], width: `${(1.3 / U) * 100}%` }}>
                  {resOf(2, side) && <small className="pb-res">{resOf(2, side)}</small>}
                  <Cell value={bd.ko?.[key]} auto={autoOf(2, side)} edit={edit} onSave={(v) => put('ko', key, v)} ph="فینالیست" list={list} />
                  {sc != null && bd.ko?.[key] == null && <b className="pb-sc">{sc}</b>}
                </div>
              )
            })}
            <b className="pb-vs" style={{ top: H / 2 }}>VS</b>
            {(edit || bd.at?.['2-0']) && <div className="pb-at fin" style={{ left: '50%', top: finY[1] + 34, width: `${(1.3 / U) * 100}%` }}><Cell value={bd.at?.['2-0']} edit={edit} onSave={(v) => put('at', '2-0', v)} ph="ساعت و زمین فینال" className="at" /></div>}
          </div>
          <div className="pb-podium">
            {[['first', 'قهرمان', p ? teamName(ev, p.first) : '', '🏆'], ['second', 'دوم', p ? teamName(ev, p.second) : '', '🥈'], ['third', 'سوم', third, '🥉']].map(([k, n, auto, ic]) => (
              <div key={k} className={`pb-pod ${k}`}><i>{ic}</i><small>{n}</small><Cell value={bd.pod?.[k]} auto={auto} edit={edit} onSave={(v) => put('pod', k, v)} ph="نام تیم" list={list} /></div>
            ))}
          </div>
          {(shownGroups.length > 0 || edit) && (
            <div className="pb-groups">
              <div className="pb-g-h">
                <b>گروه‌ها</b><small>{fa(gN)} گروه{ev.groups.length ? `، ${fa(ev.groups.length)} گروه از مسابقه پر شده` : ''}</small>
                {edit && <div className="pb-g-act">
                  <button className="adm-btn ghost sm" disabled={gN <= 1} onClick={() => setG(gN - 1)} data-tip="حذف گروه آخر"><Icon name="minus" size={14} /></button>
                  <button className="adm-btn ghost sm" disabled={gN >= MAX_G} onClick={() => setG(gN + 1)} data-tip={`تا ${fa(MAX_G)} گروه`}><Icon name="plus" size={14} />گروه</button>
                </div>}
              </div>
              <div className="pb-g-grid">
                {shownGroups.map((g) => (
                  <div key={g.L} className="pb-g">
                    <h5><span>{g.L}</span>گروه {g.L}<em>امتیاز</em></h5>
                    {(edit ? g.rows : g.filled).map(({ r, auto, man }) => (
                      <div key={r} className="pb-g-r">
                        <Cell value={man.n} auto={auto.n} edit={edit} onSave={(v) => putCell(g.L, r, 'n', v)} ph="نام تیم" list={list} />
                        <Cell value={man.p} auto={auto.p} edit={edit} onSave={(v) => putCell(g.L, r, 'p', v)} ph="۰" className="pt" />
                      </div>
                    ))}
                    {edit && <div className="pb-g-rows">
                      <button onClick={() => setRows(g.L, g.n - 1)} disabled={g.n <= 1} aria-label="ردیف کمتر"><Icon name="minus" size={12} /></button>
                      <small>{fa(g.n)} تیم</small>
                      <button onClick={() => setRows(g.L, g.n + 1)} disabled={g.n >= MAX_ROWS} aria-label="ردیف بیشتر"><Icon name="plus" size={12} /></button>
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
