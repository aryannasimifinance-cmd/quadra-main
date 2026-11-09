// حسابداری دوطرفه‌ی باشگاه بر اساس کدینگ رایج ایران (گروه / کل / تفصیلی) — بدون مالیات و ارزش افزوده
// اسناد از عملیات باشگاه (رزرو، فروشگاه، پکیج، هزینه، انبار، حقوق) به صورت خودکار ساخته می‌شوند.
// شناسایی درآمد تعهدی است: پول رزرو آینده «پیش‌دریافت» است و در روز بازی به درآمد منتقل می‌شود.
import { todayKey } from './data'
import { dk, ord, inPeriod } from './jalali'
import { cafeCat } from './cafe'

export const GROUPS = [
  { id: 1, name: 'دارایی‌های جاری', type: 'asset' },
  { id: 2, name: 'دارایی‌های غیرجاری', type: 'asset' },
  { id: 3, name: 'بدهی‌های جاری', type: 'liab' },
  { id: 5, name: 'حقوق مالکانه', type: 'equity' },
  { id: 6, name: 'درآمدهای عملیاتی', type: 'rev' },
  { id: 7, name: 'بهای تمام‌شده', type: 'cogs' },
  { id: 8, name: 'هزینه‌های عملیاتی', type: 'exp' },
]
export const ACCOUNTS = [
  ['1101', 'صندوق'], ['1102', 'بانک — حساب جاری و کارتخوان'], ['1103', 'بانک — درگاه پرداخت آنلاین'],
  ['1201', 'حساب‌های دریافتنی (مشتریان)'], ['1301', 'موجودی کالای فروشگاه'], ['1302', 'موجودی مواد اولیه‌ی کافه'], ['1501', 'مساعده‌ی کارکنان'],
  ['2101', 'زمین‌ها و تأسیسات پدل'], ['2102', 'تجهیزات و اثاثه'],
  ['3101', 'حساب‌های پرداختنی (تأمین‌کنندگان)'], ['3201', 'حقوق و دستمزد پرداختنی'], ['3202', 'حق بیمه‌ی پرداختنی'], ['3301', 'پیش‌دریافت رزروها'],
  ['5101', 'سرمایه'], ['5201', 'سود و زیان انباشته'],
  ['6101', 'درآمد اجاره‌ی زمین'], ['6102', 'درآمد کلاس و پکیج مربی'], ['6103', 'درآمد پکیج و عضویت'], ['6104', 'درآمد تورنمنت و رویداد'], ['6105', 'درآمد فروش کالا'], ['6106', 'درآمد کافه'], ['6201', 'سایر درآمدها'],
  ['7101', 'بهای تمام‌شده‌ی کالای فروش‌رفته'], ['7102', 'بهای تمام‌شده‌ی فروش کافه'],
  ['8101', 'حقوق و دستمزد'], ['8102', 'حق بیمه‌ی سهم کارفرما'], ['8103', 'حق‌الزحمه‌ی مربیان'], ['8104', 'اجاره‌ی محل'],
  ['8105', 'آب، برق و گاز'], ['8106', 'تعمیر و نگهداری زمین‌ها'], ['8107', 'تبلیغات و بازاریابی'], ['8108', 'اینترنت و تلفن'],
  ['8109', 'ملزومات و نظافت'], ['8110', 'کارمزد بانکی'], ['8111', 'کسری و ضایعات انبار و کافه'], ['8199', 'سایر هزینه‌ها'],
].map(([code, name]) => {
  const g = GROUPS.find((x) => x.id === +code[0])
  return { code, name, g: g.id, type: g.type, debit: ['asset', 'cogs', 'exp'].includes(g.type) }
})
export const accByCode = (c) => ACCOUNTS.find((a) => a.code === c)
// حساب‌های درآمدی که دریافت دستی می‌تواند به آن برود
export const INCOME_ACCS = ACCOUNTS.filter((a) => a.g === 6)
export const EXPENSE_ACCS = ACCOUNTS.filter((a) => a.g === 8 && !['8101', '8102', '8103'].includes(a.code))
// روش پرداخت ← حساب
export const PAY_ACC = { cash: '1101', card: '1102', bank: '1102', online: '1103', wallet: '1103', payable: '3101' }
export const PAY_FROM = { cash: 'صندوق (نقدی)', bank: 'بانک (انتقال / کارت)', payable: 'نسیه — بدهی به تأمین‌کننده' }
export const KIND_NAME = { opening: 'افتتاحیه', booking: 'رزرو و کلاس', shop: 'فروشگاه', cafe: 'کافه', sale: 'پکیج و رویداد', payin: 'دریافت دستی', expense: 'هزینه', stock: 'انبار', payroll: 'حقوق و دستمزد', advance: 'مساعده', ap: 'پرداخت به تأمین‌کننده', manual: 'سند دستی' }
const KIND_ORDER = Object.keys(KIND_NAME)

