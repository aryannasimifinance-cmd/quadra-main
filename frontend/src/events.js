// مسابقات آدینه و تورنمنت‌ها: ثبت‌نام، تیم‌بندی متعادل، گروه‌ها، مرحله‌ی حذفی، برنده‌ها و فروش کافه‌ی همان روز
// همه‌ی داده در club.events ذخیره می‌شود تا مدیر تعریف و ویرایش کند و اپ همان را نشان دهد.
import { EV_IMG, VIBORA_IMG, FRIDAY, LEVELS, MEMBERS, OFFICIAL, addDays, dayKey, fromKey, hash, levelById, nextDays, todayKey } from './data'
import { dk, jParts } from './jalali'

export const EV_STATUS = { draft: ['پیش‌نویس', 'mute'], open: ['ثبت‌نام باز', 'ok'], closed: ['ثبت‌نام بسته', 'warn'], done: ['برگزار شد', 'mute'], cancelled: ['لغو شد', 'bad'] }
export const EV_FORMAT = { groups: 'گروهی + حذفی', knockout: 'فقط حذفی' }
export const ROUND = { 32: 'یک‌شانزدهم', 16: 'یک‌هشتم', 8: 'یک‌چهارم', 4: 'نیمه‌نهایی', 2: 'فینال' }
export const GROUP_IDS = 'ABCDEFGHIJKLMNOP'

export const regPower = (r) => levelById(r.level)?.base || 1500
export const teamOf = (ev, id) => ev.teams.find((t) => t.id === id)
export const teamName = (ev, id) => teamOf(ev, id)?.name || '—'
export const isLive = (ev) => ev.status === 'open' || ev.status === 'closed'

// ---------- امتیازدهی پدل (همان قانون تنیس) ----------
// گیم: ۱۵، ۳۰، ۴۰، گیم؛ ست: هر کس زودتر ۶ گیم با دو اختلاف (۶–۴، ۷–۵)؛ در ۶–۶ تای‌بریک و ست ۷–۶ تمام می‌شود.
// پرو ست: ۹ گیم با دو اختلاف، در ۸–۸ تای‌بریک (۹–۸). دو از سه: اگر ست‌ها ۱–۱ شد ست سوم کامل، در ۶–۶ تای‌بریک ۷ امتیازی.
export const SCORING = {
  set6: { name: 'یک ست ۶ گیمی', sub: 'در ۶–۶ تای‌بریک؛ مثل ۶–۳ یا ۷–۶', sets: 1, games: 6, tbAt: 6 },
  pro9: { name: 'پرو ست ۹ گیمی', sub: 'در ۸–۸ تای‌بریک؛ مثل ۹–۵ یا ۹–۸', sets: 1, games: 9, tbAt: 8 },
  bo3: { name: 'دو ست از سه', sub: 'ست‌های ۶ گیمی؛ اگر ۱–۱ شد ست سوم کامل زده می‌شود؛ در ۶–۶ هر ست تای‌بریک ۷ امتیازی (۷–۶)', sets: 3, games: 6, tbAt: 6 },
}
export const scoringOf = (ev) => SCORING[ev.scoring] || SCORING.set6
// سطح مجاز: در اپ فقط اعضای همین سطح‌ها (یا مهمان با سطح مجاز) ثبت‌نام می‌کنند
export const levelOk = (ev, lv) => !ev.levels?.length || (!!lv && ev.levels.includes(lv))
// جنسیت و سن: هر رویداد می‌تواند ویژه‌ی بانوان/آقایان باشد و بازه‌ی سنی داشته باشد
export const GENDER = { f: 'خانم', m: 'آقا' }
export const AUDIENCE = { all: 'همه', f: 'ویژه‌ی بانوان', m: 'ویژه‌ی آقایان' }
export const ageOf = (p) => (p?.birth ? jParts(todayKey()).y - p.birth : null)
const ageRule = (ev) => (ev.ageMin || ev.ageMax ? (ev.ageMin && ev.ageMax ? `${ev.ageMin} تا ${ev.ageMax} سال` : ev.ageMin ? `${ev.ageMin} سال به بالا` : `تا ${ev.ageMax} سال`) : '')
// متن «چه کسانی»: سطح، جنسیت و سن در یک خط (اعداد را صفحه‌ها فارسی می‌کنند)
export const audienceText = (ev) => [ev.gender && ev.gender !== 'all' && AUDIENCE[ev.gender], ageRule(ev)].filter(Boolean).join('، ')
// چرا این نفر نمی‌تواند شرکت کند؟ null یعنی مجاز است. p: { level, gender, birth }
export function whyNot(ev, p) {
  if (!levelOk(ev, p?.level)) return 'level'
  if (ev.gender && ev.gender !== 'all' && p?.gender !== ev.gender) return 'gender'
  const a = ageOf(p)
  if ((ev.ageMin || ev.ageMax) && (a == null || (ev.ageMin && a < ev.ageMin) || (ev.ageMax && a > ev.ageMax))) return 'age'
  return null
}
export const whyText = (ev, why) => ({ level: `فقط سطح ${(ev.levels || []).join(' / ')}`, gender: AUDIENCE[ev.gender], age: `فقط ${ageRule(ev)}` }[why] || '')
// آیا نتیجه‌ی یک ست درست است؟
export function setOk(a, b, sc, stb) {
  const hi = Math.max(a, b), lo = Math.min(a, b), g = sc.games
  if (a == null || b == null || a === b) return false
  if (stb) return hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2)
  if (hi === g) return lo <= g - 2 || (sc.tbAt === g - 1 && lo === g - 1)
  if (hi === g + 1 && sc.tbAt === g) return lo === g - 1 || lo === g
  return false
}
// ست‌های هر بازی؛ داده‌ی قدیمی فقط گیم یک ست را در sa/sb داشت
export const setsOf = (m) => m.sets || (m.sa != null && m.sb != null ? [[m.sa, m.sb]] : [])
// نتیجه‌ی بازی از روی ست‌ها: چند ست هر تیم برده، تمام شده یا نه، و اگر غلط است چرا
export function judge(ev, sets) {
  const sc = scoringOf(ev), need = Math.ceil(sc.sets / 2)
  let a = 0, b = 0, why = null
  for (let i = 0; i < sets.length; i++) {
    const [x, y] = sets[i]
    if (a === need || b === need) { why = 'بازی قبلاً تمام شده'; break }
    if (!setOk(x, y, sc, sc.stb && i === 2)) { why = sc.stb && i === 2 ? `سوپرتای‌بریک ${x}–${y} درست نیست` : `ست ${x}–${y} درست نیست`; break }
    if (x > y) a++; else b++
  }
  return { a, b, done: !why && (a === need || b === need), why }
}

