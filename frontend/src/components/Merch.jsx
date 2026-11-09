import { FOUR, FRAME, STEM, VB } from './Logo'

// تصویر محصولات برند کوادرا به‌صورت برداری — رنگ محصول قابل تغییر است
const SHAPES = {
  tee: 'M62 40l22-10c4 10 28 10 32 0l22 10 26 26-18 20-14-10v94H68V76l-14 10-18-20z',
  polo: 'M62 40l24-10 14 16 14-16 24 10 26 26-18 20-14-10v94H68V76l-14 10-18-20z',
  hoodie: 'M60 46c6-14 22-22 40-22s34 8 40 22l26 30-6 64-20-2 2-46-4 82H62l-4-82 2 46-20 2-6-64z',
  shorts: 'M52 54h96l10 96-46 6-12-50-12 50-46-6z',
  skirt: 'M66 52h68l28 98c-20 8-104 8-124 0z',
  cap: 'M40 118c0-40 26-66 60-66s60 26 60 66zM40 118c30 8 90 8 120 0 10 0 22 4 22 10-50 14-120 12-142-2z',
  bag: 'M34 92c0-16 12-26 26-26h80c14 0 26 10 26 26v40c0 16-12 26-26 26H60c-14 0-26-10-26-26z',
  backpack: 'M58 56c0-18 18-28 42-28s42 10 42 28v100c0 8-6 14-14 14H72c-8 0-14-6-14-14z',
  grip: 'M84 30h32v140H84z',
  band: 'M50 80h100v40H50z',
  bottle: 'M84 28h32v18l8 12v108c0 6-4 10-10 10H86c-6 0-10-4-10-10V58l8-12z',
  towel: 'M48 40h104v130H48z',
}
const light = (c) => ['#F4F2EC', '#9A988F', '#19C9C1'].includes(c)

export function MerchArt({ type, color = '#141413' }) {
  const ink = light(color) ? '#141413' : '#F2F2F0'
  const logo = { tee: [86, 70, 28], polo: [86, 72, 28], hoodie: [86, 84, 28], shorts: [112, 66, 18], skirt: [88, 70, 22], cap: [86, 76, 28], bag: [86, 98, 28], backpack: [86, 90, 28], grip: [90, 60, 20], band: [88, 88, 24], bottle: [88, 92, 24], towel: [84, 90, 32] }[type] || [86, 80, 28]
  const [lx, ly, ls] = logo
  return (
    <svg viewBox="0 0 200 200" className="merch-art" aria-hidden="true">
      <defs>
        <linearGradient id={`sh-${type}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="182" rx="62" ry="7" fill="#000" opacity=".08" />
      {type === 'grip' && [0, 1, 2].map((k) => <rect key={k} x={44 + k * 40} y={34 + k * 4} width="30" height={132 - k * 8} rx="15" fill={color} stroke="#0002" />)}
      {type === 'band' && [0, 1].map((k) => <g key={k}><ellipse cx={72 + k * 56} cy={100} rx="26" ry="34" fill="none" stroke={color} strokeWidth="18" /></g>)}
      {type !== 'grip' && type !== 'band' && <path d={SHAPES[type]} fill={color} stroke="#00000018" strokeWidth="1.5" strokeLinejoin="round" />}
      {type !== 'grip' && type !== 'band' && <path d={SHAPES[type]} fill={`url(#sh-${type})`} />}
      {type === 'polo' && <path d="M86 30l14 26 14-26" fill="none" stroke={ink} strokeOpacity=".5" strokeWidth="3" />}
      {type === 'hoodie' && <path d="M78 40c6 14 38 14 44 0M96 62v22M104 62v22" fill="none" stroke={ink} strokeOpacity=".4" strokeWidth="3" />}
      {type === 'bag' && <path d="M60 66V54c0-6 4-10 10-10h60c6 0 10 4 10 10v12M34 104h132" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="4" />}
      {type === 'backpack' && <path d="M72 116h56v34H72z" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="4" />}
      {type === 'bottle' && <rect x="80" y="20" width="40" height="14" rx="4" fill={ink} opacity=".8" />}
      {type === 'towel' && <path d="M48 150h104M48 156h104" stroke={ink} strokeOpacity=".3" strokeWidth="3" />}
      <svg x={lx} y={ly} width={ls * 1.154} height={ls} viewBox={VB}>
          <path d={FRAME} fill="none" stroke={ink} strokeWidth="47" />
          <path d={STEM} fill={ink} />
          <path d={FOUR} fill={color === '#19C9C1' ? ink : '#05E0DA'} />
      </svg>
    </svg>
  )
}

export function ProductImage({ p, color, className = '' }) {
  if (p.art) return <div className={`p-img art ${className}`}><MerchArt type={p.art.type} color={color || p.art.color} /></div>
  return <div className={`p-img ${className}`}><img src={p.img} alt="" loading="lazy" draggable={false} /></div>
}
