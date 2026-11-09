import { useState } from 'react'
import { fa, fromKey, short, toman } from '../../data'
import { SERIES } from './derive'

const dm = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' })
const wd = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })

function niceMax(v) {
  if (!v) return 1
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export function Legend({ series = SERIES }) {
  return <div className="legend">{series.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.name}</span>)}</div>
}

// ستونی انباشته — درآمد روزانه به تفکیک منبع
export function StackedBars({ data, series = SERIES, height = 230 }) {
  const [hov, setHov] = useState(null)
  const W = 720, H = height, pl = 8, pr = 54, pt = 10, pb = 24
  const max = niceMax(Math.max(...data.map((d) => d.total)))
  const bw = (W - pl - pr) / data.length
  const y = (v) => pt + (H - pt - pb) * (1 - v / max)
  const ticks = [0, max / 2, max]
  const h = hov != null ? data[hov] : null
  return (
    <div className="chart" onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="درآمد روزانه">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="grid" />
            <text x={W - pr + 8} y={y(t) + 4} className="axis">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0
          const x = pl + i * bw + bw * 0.18, w = bw * 0.64
          return (
            <g key={d.key} opacity={hov == null || hov === i ? 1 : 0.45}>
              {series.map((s, si) => {
                const v = d[s.id]; if (!v) return null
                const y0 = y(acc), y1 = y(acc + v); acc += v
                const top = series.slice(si + 1).every((t) => !d[t.id])
                const hgt = Math.max(0, y0 - y1 - (top ? 0 : 2))
                return top
                  ? <path key={s.id} d={`M${x} ${y0}V${y1 + 4}Q${x} ${y1} ${x + 4} ${y1}H${x + w - 4}Q${x + w} ${y1} ${x + w} ${y1 + 4}V${y0}Z`} fill={s.color} />
                  : <rect key={s.id} x={x} y={y1 + 2} width={w} height={hgt} fill={s.color} />
              })}
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pt - pb} fill="transparent" onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)} />
              {i % 5 === data.length % 5 && <text x={x + w / 2} y={H - 6} textAnchor="middle" className="axis">{dm.format(fromKey(d.key))}</text>}
            </g>
          )
        })}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${((pl + hov * bw + bw / 2) / W) * 100}%` }}>
          <b>{wd.format(fromKey(h.key))}</b>
          {series.map((s) => <div key={s.id}><i style={{ background: s.color }} /><span>{s.name}</span><em>{toman(h[s.id])}</em></div>)}
          <div className="tip-total"><span>جمع</span><em>{toman(h.total)}</em></div>
        </div>
      )}
    </div>
  )
}

// نقشه‌ی حرارتی اشغال — یک فام، روشن به تیره
const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
export function Heatmap({ grid }) {
  const [hov, setHov] = useState(null)
  const col = (v) => `color-mix(in oklab, #0B6E69 ${Math.round(Math.min(1, v) * 100)}%, #EAF7F6)`
  return (
    <div className="heat" onMouseLeave={() => setHov(null)}>
      <div className="heat-grid">
        <span />
        {Array.from({ length: 17 }, (_, h) => <small key={h} className="heat-h">{h % 2 === 0 ? fa(h + 7) : ''}</small>)}
        {grid.map((row, d) => (
          <div key={d} className="heat-row">
            <small className="heat-d">{DAYS[d]}</small>
            {row.map((v, h) => (
              <i key={h} style={{ background: col(v) }} className={hov && hov[0] === d && hov[1] === h ? 'on' : ''} onMouseEnter={() => setHov([d, h, v])} />
            ))}
          </div>
        ))}
      </div>
      <div className="heat-foot">
        {hov ? <span><b>{DAYS[hov[0]]} ساعت {fa(hov[1] + 7)}</b>، اشغال {fa(Math.round(hov[2] * 100))}٪</span> : <span>روی خانه‌ها بروید</span>}
        <span className="heat-scale"><small>کم</small>{[0.1, 0.35, 0.6, 0.85].map((v) => <i key={v} style={{ background: col(v) }} />)}<small>پر</small></span>
      </div>
    </div>
  )
}

export function HBars({ rows, format = toman }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.name} className="hb" title={`${r.name}: ${format(r.value)}`}>
          <span>{r.name}</span>
          <div><i style={{ width: `${(r.value / max) * 100}%`, background: r.color || '#0E9F98' }} /></div>
          <em>{format(r.value)}</em>
        </div>
      ))}
    </div>
  )
}

export function Spark({ values, color = '#0E9F98' }) {
  const W = 100, H = 28, max = Math.max(...values, 1), min = Math.min(...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / (max - min || 1)) * (H - 4)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
}