// ---------- انتخاب‌ها ----------
export const upcoming = (club) => (club.events || []).filter((e) => isLive(e) && fromKey(e.date) >= fromKey(todayKey())).sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
export const finished = (club) => (club.events || []).filter((e) => e.status === 'done').sort((a, b) => fromKey(b.date) - fromKey(a.date))
// مسابقه‌ی همان روز: هر خرید کافه در روز آدینه یا مسابقه، فروش همان روز مسابقه است
export function eventAt(events, ts) {
  const k = dk(ts)
  return (events || []).find((e) => e.date === k && e.status !== 'draft' && e.status !== 'cancelled')
}
// برای اپ: رویدادهای پیش‌روی منتشرشده با شکل قبلی (format = متن توضیح، taken = تعداد ثبت‌نام)
export const asApp = (e) => ({ ...e, format: e.desc || EV_FORMAT[e.format], taken: e.regs.length })
export const appEvents = (club) => upcoming(club).map(asApp)
export const cafeOf = (club, ev) => (club.cafeOrders || []).filter((o) => eventAt([ev], o.at))
export const entryTotal = (ev) => ev.regs.reduce((s, r) => s + (r.paid || 0), 0)

// ---------- تیم‌بندی: قوی‌ترین با ضعیف‌ترین تا تیم‌ها هم‌سطح شوند ----------
const short = (n) => (n || '').split(' ')[0]
export function makeTeams(ev) {
  const teams = []
  const pairs = new Map()
  ev.regs.filter((r) => r.pair).forEach((r) => pairs.set(r.pair, [...(pairs.get(r.pair) || []), r.id]))
  ;[...pairs.values()].filter((p) => p.length === 2).forEach((p) => teams.push({ id: 't' + (teams.length + 1), players: p, pair: true }))
  const taken = new Set(teams.flatMap((x) => x.players))
  const regs = ev.regs.filter((r) => !taken.has(r.id)).sort((a, b) => regPower(b) - regPower(a))
  while (regs.length) {
    const a = regs.shift(), b = regs.pop()
    teams.push({ id: 't' + (teams.length + 1), players: b ? [a.id, b.id] : [a.id] })
  }
  return { ...ev, teams: teams.map((t) => named(ev, t)), groups: [], matches: [] }
}
function named(ev, t) {
  return { ...t, name: t.players.map((p) => short(ev.regs.find((r) => r.id === p)?.name)).join(' / ') }
}
const teamPower = (ev, t) => t.players.reduce((s, p) => s + regPower(ev.regs.find((r) => r.id === p) || {}), 0)
// ---------- تیم‌سازی دستی مدیر ----------
// کسانی که هنوز در هیچ تیمی نیستند (ثبت‌نام تکی یا «منتظر یار»)
export const singles = (ev) => { const inT = new Set(ev.teams.flatMap((t) => t.players)); return ev.regs.filter((r) => !inT.has(r.id)) }
// زوج‌هایی که با هم ثبت‌نام کرده‌اند و هنوز تیم نشده‌اند
export const loosePairs = (ev) => { const m = new Map(); singles(ev).filter((r) => r.pair).forEach((r) => m.set(r.pair, [...(m.get(r.pair) || []), r.id])); return [...m.values()].filter((p) => p.length === 2) }
export const withPairs = (ev) => loosePairs(ev).reduce((e, p, i) => ({ ...e, teams: [...e.teams, named(e, { id: 't' + e.teams.length + 'p' + i + Date.now().toString(36), players: p, pair: true })] }), ev)
export const pairUp = (ev, a, b) => ({ ...ev, teams: [...ev.teams, named(ev, { id: 't' + Date.now().toString(36), players: [a, b].filter(Boolean) })], groups: [], matches: [] })
// جدا کردن تیم؛ اگر با هم ثبت‌نام کرده بودند پیوندشان هم برداشته می‌شود تا دوباره خودکار جفت نشوند
export const unpair = (ev, tid) => {
  const t = ev.teams.find((x) => x.id === tid)
  const out = new Set(t?.players || [])
  return { ...ev, regs: ev.regs.map((r) => (out.has(r.id) && r.pair ? { ...r, pair: null, waiting: true } : r)), teams: ev.teams.filter((x) => x.id !== tid), groups: [], matches: [] }
}
// تیم‌های موجود می‌مانند؛ زوج‌های ثبت‌نامی تیم می‌شوند و منتظرها هم‌سطح جفت می‌شوند
export function fillTeams(ev) {
  let e = ev
  const pairs = new Map()
  singles(e).filter((r) => r.pair).forEach((r) => pairs.set(r.pair, [...(pairs.get(r.pair) || []), r.id]))
  ;[...pairs.values()].filter((p) => p.length === 2).forEach((p) => { e = { ...e, teams: [...e.teams, named(e, { id: 't' + e.teams.length + Date.now().toString(36), players: p, pair: true })] } })
  const rest = singles(e).sort((a, b) => regPower(b) - regPower(a))
  while (rest.length > 1) { const a = rest.shift(), b = rest.pop(); e = { ...e, teams: [...e.teams, named(e, { id: 't' + e.teams.length + Date.now().toString(36), players: [a.id, b.id] })] } }
  return { ...e, groups: [], matches: [] }
}
// انتقال یا افزودن یک تیم به گروه؛ بازی‌های دو گروه درگیر از نو ساخته می‌شوند و حذفی پاک می‌شود
export function moveTeam(ev, tid, gid) {
  const from = ev.groups.find((g) => g.teams.includes(tid))?.id
  const groups = ev.groups.map((g) => ({ ...g, teams: g.id === gid ? [...g.teams.filter((x) => x !== tid), tid] : g.teams.filter((x) => x !== tid) }))
  const touched = [from, gid]
  const keep = ev.matches.filter((m) => m.stage === 'group' && !touched.includes(m.group))
  const fresh = groups.filter((g) => touched.includes(g.id)).flatMap((g) => rr(ev, g))
  return { ...ev, groups, matches: [...keep, ...fresh] }
}
export const showsResults = (ev) => ev.showResults !== false
// صفحه‌ی قهرمان در اپ: مدیر انتخاب می‌کند نشان داده شود یا نه (پیش‌فرض: نشان داده می‌شود)
export const champOn = (ev) => ev.champPub !== false && !!podium(ev)

