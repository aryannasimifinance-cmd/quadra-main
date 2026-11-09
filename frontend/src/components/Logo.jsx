import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useId } from 'react'

// لوگوی کوادرا — بازترسیم برداری از فایل اصلی (قاب Q + عدد ۴ فیروزه‌ای)
export const VB = '60 115 464 402'
export const FRAME = 'M322 487H163A73 73 0 0 1 90 414V217.5A73 73 0 0 1 163 144.5H420.5A73 73 0 0 1 493.5 217.5V335'
export const STEM = 'M470 388H517V510.5H470Z'
export const FOUR = 'M358 251H421L284 388H470V432H177Z'
export const CYAN = '#05E0DA'

export function QuadraMark({ size = 40, tone = 'light', style }) {
  const id = useId().replace(/:/g, '')
  const ink = tone === 'light' ? '#F2F2F0' : '#141413'
  return (
    <svg width={size * 1.154} height={size} viewBox={VB} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={'g' + id} gradientUnits="userSpaceOnUse" x1="177" x2="470">
          <stop offset="0.55" stopColor={CYAN} /><stop offset="0.86" stopColor={ink} />
        </linearGradient>
      </defs>
      <path d={FRAME} fill="none" stroke={ink} strokeWidth="47" />
      <path d={STEM} fill={ink} />
      <path d={FOUR} fill={`url(#g${id})`} />
    </svg>
  )
}

export function Logo({ size = 22, tone = 'dark', word = true }) {
  return (
    <span className={`logo ${tone}`} style={{ fontSize: size }}>
      <QuadraMark size={size * 1.25} tone={tone} />
      {word && <span className="logo-word">QUADRA</span>}
    </span>
  )
}

// موشن استینگ: کشیده شدن قاب مثل خط زمین، افتادن پایه، ورود ۴ با رد نور، بعد کلمه و چهار زمین
export function Sting({ onSkip }) {
  const word = 'QUADRA'.split('')
  const ease = [0.65, 0, 0.35, 1]
  return (
    <motion.div className="sting" onClick={onSkip} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.4 }}>
      <motion.div className="sting-glow" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 0.65], scale: [0.6, 1.1, 1] }} transition={{ duration: 2, times: [0, 0.55, 1], delay: 0.9 }} />
      <motion.div className="sting-sweep" initial={{ x: '-120%' }} animate={{ x: '120%' }} transition={{ duration: 1.1, delay: 1.45, ease: 'easeInOut' }} />
      <div className="sting-grain" />
      <motion.div className="sting-mark" initial={{ scale: 0.92 }} animate={{ scale: [0.92, 1, 1.035, 1] }} transition={{ duration: 2.2, times: [0, 0.5, 0.62, 0.8] }}>
        <svg viewBox={VB} width="200" height="173" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="st-g" gradientUnits="userSpaceOnUse" x1="177" x2="470">
              <stop offset="0.55" stopColor={CYAN} /><stop offset="0.86" stopColor="#F2F2F0" />
            </linearGradient>
            <linearGradient id="st-sh"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <clipPath id="st-clip"><path d={FOUR} /></clipPath>
          </defs>
          <motion.path d={FRAME} fill="none" stroke="#F2F2F0" strokeWidth="47"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.05, delay: 0.15, ease }} />
          <motion.path d={STEM} fill="#F2F2F0" style={{ transformOrigin: '493px 510px' }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.95, type: 'spring', stiffness: 420, damping: 18 }} />
          <motion.g initial={{ x: -140, y: 140, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ delay: 1.05, duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }}>
            <path d={FOUR} fill="url(#st-g)" />
            <g clipPath="url(#st-clip)">
              <g transform="rotate(35 320 340)">
                <motion.rect x="0" y="40" width="70" height="600" fill="url(#st-sh)"
                  initial={{ x: -120 }} animate={{ x: 620 }} transition={{ delay: 1.6, duration: 0.8, ease: 'easeInOut' }} />
              </g>
            </g>
          </motion.g>
        </svg>
        <motion.span className="sting-wave" initial={{ scale: 1, opacity: 0 }} animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ delay: 1.35, duration: 1.1, ease: 'easeOut' }} />
      </motion.div>
      <div className="sting-word" dir="ltr">
        {word.map((l, i) => (
          <motion.span key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.55 + i * 0.06, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>{l}</motion.span>
        ))}
      </div>
      <motion.p className="sting-sub" initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 0.7, letterSpacing: '0.32em' }} transition={{ delay: 2, duration: 0.8 }}>
        PADEL CLUB
      </motion.p>
      <div className="sting-courts">
        {[0, 1, 2, 3].map((i) => (
          <motion.i key={i} initial={{ scaleX: 0, opacity: 0.2 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 2.15 + i * 0.12, type: 'spring', stiffness: 300, damping: 20 }} />
        ))}
      </div>
      <motion.small className="sting-skip" initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 1 }}>برای رد کردن بزنید</motion.small>
    </motion.div>
  )
}

