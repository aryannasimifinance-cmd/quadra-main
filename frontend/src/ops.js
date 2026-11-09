// داده‌ی نمونه‌ی عملیات باشگاه برای پنل مدیر: کاتالوگ کددار، انبار، هزینه‌ها، پرسنل، حضور و غیاب و حقوق
import { BASE_PRODUCTS, COACHES, addDays, hash, todayKey } from './data'
import { buildCatalog, colorByName, skuOf } from './catalog'
import { seedCafe } from './cafe'
import { HR_CFG, SHIFTS, payroll, wdIndex } from './hr'
import { jMonthDays, jMonthKey, jMonthLabel, ord, recentMonths } from './jalali'

export const SUPPLIERS = ['پخش تجهیزات ورزشی آریا', 'تولیدی پوشاک ورزشی نوین', 'بازرگانی پدل‌سنتر', 'شرکت نظافتی پاکان', 'تأسیسات و ساختمان مهر', 'رُست‌خانه‌ی قهوه‌ی برنا', 'پخش مواد غذایی و لبنی سحر']

const W = (sat, sun, mon, tue, wed, thu, fri) => [sat, sun, mon, tue, wed, thu, fri]
const STAFF = [
  { name: 'مهدی رستمی', role: 'manager', type: 'full', base: 28000000, children: 2, days: 1100, edu: 'کارشناسی ارشد مدیریت ورزشی', week: W('f', 'f', 'f', 'f', 'f', 'm', 'off') },
  { name: 'نیلوفر احمدی', role: 'reception', type: 'full', base: 14500000, children: 0, days: 620, edu: 'کارشناسی', week: W('m', 'm', 'm', 'm', 'm', 'e', 'off') },
  { name: 'پوریا صادقی', role: 'reception', type: 'full', base: 14500000, children: 1, days: 380, edu: 'کاردانی', week: W('e', 'e', 'e', 'e', 'off', 'm', 'e') },
  { name: 'سمیرا قاسمی', role: 'shop', type: 'part', base: 9500000, children: 0, days: 210, edu: 'کارشناسی', week: W('e', 'off', 'e', 'off', 'e', 'e', 'e') },
  { name: 'رضا مرادی', role: 'service', type: 'full', base: 11500000, children: 3, days: 900, edu: 'دیپلم', week: W('m', 'm', 'm', 'm', 'm', 'm', 'off') },
  { name: 'علی کرمانی', role: 'service', type: 'hourly', rate: 95000, days: 120, edu: 'دیپلم', week: W('e', 'e', 'off', 'e', 'e', 'off', 'm') },
  { name: 'حسین بابایی', role: 'security', type: 'full', base: 12500000, children: 2, days: 1400, edu: 'دیپلم', week: W('n', 'n', 'n', 'n', 'n', 'n', 'off') },
  { name: 'مجید طالبی', role: 'tech', type: 'full', base: 16500000, children: 1, days: 700, edu: 'کاردانی برق', week: W('m', 'off', 'm', 'm', 'off', 'm', 'm') },
  { name: 'فرزانه کیانی', role: 'accountant', type: 'part', base: 12000000, children: 0, days: 300, edu: 'کارشناسی حسابداری', week: W('f', 'off', 'f', 'off', 'f', 'off', 'off') },
]
const digits = (seed, n) => Array.from({ length: n }, (_, i) => Math.floor(hash(seed + i) * 10)).join('')

function seedStaff() {
  const today = todayKey()
  const staff = STAFF.map((s, i) => ({
    id: 'h' + (i + 1), name: s.name, role: s.role, type: s.type, base: s.base || 0, rate: s.rate || 0, children: s.children || 0,
    start: addDays(today, -s.days), contractEnd: addDays(today, i === 3 ? 18 : i === 5 ? 40 : 150 + i * 20),
    phone: '0912' + digits('ph' + i, 7), nationalId: digits('nid' + i, 10), insuranceNo: digits('ins' + i, 10), iban: 'IR' + digits('iban' + i, 24),
    edu: s.edu, address: 'تهران', emergency: { name: 'همسر / والدین', phone: '0912' + digits('em' + i, 7) }, status: 'active',
    docs: { contract: true, id: true, health: i !== 5, clearance: i !== 3 && i !== 5, insurance: s.type !== 'hourly' },
  }))
  COACHES.forEach((c, i) => staff.push({
    id: 'hc' + (i + 1), name: c.name, role: 'coach', type: 'commission', coach: c.id, share: 0.6, start: addDays(today, -(300 + i * 140)),
    contractEnd: addDays(today, 200 + i * 30), phone: '0935' + digits('cph' + i, 7), nationalId: digits('cnid' + i, 10), iban: 'IR' + digits('ciban' + i, 24),
    edu: 'مربیگری فدراسیون', status: 'active', docs: { contract: true, id: true, health: true, clearance: true, insurance: false }, children: 0, base: 0, rate: 0,
  }))
  const shifts = Object.fromEntries(STAFF.map((s, i) => ['h' + (i + 1), s.week]))
  COACHES.forEach((_, i) => { shifts['hc' + (i + 1)] = W('off', 'off', 'off', 'off', 'off', 'off', 'off') })
  return { staff, shifts }
}

