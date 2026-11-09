import { COACHES, COACH_PACKS, COURTS, hoursOf, MEMBERS, ratingOf, shownReviews, addDays, dayMonth, coachById, courtById, fromKey, memberById, productById, range, todayKey } from '../../data'
import { ME, payState } from '../../store'

export const SERIES = [
  { id: 'court', name: 'زمین', color: '#0E9F98' },
  { id: 'coach', name: 'کلاس مربی', color: '#5B6CF0' },
  { id: 'pack', name: 'پکیج و تورنمنت', color: '#E07B39' },
  { id: 'shop', name: 'فروشگاه', color: '#B44C9A' },
]
export const STATUS = {
  paid: { name: 'پرداخت‌شده', cls: 'ok' }, partial: { name: 'بخشی پرداخت‌شده', cls: 'warn' }, pending: { name: 'پرداخت‌نشده', cls: 'bad' },
  refunded: { name: 'مسترد', cls: 'mute' }, void: { name: 'لغو', cls: 'mute' },
}
export const OPEN_H = 17 // ساعت‌های کاری روزانه (۷ تا ۲۴)

export function who(id, user) {
  if (!id) return '—'
  if (id === ME) return user?.name ? `${user.name} (اپ)` : 'کاربر اپ'
  if (id === 'walkin') return 'مشتری حضوری'
  if (id.startsWith('f:')) return id.slice(2) + ' (مهمان)'
  return memberById(id)?.name || id
}

// همه‌ی تراکنش‌ها — رزروهایی که با اعتبار پکیج ثبت شده‌اند درآمد جدا ندارند (در فروش پکیج حساب شده)
export function payments(club, user) {
  const out = []
  club.bookings.forEach((b) => {
    if (b.type === 'block') return
    const settled = b.settled || [], later = settled.reduce((s, x) => s + x.amt, 0)
    // رزرو پکیجی: سهم پکیج قبلاً موقع خرید پکیج فروش خورده؛ فقط مانده‌ی نقدی (و تسویه‌هایش) این‌جا می‌آید
    const pkg = b.method === 'package' || b.method === 'coach-pack'
    if (pkg && b.paid - later >= b.price) return
    const st = payState(b)
    // پرداخت اول با روش خود رزرو؛ هر تسویه‌ی بعدی (پذیرش) با روش و زمان خودش جدا می‌آید
    const row = {
      ref: b, bid: b.id, kind: b.type === 'coach' ? 'coach' : 'court',
      title: b.type === 'coach' ? `کلاس ${coachById(b.coach)?.name}` : `${courtById(b.court).name}، ${b.type === 'open' ? 'بازی باز' : 'رزرو زمین'}`,
      sub: `${dayMonth(fromKey(b.date))}، ${range(b.start, b.dur)}`, who: who(b.by, user), status: st,
    }
    out.push({
      ...row, id: b.id, at: fromKey(b.date).getTime() + b.start * 36e5, amount: pkg ? b.price - (b.paid - later) : b.price, paid: st === 'refunded' || pkg ? 0 : Math.max(0, b.paid - later), pkg,
      due: st === 'paid' || st === 'void' || st === 'refunded' ? 0 : b.price - b.paid, method: b.method,
    })
    if (st !== 'refunded') settled.forEach((x, i) => out.push({ ...row, id: `${b.id}~s${i}`, at: x.at, amount: x.amt, paid: x.amt, due: 0, method: x.method }))
  })
  club.orders.forEach((o) => out.push({ id: o.id, at: o.at, kind: 'shop', title: `سفارش ${o.id}`, sub: o.items.map((x) => productById(x.pid)?.name).join('، '), who: who(o.by, user), amount: o.total, paid: o.total, due: 0, method: o.method, status: 'paid' }))
  ;(club.cafeOrders || []).forEach((o) => out.push({ id: o.id, at: o.at, kind: 'cafe', title: `کافه ${o.id}`, sub: o.items.map((x) => x.name).join('، '), who: who(o.by, user), amount: o.total, paid: o.total, due: 0, method: o.method, status: 'paid' }))
  ;(club.payins || []).forEach((p) => out.push({ id: p.id, at: p.at, kind: 'manual', manual: true, title: p.title || 'دریافت دستی', sub: p.note || 'ثبت دستی در پذیرش', who: p.by ? who(p.by, user) : (p.name || 'مشتری حضوری'), amount: p.amount, paid: p.amount, due: 0, method: p.method, status: 'paid' }))
  club.sales.forEach((s) => out.push({ id: s.id, at: s.at, kind: s.kind === 'coach' ? 'coach' : 'pack', title: s.name, sub: s.kind === 'event' ? 'ثبت‌نام تورنمنت' : s.kind === 'coach' ? 'پکیج مربی' : 'پکیج / عضویت', who: who(s.by, user), amount: s.price, paid: s.price, due: 0, method: s.method, status: 'paid' }))
  return out.sort((a, b) => b.at - a.at)
}

