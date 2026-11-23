import { COURTS, PACKAGES, XP_GUIDE, addDays, fa, fromKey, isPeak, levelIndex, priceFor, todayKey, clubNow, clubNowMs } from './data'
import { jParts } from './jalali'
import { DEFAULT_QUESTS, QUEST_METRICS, QUEST_PERIODS } from './quests'
import { ME, freeStarts, isFree, weekKey } from './store'

const nowH = () => { const n = clubNow(); return n.getHours() + n.getMinutes() / 60 }
export const startsAt = (b) => fromKey(b.date).getTime() + b.start * 36e5
export const isUpcoming = (b) => startsAt(b) + b.dur * 36e5 > clubNowMs()
export const sortByTime = (a, b) => startsAt(a) - startsAt(b)

// بازی‌های باز آینده که جای خالی دارند — با فاصله‌ی سطح از کاربر
export function openGames(club, level, { date } = {}) {
  const ul = levelIndex(level)
  return club.bookings
    .filter((b) => b.type === 'open' && b.status === 'ok' && b.players.length < 4 && isUpcoming(b) && (!date || b.date === date) && b.visibility !== 'private')
    .map((b) => ({ ...b, gap: Math.min(...b.levels.map((l) => Math.abs(levelIndex(l) - ul))), mine: b.players.includes(ME) }))
    .sort((a, b) => a.gap - b.gap || sortByTime(a, b))
}

// بازی‌هایی که کاربر به آن‌ها دعوت شده و هنوز جواب نداده
export function myInvites(club) {
  return club.bookings.filter((b) => b.status === 'ok' && (b.invited || []).includes(ME) && !b.players.includes(ME) && b.players.length < 4 && isUpcoming(b)).sort(sortByTime)
}

export function myBookings(club) {
  return club.bookings.filter((b) => (b.by === ME || b.players?.includes(ME)) && b.status === 'ok').sort(sortByTime)
}

// وضعیت لحظه‌ای هر زمین امروز
export function courtsNow(club) {
  const k = todayKey(), h = nowH()
  return COURTS.map((c) => {
    const list = club.bookings.filter((b) => b.date === k && b.court === c.id && b.status === 'ok')
    const cur = list.find((b) => b.start <= h && h < b.start + b.dur)
    const next = freeStarts(club, k, c.id, 1)
    return { ...c, off: !!club.off[c.id], busy: !!cur, cur, nextFree: next[0], freeCount: next.length }
  })
}

// نزدیک‌ترین ساعت‌های آزاد یک‌ساعته روی ۴ زمین (امروز و فردا) برای رزرو سریع
export function upcomingSlots(club, n = 10) {
  const out = []
  ;[todayKey(), addDays(todayKey(), 1)].forEach((d) => COURTS.forEach((c) => freeStarts(club, d, c.id, 1).forEach((h) => {
    if (h % 1 === 0) out.push({ court: c.id, date: d, start: h, price: priceFor(d, h, 1, club.pricing), peak: isPeak(d, h, club.pricing) })
  })))
  out.sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start || a.court - b.court)
  // از هر ساعت حداکثر دو زمین تا فهرست متنوع بماند
  const seen = {}
  return out.filter((x) => (seen[x.date + x.start] = (seen[x.date + x.start] || 0) + 1) <= 2).slice(0, n)
}

// برنامه‌ی جلسه‌های پکیج: هر هفته همان روز و ساعت؛ اگر زمین پر بود زمین دیگر،
// بعد یک یا دو ساعت جلوتر/عقب‌تر همان روز، و اگر هیچ‌کدام نشد آن هفته رد می‌شود
export function planSeries(club, { court, date, start, dur, count, coach, days }) {
  const coachFree = (d, h) => !coach || !club.bookings.some((b) => b.coach === coach && b.date === d && b.status !== 'cancelled' && h < b.start + b.dur && b.start < h + dur)
  const ok = (d, c, h) => isFree(club, d, c, h, dur) && coachFree(d, h)
  const courts = [court, ...COURTS.map((c) => c.id).filter((x) => x !== court)]
  const out = []
  let skipped = 0
  // days: روزهای هفته (getDay)؛ بدون آن هر هفته همان روز
  const dates = []
  if (days?.length > 1) { for (let k = 0; dates.length < count + 8 && k < (count + 8) * 7; k++) { const d = addDays(date, k); if (days.includes(fromKey(d).getDay())) dates.push(d) } }
  else for (let k = 0; k < count + 8; k++) dates.push(addDays(date, 7 * k))
  for (const d of dates) {
    if (out.length >= count) break
    let pick = null
    for (const delta of [0, 1, -1, 2, -2]) {
      const c = courts.find((x) => ok(d, x, start + delta))
      if (c) { pick = { date: d, court: c, start: start + delta, dur, moved: c !== court || delta !== 0 }; break }
    }
    if (pick) out.push(pick); else skipped++
  }
  return { sessions: out, skipped, complete: out.length === count }
}

