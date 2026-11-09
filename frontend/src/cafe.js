// کافه‌ی باشگاه: منو با دستور تهیه، انبار مواد اولیه و بهای تمام‌شده‌ی هر آیتم
// موجودی به واحد پایه (گرم / میلی‌لیتر / عدد) و بهای هر واحد به روش میانگین موزون نگه داشته می‌شود.
// کد آیتم منو = ۲ رقم دسته (۳۱ تا ۳۷) + ۳ رقم ردیف؛ کد ماده‌ی اولیه = ۲ رقم گروه (۲۱ تا ۲۹) + ۳ رقم ردیف.
// حساب‌ها: موجودی مواد اولیه ۱۳۰۲-کد ماده، درآمد کافه ۶۱۰۶-کد دسته، بهای تمام‌شده‌ی کافه ۷۱۰۲.
import { MEMBERS, addDays, fa, fromKey, hash, todayKey } from './data'
import { ord } from './jalali'

export const CAFE_CATS = [
  { id: 'hotcoffee', name: 'قهوه‌ی گرم', ic: '☕', code: '31' },
  { id: 'coldcoffee', name: 'قهوه‌ی سرد', ic: '🧊', code: '32' },
  { id: 'hotdrink', name: 'نوشیدنی گرم', ic: '🍵', code: '33' },
  { id: 'colddrink', name: 'نوشیدنی سرد', ic: '🥤', code: '34' },
  { id: 'mocktail', name: 'ماکتل', ic: '🍹', code: '35' },
  { id: 'sandwich', name: 'ساندویچ', ic: '🥪', code: '36' },
  { id: 'food', name: 'غذا', ic: '🍝', code: '37' },
]
export const cafeCat = (id) => CAFE_CATS.find((c) => c.id === id) || CAFE_CATS[0]
export const DRINKS = ['hotcoffee', 'coldcoffee', 'hotdrink', 'colddrink', 'mocktail']
export const ING_CATS = {
  coffee: ['قهوه و چای', '21'], dairy: ['لبنیات', '22'], syrup: ['سیروپ، سس و شیرین‌کننده', '23'], fruit: ['میوه و سبزیجات', '24'],
  bakery: ['نان', '25'], protein: ['گوشت و پروتئین', '26'], dry: ['مواد خشک', '27'], drinks: ['نوشیدنی آماده', '28'], pack: ['بسته‌بندی', '29'],
}
export const UNITS = { g: { n: 'گرم', big: 'کیلوگرم', k: 1000 }, ml: { n: 'میلی‌لیتر', big: 'لیتر', k: 1000 }, pc: { n: 'عدد', big: 'عدد', k: 1 } }
export const ORDER_ST = { new: 'ثبت شد', prep: 'در حال آماده‌سازی', ready: 'آماده‌ی تحویل', delivered: 'تحویل شد' }
export const ORDER_FLOW = ['new', 'prep', 'ready', 'delivered']
export const NOTES = ['بدون شکر', 'کم‌شیرین', 'داغ‌تر', 'یخ کمتر', 'بدون پیاز', 'تند']
export const BIG_K = 1.5 // دستور تهیه‌ی سایز بزرگ

const num = (n, d = 1) => fa(+n.toFixed(d))
// نمایش مقدار: بالای ۱۰۰۰ گرم به کیلو و بالای ۱۰۰۰ میلی‌لیتر به لیتر
export function fmtQty(ing, q) {
  const u = UNITS[ing.unit]
  if (u.k > 1 && Math.abs(q) >= u.k) return `${num(q / u.k, 2)} ${u.big}`
  return `${num(q, 0)} ${u.n}`
}
// بهای واحد بزرگ (هر کیلو / لیتر / عدد)
export const bigCost = (ing) => Math.round(ing.cost * UNITS[ing.unit].k)

export const itemAcc = (it) => `6106-${cafeCat(it.cat).code}`
export const ingAcc = (g) => `1302-${g.code}`

export function nextItemCode(items, cat) {
  const pre = cafeCat(cat).code
  const n = items.filter((x) => x.code?.startsWith(pre)).map((x) => +x.code.slice(2))
  return pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')
}
export function nextIngCode(ings, cat) {
  const pre = ING_CATS[cat][1]
  const n = ings.filter((x) => x.code?.startsWith(pre)).map((x) => +x.code.slice(2))
  return pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')
}