export function revenueByDay(pays, days = 30) {
  const keys = Array.from({ length: days }, (_, i) => addDays(todayKey(), i - days + 1))
  const map = Object.fromEntries(keys.map((k) => [k, { court: 0, coach: 0, pack: 0, shop: 0 }]))
  const end = fromKey(todayKey()).getTime() + 864e5
  pays.forEach((p) => {
    if (p.at >= end || !p.paid) return
    const d = new Date(p.at), k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    if (map[k]) map[k][p.kind] += p.paid
  })
  return keys.map((k) => ({ key: k, ...map[k], total: map[k].court + map[k].coach + map[k].pack + map[k].shop }))
}

export function occupancy(club, date, court) {
  const hrs = club.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && (!court || b.court === court)).reduce((s, b) => s + b.dur, 0)
  const { open, close } = hoursOf(club)
  return hrs / ((close - open || OPEN_H) * (court ? 1 : COURTS.length))
}

// میانگین اشغال ۴ هفته‌ی اخیر — روز هفته × ساعت
export function heat(club) {
  const grid = Array.from({ length: 7 }, () => Array(17).fill(0))
  for (let d = -28; d < 0; d++) {
    const k = addDays(todayKey(), d), wd = (fromKey(k).getDay() + 1) % 7 // شنبه = ۰
    club.bookings.forEach((b) => {
      if (b.date !== k || b.status === 'cancelled') return
      for (let t = b.start; t < b.start + b.dur; t += 0.5) { const h = Math.floor(t) - 7; if (h >= 0 && h < 17) grid[wd][h] += 0.5 / 4 / 4 }
    })
  }
  return grid
}

// جلسه‌های پکیج درآمد جدا ندارند؛ مبلغشان در فروش پکیج حساب شده
const notPack = (b) => b.method !== 'package' && b.method !== 'coach-pack'

export function memberStats(club, user) {
  const rows = MEMBERS.filter((m) => !(user && m.source === 'app' && m.phone === user.phone)).map((m) => {
    const bk = club.bookings.filter((b) => b.status !== 'cancelled' && (b.by === m.id || b.players?.includes(m.id)))
    const spent = bk.filter((b) => b.by === m.id && notPack(b)).reduce((s, b) => s + b.paid, 0) + club.orders.filter((o) => o.by === m.id).reduce((s, o) => s + o.total, 0) + (club.cafeOrders || []).filter((o) => o.by === m.id).reduce((s, o) => s + o.total, 0) + club.sales.filter((x) => x.by === m.id).reduce((s, x) => s + x.price, 0)
    const lastB = bk.map((b) => fromKey(b.date).getTime()).filter((t) => t <= Date.now()).sort((a, b) => b - a)[0]
    const lastDays = lastB ? Math.floor((Date.now() - lastB) / 864e5) : 99
    const seg = m.inactive ? 'off' : m.member ? 'vip' : m.joined < 30 ? 'new' : lastDays > 10 ? 'risk' : 'active'
    return { ...m, visits: bk.length, spent, lastDays, seg, source: m.source || 'seed' }
  })
  if (user) {
    const bk = club.bookings.filter((b) => b.status !== 'cancelled' && (b.by === ME || b.players?.includes(ME)))
    rows.unshift({ id: ME, name: user.name + ' (اپ)', phone: user.phone, level: user.level, games: bk.length, visits: bk.length, wins: 0, points: 0, joined: 0, source: 'app', spent: bk.filter((b) => b.by === ME && notPack(b)).reduce((s, b) => s + b.paid, 0) + club.orders.filter((o) => o.by === ME).reduce((s, o) => s + o.total, 0) + (club.cafeOrders || []).filter((o) => o.by === ME).reduce((s, o) => s + o.total, 0) + club.sales.filter((x) => x.by === ME).reduce((s, x) => s + x.price, 0), lastDays: 0, seg: 'new', member: null })
  }
  return rows
}
export const SEGMENTS = { all: 'همه', vip: 'VIP / عضو', active: 'فعال', new: 'جدید', risk: 'در خطر ریزش', off: 'غیرفعال' }

// بازه‌های گزارش مربی: از کی تا الان
export const SPANS = { today: 'امروز', week: '۷ روز', month: '۳۰ روز', q: '۳ ماه', h: '۶ ماه', all: 'همه' }
export const spanStart = (k) => ({ today: new Date().setHours(0, 0, 0, 0), week: Date.now() - 7 * 864e5, month: Date.now() - 30 * 864e5, q: Date.now() - 91 * 864e5, h: Date.now() - 182 * 864e5 }[k] || 0)
const startOf = (b) => fromKey(b.date).getTime() + b.start * 36e5
const done = (b) => startOf(b) + b.dur * 36e5 <= Date.now()

