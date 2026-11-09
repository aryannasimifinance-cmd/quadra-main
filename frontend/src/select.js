import { COURTS, PACKAGES, addDays, fromKey, isPeak, levelIndex, priceFor, todayKey } from './data'
import { ME, freeStarts, isFree, weekKey } from './store'

const nowH = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60 }
export const startsAt = (b) => fromKey(b.date).getTime() + b.start * 36e5
export const isUpcoming = (b) => startsAt(b) + b.dur * 36e5 > Date.now()
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

export function quests(s) {
  const wk = weekKey()
  const from = fromKey(wk.split('-').map(Number).join('-')).getTime()
  const mine = s.club.bookings.filter((b) => (b.by === ME || b.players?.includes(ME)) && b.status === 'ok' && b.at >= from)
  const done = s.quests[wk] || []
  return [
    { id: 'play2', icon: '🎾', name: 'هفته‌ی پرکار', desc: 'این هفته ۲ بار به زمین بیایید (رزرو، بازی باز یا کلاس)', goal: 2, have: mine.length, xp: 60 },
    { id: 'social', icon: '🤝', name: 'یار جدید', desc: 'یک بازی باز بسازید یا به بازی باز دیگران بپیوندید', goal: 1, have: mine.filter((b) => b.type === 'open').length, xp: 40 },
    { id: 'coach', icon: '🧢', name: 'جلسه‌ی هفته', desc: 'این هفته یک جلسه با یکی از مربی‌ها داشته باشید', goal: 1, have: mine.filter((b) => b.type === 'coach').length, xp: 40 },
  ].map((q) => ({ ...q, ready: q.have >= q.goal && !done.includes(q.id), claimed: done.includes(q.id) }))
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
