import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fa, levelById } from '../data'
import { chime, haptic } from '../fx'
import { useStore } from '../store'

const P = {
  back: 'M9 6l6 6-6 6',
  fwd: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
  bell: 'M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20a2 2 0 004 0',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M18 14a6.5 6.5 0 013.5 6',
  cal: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M8 3v4M16 3v4',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 17h6v4H9z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  radar: 'M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M5 19a10 10 0 010-14M19 5a10 10 0 010 14M8 16a5.5 5.5 0 010-8M16 8a5.5 5.5 0 010 8',
  phone: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  logout: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10',
  filter: 'M4 6h16M7 12h10M10 18h4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  cup: 'M4 9h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h1.5a2.5 2.5 0 010 5H17M8 3v3M12 3v3',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  wallet: 'M4 7a2 2 0 012-2h11v4M4 7v11a2 2 0 002 2h14V9H6a2 2 0 01-2-2zM16 14.5h.01',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M7 15h3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  cog: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  court: 'M4 4h16v16H4zM4 12h16M12 4v16M8 4v16M16 4v16',
  coach: 'M12 3l9 4-9 4-9-4zM7 9v5c0 1.7 2.2 3 5 3s5-1.3 5-3V9M21 7v6',
  ticket: 'M4 8a2 2 0 002-2h12a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H6a2 2 0 00-2-2v-2a2 2 0 000-4zM10 6v12',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10 3 8 4s0 3 4 3M12 7s2-4 4-3 0 3-4 3',
  flame: 'M12 21c4 0 7-2.7 7-6.6 0-3.4-2.4-5.6-4-7.4-.4 1.8-1.5 3-2.8 3.4C12.6 7.8 11.4 5 9 3c.3 3-3.9 5.5-3.9 10.4C5 18.3 8 21 12 21z',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  cash: 'M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10v.01M18 14v.01',
  refresh: 'M20 11a8 8 0 00-14.7-3.5M4 5v3h3M4 13a8 8 0 0014.7 3.5M20 19v-3h-3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  msg: 'M4 5h16v11H8l-4 4z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.9 10.9 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.5M9.9 9.9a3 3 0 004.2 4.2',
  wrench: 'M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.8-.7-.7-2.8z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
}
export function Icon({ name, size = 22, stroke = 2, style, fill = 'none', className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}

export function Button({ children, variant = 'primary', onClick, disabled, full, icon, className = '', type = 'button', small, ...rest }) {
  const [ripples, setRipples] = useState([])
  const click = (e) => {
    if (disabled) return
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setRipples((x) => [...x, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    setTimeout(() => setRipples((x) => x.filter((y) => y.id !== id)), 600)
    haptic(10); chime('tap')
    onClick?.(e)
  }
  return (
    <motion.button type={type} whileTap={disabled ? {} : { scale: 0.96 }} whileHover={disabled ? {} : { y: -1 }}
      className={`btn btn-${variant} ${full ? 'btn-full' : ''} ${small ? 'btn-sm' : ''} ${className}`} disabled={disabled} onClick={click} {...rest}>
      {ripples.map((r) => <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />)}
      {icon && <Icon name={icon} size={small ? 16 : 20} />}
      <span>{children}</span>
    </motion.button>
  )
}

// گروه چیپ با هایلایت متحرک مشترک
export function Chips({ options, value, onChange, id, scroll, small }) {
  return (
    <div className={`chips ${scroll ? 'chips-scroll' : ''} ${small ? 'chips-sm' : ''}`}>
      {options.map((o) => {
        const active = Array.isArray(value) ? value.includes(o.id) : value === o.id
        return (
          <motion.button key={o.id} className={`chip ${active ? 'on' : ''} ${o.disabled ? 'dis' : ''}`} whileTap={{ scale: 0.92 }}
            onClick={() => { if (o.disabled) return; haptic(6); onChange(o.id) }}>
            {active && !Array.isArray(value) && <motion.span layoutId={`chip-${id}`} className="chip-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            {active && Array.isArray(value) && <motion.span className="chip-bg" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />}
            <span className="chip-t">{o.icon && <i>{o.icon}</i>}{o.name}{o.sub && <small>{o.sub}</small>}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

const HUES = ['#2F5D8C', '#C2503A', '#0E9F98', '#B8901C', '#6B4FA8', '#B44C9A', '#3DA57E', '#24344F']
export function Avatar({ name = '?', size = 40, ring, me, empty, onClick }) {
  if (empty) {
    return (
      <motion.div className="avatar empty" style={{ width: size, height: size }} onClick={onClick} whileTap={{ scale: 0.9 }}>
        <Icon name="plus" size={size * 0.42} />
      </motion.div>
    )
  }
  const h = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return (
    <motion.div className="avatar" onClick={onClick} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      style={{ width: size, height: size, fontSize: size * 0.4, background: me ? 'var(--q)' : h, color: me ? 'var(--ink)' : '#fff', boxShadow: ring ? `0 0 0 2px var(--paper), 0 0 0 4px ${ring}` : undefined }}>
      {name.trim()[0]}
    </motion.div>
  )
}

export function LevelPill({ id, big }) {
  const l = levelById(id)
  return <span className={`lvl ${big ? 'lvl-big' : ''}`} style={{ '--c': l.color }}>{id}</span>
}

export function TopBar({ title, onBack, right, step, total, transparent, sub }) {
  return (
    <div className={`topbar ${transparent ? 'clear' : ''}`}>
      {onBack ? (
        <motion.button className="icon-btn" whileTap={{ scale: 0.85 }} onClick={() => { haptic(6); onBack() }} aria-label="بازگشت">
          <Icon name="back" />
        </motion.button>
      ) : <span style={{ width: 42 }} />}
      <div className="topbar-mid">
        {total ? (
          <div className="steps">
            {Array.from({ length: total }, (_, i) => (
              <div key={i} className="step-seg">
                <motion.div className="step-fill" initial={false} animate={{ scaleX: i < step ? 1 : i === step ? 0.5 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }} />
              </div>
            ))}
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          <motion.div key={title} className="topbar-title" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}>
            {title}{sub && <small>{sub}</small>}
          </motion.div>
        </AnimatePresence>
      </div>
      {right || <span style={{ width: 42 }} />}
    </div>
  )
}

// تصویر با محو تدریجی پس از بارگذاری
export function Photo({ src, className = '', style, children, zoom, pos }) {
  const [ok, setOk] = useState(false)
  return (
    <div className={`photo ${className}`} style={style}>
      <motion.img src={src} alt="" loading="lazy" onLoad={() => setOk(true)} draggable={false} style={pos ? { objectPosition: pos } : null}
        initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: ok ? 1 : 0, scale: ok ? (zoom ? 1.12 : 1) : 1.08 }}
        transition={zoom ? { opacity: { duration: 0.6 }, scale: { duration: 18, ease: 'linear' } } : { duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
      {children}
    </div>
  )
}

// کارت سه‌بعدی با کج‌شدن بر اساس اشاره‌گر
export function Tilt({ children, className = '', onClick, style, max = 7 }) {
  const ref = useRef(null)
  const x = useMotionValue(0.5), y = useMotionValue(0.5)
  const rx = useSpring(useTransform(y, [0, 1], [max, -max]), { stiffness: 250, damping: 20 })
  const ry = useSpring(useTransform(x, [0, 1], [-max, max]), { stiffness: 250, damping: 20 })
  const gx = useTransform(x, (v) => `${v * 100}%`), gy = useTransform(y, (v) => `${v * 100}%`)
  const move = (e) => {
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left) / r.width); y.set((e.clientY - r.top) / r.height)
  }
  const leave = () => { x.set(0.5); y.set(0.5) }
  return (
    <motion.div ref={ref} className={`tilt ${className}`} style={{ rotateX: rx, rotateY: ry, '--gx': gx, '--gy': gy, ...style }}
      onPointerMove={move} onPointerLeave={leave} whileTap={{ scale: 0.97 }} onClick={onClick}>
      {children}
      <motion.div className="tilt-glare" />
    </motion.div>
  )
}

export function CountUp({ to, duration = 1.2, format = fa }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, to, { duration, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [to, duration])
  return <>{format(v)}</>
}

export function Ring({ value, size = 64, stroke = 6, color = 'var(--q)', track = 'rgba(255,255,255,.18)', children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
          transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1], delay: 0.2 }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

export function Sheet({ open, onClose, children, title, tall }) {
  const root = document.getElementById('portal')
  if (!root) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className={`sheet ${tall ? 'tall' : ''}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} dragListener={!tall}
            onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose() }}>
            <div className="sheet-grip" />
            {title && <h3 className="sheet-title">{title}</h3>}
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    root,
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" layout initial={{ y: -40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <span className="toast-ic">{t.icon || '✨'}</span>
            <div><b>{t.title}</b>{t.body && <p>{t.body}</p>}</div>
            {t.action && <button className="toast-act" onClick={t.action.run}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 99 }) {
  return (
    <div className="stepper">
      <motion.button whileTap={{ scale: 0.8 }} onClick={() => { haptic(6); onChange(Math.min(max, value + 1)) }} aria-label="بیشتر"><Icon name="plus" size={16} /></motion.button>
      <AnimatePresence mode="popLayout"><motion.b key={value} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>{fa(value)}</motion.b></AnimatePresence>
      <motion.button whileTap={{ scale: 0.8 }} onClick={() => { haptic(6); onChange(Math.max(min, value - 1)) }} aria-label="کمتر"><Icon name="minus" size={16} /></motion.button>
    </div>
  )
}

// نوار دکمه‌ی پایین ویزارد؛ با پورتال بیرون از محتوای انیمیشن‌دار رندر می‌شود تا موقع اسکرول جابه‌جا نشود
export function CtaBar({ children }) {
  const root = document.getElementById('portal')
  if (!root) return null
  return createPortal(<div className="cta-bar">{children}</div>, root)
}

export function Stars({ value = 0, onChange, size = 16 }) {
  return (
    <span className={`stars ${onChange ? 'edit' : ''}`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} className={n <= Math.round(value) ? 'on' : ''} onClick={() => { haptic(8); onChange?.(n) }} aria-label={`${n} ستاره`}>★</button>
      ))}
    </span>
  )
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
export const rise = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

export const SectionHead = ({ title, sub, action, onAction }) => (
  <div className="sec-head">
    <div><h3>{title}</h3>{sub && <small>{sub}</small>}</div>
    {action && <button className="link" onClick={onAction}>{action} <Icon name="fwd" size={14} /></button>}
  </div>
)