// لوگوی زنده‌ی صفحه‌ی اول: کشیده شدن قاب، ورود ۴، بعد تپش نور و رد نور هر چند ثانیه
export function LiveLogo({ size = 26 }) {
  const ease = [0.65, 0, 0.35, 1]
  return (
    <span className="live-logo" style={{ fontSize: size * 0.8 }}>
      <span className="ll-mark">
      <motion.i className="ll-glow" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 2.6, repeat: Infinity, delay: 1.4, ease: 'easeInOut' }} />
      <svg viewBox={VB} width={size * 1.154} height={size} style={{ overflow: 'visible', position: 'relative' }}>
        <defs>
          <linearGradient id="ll-g" gradientUnits="userSpaceOnUse" x1="177" x2="470">
            <stop offset="0.55" stopColor={CYAN} /><stop offset="0.86" stopColor="#F2F2F0" />
          </linearGradient>
          <linearGradient id="ll-sh"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <clipPath id="ll-clip"><path d={FOUR} /><path d={STEM} /></clipPath>
        </defs>
        <motion.path d={FRAME} fill="none" stroke="#F2F2F0" strokeWidth="47" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.2, ease }} />
        <motion.path d={STEM} fill="#F2F2F0" style={{ transformOrigin: '493px 510px' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.9, type: 'spring', stiffness: 420, damping: 18 }} />
        <motion.path d={FOUR} fill="url(#ll-g)" initial={{ x: -120, y: 120, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ delay: 1, duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }} />
        <g clipPath="url(#ll-clip)">
          <g transform="rotate(35 320 340)">
            <motion.rect y="40" width="70" height="600" fill="url(#ll-sh)" initial={{ x: -140 }} animate={{ x: 640 }}
              transition={{ duration: 0.9, delay: 1.8, repeat: Infinity, repeatDelay: 3.6, ease: 'easeInOut' }} />
          </g>
        </g>
      </svg>
      </span>
      <span className="live-word" dir="ltr">
        {'QUADRA'.split('').map((l, i) => (
          <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 + i * 0.06, duration: 0.4 }}>{l}</motion.span>
        ))}
      </span>
    </span>
  )
}