// آمار هر مربی در بازه: جلسه‌ی برگزارشده، شاگرد، پکیج به تفکیک نوع، درآمد و نظرها
export function coachStats(club, span = 'all') {
  const since = spanStart(span)
  return COACHES.map((c) => {
    const bk = club.bookings.filter((b) => b.coach === c.id && b.status !== 'cancelled')
    const held = bk.filter((b) => done(b) && startOf(b) >= since)
    const sales = club.sales.filter((s) => s.kind === 'coach' && s.item === c.id && s.at >= since)
    const students = new Set([...held.flatMap((b) => b.players), ...sales.map((s) => s.by)])
    const rt = ratingOf(club, 'coach:' + c.id)
    const byPack = Object.fromEntries(COACH_PACKS.map((p) => [p.id, sales.filter((s) => s.pack === p.id).length]))
    return {
      ...c, rating: rt.avg, reviews: rt.count, pending: rt.list.filter((r) => r.text && r.ok === false && !r.hidden).length, comments: shownReviews(rt.list).filter((r, i, a) => a.findIndex((x) => x.text === r.text) === i).slice(0, 3),
      sessions: held.length, upcoming: bk.filter((b) => !done(b)).length, students: students.size, packsSold: sales.length, byPack,
      revenue: held.filter(notPack).reduce((s, b) => s + b.paid, 0) + sales.reduce((s, x) => s + x.price, 0),
    }
  })
}

// پرونده‌ی یک مربی در بازه: هر شاگرد با پکیج‌ها، جلسه‌ها و پرداختی؛ هر پکیج با شروع، روز و ساعت و جلسه‌های مانده
export function coachFile(club, id, user, span = 'all') {
  const since = spanStart(span)
  const bk = club.bookings.filter((b) => b.coach === id && b.status !== 'cancelled')
  const allSales = club.sales.filter((s) => s.kind === 'coach' && s.item === id).sort((a, b) => b.at - a.at)
  const sales = allSales.filter((s) => s.at >= since)
  const m = new Map()
  const get = (pid) => {
    if (!m.has(pid)) {
      const mm = memberById(pid)
      m.set(pid, { id: pid, name: who(pid, user), phone: mm?.phone || (pid === ME ? user?.phone : ''), level: mm?.level || (pid === ME ? user?.level : null), packs: [], past: 0, next: 0, last: null, upcoming: null, paid: 0 })
    }
    return m.get(pid)
  }
  bk.forEach((b) => {
    const isDone = done(b)
    if (isDone && startOf(b) < since) return
    b.players.forEach((pid) => {
      const s = get(pid)
      if (isDone) { s.past++; if (!s.last || fromKey(b.date) > fromKey(s.last)) s.last = b.date } else { s.next++; if (!s.upcoming || fromKey(b.date) < fromKey(s.upcoming)) s.upcoming = b.date }
    })
  })
  bk.filter((b) => notPack(b) && done(b) && startOf(b) >= since).forEach((b) => { get(b.by).paid += b.paid })
  sales.forEach((x) => { const s = get(x.by); s.packs.push(x); s.paid += x.price })
  const students = [...m.values()].sort((a, b) => (b.next > 0) - (a.next > 0) || b.past - a.past || b.paid - a.paid)
  const row = (ss) => ({ first: ss[0], last: ss[ss.length - 1], days: [...new Set(ss.map((b) => fromKey(b.date).getDay()))], hours: [...new Set(ss.map((b) => b.start))], used: ss.filter(done).length, nextS: ss.find((b) => !done(b)) })
  const packs = [
    ...sales.map((s) => {
      const ss = bk.filter((b) => s.series && b.series === s.series).sort((a, b) => startOf(a) - startOf(b))
      const p = COACH_PACKS.find((x) => x.id === s.pack)
      return { ...s, ...row(ss), student: who(s.by, user), packName: p?.name || s.name, total: ss.length || p?.sessions || 1 }
    }),
    // تک‌جلسه‌ها (رزرو کلاس بدون پکیج) در همان بازه
    ...bk.filter((b) => !b.series && notPack(b) && startOf(b) >= since).map((b) => ({ id: b.id, at: b.at || startOf(b), by: b.by, pack: 'one', price: b.price, method: b.method, ...row([b]), student: who(b.by, user), packName: 'تک جلسه', total: 1 })),
  ].sort((a, b) => b.at - a.at)
  const upcoming = bk.filter((b) => !done(b)).sort((a, b) => startOf(a) - startOf(b))
  const reviews = ratingOf(club, 'coach:' + id).list
  return { students, sales, packs, upcoming, reviews, active: students.filter((s) => s.next > 0).length }
}

export const csv = (rows) => '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
export function download(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