// جابه‌جا کردن دو بازیکن بین تیم‌ها (یا داخل یک تیم که اثری ندارد)
export function swapPlayers(ev, p1, p2) {
  const teams = ev.teams.map((t) => ({ ...t, players: t.players.map((p) => (p === p1 ? p2 : p === p2 ? p1 : p)) })).map((t) => named(ev, t))
  return { ...ev, teams }
}

// ---------- گروه‌ها: پخش ماری تیم‌ها به ترتیب قدرت، هر گروه دوره‌ای ----------
export function makeGroups(ev, opt = {}) {
  const teams = [...ev.teams].sort((a, b) => teamPower(ev, b) - teamPower(ev, a))
  const n = Math.max(1, Math.min(opt.groups || Math.round(teams.length / 4), Math.floor(teams.length / 2) || 1))
  const groups = Array.from({ length: n }, (_, i) => ({ id: GROUP_IDS[i], teams: [] }))
  teams.forEach((t, i) => { const row = Math.floor(i / n), col = row % 2 ? n - 1 - (i % n) : i % n; groups[col].teams.push(t.id) })
  const matches = []
  groups.forEach((g) => roundRobin(g.teams).forEach(([a, b], k) => matches.push({ id: `g${g.id}${k + 1}`, stage: 'group', group: g.id, a, b, sa: null, sb: null, court: ev.courts?.[k % (ev.courts?.length || 1)] || 1 })))
  const size = Math.min(...groups.map((g) => g.teams.length))
  return { ...ev, groups, matches, setup: { groups: n, advance: Math.min(opt.advance || (n === 1 ? Math.min(4, teams.length) : 2), size) } }
}
const rr = (ev, g) => roundRobin(g.teams).map(([a, b], k) => ({ id: `g${g.id}${k + 1}`, stage: 'group', group: g.id, a, b, sa: null, sb: null, court: ev.courts?.[k % (ev.courts?.length || 1)] || 1 }))
// گروه‌های خالی تا مدیر تیم‌ها را خودش در آن‌ها بچیند
export const emptyGroups = (ev, n, advance = 2) => ({ ...ev, groups: Array.from({ length: Math.min(16, n) }, (_, i) => ({ id: GROUP_IDS[i], teams: [] })), matches: [], setup: { groups: n, advance } })
export const addGroup = (ev) => (ev.groups.length >= 16 ? ev : { ...ev, groups: [...ev.groups, { id: GROUP_IDS.split('').find((L) => !ev.groups.some((g) => g.id === L)), teams: [] }] })
// حذف گروه: تیم‌هایش بیرون می‌آیند و حذفی پاک می‌شود
export const dropGroup = (ev, gid) => ({ ...ev, groups: ev.groups.filter((g) => g.id !== gid), matches: ev.matches.filter((m) => m.stage === 'group' && m.group !== gid) })
// تیم‌های بیرون از گروه‌ها به ترتیب قدرت در گروه‌های کم‌جمعیت‌تر پخش می‌شوند؛ تیم‌های چیده‌شده جابه‌جا نمی‌شوند
export function fillGroups(ev) {
  const placed = new Set(ev.groups.flatMap((g) => g.teams))
  const rest = ev.teams.filter((t) => !placed.has(t.id)).sort((a, b) => teamPower(ev, b) - teamPower(ev, a))
  if (!ev.groups.length || !rest.length) return ev
  const groups = ev.groups.map((g) => ({ ...g, teams: [...g.teams] }))
  rest.forEach((t) => { const g = groups.reduce((m, x) => (x.teams.length < m.teams.length ? x : m)); g.teams.push(t.id) })
  const touched = groups.filter((g, i) => g.teams.length !== ev.groups[i].teams.length).map((g) => g.id)
  return { ...ev, groups, matches: [...ev.matches.filter((m) => m.stage === 'group' && !touched.includes(m.group)), ...groups.filter((g) => touched.includes(g.id)).flatMap((g) => rr(ev, g))] }
}
// پیش‌نمایش طرح مسابقه: چند تیم صعود می‌کنند و حذفی از کدام دور شروع می‌شود
export function plan(teams, groups, advance) {
  const per = Math.floor(teams / groups), extra = teams % groups
  const q = Math.min(teams, groups * advance)
  let size = 2; while (size < q) size *= 2
  const games = Array.from({ length: groups }, (_, i) => { const k = per + (i < extra ? 1 : 0); return (k * (k - 1)) / 2 }).reduce((a, b) => a + b, 0)
  return { per, extra, q, size, byes: size - q, games, koGames: size - 1 - (size - q) }
}
// روش دایره‌ای: در هر دور همه یک بار بازی می‌کنند و هیچ تیمی پشت سر هم بازی نمی‌کند
function roundRobin(ids) {
  const t = ids.length % 2 ? [...ids, null] : [...ids]
  const n = t.length, out = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) out.push([a, b]) }
    t.splice(1, 0, t.pop())
  }
  return out
}
export const scored = (m) => m.sa != null && m.sb != null && m.sa !== m.sb
export const winnerOf = (m) => (m.b == null ? m.a : scored(m) ? (m.sa > m.sb ? m.a : m.b) : null)
export const loserOf = (m) => (m.b == null || !scored(m) ? null : m.sa > m.sb ? m.b : m.a)

