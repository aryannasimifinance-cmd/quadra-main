// منابع انسانی: شیفت، حضور و غیاب، مرخصی و حقوق بر اساس قانون کار (بدون مالیات بر حقوق)
import { addDays, fromKey, todayKey } from './data'
import { jMonthDays, jMonthKey, jMonthLabel, jParts, ord } from './jalali'

export const ROLES = {
  manager: 'مدیر داخلی', reception: 'پذیرش', shop: 'فروشنده‌ی فروشگاه', service: 'خدمات و نظافت',
  security: 'نگهبانی', tech: 'تأسیسات و نگهداری', accountant: 'حسابداری', coach: 'مربی',
}
export const CONTRACTS = { full: 'تمام‌وقت', part: 'پاره‌وقت', hourly: 'ساعتی', commission: 'قرارداد درصدی' }
export const SHIFTS = {
  m: { name: 'صبح', short: 'صبح', from: 7, to: 15 },
  e: { name: 'عصر', short: 'عصر', from: 15, to: 24 },
  f: { name: 'اداری', short: 'اداری', from: 9, to: 17 },
  n: { name: 'شب', short: 'شب', from: 0, to: 8 },
  off: { name: 'تعطیل', short: '—' },
}
export const SHIFT_CYCLE = ['m', 'e', 'f', 'n', 'off']
export const WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
export const LEAVE_KIND = { annual: 'استحقاقی', sick: 'استعلاجی', unpaid: 'بدون حقوق' }
export const DOCS = { contract: 'قرارداد امضاشده', id: 'کپی کارت ملی و شناسنامه', health: 'کارت بهداشت', clearance: 'گواهی عدم سوءپیشینه', insurance: 'معرفی به تأمین اجتماعی' }

// مقادیر پیش‌فرض نمونه — هر سال با مصوبه‌ی شورای عالی کار در «تنظیمات قانون کار» به‌روز شود
export const HR_CFG = { housing: 900000, bon: 2200000, child: 1040000, otRate: 1.4, emp: 0.07, er: 0.23, monthHours: 176, dayHours: 8, annualLeave: 26 }

export const wdIndex = (k) => (fromKey(k).getDay() + 1) % 7 // شنبه = ۰
export const shiftOn = (club, staffId, k) => club.shifts?.[staffId]?.[wdIndex(k)] || 'off'
export const hhmm = (h) => (h == null ? '—' : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]))
export const fromHHMM = (s) => { const [h, m] = s.split(':').map(Number); return h + (m || 0) / 60 }

export function onLeave(club, staffId, k) {
  return (club.leaves || []).find((l) => l.staff === staffId && l.status === 'ok' && ord(k) >= ord(l.from) && ord(k) <= ord(l.to))
}

// وضعیت یک نفر در یک روز
export function dayStatus(club, s, k) {
  const sh = shiftOn(club, s.id, k)
  const rec = club.attendance?.[k]?.[s.id]
  const lv = onLeave(club, s.id, k)
  if (lv) return { code: 'leave', name: `مرخصی ${LEAVE_KIND[lv.kind]}`, sh, rec }
  if (rec?.in != null) {
    const late = sh !== 'off' && rec.in - SHIFTS[sh].from > 0.08 ? Math.round((rec.in - SHIFTS[sh].from) * 60) : 0
    return { code: rec.out == null ? 'in' : late ? 'late' : 'ok', name: rec.out == null ? 'در محل کار' : late ? `تأخیر ${late} دقیقه` : 'حاضر', sh, rec, late }
  }
  if (sh === 'off' || s.type === 'commission') return { code: 'off', name: 'تعطیل', sh }
  if (ord(k) > ord(todayKey()) || (k === todayKey() && new Date().getHours() < SHIFTS[sh].from + 0.5)) return { code: 'wait', name: 'در انتظار ورود', sh }
  return { code: 'absent', name: 'غیبت', sh }
}