// نشان وسط صفحه‌ی اول: لوگو و زیرش یک رالی پدل — راکت ضربه می‌زند، توپ روی خط زمین یک بار زمین می‌خورد
// حلقه‌ی رالی فقط CSS (transform/opacity) است تا روی گوشی ضعیف هم روان و بدون فایل اضافه باشد
export function Emblem({ size = 96 }) {
  const ease = [0.65, 0, 0.35, 1]
  return (
    <motion.div className="emblem" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
      <span className="em-core">
        <svg viewBox={VB} width={size * 1.154} height={size} style={{ overflow: 'visible' }} aria-hidden="true">
          <defs>
            <linearGradient id="em-g" gradientUnits="userSpaceOnUse" x1="177" x2="470">
              <stop offset="0.55" stopColor={CYAN} /><stop offset="0.86" stopColor="#F2F2F0" />
            </linearGradient>
            <linearGradient id="em-sh"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <clipPath id="em-clip"><path d={FOUR} /><path d={STEM} /></clipPath>
          </defs>
          <motion.path d={FRAME} fill="none" stroke="#F2F2F0" strokeWidth="47" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.3, ease }} />
          <motion.path d={STEM} fill="#F2F2F0" style={{ transformOrigin: '493px 510px' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 420, damping: 18 }} />
          <motion.path d={FOUR} fill="url(#em-g)" initial={{ x: -120, y: 120, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ delay: 1.2, duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }} />
          <g clipPath="url(#em-clip)">
            <g transform="rotate(35 320 340)">
              <motion.rect y="40" width="70" height="600" fill="url(#em-sh)" initial={{ x: -140 }} animate={{ x: 640 }}
                transition={{ duration: 0.9, delay: 2, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut' }} />
            </g>
          </g>
        </svg>
      </span>
      <span className="em-word" dir="ltr">
        {'QUADRA'.split('').map((l, i) => (
          <motion.span key={i} initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 1.4 + i * 0.07, duration: 0.45 }}>{l}</motion.span>
        ))}
      </span>
      <motion.small className="em-sub" initial={{ opacity: 0, letterSpacing: '0.7em' }} animate={{ opacity: 0.85, letterSpacing: '0.38em' }} transition={{ delay: 1.9, duration: 0.8 }}>PADEL CLUB</motion.small>
      <div className="em-rally" aria-hidden="true">
        <i className="em-floor" />
        <svg className="em-racket" viewBox="0 0 60 120" width="34" height="68">
          <path d="M30 4C14 4 5 17 5 34c0 14 7 25 15 31l4 14h12l4-14c8-6 15-17 15-31C55 17 46 4 30 4Z" fill="#1B1D21" stroke="#F2F2F0" strokeWidth="2.5" />
          <path d="M8 22C12 11 20 6 30 6" fill="none" stroke={CYAN} strokeWidth="2.5" strokeLinecap="round" />
          {[[22, 22], [30, 20], [38, 22], [18, 31], [26, 30], [34, 30], [42, 31], [22, 39], [30, 38], [38, 39], [26, 47], [34, 47]].map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="1.8" fill="#F2F2F0" opacity=".55" />)}
          <rect x="25" y="79" width="10" height="37" rx="4" fill="#F2F2F0" />
          <path d="M25 88h10M25 96h10M25 104h10" stroke="#1B1D21" strokeWidth="1.5" opacity=".5" />
        </svg>
        <span className="bl-x">
          <i className="bl-shadow" />
          <span className="bl-y">
            <svg className="bl-ball" viewBox="0 0 20 20" width="13" height="13">
              <circle cx="10" cy="10" r="9.3" fill="#D9E84A" />
              <path d="M3 5c4 2 4 8 0 10M17 5c-4 2-4 8 0 10" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".85" />
            </svg>
          </span>
        </span>
      </div>
    </motion.div>
  )
}

// لودر: قاب لوگو مدام کشیده می‌شود و «۴» تپش دارد
export function LoaderMark({ size = 64, tone = 'light' }) {
  const ink = tone === 'light' ? '#F2F2F0' : '#141413'
  return (
    <svg viewBox={VB} width={size * 1.154} height={size} style={{ overflow: 'visible' }} aria-hidden="true">
      <path d={FRAME} fill="none" stroke={ink} strokeOpacity=".14" strokeWidth="47" />
      <motion.path d={FRAME} fill="none" stroke={ink} strokeWidth="47" initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.75, 1] }} />
      <path d={STEM} fill={ink} />
      <motion.path d={FOUR} fill={CYAN} animate={{ opacity: [0.35, 1, 0.35], x: [-10, 0, -10], y: [10, 0, 10] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
  )
}

// صفحه‌ی لودینگ تمام‌صفحه با لوگوی متحرک — برای پرداخت، ورود و بارگذاری بخش‌ها
export function Loading({ show = true, text }) {
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div className="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <LoaderMark size={58} />
          {text && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 0.8, y: 0 }} transition={{ delay: 0.15 }}>{text}</motion.p>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
