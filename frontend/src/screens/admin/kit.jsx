// اجزای مشترک پنل مدیر
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { fa, todayKey } from '../../data'
import { PERIODS, ord, period, shiftPeriod } from '../../jalali'
import { Icon } from '../../components/ui'
import { STATUS } from './derive'

export function Card({ title, sub, right, children, className = '', tip }) {
  return (
    <section className={`adm-card ${className}`}>
      {(title || right) && <div className="adm-card-h"><div><h3 data-tip={tip}>{title}{tip && <i className="tip-dot">؟</i>}</h3>{sub && <small>{sub}</small>}</div>{right}</div>}
      {children}
    </section>
  )
}
export const Status = ({ s }) => <span className={`badge-st ${STATUS[s].cls}`}><i />{STATUS[s].name}</span>
export const Badge = ({ tone = 'mute', children }) => <span className={`badge-st ${tone}`}><i />{children}</span>

// مبلغ پنهان: ستاره نشان داده می‌شود تا با زدن چشم دیده شود
export const MASK = '✱✱✱✱✱✱'
export const Eye = ({ on, set }) => (
  <span role="button" tabIndex={0} className={`eye ${on ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); set(!on) }} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), set(!on))} data-tip={on ? 'پنهان کردن مبلغ' : 'نمایش مبلغ'} aria-label={on ? 'پنهان کردن مبلغ' : 'نمایش مبلغ'}>
    <Icon name={on ? 'eye' : 'eyeOff'} size={16} />
  </span>
)

// یک مبلغ پنهان با چشم کنارش
export function Secret({ value }) {
  const [on, set] = useState(false)
  return <span className={`secret ${on ? 'on' : ''}`}>{on ? value : MASK}<Eye on={on} set={set} /></span>
}
export const EyeMid = ({ set }) => (
  <button type="button" className="eye-mid" onClick={(e) => { e.stopPropagation(); set(true) }}><span className="eye on"><Icon name="eye" size={18} /></span>نمایش مبلغ‌ها</button>
)

export function Kpi({ label, value, delta, spark, icon, tone, sub, onClick, tip, secret }) {
  const T = onClick ? 'button' : 'div'
  const [show, setShow] = useState(false)
  const hid = secret && !show
  return (
    <T className={`kpi ${tone || ''} ${onClick ? 'link' : ''} ${secret ? 'kpi-secret' : ''}`} onClick={onClick} data-tip={tip}>
      <div className="kpi-h"><span><Icon name={icon} size={16} />{label}</span>{delta != null && !hid && <em className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {fa(Math.abs(Math.round(delta)))}٪</em>}</div>
      {secret ? <div className="kpi-sec"><b className={hid ? 'masked' : ''}>{hid ? MASK : value}</b><Eye on={show} set={setShow} /></div> : <b>{value}</b>}
      {sub && <small className="kpi-sub">{hid && secret !== 'value' ? MASK : sub}</small>}
      {spark}
    </T>
  )
}

export const Search = ({ value, onChange, ph }) => <label className="adm-search"><Icon name="search" size={16} /><input placeholder={ph} value={value} onChange={(e) => onChange(e.target.value)} /></label>
export const Seg = ({ value, onChange, options, tips = {} }) => (
  <div className="seg-adm">{Object.entries(options).map(([k, v]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} data-tip={tips[k]}>{v}</button>)}</div>
)
export function usePage(list, size = 25) {
  const [n, setN] = useState(size)
  return [list.slice(0, n), list.length > n ? () => setN(n + size) : null]
}
export const More = ({ more }) => more && <button className="adm-btn ghost full" onClick={more}>نمایش بیشتر</button>
// صفحه‌بندی شماره‌دار برای فهرست‌های بلند؛ با عوض شدن فیلتر به صفحه‌ی اول برمی‌گردد
export function useSlice(list, size = 20, reset = '') {
  const [s, setS] = useState({ page: 0, reset })
  const page = s.reset === reset ? s.page : 0
  const pages = Math.max(1, Math.ceil(list.length / size))
  const p = Math.min(page, pages - 1)
  return { rows: list.slice(p * size, p * size + size), page: p, pages, from: p * size, setPage: (n) => setS({ page: n, reset }) }
}
export function Pager({ page, pages, setPage }) {
  if (pages < 2) return null
  // صفحه‌ی اول و آخر، و دو صفحه‌ی دور و بر صفحه‌ی فعلی
  const nums = [...new Set([0, pages - 1, page - 2, page - 1, page, page + 1, page + 2])].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b)
  return (
    <div className="pager">
      <button className="adm-btn ghost sm" disabled={!page} onClick={() => setPage(page - 1)} aria-label="صفحه‌ی قبل"><Icon name="back" size={16} /></button>
      {nums.map((n, i) => <span key={n}>{i > 0 && n - nums[i - 1] > 1 && <i>…</i>}<button className={n === page ? 'on' : ''} onClick={() => setPage(n)}>{fa(n + 1)}</button></span>)}
      <button className="adm-btn ghost sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="صفحه‌ی بعد"><Icon name="fwd" size={16} /></button>
    </div>
  )
}
export const Empty = ({ children }) => <div className="adm-empty">{children}</div>

// زبانه‌های داخلی هر بخش
export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="adm-tabs" role="tablist">
      {tabs.map(([k, v, n, tip]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} data-tip={tip}>
          {value === k && <motion.i layoutId={`tab-${tabs[0][0]}`} className="adm-tab-bar" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          {v}{n != null && n !== 0 && <em>{fa(n)}</em>}
        </button>
      ))}
    </div>
  )
}

// انتخاب بازه‌ی گزارش: روزانه / هفتگی / ماهانه‌ی شمسی + قبل و بعد
export function PeriodBar({ p, setP, right }) {
  return (
    <div className="period-bar">
      <Seg value={p.kind} onChange={(k) => setP(period(k, ord(p.to) > ord(todayKey()) ? todayKey() : p.to))} options={PERIODS} tips={{ day: 'گزارش یک روز', week: 'شنبه تا جمعه', month: 'ماه شمسی' }} />
      <div className="period-nav">
        <button className="adm-btn ghost sm" onClick={() => setP(period(p.kind, shiftPeriod(p, -1)))} aria-label="بازه‌ی قبل" data-tip="روز / هفته / ماه قبل"><Icon name="back" size={16} /></button>
        <b>{p.label}</b>
        <button className="adm-btn ghost sm" onClick={() => setP(period(p.kind, shiftPeriod(p, 1)))} aria-label="بازه‌ی بعد" data-tip="روز / هفته / ماه بعد"><Icon name="fwd" size={16} /></button>
      </div>
      {right}
    </div>
  )
}

// کشوی کناری عمومی
// size: wide برای فرم‌های پهن، till برای صندوق فروش حضوری (دو ستونه)
export function Side({ open, onClose, title, children, wide, size }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="dr-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className={`drawer ${size || (wide ? 'wide' : '')}`} initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 36 }}>
            <button className="dr-x" onClick={onClose} aria-label="بستن"><Icon name="close" /></button>
            <div className="dr">{title && <h2 className="dr-h">{title}</h2>}{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export const Field = ({ label, children, hint, className = '', tip }) => <label className={`fld ${className}`}><span data-tip={tip}>{label}{tip && <i className="tip-dot">؟</i>}</span>{children}{hint && <small>{hint}</small>}</label>
// ورودی مبلغ با جداکننده‌ی هزارگان
export function Money({ value, onChange, ...rest }) {
  return <input inputMode="numeric" dir="ltr" value={value ? Number(value).toLocaleString('en') : ''} onChange={(e) => onChange(+e.target.value.replace(/[^\d]/g, '') || 0)} {...rest} />
}
export const XlsxBtn = ({ onClick, label = 'خروجی اکسل', tip = 'دانلود همین فهرست به‌صورت فایل اکسل' }) => <button className="adm-btn ghost sm xl" onClick={onClick} data-tip={tip}><Icon name="download" size={16} />{label}</button>

// یک خط راهنما بالای هر بخش: این صفحه برای چیست
export const Guide = ({ children }) => <p className="guide"><Icon name="sparkle" size={14} />{children}</p>

// راهنمای شناور: هر عنصری که data-tip دارد با رفتن موس توضیح کوتاهش را نشان می‌دهد
export function TipLayer() {
  const [t, setT] = useState(null)
  const cur = useRef(null)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return
    let timer
    const over = (e) => {
      const el = e.target.closest?.('[data-tip]')
      if (el === cur.current) return
      cur.current = el; clearTimeout(timer)
      if (!el || !el.dataset.tip) { setT(null); return }
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect(), W = window.innerWidth
        // نزدیک لبه‌ی راست (منوی کناری): کنار عنصر؛ وگرنه بالا یا پایین آن
        if (r.right > W - 140) { setT({ text: el.dataset.tip, x: r.left - 10, y: r.top + r.height / 2, pos: 'side' }); return }
        const pos = r.top < 70 ? 'below' : ''
        setT({ text: el.dataset.tip, x: Math.min(W - 140, Math.max(140, r.left + r.width / 2)), y: pos ? r.bottom + 8 : r.top - 8, pos })
      }, 350)
    }
    const hide = () => { cur.current = null; clearTimeout(timer); setT(null) }
    document.addEventListener('mouseover', over)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('mousedown', hide)
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('scroll', hide, true); document.removeEventListener('mousedown', hide); clearTimeout(timer) }
  }, [])
  return (
    <AnimatePresence>
      {t && <motion.div key={t.text + t.x} className={`tip-layer ${t.pos}`} style={{ left: t.x, top: t.y }} initial={{ opacity: 0, y: t.pos === 'below' ? -4 : t.pos ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>{t.text}</motion.div>}
    </AnimatePresence>
  )
}

// کوچک کردن عکس قبل از ذخیره تا جای کمی بگیرد (حداکثر ۵۴۰ پیکسل، JPEG)
export function shrinkImage(file, max = 540, q = 0.72) {
  return new Promise((ok, fail) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      ok(c.toDataURL('image/jpeg', q))
    }
    img.onerror = fail
    img.src = URL.createObjectURL(file)
  })
}

// آپلود عکس: کشیدن و رها کردن یا انتخاب فایل؛ پیش‌نمایش و حذف
export function ImageUpload({ value, onChange, hint = 'عکس واقعی کالا، مربع یا افقی، پس‌زمینه‌ی ساده' }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const take = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try { onChange(await shrinkImage(file)) } finally { setBusy(false) }
  }
  return (
    <div className={`img-up ${drag ? 'drag' : ''} ${value ? 'has' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]) }}>
      {value ? <img src={value} alt="" /> : <div className="img-up-empty"><Icon name="plus" size={22} /><b>{busy ? 'در حال آماده‌سازی…' : 'افزودن عکس'}</b><small>{hint}</small></div>}
      <div className="img-up-act">
        <button type="button" className="adm-btn ghost sm" onClick={() => input.current.click()} data-tip="انتخاب عکس از کامپیوتر یا گوشی؛ می‌توانید عکس را روی همین کادر بکشید">{value ? 'تغییر عکس' : 'انتخاب فایل'}</button>
        {value && <button type="button" className="adm-btn ghost sm" onClick={() => onChange(null)} data-tip="حذف عکس">حذف</button>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