function seedAttendance(staff, shifts, from, leaves) {
  const att = {}
  const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60
  for (let k = from; ord(k) <= ord(todayKey()); k = addDays(k, 1)) {
    staff.forEach((s) => {
      if (s.type === 'commission' || ord(k) < ord(s.start)) return
      const sh = shifts[s.id][wdIndex(k)]
      if (sh === 'off') return
      if (leaves.some((l) => l.staff === s.id && l.status === 'ok' && ord(k) >= ord(l.from) && ord(k) <= ord(l.to))) return
      const r = (x) => hash(`${x}${k}${s.id}`)
      if (r('abs') < 0.035) return
      const { from: f, to: t } = SHIFTS[sh]
      const inH = f - 0.15 + (r('late') < 0.16 ? 0.25 + r('lm') * 0.4 : r('in') * 0.12)
      const outH = Math.min(24, t + (r('ot') < 0.22 ? 0.5 + r('om') * 1.5 : r('out') * 0.15))
      if (k === todayKey()) {
        if (nowH < inH) return
        ;(att[k] ||= {})[s.id] = { in: Math.round(inH * 60) / 60, out: nowH > outH ? Math.round(outH * 60) / 60 : null }
        return
      }
      ;(att[k] ||= {})[s.id] = { in: Math.round(inH * 60) / 60, out: Math.round(outH * 60) / 60 }
    })
  }
  return att
}

function seedExpenses(from) {
  const out = []
  const add = (date, acc, amount, title, vendor, pay = 'bank', invoice = '') => {
    if (ord(date) < ord(from) || ord(date) > ord(todayKey())) return
    out.push({ id: 'e' + out.length + date.replace(/-/g, ''), date, acc, amount, title, vendor, pay, invoice, at: Date.now() })
  }
  const months = recentMonths(3)
  months.forEach((mk) => {
    const d = jMonthDays(mk)
    const L = jMonthLabel(mk)
    add(d[0], '8104', 180000000, `اجاره‌ی سالن ${L}`, 'موجر — آقای صدری')
    add(d[4], '8105', 27500000 + Math.round(hash('el' + mk) * 6e6), `قبض برق ${L}`, 'توزیع برق تهران')
    add(d[6], '8105', 8400000 + Math.round(hash('gs' + mk) * 3e6), `قبض گاز ${L}`, 'شرکت گاز')
    add(d[7], '8105', 3900000, `قبض آب ${L}`, 'آب و فاضلاب')
    add(d[2], '8108', 3500000, `اینترنت و تلفن ${L}`, 'مخابرات')
    add(d[9], '8107', 14000000, `تبلیغات اینستاگرام ${L}`, 'آژانس تبلیغاتی', 'bank', 'AD-' + mk)
    add(d[14], '8106', 6000000 + Math.round(hash('mt' + mk) * 9e6), 'سرویس دوره‌ای چمن و شیشه‌ها', SUPPLIERS[4], 'payable', 'MT-' + mk)
    add(d[d.length - 1], '8110', 1250000, `کارمزد بانکی ${L}`, 'بانک')
    ;[3, 11, 19, 26].forEach((n, i) => d[n] && add(d[n], '8109', 1800000 + Math.round(hash('cl' + mk + i) * 2.4e6), 'مواد شوینده و ملزومات', SUPPLIERS[3], i % 2 ? 'cash' : 'bank'))
  })
  add(addDays(todayKey(), -9), '8106', 22000000, 'تعویض توری و ترمیم چمن زمین ۴', SUPPLIERS[4], 'bank', 'MT-401')
  add(addDays(todayKey(), -3), '8199', 4500000, 'پذیرایی تورنمنت آدینه', 'کترینگ', 'cash')
  return out
}