export function standings(ev, gid) {
  const g = ev.groups.find((x) => x.id === gid)
  const rows = g.teams.map((id) => ({ id, name: teamName(ev, id), p: 0, w: 0, l: 0, sf: 0, sa: 0, gf: 0, ga: 0 }))
  ev.matches.filter((m) => m.stage === 'group' && m.group === gid && scored(m)).forEach((m) => {
    const A = rows.find((r) => r.id === m.a), B = rows.find((r) => r.id === m.b)
    if (!A || !B) return
    A.p++; B.p++
    setsOf(m).forEach(([x, y]) => { A.gf += x; A.ga += y; B.gf += y; B.ga += x; if (x > y) { A.sf++; B.sa++ } else { B.sf++; A.sa++ } })
    if (m.sa > m.sb) { A.w++; B.l++ } else { B.w++; A.l++ }
  })
  // قانون پدل (FIP): بیشترین برد، بعد بازی رودررو، بعد تفاضل ست، بعد تفاضل گیم
  return rows.sort((a, b) => b.w - a.w || h2h(ev, a.id, b.id) || (b.sf - b.sa) - (a.sf - a.sa) || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
}
function h2h(ev, a, b) {
  const m = ev.matches.find((x) => x.stage === 'group' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)))
  const w = m && winnerOf(m)
  return w === a ? -1 : w === b ? 1 : 0
}
export const groupsDone = (ev) => ev.groups.length > 0 && ev.matches.filter((m) => m.stage === 'group').every(scored)

