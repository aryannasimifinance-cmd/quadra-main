// تاریخ شمسی و بازه‌های گزارش (روزانه، هفتگی از شنبه، ماهانه‌ی شمسی)
import { addDays, fromKey, todayKey, weekday } from './data'

const jf = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' })
const cache = new Map()
export function jParts(k) {
  let v = cache.get(k)
  if (!v) {
    const p = Object.fromEntries(jf.formatToParts(fromKey(k)).map((x) => [x.type, x.value]))
    v = { y: parseInt(p.year, 10), m: parseInt(p.month, 10), d: parseInt(p.day, 10) }
    cache.set(k, v)
  }
  return v
}

export const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const pad = (n) => String(n).padStart(2, '0')
export const faDigits = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

// کلید روز به صورت عدد قابل مقایسه: 2026-11-3 → 20261103
export const ord = (k) => { const [y, m, d] = k.split('-').map(Number); return y * 10000 + m * 100 + d }
export const dk = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

export const jDate = (k) => { const { y, m, d } = jParts(k); return `${y}/${pad(m)}/${pad(d)}` } // برای اکسل
export const jDateFa = (k) => faDigits(jDate(k))
export const jMonthKey = (k) => { const { y, m } = jParts(k); return `${y}-${pad(m)}` }
export const jMonthLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${J_MONTHS[m - 1]} ${faDigits(y)}` }

// همه‌ی روزهای یک ماه شمسی، به صورت کلید روز میلادی
export function jMonthDays(mk) {
  let k = todayKey(), guard = 0
  while (jMonthKey(k) !== mk && guard++ < 600) k = addDays(k, jMonthKey(k) < mk ? 15 : -15)
  while (jMonthKey(addDays(k, -1)) === mk) k = addDays(k, -1)
  const out = []
  while (jMonthKey(k) === mk) { out.push(k); k = addDays(k, 1) }
  return out
}
// چند ماه شمسی اخیر، جدیدترین اول
export function recentMonths(n = 4) {
  const out = [jMonthKey(todayKey())]
  while (out.length < n) out.push(jMonthKey(addDays(jMonthDays(out[out.length - 1])[0], -1)))
  return out
}

export const PERIODS = { day: 'روزانه', week: 'هفتگی', month: 'ماهانه' }
export function period(kind, k) {
  if (kind === 'day') return { kind, from: k, to: k, label: `${weekday(fromKey(k))} ${jDateFa(k)}`, file: jDate(k).replace(/\//g, '-') }
  if (kind === 'week') {
    const from = addDays(k, -((fromKey(k).getDay() + 1) % 7)), to = addDays(from, 6)
    return { kind, from, to, label: `هفته‌ی ${jDateFa(from)} تا ${jDateFa(to)}`, file: `week-${jDate(from).replace(/\//g, '-')}` }
  }
  const mk = jMonthKey(k), days = jMonthDays(mk)
  return { kind, from: days[0], to: days[days.length - 1], label: jMonthLabel(mk), file: mk }
}
export function shiftPeriod(p, dir) {
  if (p.kind === 'day') return addDays(p.from, dir)
  if (p.kind === 'week') return addDays(p.from, dir * 7)
  return dir > 0 ? addDays(p.to, 1) : addDays(p.from, -1)
}
export const inPeriod = (k, p) => { const o = ord(k); return o >= ord(p.from) && o <= ord(p.to) }
export function daysOf(p) {
  const out = []
  for (let k = p.from; ord(k) <= ord(p.to); k = addDays(k, 1)) out.push(k)
  return out
}