export function attStats(club, s, days) {
  const st = { present: 0, absent: 0, leave: 0, hours: 0, ot: 0, late: 0 }
  const cfg = { ...HR_CFG, ...club.hrCfg }
  days.forEach((k) => {
    if (ord(k) > ord(todayKey()) || (s.start && ord(k) < ord(s.start))) return
    const d = dayStatus(club, s, k)
    if (d.code === 'absent') st.absent++
    else if (d.code === 'leave') st.leave++
    else if (d.rec?.in != null) {
      st.present++
      st.late += d.late || 0
      if (d.rec.out != null) { const h = d.rec.out - d.rec.in; st.hours += h; st.ot += Math.max(0, h - cfg.dayHours) }
    }
  })
  st.hours = Math.round(st.hours * 10) / 10; st.ot = Math.round(st.ot * 10) / 10
  return st
}

// مانده‌ی مرخصی استحقاقی سال جاری شمسی
export function leaveBalance(club, s) {
  const cfg = { ...HR_CFG, ...club.hrCfg }
  const y = jParts(todayKey()).y
  const used = (club.leaves || []).filter((l) => l.staff === s.id && l.status === 'ok' && l.kind === 'annual' && jParts(l.from).y === y).reduce((a, l) => a + l.days, 0)
  return { total: cfg.annualLeave, used, left: cfg.annualLeave - used }
}

const round = (n) => Math.round(n / 1000) * 1000

// محاسبه‌ی حقوق یک ماه شمسی — mk مثل 1405-08
export function payroll(club, mk) {
  const cfg = { ...HR_CFG, ...club.hrCfg }
  const days = jMonthDays(mk)
  const first = days[0], last = days[days.length - 1]
  return club.staff.filter((s) => s.status !== 'ended' && (!s.start || ord(s.start) <= ord(last))).map((s) => {
    const att = attStats(club, s, days)
    const adv = (club.advances || []).filter((a) => a.staff === s.id && jMonthKey(a.date) === mk).reduce((x, a) => x + a.amount, 0)
    const r = { staff: s.id, name: s.name, role: s.role, type: s.type, att, base: 0, housing: 0, bon: 0, child: 0, otPay: 0, absence: 0, commission: 0, adv }
    if (s.type === 'commission') {
      const inMonth = (k) => ord(k) >= ord(first) && ord(k) <= ord(last) && ord(k) <= ord(todayKey())
      const sessions = club.bookings.filter((b) => b.coach === s.coach && b.status !== 'cancelled' && inMonth(b.date))
      const packs = club.sales.filter((x) => x.kind === 'coach' && x.item === s.coach && inMonth(`${new Date(x.at).getFullYear()}-${new Date(x.at).getMonth() + 1}-${new Date(x.at).getDate()}`))
      r.revenue = sessions.filter((b) => b.method !== 'coach-pack').reduce((a, b) => a + b.price, 0) + packs.reduce((a, x) => a + x.price, 0)
      r.sessions = sessions.length
      r.commission = round(r.revenue * (s.share || 0.6))
      r.gross = r.commission; r.emp = 0; r.er = 0
    } else {
      const hourly = s.type === 'hourly'
      r.base = hourly ? round(att.hours * (s.rate || 0)) : s.base
      if (s.type === 'full') {
        r.housing = cfg.housing; r.bon = cfg.bon; r.child = (s.children || 0) * cfg.child
        r.otPay = round(att.ot * (s.base / cfg.monthHours) * cfg.otRate)
        r.absence = round(att.absent * (s.base / 30))
      }
      r.gross = r.base + r.housing + r.bon + r.child + r.otPay - r.absence
      r.emp = round(r.gross * cfg.emp); r.er = round(r.gross * cfg.er)
    }
    r.net = r.gross - r.emp - r.adv
    return r
  })
}
export const payrollLabel = jMonthLabel

export function contractAlert(s) {
  if (!s.contractEnd) return null
  const d = Math.round((fromKey(s.contractEnd) - fromKey(todayKey())) / 864e5)
  return d < 0 ? 'قرارداد منقضی شده' : d <= 30 ? `پایان قرارداد تا ${d.toLocaleString('fa-IR')} روز دیگر` : null
}
export const seniority = (s) => {
  const days = Math.round((fromKey(todayKey()) - fromKey(s.start)) / 864e5)
  return days >= 365 ? `${Math.floor(days / 365).toLocaleString('fa-IR')} سال و ${Math.floor((days % 365) / 30).toLocaleString('fa-IR')} ماه` : `${Math.floor(days / 30).toLocaleString('fa-IR')} ماه`
}
export const leaveDays = (from, to) => Math.round((fromKey(to) - fromKey(from)) / 864e5) + 1
export { addDays }