// ---------- مرحله‌ی حذفی: سیدها ۱ با آخر، ۲ با یکی مانده به آخر و … ؛ جای خالی = استراحت (bye) ----------
export function makeKnockout(ev, perGroup) {
  let seeds
  if (ev.format === 'knockout' || !ev.groups.length) seeds = [...ev.teams].sort((a, b) => teamPower(ev, b) - teamPower(ev, a)).map((t) => t.id)
  else {
    const tables = ev.groups.map((g) => standings(ev, g.id))
    const per = Math.min(perGroup ?? ev.setup?.advance ?? (ev.groups.length === 1 ? 4 : 2), ...tables.map((x) => x.length))
    seeds = []
    // اول‌های گروه‌ها سیدهای بالا، دوم‌ها پایین؛ ترتیب جدول، اول هر گروه را به دوم گروه دیگر می‌رساند
    for (let k = 0; k < per; k++) tables.forEach((t) => t[k] && seeds.push(t[k].id))
  }
  let size = 2; while (size < seeds.length) size *= 2
  const slots = order(size)
  const matches = []
  for (let i = 0; i < size / 2; i++) {
    const a = seeds[slots[2 * i] - 1] ?? null, b = seeds[slots[2 * i + 1] - 1] ?? null
    matches.push({ id: `k${size}-${i + 1}`, stage: 'ko', round: size, idx: i, a: a ?? b, b: a == null ? null : b, sa: null, sb: null })
  }
  return advance({ ...ev, matches: [...ev.matches.filter((m) => m.stage === 'group'), ...matches] })
}
// ترتیب استاندارد جدول حذفی تا سید ۱ و ۲ فقط در فینال به هم برسند
function order(size) {
  let s = [1, 2]
  while (s.length < size) { const n = s.length * 2 + 1; s = s.flatMap((x) => [x, n - x]) }
  return s
}
// اگر یک دور کامل شد، دور بعد ساخته می‌شود
export function advance(ev) {
  let out = ev
  for (;;) {
    const ko = out.matches.filter((m) => m.stage === 'ko')
    if (!ko.length) return out
    const last = Math.min(...ko.map((m) => m.round))
    const cur = ko.filter((m) => m.round === last).sort((a, b) => a.idx - b.idx)
    if (last <= 2 || !cur.every((m) => winnerOf(m))) return out
    const next = []
    for (let i = 0; i < cur.length; i += 2) next.push({ id: `k${last / 2}-${i / 2 + 1}`, stage: 'ko', round: last / 2, idx: i / 2, a: winnerOf(cur[i]), b: winnerOf(cur[i + 1]), sa: null, sb: null })
    out = { ...out, matches: [...out.matches, ...next] }
  }
}
// ثبت نتیجه؛ اگر نتیجه‌ی یک دور حذفی عوض شود، دورهای بعدش از نو ساخته می‌شوند
export function setScore(ev, id, sets) {
  const m = ev.matches.find((x) => x.id === id)
  const r = sets?.length ? judge(ev, sets) : null
  let matches = ev.matches.map((x) => (x.id === id ? { ...x, sets: sets?.length ? sets : null, sa: r?.done ? r.a : null, sb: r?.done ? r.b : null } : x))
  if (m.stage === 'ko') matches = matches.filter((x) => x.stage !== 'ko' || x.round >= m.round)
  return advance({ ...ev, matches })
}
export function podium(ev) {
  const fin = ev.matches.find((m) => m.stage === 'ko' && m.round === 2)
  if (!fin || !winnerOf(fin)) return null
  const semis = ev.matches.filter((m) => m.stage === 'ko' && m.round === 4).map(loserOf).filter(Boolean)
  return { first: winnerOf(fin), second: loserOf(fin), third: semis }
}
export const koRounds = (ev) => [...new Set(ev.matches.filter((m) => m.stage === 'ko').map((m) => m.round))].sort((a, b) => b - a)