// ---------- ساخت اسناد ----------
function bucket() {
  const m = new Map()
  return {
    add(acc, dr, cr, sub = null, desc = '') {
      if (!dr && !cr) return
      const k = `${acc}|${sub || ''}|${desc}`
      const x = m.get(k) || { acc, sub, desc, dr: 0, cr: 0 }
      x.dr += dr; x.cr += cr; m.set(k, x)
    },
    lines() {
      // بدهکار و بستانکار یک ردیف با هم خالص می‌شوند
      return [...m.values()].map((x) => { const n = x.dr - x.cr; return { ...x, dr: n > 0 ? n : 0, cr: n < 0 ? -n : 0 } }).filter((x) => x.dr || x.cr)
        .sort((a, b) => (b.dr > 0) - (a.dr > 0) || a.acc.localeCompare(b.acc))
    },
  }
}

export function ledger(club) {
  const T = ord(todayKey())
  const days = new Map() // date|kind → bucket
  const day = (date, kind) => { const k = `${date}|${kind}`; if (!days.has(k)) days.set(k, { date, kind, b: bucket() }); return days.get(k).b }
  const vouchers = []
  const push = (date, kind, title, lines, ref) => { if (ord(date) <= T && lines.length) vouchers.push({ date, kind, title, lines, ref }) }

  // افتتاحیه
  if (club.opening) push(club.opening.date, 'opening', 'سند افتتاحیه‌ی حساب‌ها', club.opening.lines)

  // رزرو و کلاس
  club.bookings.forEach((b) => {
    if (b.type === 'block') return
    const S = b.date
    const settled = b.settled || []
    // پکیج: سهم پکیج در فروش پکیج ثبت شده؛ فقط مانده‌ی نقدی این رزرو درآمد همین رزرو است
    const pkg = b.method === 'package' || b.method === 'coach-pack'
    const covered = pkg ? Math.max(0, b.paid - settled.reduce((s, x) => s + x.amt, 0)) : 0
    const price = b.price - covered
    if (pkg && price <= 0) return
    const first = pkg ? 0 : Math.max(0, b.paid - settled.reduce((s, x) => s + x.amt, 0))
    const pays = [{ amt: first, day: dk(b.at || Date.now()), method: b.method }, ...settled.map((x) => ({ amt: x.amt, day: dk(x.at), method: x.method }))].filter((x) => x.amt > 0)
    if (b.status === 'cancelled') {
      if (b.refunded) return
      pays.forEach((p) => { const v = day(p.day, 'booking'); v.add(PAY_ACC[p.method] || '1101', p.amt, 0); v.add('6201', 0, p.amt, null, 'جریمه‌ی لغو رزرو') })
      return
    }
    let pre = 0
    pays.forEach((p) => {
      const early = ord(p.day) < ord(S)
      if (early) pre += p.amt
      const v = day(p.day, 'booking')
      v.add(PAY_ACC[p.method] || '1101', p.amt, 0)
      v.add(early ? '3301' : '1201', 0, p.amt, early ? null : b.by)
    })
    if (ord(S) <= T) {
      const v = day(S, 'booking')
      v.add('3301', pre, 0)
      v.add('1201', price - pre, 0, b.by)
      v.add(b.type === 'coach' ? '6102' : '6101', 0, price)
    }
  })

  // فروشگاه — فروش و بهای تمام‌شده (میانگین موزون)
  club.orders.forEach((o) => {
    const v = day(dk(o.at), 'shop')
    v.add(PAY_ACC[o.method] || '1101', o.total, 0)
    let cogs = 0
    o.items.forEach((x) => {
      const p = club.products.find((y) => y.id === x.pid)
      v.add('6105', 0, x.qty * x.price, p?.cat)
      const c = (x.cost ?? p?.cost ?? 0) * x.qty
      cogs += c
      v.add('1301', 0, c, p?.code)
    })
    v.add('7101', cogs, 0)
  })

  // کافه — فروش به تفکیک دسته‌ی منو و مصرف مواد اولیه به بهای میانگین همان لحظه
  ;(club.cafeOrders || []).forEach((o) => {
    const v = day(dk(o.at), 'cafe')
    v.add(PAY_ACC[o.method] || '1101', o.total, 0)
    o.items.forEach((x) => v.add('6106', 0, x.qty * x.price, cafeCat(x.cat).code))
    let cogs = 0
    ;(o.use || []).forEach(([code, , amt]) => { cogs += amt; v.add('1302', 0, amt, code) })
    v.add('7102', cogs, 0)
  })

  // پکیج، عضویت، پکیج مربی و ثبت‌نام رویداد
  club.sales.forEach((s) => {
    const v = day(dk(s.at), 'sale')
    v.add(PAY_ACC[s.method] || '1103', s.price, 0)
    v.add(s.kind === 'coach' ? '6102' : s.kind === 'event' ? '6104' : '6103', 0, s.price)
  })

  // دریافت‌های دستی پذیرش (نقدی یا کارتخوان) به حساب درآمد انتخاب‌شده
  ;(club.payins || []).forEach((p) => {
    const v = day(p.date, 'payin')
    v.add(PAY_ACC[p.method] || '1101', p.amount, 0)
    v.add(p.acc || '6201', 0, p.amount, null, p.title)
  })

  for (const { date, kind, b } of days.values()) push(date, kind, `خلاصه‌ی ${KIND_NAME[kind]} روز`, b.lines())

  // هزینه‌ها
  ;(club.expenses || []).forEach((e) => push(e.date, 'expense', e.title || accByCode(e.acc)?.name, [
    { acc: e.acc, dr: e.amount, cr: 0, desc: e.vendor || '' },
    { acc: PAY_ACC[e.pay] || '1101', dr: 0, cr: e.amount, sub: e.pay === 'payable' ? e.vendor : null },
  ], e.id))

  // ورود کالا به انبار
  ;(club.receipts || []).forEach((r) => {
    const b = bucket()
    r.items.forEach((x) => b.add('1301', x.qty * x.cost, 0, x.code))
    b.add(PAY_ACC[r.pay] || '1102', 0, r.total, r.pay === 'payable' ? r.supplier : null)
    push(r.date, 'stock', `ورود کالا، ${r.supplier}${r.invoice ? `، فاکتور ${r.invoice}` : ''}`, b.lines(), r.id)
  })
  // اصلاح موجودی (کسری یا اضافه)
  ;(club.stockMoves || []).filter((m) => m.kind === 'adjust').forEach((m) => {
    const amt = Math.abs(m.qty) * m.cost
    push(m.date, 'stock', `${m.qty < 0 ? 'کسری' : 'اضافه'} انبار، ${m.sku}${m.note ? '، ' + m.note : ''}`, m.qty < 0
      ? [{ acc: '8111', dr: amt, cr: 0 }, { acc: '1301', dr: 0, cr: amt, sub: m.code }]
      : [{ acc: '1301', dr: amt, cr: 0, sub: m.code }, { acc: '6201', dr: 0, cr: amt, desc: 'اضافه‌ی انبار' }], m.id)
  })
  // خرید مواد اولیه‌ی کافه
  ;(club.cafeReceipts || []).forEach((r) => {
    const b = bucket()
    r.items.forEach((x) => b.add('1302', Math.round(x.qty * x.cost), 0, x.code))
    b.add(PAY_ACC[r.pay] || '1102', 0, r.total, r.pay === 'payable' ? r.supplier : null)
    push(r.date, 'cafe', `خرید مواد اولیه‌ی کافه، ${r.supplier}${r.invoice ? `، فاکتور ${r.invoice}` : ''}`, b.lines(), r.id)
  })
  // ضایعات و اصلاح شمارش مواد اولیه
  ;(club.cafeMoves || []).forEach((m) => push(m.date, 'cafe', `${m.amount < 0 ? 'ضایعات / کسری' : 'اضافه‌ی شمارش'} ${m.name}${m.note ? '، ' + m.note : ''}`, m.amount < 0
    ? [{ acc: '8111', dr: -m.amount, cr: 0, desc: 'کافه' }, { acc: '1302', dr: 0, cr: -m.amount, sub: m.code }]
    : [{ acc: '1302', dr: m.amount, cr: 0, sub: m.code }, { acc: '6201', dr: 0, cr: m.amount, desc: 'اضافه‌ی انبار کافه' }], m.id))
  // پرداخت به تأمین‌کنندگان
  ;(club.apPays || []).forEach((p) => push(p.date, 'ap', `تسویه با ${p.supplier}`, [
    { acc: '3101', dr: p.amount, cr: 0, sub: p.supplier }, { acc: PAY_ACC[p.pay] || '1102', dr: 0, cr: p.amount },
  ], p.id))

  // مساعده
  ;(club.advances || []).forEach((a) => push(a.date, 'advance', `مساعده، ${a.name}`, [
    { acc: '1501', dr: a.amount, cr: 0, sub: a.staff }, { acc: PAY_ACC[a.pay] || '1101', dr: 0, cr: a.amount },
  ], a.id))

  // حقوق و دستمزد: ثبت هزینه، پرداخت خالص، پرداخت بیمه
  ;(club.payrolls || []).forEach((p) => {
    const sum = (f, pred = () => true) => p.rows.filter(pred).reduce((s, r) => s + (r[f] || 0), 0)
    const coach = (r) => r.type === 'commission'
    const b = bucket()
    b.add('8101', sum('gross', (r) => !coach(r)), 0)
    b.add('8103', sum('gross', coach), 0)
    b.add('8102', sum('er'), 0)
    b.add('3202', 0, sum('emp') + sum('er'))
    p.rows.forEach((r) => r.adv && b.add('1501', 0, r.adv, r.staff))
    b.add('3201', 0, sum('net'))
    push(p.date, 'payroll', `سند حقوق و دستمزد ${p.label}`, b.lines(), p.id)
    if (p.paidAt) push(p.paidAt, 'payroll', `پرداخت حقوق ${p.label}`, [{ acc: '3201', dr: sum('net'), cr: 0 }, { acc: '1102', dr: 0, cr: sum('net') }], p.id)
    if (p.insPaidAt) push(p.insPaidAt, 'payroll', `پرداخت حق بیمه‌ی ${p.label} به تأمین اجتماعی`, [{ acc: '3202', dr: sum('emp') + sum('er'), cr: 0 }, { acc: '1102', dr: 0, cr: sum('emp') + sum('er') }], p.id)
  })

  // اسناد دستی
  ;(club.journals || []).forEach((j) => push(j.date, 'manual', j.title, j.lines, j.id))

  vouchers.sort((a, b) => ord(a.date) - ord(b.date) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  vouchers.forEach((v, i) => {
    v.no = i + 1
    v.dr = v.lines.reduce((s, l) => s + l.dr, 0)
    v.cr = v.lines.reduce((s, l) => s + l.cr, 0)
  })
  return vouchers
}

// ---------- گزارش‌ها ----------
const signed = (a, dr, cr) => (a.debit ? dr - cr : cr - dr)

// گردش و مانده‌ی حساب‌ها؛ p = بازه (اختیاری)، sub = تفکیک تفصیلی
export function trial(vouchers, p, { bySub = false } = {}) {
  const m = new Map()
  const from = p ? ord(p.from) : -Infinity, to = p ? ord(p.to) : Infinity
  vouchers.forEach((v) => {
    const o = ord(v.date)
    if (o > to) return
    v.lines.forEach((l) => {
      const k = bySub ? `${l.acc}|${l.sub || ''}` : l.acc
      const x = m.get(k) || { acc: l.acc, sub: bySub ? l.sub || null : null, odr: 0, ocr: 0, dr: 0, cr: 0 }
      if (o < from) { x.odr += l.dr; x.ocr += l.cr } else { x.dr += l.dr; x.cr += l.cr }
      m.set(k, x)
    })
  })
  return [...m.values()].map((x) => {
    const a = accByCode(x.acc)
    const close = x.odr + x.dr - x.ocr - x.cr
    return { ...x, name: a?.name || x.acc, account: a, open: x.odr - x.ocr, close, closeDr: close > 0 ? close : 0, closeCr: close < 0 ? -close : 0, bal: a ? signed(a, x.odr + x.dr, x.ocr + x.cr) : close }
  }).sort((a, b) => a.acc.localeCompare(b.acc) || String(a.sub).localeCompare(String(b.sub)))
}

export function balanceOf(vouchers, code, toKey = todayKey()) {
  const a = accByCode(code), to = ord(toKey)
  let dr = 0, cr = 0
  vouchers.forEach((v) => { if (ord(v.date) <= to) v.lines.forEach((l) => { if (l.acc === code) { dr += l.dr; cr += l.cr } }) })
  return signed(a, dr, cr)
}

// صورت سود و زیان یک بازه
export function income(vouchers, p) {
  const rows = trial(vouchers, p).filter((r) => r.account && r.account.g >= 6)
  const amt = (r) => signed(r.account, r.dr, r.cr)
  const rev = rows.filter((r) => r.account.g === 6).map((r) => ({ code: r.acc, name: r.name, amt: amt(r) })).filter((r) => r.amt)
  const cogs = rows.filter((r) => r.account.g === 7).map((r) => ({ code: r.acc, name: r.name, amt: amt(r) })).filter((r) => r.amt)
  const exp = rows.filter((r) => r.account.g === 8).map((r) => ({ code: r.acc, name: r.name, amt: amt(r) })).filter((r) => r.amt).sort((a, b) => b.amt - a.amt)
  const R = rev.reduce((s, r) => s + r.amt, 0), C = cogs.reduce((s, r) => s + r.amt, 0), E = exp.reduce((s, r) => s + r.amt, 0)
  return { rev, cogs, exp, R, C, E, gross: R - C, net: R - C - E }
}

// ترازنامه در پایان روز toKey — سود دوره‌ی جاری از مانده‌ی حساب‌های موقت
export function balanceSheet(vouchers, toKey) {
  const rows = trial(vouchers, { from: toKey, to: toKey }).map((r) => ({ ...r, bal: signed(r.account, r.odr + r.dr, r.ocr + r.cr) }))
  const pick = (g) => rows.filter((r) => r.account.g === g && Math.round(r.bal)).map((r) => ({ code: r.acc, name: r.name, amt: r.bal }))
  const profit = rows.filter((r) => r.account.g >= 6).reduce((s, r) => s + (r.account.g === 6 ? r.bal : -r.bal), 0)
  const assets = [...pick(1), ...pick(2)], liab = pick(3), equity = [...pick(5), { code: '—', name: 'سود (زیان) دوره‌ی جاری', amt: profit }]
  const A = assets.reduce((s, r) => s + r.amt, 0), L = liab.reduce((s, r) => s + r.amt, 0), Q = equity.reduce((s, r) => s + r.amt, 0)
  return { current: pick(1), fixed: pick(2), assets, liab, equity, A, L, Q }
}

// دفتر یک حساب با مانده‌ی جاری
export function accountBook(vouchers, code, p, sub) {
  const a = accByCode(code)
  let open = 0
  const rows = []
  vouchers.forEach((v) => {
    v.lines.forEach((l) => {
      if (l.acc !== code || (sub !== undefined && (l.sub || null) !== sub)) return
      if (ord(v.date) < ord(p.from)) open += signed(a, l.dr, l.cr)
      else if (inPeriod(v.date, p)) rows.push({ no: v.no, date: v.date, title: v.title, desc: l.desc, sub: l.sub, dr: l.dr, cr: l.cr })
    })
  })
  let bal = open
  rows.forEach((r) => { bal += signed(a, r.dr, r.cr); r.bal = bal })
  return { open, rows, close: bal }
}

// درآمد، هزینه و سود هر روز بازه — برای نمودار و گزارش
export function dailyPL(vouchers, p) {
  const m = new Map()
  vouchers.forEach((v) => {
    if (!inPeriod(v.date, p)) return
    const x = m.get(v.date) || { rev: 0, cost: 0, byAcc: {} }
    v.lines.forEach((l) => {
      const a = accByCode(l.acc); if (!a || a.g < 6) return
      const amt = signed(a, l.dr, l.cr)
      if (a.g === 6) x.rev += amt; else x.cost += amt
      x.byAcc[l.acc] = (x.byAcc[l.acc] || 0) + amt
    })
    m.set(v.date, x)
  })
  return m
}

// ---------- سود هر بخش باشگاه (نمای ساده برای مدیر) ----------
// هر بخش: درآمد خودش منهای هزینه‌ی مستقیمش (بهای کالا، سهم مربی)؛ بعد هزینه‌های عمومی باشگاه کم می‌شود
export const UNITS_PL = [
  { id: 'court', name: 'اجاره‌ی زمین', icon: 'court', rev: ['6101'], cost: [], tip: 'رزرو زمین‌ها، روز بازی درآمد حساب می‌شود' },
  { id: 'coach', name: 'کلاس و مربی', icon: 'coach', rev: ['6102'], cost: ['8103'], tip: 'کلاس‌ها و پکیج مربی منهای سهم درصدی مربی‌ها' },
  { id: 'pack', name: 'پکیج و عضویت', icon: 'ticket', rev: ['6103'], cost: [], tip: 'فروش پکیج‌های چندجلسه‌ای و عضویت' },
  { id: 'event', name: 'تورنمنت و رویداد', icon: 'trophy', rev: ['6104'], cost: [], tip: 'ورودی مسابقه‌ها' },
  { id: 'shop', name: 'فروشگاه', icon: 'bag', rev: ['6105'], cost: ['7101'], tip: 'فروش کالا منهای قیمت خرید همان کالاها' },
  { id: 'cafe', name: 'کافه', icon: 'cup', rev: ['6106'], cost: ['7102'], tip: 'فروش کافه منهای مواد اولیه‌ی مصرف‌شده' },
  { id: 'other', name: 'سایر', icon: 'sparkle', rev: ['6201'], cost: [], tip: 'جریمه‌ی لغو، اضافه‌ی انبار و…' },
]
export const OVERHEAD = [
  { id: 'staff', name: 'حقوق و بیمه‌ی پرسنل', acc: ['8101', '8102'] },
  { id: 'rent', name: 'اجاره‌ی محل', acc: ['8104'] },
  { id: 'bills', name: 'قبض‌ها و اینترنت', acc: ['8105', '8108'] },
  { id: 'repair', name: 'تعمیر و نگهداری', acc: ['8106'] },
  { id: 'ads', name: 'تبلیغات', acc: ['8107'] },
  { id: 'supply', name: 'ملزومات و نظافت', acc: ['8109'] },
  { id: 'misc', name: 'کارمزد، ضایعات و سایر', acc: ['8110', '8111', '8199'] },
]
export function segments(vouchers, p) {
  const inc = income(vouchers, p)
  const amt = {}
  ;[...inc.rev, ...inc.cogs, ...inc.exp].forEach((r) => { amt[r.code] = r.amt })
  const sum = (codes) => codes.reduce((s, c) => s + (amt[c] || 0), 0)
  const units = UNITS_PL.map((u) => { const rev = sum(u.rev), cost = sum(u.cost); return { ...u, revenue: rev, direct: cost, profit: rev - cost } })
  const over = OVERHEAD.map((o) => ({ ...o, amount: sum(o.acc) })).filter((o) => o.amount)
  const R = units.reduce((s, u) => s + u.revenue, 0), D = units.reduce((s, u) => s + u.direct, 0), O = over.reduce((s, o) => s + o.amount, 0)
  return { units, over, R, D, O, contrib: R - D, net: R - D - O }
}