// مصرف مواد اولیه‌ی یک آیتم (با سایز بزرگ)
export const recipeOf = (it, big) => (it.recipe || []).map(([ing, q]) => [ing, big ? q * BIG_K : q])
export function itemCost(it, ings, big = false) {
  return Math.round(recipeOf(it, big).reduce((s, [id, q]) => s + q * (ings.find((g) => g.id === id)?.cost || 0), 0))
}
// چند پرس با موجودی فعلی قابل تهیه است
export function portions(it, ings, big = false) {
  const r = recipeOf(it, big)
  if (!r.length) return 0
  return Math.max(0, Math.min(...r.map(([id, q]) => { const g = ings.find((x) => x.id === id); return g ? Math.floor(g.stock / q) : 0 })))
}
export const priceOf = (it, big) => it.price + (big && it.big ? it.big : 0)
export const available = (it, ings) => it.active !== false && portions(it, ings) > 0

// مصرف کل مواد اولیه‌ی یک سبد؛ آیتم‌های مختلف ممکن است ماده‌ی مشترک داشته باشند (قهوه، شیر، لیوان)
function usage(items, lines) {
  const m = new Map()
  lines.forEach((x) => {
    const it = items.find((y) => y.id === x.iid)
    if (it) recipeOf(it, x.big).forEach(([id, q]) => m.set(id, (m.get(id) || 0) + q * x.qty))
  })
  return m
}
// موجودی باقی‌مانده بعد از کنار گذاشتن مواد سبد
export function leftAfter(ings, items, lines) {
  const m = usage(items, lines)
  return ings.map((g) => (m.has(g.id) ? { ...g, stock: g.stock - m.get(g.id) } : g))
}
// ماده‌هایی که برای این سبد کم است: [ماده, کمبود به واحد پایه]
export function shortage(ings, items, lines) {
  const m = usage(items, lines)
  return ings.filter((g) => m.has(g.id) && m.get(g.id) > g.stock + 1e-9).map((g) => [g, m.get(g.id) - g.stock])
}
// سبد با موجودی فعلی قابل تهیه است؛ آیتم حذف‌شده یا غیرفعال هم مانع ثبت است
export function fits(ings, items, lines) {
  const ok = lines.every((x) => { const it = items.find((y) => y.id === x.iid); return it && it.active !== false && x.qty > 0 })
  return lines.length > 0 && ok && !shortage(ings, items, lines).length
}
// چند پرس دیگر از این آیتم کنار سبد فعلی جا می‌شود
export const moreOf = (it, big, ings, items, lines) => (it.active === false ? 0 : portions(it, leftAfter(ings, items, lines), big))

// ثبت سفارش: قیمت، بهای تمام‌شده و مصرف هر ماده با بهای همان لحظه؛ موجودی کم می‌شود
export function placeCafe(ings, items, lines) {
  const use = new Map()
  const out = lines.map((x) => {
    const it = items.find((y) => y.id === x.iid)
    let cost = 0
    recipeOf(it, x.big).forEach(([id, q]) => {
      const g = ings.find((y) => y.id === id); if (!g) return
      const u = use.get(id) || { id, code: g.code, qty: 0, amt: 0 }
      u.qty += q * x.qty; u.amt += q * x.qty * g.cost; cost += q * x.qty * g.cost
      use.set(id, u)
    })
    return { iid: it.id, code: it.code, name: it.name, cat: it.cat, qty: x.qty, big: !!x.big, note: x.note || '', price: priceOf(it, x.big), cost: Math.round(cost) }
  })
  const used = [...use.values()].map((u) => ({ ...u, amt: Math.round(u.amt) }))
  // جمع ردیف‌ها با جمع مصرف یکی می‌شود تا سند تراز بماند
  const diff = used.reduce((s, u) => s + u.amt, 0) - out.reduce((s, x) => s + x.cost, 0)
  if (out.length && diff) out[0].cost += diff
  const next = ings.map((g) => (use.has(g.id) ? { ...g, stock: Math.max(0, g.stock - use.get(g.id).qty) } : g))
  return { lines: out, use: used.map(({ code, qty, amt }) => [code, Math.round(qty * 100) / 100, amt]), ings: next, total: out.reduce((s, x) => s + x.qty * x.price, 0) }
}