// ---------- زمین‌های مسابقه در تقویم ----------
export const blocksOf = (ev) => (ev.status === 'draft' || ev.status === 'cancelled' ? [] : ev.courts.map((c) => ({
  id: `ev-${ev.id}-${c}`, court: c, date: ev.date, start: ev.start, dur: ev.dur, type: 'block', note: `🏆 ${ev.title}`, event: ev.id,
  by: null, players: [], price: 0, paid: 0, status: 'ok', source: 'desk', at: Date.now(),
})))
// رزروهای این مسابقه جایگزین قبلی‌ها می‌شوند
export const syncBlocks = (bookings, ev) => [...bookings.filter((b) => b.event !== ev.id), ...blocksOf(ev)]
// رزروهای عادی که با ساعت مسابقه روی زمین‌های انتخابی هم‌پوشانی دارند
export const clashes = (bookings, ev) => bookings.filter((b) => b.event !== ev.id && b.status !== 'cancelled' && b.date === ev.date && ev.courts.includes(b.court) && b.start < ev.start + ev.dur && ev.start < b.start + b.dur)

// ---------- داده‌ی نمونه ----------
const rh = (x) => hash(x + '#ev')
function fakeRegs(id, n, fee, date, ev) {
  const pool = [...MEMBERS].filter((m) => !ev || ev.gender === 'all' || !ev.gender || m.gender === ev.gender).sort((a, b) => rh(id + a.id) - rh(id + b.id)).slice(0, n)
  const at0 = fromKey(date).getTime() - 6 * 864e5
  return pool.map((m, i) => {
    const j = i - (i % 2)
    return { id: `r${i + 1}`, by: m.id, name: m.name, level: m.level, phone: m.phone, at: at0 + j * 36e5 * 3, method: rh(id + 'pm' + j) < 0.6 ? 'online' : rh(id + 'pm2' + j) < 0.5 ? 'card' : 'cash', paid: fee, source: rh(id + 's' + j) < 0.7 ? 'app' : 'desk', ...(i + 1 < n || i % 2 ? { pair: `${id}-p${j}`, payer: pool[j].id } : {}) }
  })
}
// نتیجه‌ی یک بازی تک‌ستی ۶ گیمی؛ تیم قوی‌تر شانس بیشتری دارد
function play(ev, m, key) {
  const pa = teamPower(ev, teamOf(ev, m.a)), pb = teamPower(ev, teamOf(ev, m.b))
  const aWins = rh(key) < 0.5 + Math.max(-0.3, Math.min(0.3, (pa - pb) / 1500))
  const lose = Math.floor(rh(key + 'l') * 5)
  return aWins ? [6, lose] : [lose, 6]
}
function runAll(ev) {
  let e = ev
  e.matches.filter((m) => m.stage === 'group').forEach((m) => { e = setScore(e, m.id, [play(e, m, e.id + m.id)]) })
  e = makeKnockout(e)
  for (let guard = 0; guard < 8; guard++) {
    const open = e.matches.find((m) => m.stage === 'ko' && m.b != null && !scored(m))
    if (!open) break
    e = setScore(e, open.id, [play(e, open, e.id + open.id)])
  }
  return e
}

