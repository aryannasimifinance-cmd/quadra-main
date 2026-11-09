// بررسی داشبورد مدیر با داده‌ی واقعی سرور: همان کدهای حسابداری و گزارش‌های اپ روی خروجی /api/state
// اول در backend:  php artisan test --filter AdminDayTest  (فایل storage/app/admin-state.json را می‌سازد)
// بعد:            npm run check:dashboard
process.env.TZ = process.env.TZ || 'Asia/Tehran'
import { build } from 'esbuild'
import { readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stateFile = process.argv[2] || resolve(here, '../../backend/storage/app/admin-state.json')
const entry = `
export * from './data'
export { ledger, trial, balanceSheet, income, segments, dailyPL, accountBook, ACCOUNTS } from './accounting'
export { payments, revenueByDay, memberStats, coachStats, coachFile, heat, occupancy, SPANS } from './screens/admin/derive'
export { payroll, attStats, leaveBalance } from './hr'
export { standings, podium, groupsDone, appEvents, finished } from './events'
export { period, recentMonths } from './jalali'
export { payState, coachLimits, openHours } from './store'
`
const tmp = resolve(here, '.dash-tmp.mjs')
await build({ stdin: { contents: entry, resolveDir: resolve(here, '../src'), loader: 'js' }, bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error',
  loader: { '.js': 'jsx', '.jsx': 'jsx', '.css': 'empty', '.woff2': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': '{}' } })
const M = await import(pathToFileURL(tmp).href)
unlinkSync(tmp)

const state = JSON.parse(readFileSync(stateFile, 'utf8'))
const club = state.club
M.setMembers(club.members); M.setCoaches(club.coaches); M.setCatalog(club.products); M.setCourts(club.courtEdits)

let fails = 0
const ok = (c, msg, x) => { if (c) console.log('  ✓', msg); else { fails++; console.log('  ✗', msg, x === undefined ? '' : JSON.stringify(x).slice(0, 500)) } }
const run = (name, fn) => { try { return fn() } catch (e) { fails++; console.log('  ✗', name, 'CRASH:', e.message, e.stack?.split('\n')[1]); return null } }
const today = M.todayKey()

console.log('— حسابداری (دفتر کل)')
const v = run('ledger', () => M.ledger(club))
ok(v && v.length > 50, `اسناد ساخته شد: ${v?.length}`)
const unbalanced = (v || []).filter((x) => Math.abs(x.dr - x.cr) > 0)
ok(!unbalanced.length, 'همه‌ی اسناد تراز (بدهکار = بستانکار)', unbalanced.slice(0, 3).map((x) => ({ no: x.no, title: x.title, dr: x.dr, cr: x.cr })))
const unknownAcc = (v || []).flatMap((x) => x.lines).filter((l) => !M.ACCOUNTS.some((a) => a.code === l.acc))
ok(!unknownAcc.length, 'همه‌ی سطرها حساب معتبر دارند', unknownAcc.slice(0, 3))
const neg = (v || []).flatMap((x) => x.lines).filter((l) => l.dr < 0 || l.cr < 0 || Number.isNaN(l.dr) || Number.isNaN(l.cr))
ok(!neg.length, 'بدون مبلغ منفی یا NaN', neg.slice(0, 3))
const tb = run('trial', () => M.trial(v))
const sum = (rows, f) => rows.reduce((s, r) => s + r[f], 0)
ok(tb && sum(tb, 'dr') + sum(tb, 'odr') === sum(tb, 'cr') + sum(tb, 'ocr'), 'تراز آزمایشی: جمع گردش بدهکار = بستانکار')
const bs = run('balanceSheet', () => M.balanceSheet(v, today))
ok(bs && Math.abs(bs.A - (bs.L + bs.Q)) < 1, `ترازنامه: دارایی ${bs?.A} = بدهی ${bs?.L} + حقوق مالکانه ${bs?.Q}`)
for (const kind of ['day', 'week', 'month']) {
  const p = M.period(kind, today)
  const inc = run('income ' + kind, () => M.income(v, p))
  const seg = run('segments ' + kind, () => M.segments(v, p))
  ok(inc && Number.isFinite(inc.net) && seg && seg.net === inc.net, `سود و زیان ${kind}: درآمد ${inc?.R} سود خالص ${inc?.net} (برابر با سود بخش‌ها)`)
  run('dailyPL ' + kind, () => M.dailyPL(v, p))
}
for (const code of ['1101', '1102', '1103', '1201', '3101', '3301', '6101', '6106']) run('accountBook ' + code, () => M.accountBook(v, code, M.period('month', today)))
ok(true, 'دفتر حساب‌ها برای ۸ حساب کلیدی بدون خطا')

console.log('— داشبورد و گزارش‌ها')
const pays = run('payments', () => M.payments(club, null))
ok(pays && pays.length > 100 && pays.every((x) => Number.isFinite(x.amount) && Number.isFinite(x.paid) && x.at), `تراکنش‌ها: ${pays?.length}، همه مبلغ و تاریخ معتبر دارند`)
const rev = run('revenueByDay', () => M.revenueByDay(pays, 30))
ok(rev && rev.length === 30 && rev.every((d) => Number.isFinite(d.total)), 'درآمد ۳۰ روز اخیر')
const ms = run('memberStats', () => M.memberStats(club, null))
ok(ms && ms.length === club.members.length && ms.every((m) => m.seg && Number.isFinite(m.spent)), `آمار اعضا: ${ms?.length} عضو، با بخش‌بندی`)
ok(ms && new Set(ms.map((m) => m.seg)).size >= 2, 'بخش‌بندی اعضا متنوع است (نه همه «جدید»)', ms && [...new Set(ms.map((m) => m.seg))])
for (const span of Object.keys(M.SPANS)) run('coachStats ' + span, () => M.coachStats(club, span))
const cs = run('coachStats', () => M.coachStats(club, 'all'))
ok(cs && cs.length === club.coaches.length && cs.every((c) => Number.isFinite(c.revenue)), 'آمار مربی‌ها در همه‌ی بازه‌ها')
for (const c of club.coaches) run('coachFile ' + c.id, () => M.coachFile(club, c.id, null, 'all'))
ok(true, 'پرونده‌ی هر مربی بدون خطا')
const ht = run('heat', () => M.heat(club))
ok(ht && ht.length === 7 && ht.every((r) => r.every((x) => x >= 0 && x <= 1.0001)), 'نقشه‌ی اشغال روز × ساعت (۰ تا ۱۰۰٪)')
const occ = run('occupancy', () => M.occupancy(club, today))
ok(Number.isFinite(occ) && occ >= 0 && occ <= 1.0001, `اشغال امروز: ${Math.round(occ * 100)}٪`)
const states = (club.bookings || []).filter((b) => b.type !== 'block').map(M.payState)
ok(states.every((s) => ['paid', 'partial', 'pending', 'refunded', 'void'].includes(s)), 'وضعیت پرداخت همه‌ی رزروها معتبر')

console.log('— پرسنل، مسابقه، مربی')
const mk = M.recentMonths(2)
for (const m of mk) {
  const rows = run('payroll ' + m, () => M.payroll(club, m))
  ok(rows && rows.every((r) => Number.isFinite(r.net) && Number.isFinite(r.gross)), `محاسبه‌ی حقوق ${m}: ${rows?.length} نفر`)
}
for (const s of club.staff) { run('leaveBalance', () => M.leaveBalance(club, s)) }
let st = 0
for (const e of club.events) {
  for (const g of e.groups || []) { run('standings ' + e.id, () => M.standings(e, g.id)); st++ }
  run('podium ' + e.id, () => M.podium(e))
}
ok(true, `جدول گروه‌ها (${st}) و سکوی قهرمانی همه‌ی مسابقه‌ها`)
run('appEvents', () => M.appEvents(club)); run('finished', () => M.finished(club))
for (const c of club.coaches) run('coachLimits', () => M.coachLimits(club, c, today))
ok(true, 'سقف رزرو مربی‌ها')

// ثابت‌های داده
const ids = new Set(); let dupIds = 0
for (const b of club.bookings) { if (ids.has(b.id)) dupIds++; ids.add(b.id) }
ok(!dupIds, 'شناسه‌ی رزروها یکتا')
ok(club.bookings.every((b) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(b.date) && typeof b.start === 'number' && typeof b.court === 'number'), 'قالب تاریخ و ساعت رزروها همان قالب اپ')
ok(club.orders.every((o) => typeof o.at === 'number' && o.items.every((x) => typeof x.cost === 'number')), 'سفارش‌های فروشگاه برای مدیر بهای تمام‌شده دارند')

console.log(fails ? `\n${fails} مورد ناموفق` : '\nهمه‌ی بررسی‌های داشبورد قبول شد')
process.exit(fails ? 1 : 0)