// میانگین موزون بعد از خرید
export function receiveInto(ings, items) {
  return ings.map((g) => {
    const ls = items.filter((x) => x.ing === g.id)
    if (!ls.length) return g
    const add = ls.reduce((s, x) => s + x.qty, 0), val = ls.reduce((s, x) => s + x.qty * x.cost, 0)
    const cost = g.stock + add > 0 ? (g.stock * g.cost + val) / (g.stock + add) : g.cost
    return { ...g, stock: g.stock + add, cost: Math.round(cost * 100) / 100 }
  })
}

// ---------- داده‌ی نمونه ----------
// [شناسه, نام, گروه, واحد, بهای هر واحد بزرگ (کیلو / لیتر / عدد), حداقل موجودی به واحد پایه, موجودی فعلی به واحد پایه]
const ING = [
  ['beans', 'دانه‌ی قهوه‌ی اسپرسو (۷۰ عربیکا)', 'coffee', 'g', 2600000, 2000, 6200],
  ['tea', 'چای سیاه ایرانی', 'coffee', 'g', 950000, 500, 2400],
  ['gtea', 'چای سبز', 'coffee', 'g', 1300000, 200, 900],
  ['cocoa', 'پودر کاکائو', 'coffee', 'g', 1600000, 300, 1400],
  ['matcha', 'پودر ماچا', 'coffee', 'g', 9500000, 100, 180],
  ['milk', 'شیر پرچرب', 'dairy', 'ml', 62000, 6000, 18000],
  ['oat', 'شیر جو دوسر', 'dairy', 'ml', 240000, 2000, 1500],
  ['cream', 'خامه‌ی قنادی', 'dairy', 'ml', 260000, 1000, 3000],
  ['icecream', 'بستنی وانیلی', 'dairy', 'g', 320000, 1000, 2600],
  ['cheddar', 'پنیر چدار ورقه‌ای', 'dairy', 'g', 680000, 600, 1800],
  ['mozz', 'پنیر پیتزا موزارلا', 'dairy', 'g', 720000, 600, 2100],
  ['caramel', 'سیروپ کارامل', 'syrup', 'ml', 950000, 300, 1100],
  ['vanilla', 'سیروپ وانیل', 'syrup', 'ml', 950000, 300, 900],
  ['choc', 'سس شکلات', 'syrup', 'ml', 720000, 300, 1200],
  ['honey', 'عسل', 'syrup', 'g', 1250000, 300, 1100],
  ['sugar', 'شکر', 'syrup', 'g', 65000, 2000, 7000],
  ['grenadine', 'شربت انار', 'syrup', 'ml', 480000, 300, 1300],
  ['lemon', 'لیموترش تازه', 'fruit', 'pc', 14000, 20, 46],
  ['mint', 'نعناع تازه', 'fruit', 'g', 380000, 100, 260],
  ['orange', 'پرتقال آب‌گیری', 'fruit', 'pc', 22000, 20, 54],
  ['straw', 'توت‌فرنگی', 'fruit', 'g', 360000, 500, 1300],
  ['veg', 'سبزیجات (کاهو، گوجه، خیارشور)', 'fruit', 'g', 160000, 2000, 5200],
  ['potato', 'سیب‌زمینی خلالی منجمد', 'fruit', 'g', 140000, 3000, 9000],
  ['baguette', 'نان باگت', 'bakery', 'pc', 28000, 15, 34],
  ['ciabatta', 'نان چاباتا', 'bakery', 'pc', 32000, 15, 9],
  ['chicken', 'فیله‌ی مرغ', 'protein', 'g', 460000, 2000, 5600],
  ['ham', 'ژامبون گوشت ۹۰٪', 'protein', 'g', 980000, 600, 1600],
  ['mince', 'گوشت چرخ‌کرده‌ی گوساله', 'protein', 'g', 880000, 1500, 3400],
  ['tuna', 'کنسرو تن ماهی', 'protein', 'pc', 135000, 10, 22],
  ['pasta', 'پاستا پنه', 'dry', 'g', 180000, 2000, 6000],
  ['water', 'آب معدنی ۵۰۰ سی‌سی', 'drinks', 'pc', 9000, 48, 132],
  ['cola', 'نوشابه‌ی قوطی', 'drinks', 'pc', 24000, 24, 70],
  ['sodaw', 'آب گازدار (سودا)', 'drinks', 'pc', 28000, 24, 66],
  ['energy', 'نوشیدنی انرژی‌زا', 'drinks', 'pc', 68000, 12, 8],
  ['ice', 'یخ', 'drinks', 'g', 6000, 10000, 40000],
  ['cup', 'لیوان کاغذی با درب', 'pack', 'pc', 5500, 200, 640],
  ['box', 'ظرف یک‌بار مصرف غذا', 'pack', 'pc', 8500, 100, 310],
]
// عکس هر آیتم: public/img/cafe/<شناسه>.jpg (Wikimedia Commons، منبع در CREDITS)
// [شناسه, نام, دسته, قیمت, افزایش قیمت سایز بزرگ, شکلک, زمان آماده‌سازی (دقیقه), توضیح, دستور تهیه, برچسب]
const MENU = [
  ['espresso', 'اسپرسو', 'hotcoffee', 85000, 35000, '☕', 3, 'شات ۱۸ گرمی؛ سایز بزرگ دبل', [['beans', 18], ['cup', 1]]],
  ['americano', 'آمریکانو', 'hotcoffee', 95000, 30000, '☕', 3, 'اسپرسو و آب داغ', [['beans', 18], ['cup', 1]]],
  ['cappuccino', 'کاپوچینو', 'hotcoffee', 125000, 35000, '☕', 4, 'اسپرسو، شیر بخارداده و فوم غلیظ', [['beans', 18], ['milk', 150], ['cup', 1]], 'پرفروش'],
  ['latte', 'کافه لاته', 'hotcoffee', 135000, 35000, '🥛', 4, 'اسپرسو با شیر زیاد و فوم نرم', [['beans', 18], ['milk', 220], ['cup', 1]]],
  ['mocha', 'موکا', 'hotcoffee', 155000, 35000, '🍫', 5, 'اسپرسو، شکلات و شیر', [['beans', 18], ['milk', 180], ['cocoa', 10], ['choc', 20], ['cup', 1]]],
  ['caramelm', 'کارامل ماکیاتو', 'hotcoffee', 160000, 35000, '🍮', 5, 'شیر وانیلی، اسپرسو و سس کارامل', [['beans', 18], ['milk', 200], ['vanilla', 10], ['caramel', 20], ['cup', 1]]],
  ['iceamericano', 'آیس آمریکانو', 'coldcoffee', 110000, 30000, '🧊', 3, 'اسپرسو، آب خنک و یخ', [['beans', 18], ['ice', 150], ['cup', 1]], 'پرفروش'],
  ['icelatte', 'آیس لاته', 'coldcoffee', 145000, 35000, '🥤', 4, 'اسپرسو، شیر سرد و یخ', [['beans', 18], ['milk', 200], ['ice', 120], ['cup', 1]]],
  ['coldbrew', 'کلد برو', 'coldcoffee', 150000, 35000, '🥃', 2, 'دم سرد ۱۸ ساعته، کم‌تلخ و خوش‌عطر', [['beans', 30], ['ice', 120], ['cup', 1]]],
  ['affogato', 'آفوگاتو', 'coldcoffee', 165000, 0, '🍨', 3, 'یک اسکوپ بستنی وانیلی زیر شات اسپرسو', [['beans', 18], ['icecream', 100], ['cup', 1]]],
  ['tea', 'چای', 'hotdrink', 55000, 20000, '☕', 4, 'چای ایرانی دم‌کشیده', [['tea', 5], ['sugar', 10], ['cup', 1]]],
  ['greentea', 'چای سبز و عسل', 'hotdrink', 70000, 20000, '🍃', 4, 'چای سبز با عسل طبیعی', [['gtea', 4], ['honey', 12], ['cup', 1]]],
  ['hotchoc', 'هات چاکلت', 'hotdrink', 130000, 35000, '🍫', 4, 'کاکائوی غلیظ با شیر داغ', [['cocoa', 25], ['milk', 220], ['choc', 15], ['cup', 1]]],
  ['matcha', 'ماچا لاته', 'hotdrink', 175000, 40000, '🍵', 5, 'ماچای ژاپنی، شیر جو دوسر و عسل', [['matcha', 4], ['oat', 220], ['honey', 10], ['cup', 1]], 'جدید'],
  ['water', 'آب معدنی', 'colddrink', 25000, 0, '💧', 1, '۵۰۰ سی‌سی', [['water', 1]]],
  ['cola', 'نوشابه', 'colddrink', 45000, 0, '🥤', 1, 'قوطی ۳۳۰ سی‌سی', [['cola', 1]]],
  ['energy', 'نوشیدنی انرژی‌زا', 'colddrink', 110000, 0, '⚡', 1, 'قوطی ۲۵۰ سی‌سی', [['energy', 1]]],
  ['oj', 'آب پرتقال طبیعی', 'colddrink', 140000, 50000, '🍊', 4, 'همان لحظه گرفته می‌شود', [['orange', 3], ['cup', 1]]],
  ['lemonade', 'لیموناد', 'colddrink', 95000, 30000, '🍋', 3, 'لیموی تازه، شکر و یخ', [['lemon', 2], ['sugar', 30], ['ice', 150], ['cup', 1]]],
  ['mojito', 'موهیتو', 'mocktail', 150000, 40000, '🍹', 5, 'لیمو، نعناع تازه و سودا', [['lemon', 1], ['mint', 10], ['sugar', 20], ['sodaw', 1], ['ice', 150], ['cup', 1]], 'پرفروش'],
  ['strawfizz', 'توت‌فرنگی فیزی', 'mocktail', 165000, 40000, '🍓', 5, 'پوره‌ی توت‌فرنگی، لیمو و سودا', [['straw', 80], ['lemon', 1], ['sugar', 15], ['sodaw', 1], ['ice', 120], ['cup', 1]]],
  ['sunrise', 'سان‌رایز', 'mocktail', 160000, 40000, '🌅', 5, 'آب پرتقال تازه و شربت انار', [['orange', 2], ['grenadine', 30], ['ice', 120], ['cup', 1]]],
  ['quadracool', 'کوادرا کول', 'mocktail', 175000, 40000, '🎾', 5, 'نوشیدنی امضای باشگاه؛ لیمو، نعناع، عسل و سودا', [['lemon', 1], ['mint', 8], ['honey', 15], ['sodaw', 1], ['ice', 150], ['cup', 1]], 'جدید'],
  ['chickensand', 'ساندویچ مرغ گریل', 'sandwich', 280000, 0, '🥪', 10, 'باگت، فیله‌ی مرغ گریل، چدار و سبزیجات', [['baguette', 1], ['chicken', 150], ['cheddar', 30], ['veg', 60], ['box', 1]], 'پرفروش'],
  ['hamsand', 'ساندویچ ژامبون و پنیر', 'sandwich', 240000, 0, '🥖', 7, 'باگت، ژامبون، چدار و سبزیجات', [['baguette', 1], ['ham', 80], ['cheddar', 40], ['veg', 40], ['box', 1]]],
  ['tunasand', 'ساندویچ تن ماهی', 'sandwich', 260000, 0, '🐟', 7, 'چاباتا، تن ماهی و سبزیجات', [['ciabatta', 1], ['tuna', 1], ['veg', 60], ['box', 1]]],
  ['panini', 'پنینی سبزیجات', 'sandwich', 210000, 0, '🧀', 8, 'چاباتای تست‌شده، موزارلا و سبزیجات', [['ciabatta', 1], ['mozz', 60], ['veg', 100], ['box', 1]]],
  ['alfredo', 'پاستا آلفردو مرغ', 'food', 380000, 0, '🍝', 15, 'پنه، مرغ، سس خامه و پنیر', [['pasta', 120], ['chicken', 120], ['cream', 100], ['mozz', 30], ['box', 1]]],
  ['bolognese', 'پاستا بولونز', 'food', 360000, 0, '🍝', 15, 'پنه با سس گوشت و گوجه', [['pasta', 120], ['mince', 120], ['veg', 80], ['box', 1]]],
  ['fries', 'سیب‌زمینی سرخ‌کرده', 'food', 150000, 60000, '🍟', 8, 'سایز بزرگ برای دو نفر', [['potato', 250], ['box', 1]]],
  ['caesar', 'سالاد سزار مرغ', 'food', 320000, 0, '🥗', 10, 'کاهو، مرغ گریل، پنیر و سس سزار', [['chicken', 120], ['veg', 180], ['cheddar', 25], ['box', 1]]],
]