export function seedEvents() {
  const out = [], sales = []
  const today = todayKey()
  const base = (o) => ({ courts: [1, 2, 3, 4], regs: [], teams: [], groups: [], matches: [], note: '', ...o })
  // آدینه‌های گذشته با نتیجه‌ی کامل
  const pastF = []
  for (let d = -1; d >= -50 && pastF.length < 6; d--) { const k = addDays(today, d); if (fromKey(k).getDay() === 5) pastF.push(k) }
  pastF.forEach((k, i) => {
    const f = FRIDAY[i % FRIDAY.length]
    let ev = base({ id: 'fr-' + k, kind: 'friday', title: i === 0 ? 'آدینه‌ی کوادرا' : f.title, desc: f.format, gender: i === 0 ? 'all' : f.gender || 'all', format: 'groups', date: k, start: 9, dur: 3, levels: LEVELS.slice(2, 6).map((l) => l.id), cap: 16, fee: 750000, prize: 'راکت Wilson + توپ', img: EV_IMG[1 + (i % (EV_IMG.length - 1))], status: 'done' })
    ev.regs = fakeRegs(ev.id, 12 + 2 * Math.floor(rh(k) * 3), ev.fee, k, ev)
    out.push(runAll(makeGroups(makeTeams(ev))))
  })
  const off = (() => { for (let d = -9; d >= -20; d--) { const k = addDays(today, d); if (fromKey(k).getDay() === 4) return k } return addDays(today, -12) })()
  let cup = base({ id: 'of-' + off, kind: 'official', title: 'ایونت ویبورا — دورهمی ماه', desc: 'تیم‌های دونفره، گروهی + حذفی', format: 'groups', date: off, start: 17, dur: 4, levels: LEVELS.slice(0, 5).map((l) => l.id), cap: 24, fee: 900000, prize: 'راکت + کارت هدیه‌ی کافه', img: VIBORA_IMG, status: 'done' })
  cup.regs = fakeRegs(cup.id, 20, cup.fee, off)
  out.push(runAll(makeGroups(makeTeams(cup))))
  // پیش‌رو: چهار آدینه‌ی بعدی و دو ایونت ویبورا، با ثبت‌نام‌های تا امروز
  nextDays(28, 1).filter((d) => d.getDay() === 5).slice(0, 4).forEach((d, i) => {
    const k = dayKey(d), lv = Math.floor(rh('lv' + k) * 5)
    const f = i === 0 ? { ...FRIDAY[0], title: 'آدینه‌ی این هفته‌ی کوادرا' } : FRIDAY[i % FRIDAY.length]
    const ev = base({ id: 'fr-' + k, kind: 'friday', title: f.title, desc: f.format, gender: f.gender || 'all', format: 'groups', date: k, start: 9, dur: 3, levels: LEVELS.slice(lv, lv + 3).map((l) => l.id), cap: 16, fee: 750000, prize: 'راکت Wilson + توپ', img: EV_IMG[1 + (i % (EV_IMG.length - 1))], status: 'open' })
    ev.regs = fakeRegs(ev.id, Math.floor(16 * (0.35 + rh('tk' + i) * 0.45)), ev.fee, k, ev).map((r) => ({ ...r, at: Math.min(r.at, Date.now() - (i + 1) * 36e5) }))
    out.push(ev)
  })
  OFFICIAL.forEach((o, i) => {
    const d = nextDays(7, o.in).find((x) => x.getDay() === 4), k = dayKey(d)
    const ev = base({ id: 'of-' + k, kind: 'official', title: o.title, desc: o.format, format: 'groups', date: k, start: 17, dur: 4, levels: LEVELS.slice(0, 5).map((l) => l.id), cap: 24, fee: 900000, prize: o.prize, img: VIBORA_IMG, status: 'open' })
    ev.regs = fakeRegs(ev.id, 2 * Math.floor(12 * (0.3 + rh('of' + i) * 0.35)), ev.fee, k).map((r) => ({ ...r, at: Math.min(r.at, Date.now() - (i + 2) * 36e5) }))
    out.push(ev)
  })
  out.forEach((ev) => sales.push(...regSales(ev)))
  return { events: out, sales }
}
// هر تیم یک فروش «رویداد» در حسابداری است (کسی که پرداخت کرده، ورودی هر دو نفر)
function regSales(ev) {
  const seen = new Map(), sales = []
  ev.regs.forEach((r) => {
    const key = r.pair || r.id
    if (!seen.has(key)) {
      const id = `S-E${ev.id}-${r.id}`, both = ev.regs.filter((x) => (x.pair || x.id) === key)
      seen.set(key, id)
      sales.push({ id, kind: 'event', item: ev.id, name: both.length > 1 ? `${ev.title}، تیم ${both.map((x) => x.name.split(' ')[0]).join(' و ')}` : ev.title, by: r.payer || r.by, price: both.reduce((s, x) => s + x.paid, 0), method: r.method, at: r.at })
    }
    r.sale = seen.get(key)
  })
  return sales
}
// آدینه‌ی این هفته در داده‌ی نمونه: چند تیم دونفره و چند نفر بی‌یار، تا سازوکار تیم‌سازی دیده شود
function withSingles(c) {
  const i = c.events.findIndex((e) => e.kind === 'friday' && e.status === 'open' && fromKey(e.date) >= fromKey(todayKey()))
  if (i < 0) return { ...c, evSingles: true }
  const e = c.events[i]
  const regs = fakeRegs(e.id, 11, e.fee, e.date).map((r, k, all) => ({ ...r, at: Math.min(r.at, Date.now() - (all.length - k) * 36e5), ...(k >= all.length - 3 ? { pair: null, payer: null, waiting: true } : {}) }))
  const ev = { ...e, regs, teams: [], groups: [], matches: [] }
  const sales = regSales(ev)
  return { ...c, events: c.events.map((x, j) => (j === i ? ev : x)), sales: [...sales, ...c.sales.filter((s) => s.item !== e.id)].sort((a, b) => b.at - a.at), evSingles: true }
}
// آدینه‌ی نمونه‌ی ۳۲ تیمی (فقط حذفی، برگزارشده) تا جدول حذفی کامل از یک‌شانزدهم تا فینال در پنل مدیر دیده شود
const F32 = ['آرش', 'بابک', 'کوروش', 'داریوش', 'سامان', 'فرزاد', 'میلاد', 'بهنام', 'شهاب', 'مازیار', 'رضا', 'علی', 'حامد', 'وحید', 'پیمان', 'سعید', 'کیوان', 'مهران', 'نوید', 'هومن', 'جواد', 'مسعود', 'ایمان', 'آرمین', 'بهروز', 'سهیل', 'فرشاد', 'کاوه', 'یاسر', 'رامتین', 'شایان', 'مهدی', 'اردلان', 'بیژن', 'تورج', 'جمشید', 'حسام', 'خسرو', 'رسول', 'زانیار', 'سروش', 'شروین', 'صادق', 'طاها', 'عماد', 'فرهود', 'قباد', 'کامران', 'گشتاسب', 'لقمان', 'مانی', 'نادر', 'هادی', 'یوسف', 'اهورا', 'بنیامین', 'پدرام', 'تیرداد', 'جهان', 'دارا', 'رادین', 'سیاوش', 'فریبرز', 'ماکان']
const L32 = ['اکبری', 'حسینی', 'قاسمی', 'رحیمی', 'زارعی', 'عباسی', 'مرادی', 'نجفی', 'حیدری', 'کرمانی', 'صادقی', 'افشار', 'پاکزاد', 'ملکی', 'سلطانی', 'توکلی', 'امینی', 'باقری', 'رستمی', 'شجاعی']
const SETS32 = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]]
function with32(c) {
  let k = addDays(todayKey(), -7)
  for (let d = -1; d >= -14; d--) { const x = addDays(todayKey(), d); if (fromKey(x).getDay() === 5) { k = x; break } }
  const id = 'fr32-' + k
  if ((c.events || []).some((e) => e.id === id)) return { ...c, ev32: true }
  const r = (x) => hash(id + x)
  const firsts = [...F32].sort((a, b) => r('o' + a) - r('o' + b))
  const regs = Array.from({ length: 64 }, (_, i) => {
    const name = firsts[i] + ' ' + L32[Math.floor(r('l' + i) * L32.length)]
    const j = i - (i % 2)
    return { id: `r${i + 1}`, by: null, name, level: LEVELS[2 + Math.floor(r('lv' + i) * 5)].id, phone: '0935' + String(1000000 + Math.floor(r('p' + i) * 8999999)), at: fromKey(k).getTime() - (10 - (i % 9)) * 864e5, method: r('m' + j) < 0.6 ? 'online' : 'cash', paid: 750000, source: 'app', pair: `${id}-p${j}` }
  })
  let ev = { id, kind: 'friday', title: 'آدینه‌ی بزرگ ۳۲ تیمی', desc: '۳۲ تیم دونفره، فقط حذفی از یک‌شانزدهم تا فینال', gender: 'all', format: 'knockout', scoring: 'set6', date: k, start: 9, dur: 8, courts: [1, 2, 3, 4], levels: LEVELS.slice(2, 7).map((l) => l.id), cap: 64, fee: 750000, prize: 'راکت Wilson + توپ + کارت هدیه‌ی کافه', img: EV_IMG[1 % EV_IMG.length], status: 'done', note: '', regs, teams: [], groups: [], matches: [] }
  ev = makeKnockout(makeTeams(ev))
  for (let g = 0; g < 40; g++) {
    const m = ev.matches.find((x) => x.stage === 'ko' && x.b != null && !scored(x))
    if (!m) break
    const s = SETS32[Math.floor(r('s' + m.id) * SETS32.length)]
    ev = setScore(ev, m.id, [r('w' + m.id) < 0.5 ? s : [s[1], s[0]]])
  }
  const sales = regSales(ev)
  return { ...c, events: [ev, ...(c.events || [])], sales: [...sales, ...(c.sales || [])].sort((a, b) => b.at - a.at), ev32: true }
}
// داده‌ی قبلی بدون رویداد: یک بار رویدادهای نمونه اضافه می‌شود؛ زمین‌های مسابقه‌های پیش‌رو هم در تقویم بسته می‌شوند
export function withEvents(club) {
  let c = club
  if (!c.events) { const { events, sales } = seedEvents(); c = { ...c, events, sales: [...sales, ...c.sales].sort((a, b) => b.at - a.at) } }
  if (!c.evSingles) c = withSingles(c)
  if (!c.ev32) c = with32(c)
  if (c.evBlocks) return c
  // رزروهای نمونه‌ای که با ساعت مسابقه تداخل دارند کنار می‌روند (رزروهای خود کاربر می‌مانند)
  let bookings = c.bookings
  c.events.filter((e) => isLive(e) && fromKey(e.date) >= fromKey(todayKey())).forEach((e) => {
    const drop = new Set(clashes(bookings, e).filter((b) => b.by !== 'me' && !b.event).map((b) => b.id))
    bookings = syncBlocks(bookings.filter((b) => !drop.has(b.id)), e)
  })
  return { ...c, bookings, evBlocks: true }
}