export function withOps(club) {
  const today = todayKey()
  const opening = addDays(today, -45)
  const products = buildCatalog(BASE_PRODUCTS)
  const byId = Object.fromEntries(products.map((p) => [p.id, p]))

  // اقلام سفارش‌ها: SKU، رنگ و بهای تمام‌شده
  const sold = {}
  const orders = club.orders.map((o) => ({
    ...o,
    items: o.items.map((x, j) => {
      const p = byId[x.pid]
      const v = p.variants[Math.floor(hash(o.id + j) * p.variants.length)]
      sold[v.sku] = (sold[v.sku] || 0) + x.qty
      return { ...x, size: v.size, color: v.color, colorHex: v.color ? colorByName(v.color)?.c : null, sku: v.sku, cost: p.cost }
    }),
  }))

  // ورود کالا: دو فاکتور خرید (یکی نسیه)
  const recv = (i, date, supplier, pay, lines, invoice) => {
    const items = lines.map(([pid, qty]) => { const p = byId[pid], v = p.variants[0]; return { pid, code: p.code, sku: v.sku, name: p.name, qty, cost: p.cost } })
    return { id: 'R-' + (301 + i), date, supplier, pay, invoice, items, total: items.reduce((s, x) => s + x.qty * x.cost, 0), at: Date.now() }
  }
  const receipts = [
    recv(0, addDays(today, -20), SUPPLIERS[0], 'bank', [['b1', 24], ['b2', 12], ['x1', 20]], 'F-8812'),
    recv(1, addDays(today, -11), SUPPLIERS[1], 'payable', [['a1', 12], ['a5', 6]], 'N-1405-77'),
  ]
  const received = {}
  receipts.forEach((r) => r.items.forEach((x) => { received[x.sku] = (received[x.sku] || 0) + x.qty }))

  // موجودی افتتاحیه = موجودی فعلی + فروخته‌شده − واردشده؛ اگر منفی شود موجودی فعلی بالا می‌رود
  let inv = 0
  const invLines = []
  products.forEach((p) => {
    let val = 0
    p.variants.forEach((v) => {
      let open = v.stock + (sold[v.sku] || 0) - (received[v.sku] || 0)
      if (open < 0) { v.stock -= open; open = 0 }
      val += open * p.cost
    })
    if (val) invLines.push({ acc: '1301', dr: val, cr: 0, sub: p.code }); inv += val
  })
  const assets = [['1101', 85000000], ['1102', 640000000], ['1103', 120000000], ['2101', 9600000000], ['2102', 850000000]]
  // کافه: منو، مواد اولیه، خریدها و سفارش‌های نمونه
  const cafe = seedCafe(club, opening, SUPPLIERS.slice(5))
  const cafeInv = cafe.openLines.reduce((s, l) => s + l.dr, 0)
  const capital = assets.reduce((s, [, v]) => s + v, 0) + inv + cafeInv
  const openingV = { date: opening, lines: [...assets.map(([acc, dr]) => ({ acc, dr, cr: 0 })), ...invLines, ...cafe.openLines, { acc: '5101', dr: 0, cr: capital }] }

  const { staff, shifts } = seedStaff()
  const leaves = [
    { id: 'L1', staff: 'h5', kind: 'annual', from: addDays(today, -16), to: addDays(today, -14), days: 3, status: 'ok', note: 'سفر خانوادگی', at: Date.now() - 20 * 864e5 },
    { id: 'L2', staff: 'h2', kind: 'sick', from: addDays(today, -6), to: addDays(today, -6), days: 1, status: 'ok', note: 'گواهی پزشک', at: Date.now() - 6 * 864e5 },
    { id: 'L3', staff: 'h3', kind: 'annual', from: addDays(today, 5), to: addDays(today, 7), days: 3, status: 'pending', note: 'مراسم عروسی', at: Date.now() - 864e5 },
    { id: 'L4', staff: 'h8', kind: 'annual', from: addDays(today, 12), to: addDays(today, 12), days: 1, status: 'pending', note: 'کار اداری', at: Date.now() - 2 * 36e5 },
  ]
  const attendance = seedAttendance(staff, shifts, opening, leaves)
  const curM = jMonthKey(today)
  const advances = [
    { id: 'A1', staff: 'h5', name: 'رضا مرادی', date: jMonthDays(curM)[2] || today, amount: 3000000, pay: 'cash', note: 'هزینه‌ی درمان' },
    { id: 'A2', staff: 'h3', name: 'پوریا صادقی', date: addDays(today, -1), amount: 2000000, pay: 'bank', note: '' },
  ].filter((a) => ord(a.date) <= ord(today))

  const next = {
    ...club, orders, products, receipts, stockMoves: [], apPays: [{ id: 'AP1', date: addDays(today, -4), supplier: SUPPLIERS[1], amount: 12000000, pay: 'bank' }],
    expenses: seedExpenses(opening), journals: [], opening: openingV, suppliers: SUPPLIERS,
    staff, shifts, attendance, leaves, advances, payrolls: [], hrCfg: { ...HR_CFG },
    cafeItems: cafe.cafeItems, cafeIngs: cafe.cafeIngs, cafeOrders: cafe.cafeOrders, cafeReceipts: cafe.cafeReceipts, cafeMoves: [],
  }
  // حقوق ماه قبل: ثبت، پرداخت و پرداخت بیمه
  const prev = recentMonths(2)[1], pd = jMonthDays(prev)
  if (ord(pd[pd.length - 1]) > ord(opening)) {
    next.payrolls = [{ id: 'PR-' + prev, month: prev, label: jMonthLabel(prev), date: pd[pd.length - 1], rows: payroll(next, prev), paidAt: addDays(pd[pd.length - 1], 1), insPaidAt: ord(addDays(pd[pd.length - 1], 8)) <= ord(today) ? addDays(pd[pd.length - 1], 8) : null, at: Date.now() }]
  }
  return next
}
export { skuOf }