export function buildCafe() {
  const ings = []
  ING.forEach(([id, name, cat, unit, big, min, stock]) => ings.push({ id, code: nextIngCode(ings, cat), name, cat, unit, cost: big / UNITS[unit].k, min, stock, active: true }))
  const items = []
  MENU.forEach(([id, name, cat, price, bigAdd, emoji, prep, desc, recipe, tag]) => items.push({ id, code: nextItemCode(items, cat), name, cat, price, big: bigAdd || 0, emoji, img: `./img/cafe/${id}.jpg`, prep, desc, recipe, tag: tag || '', active: true }))
  return { ings, items }
}

// سفارش‌های نمونه‌ی ۴۵ روز گذشته؛ موجودی افتتاحیه طوری ساخته می‌شود که موجودی امروز همان ستون آخر ING شود
// پسوند ثابت تا ورودی‌هایی که فقط در رقم آخر فرق دارند عدد کاملاً متفاوت بدهند
const rh = (x) => hash(x + '#cafe')

export function seedCafe(club, from, suppliers) {
  const { ings: base, items } = buildCafe()
  const today = todayKey(), now = new Date(), nowH = now.getHours() + now.getMinutes() / 60
  const pop = { cappuccino: 3, latte: 2.4, americano: 2, iceamericano: 3, icelatte: 2.2, water: 4, cola: 1.6, mojito: 2, chickensand: 1.8, tea: 2, energy: 1.2, fries: 1.4 }
  const weights = items.map((it) => pop[it.id] || 1)
  const W = weights.reduce((a, b) => a + b, 0)
  const pick = (r) => { let x = r * W; for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i] } return items[0] }
  const draft = []
  for (let k = from; ord(k) <= ord(today); k = addDays(k, 1)) {
    const day = fromKey(k)
    const n = 10 + Math.floor(rh('cn' + k) * 14) + (day.getDay() === 4 || day.getDay() === 5 ? 8 : 0)
    for (let i = 0; i < n; i++) {
      const r = (x) => rh(`c${x}${k}${i}`)
      const h = 8 + r('h') * 15.5
      if (k === today && h > nowH) continue
      const lines = Array.from({ length: 1 + Math.floor(r('n') * r('n2') * 4) }, (_, j) => {
        const it = pick(rh(`ci${k}${i}${j}`))
        return { iid: it.id, qty: 1 + (rh(`cq${k}${i}${j}`) < 0.18 ? 1 : 0), big: it.big > 0 && rh(`cb${k}${i}${j}`) < 0.3, note: DRINKS.includes(it.cat) && rh(`cnt${k}${i}${j}`) < 0.08 ? NOTES[Math.floor(rh(`cnn${k}${i}${j}`) * 4)] : '' }
      })
      const court = r('to') < 0.38 ? 1 + Math.floor(r('ct') * 4) : null
      const at = day.getTime() + h * 36e5
      const age = (Date.now() - at) / 6e4
      draft.push({
        id: 'K-' + (5000 + draft.length), at, lines, to: court, source: r('src') < 0.55 ? 'app' : 'desk',
        by: r('w') < 0.35 ? 'walkin' : MEMBERS[Math.floor(r('m') * MEMBERS.length)].id,
        method: ['card', 'card', 'cash', 'online', 'wallet'][Math.floor(r('pm') * 5)],
        status: k !== today || age > 40 ? 'delivered' : age > 22 ? 'ready' : age > 8 ? 'prep' : 'new',
      })
    }
  }
  // چند سفارش در جریان برای همین لحظه
  if (nowH > 8.5 && nowH < 23.5) [[4, 'new', 2], [13, 'prep', null], [27, 'ready', 3]].forEach(([m, status, court], i) => draft.push({
    id: 'K-' + (5000 + draft.length), at: Date.now() - m * 6e4, to: court, source: 'app', by: MEMBERS[(i * 11 + 5) % MEMBERS.length].id, method: 'wallet', status,
    lines: [[{ iid: 'iceamericano', qty: 2 }, { iid: 'water', qty: 2 }], [{ iid: 'cappuccino', qty: 1, big: true }, { iid: 'chickensand', qty: 1 }], [{ iid: 'mojito', qty: 1 }, { iid: 'fries', qty: 1, big: true }]][i],
  }))
  // مصرف کل برای ساخت موجودی افتتاحیه
  const need = {}
  draft.forEach((o) => o.lines.forEach((x) => recipeOf(items.find((y) => y.id === x.iid), x.big).forEach(([id, q]) => { need[id] = (need[id] || 0) + q * x.qty })))
  // خریدهای نمونه: هر هفته مواد پرمصرف به اندازه‌ی حدود مصرف همان هفته
  const weekly = ['beans', 'milk', 'ice', 'cup', 'veg', 'baguette', 'chicken', 'water', 'cola', 'lemon', 'orange', 'sodaw', 'box']
  const weeks = Math.max(1, Math.floor((ord(today) - ord(from)) / 7))
  const receipts = []
  for (let k = addDays(from, 6), i = 0; ord(k) <= ord(today); k = addDays(k, 7), i++) {
    const lines = weekly.map((id) => {
      const g = base.find((x) => x.id === id), u = UNITS[g.unit].k
      const q = Math.max(u, Math.round(((need[id] || 0) / weeks) * 0.85 / u) * u)
      const c = Math.round(g.cost * (1 + (rh('rc' + id + i) - 0.4) * 0.08) * 100) / 100
      return { ing: id, code: g.code, name: g.name, qty: q, cost: c }
    })
    receipts.push({ id: 'CR-' + (701 + i), date: k, supplier: i % 2 ? suppliers[1] : suppliers[0], invoice: 'C-' + (3300 + i), pay: i % 3 === 2 ? 'payable' : 'bank', items: lines, total: lines.reduce((s, x) => s + Math.round(x.qty * x.cost), 0), at: Date.now() })
  }
  const got = {}
  receipts.forEach((r) => r.items.forEach((x) => { got[x.ing] = (got[x.ing] || 0) + x.qty }))
  // موجودی افتتاحیه = امروز + مصرف − خرید (اگر منفی شود موجودی امروز بالا می‌رود)
  let ings = base.map((g) => {
    let open = g.stock + (need[g.id] || 0) - (got[g.id] || 0)
    if (open < 0) open = 0
    return { ...g, stock: open, open }
  })
  const openLines = ings.filter((g) => g.open > 0).map((g) => ({ acc: '1302', dr: Math.round(g.open * g.cost), cr: 0, sub: g.code }))
  // اجرای زمانی خریدها و فروش‌ها تا بهای میانگین و موجودی واقعی شوند
  const events = [...receipts.map((r) => ({ t: fromKey(r.date).getTime() + 8 * 36e5, r })), ...draft.map((o) => ({ t: o.at, o }))].sort((a, b) => a.t - b.t)
  const orders = []
  events.forEach((e) => {
    if (e.r) { ings = receiveInto(ings, e.r.items); return }
    const o = e.o
    const ok = o.lines.filter((x) => portions(items.find((y) => y.id === x.iid), ings, x.big) >= x.qty)
    if (!ok.length) return
    const r = placeCafe(ings, items, ok)
    ings = r.ings
    orders.push({ id: o.id, by: o.by, items: r.lines, use: r.use, total: r.total, method: o.method, to: o.to, status: o.status, source: o.source, at: o.at })
  })
  ings = ings.map(({ open, ...g }) => g)
  return { cafeItems: items, cafeIngs: ings, cafeOrders: orders.reverse(), cafeReceipts: receipts.reverse(), cafeMoves: [], openLines }
}