// ---------- چالش‌ها و امتیاز ----------
// تعریف‌ها را مدیر می‌سازد (club.quests)؛ ثابت‌ها در quests.js
export { DEFAULT_QUESTS, QUEST_METRICS, QUEST_PERIODS }
export const QUEST_ONCE = '2000-01-01'
const ymd = (k) => k.split('-').map((x, i) => (i ? x.padStart(2, '0') : x)).join('-')
// کلید بازه همان کلید سرور: شنبه‌ی هفته، روز اول ماه شمسی، یا کلید ثابت یک‌باره
export function questKey(period) {
  if (period === 'once') return QUEST_ONCE
  if (period === 'month') { const t = todayKey(); return ymd(addDays(t, -(jParts(t).d - 1))) }
  return weekKey()
}
export const questDefs = (club) => (Array.isArray(club.quests) ? club.quests : DEFAULT_QUESTS)

function questHave(s, metric, from) {
  const c = s.club, since = (x) => from == null || x.at >= from
  if (metric === 'event') return (c.events || []).filter((e) => e.status !== 'cancelled' && e.status !== 'draft').reduce((n, e) => n + (e.regs || []).filter((r) => r.by === ME && since(r)).length, 0)
  if (metric === 'shop') return (c.orders || []).filter((o) => o.by === ME && since(o)).length
  if (metric === 'cafe') return (c.cafeOrders || []).filter((o) => o.by === ME && since(o)).length
  const mine = c.bookings.filter((b) => (b.by === ME || b.players?.includes(ME)) && b.status === 'ok' && since(b))
  return metric === 'play' ? mine.length : mine.filter((b) => b.type === metric).length
}

export function quests(s) {
  return questDefs(s.club).filter((q) => q.active).map((q) => {
    const key = questKey(q.period)
    const from = q.period === 'once' ? null : fromKey(key.split('-').map(Number).join('-')).getTime()
    const done = (s.quests || {})[key] || []
    const claimed = done.includes(q.id)
    const have = questHave(s, q.metric, from)
    return { ...q, have, when: QUEST_PERIODS[q.period] || '', ready: have >= q.goal && !claimed, claimed }
  })
}

// ردیف چالش‌ها در راهنمای XP: بازه‌ی جایزه‌ی چالش‌های فعال
export function xpGuide(club) {
  const xs = questDefs(club).filter((q) => q.active).map((q) => q.xp)
  const lo = Math.min(...xs), hi = Math.max(...xs)
  return XP_GUIDE.map(([k, v]) => (k.startsWith('چالش') ? [k, xs.length ? (lo === hi ? fa(lo) : `${fa(lo)} تا ${fa(hi)}`) : 'فعلاً چالشی نیست'] : [k, v]))
}

// تعداد هفته‌های پشت‌سرهم با حداقل یک بازی
export function streak(s) {
  const mine = s.club.bookings.filter((b) => (b.by === ME || b.players?.includes(ME)) && b.status === 'ok')
  if (!mine.length) return 0
  const weeks = new Set(mine.map((b) => Math.floor((b.at - 3 * 864e5) / (7 * 864e5))))
  let n = 0, w = Math.floor((Date.now() - 3 * 864e5) / (7 * 864e5))
  while (weeks.has(w)) { n++; w-- }
  return n
}

export const activeMembership = (s) => (s.membership && s.membership.until > Date.now() ? PACKAGES.find((p) => p.id === s.membership.id) : null)
