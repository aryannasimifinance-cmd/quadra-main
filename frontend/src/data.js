// داده‌های نمونه‌ی باشگاه کوادرا — نام‌ها، قیمت‌ها و آمارها ساختگی‌اند
const img = (n) => `./img/${n}.jpg`

export const CLUB = {
  name: 'کوادرا', en: 'QUADRA', tagline: 'باشگاه پدل',
  address: 'تهران — آدرس نمونه', phone: '۰۲۱ ۰۰۰۰ ۰۰۰۰', open: 7, close: 24,
}

// ساعت کاری مجموعه؛ مدیر در تنظیمات عوض می‌کند (۲۴ یعنی تا نیمه‌شب)
export const hoursOf = (club) => club?.hours || { open: CLUB.open, close: CLUB.close }

export const COURTS = [
  { id: 1, name: 'زمین ۱', kind: 'پانورامیک', indoor: true, img: img('court-pano') },
  { id: 2, name: 'زمین ۲', kind: 'پانورامیک', indoor: true, img: img('court-indoor') },
  { id: 3, name: 'زمین ۳', kind: 'استاندارد', indoor: true, img: img('court-blue') },
  { id: 4, name: 'زمین ۴', kind: 'روباز', indoor: false, img: img('court-outdoor') },
]
export const courtById = (id) => COURTS.find((c) => c.id === id)
const COURT_BASE = COURTS.map((c) => ({ ...c }))
export const COURT_IMGS = ['court-pano', 'court-indoor', 'court-blue', 'court-outdoor', 'court-aerial', 'welcome-courts', 'welcome-night', 'tiles'].map(img)
let liveCourtEdits
// تغییرات مدیر روی همان آرایه اعمال می‌شود تا نام و عکس تازه در کل اپ دیده شود
export function setCourts(edits) {
  if (edits === liveCourtEdits) return
  liveCourtEdits = edits
  COURTS.forEach((c, i) => Object.assign(c, COURT_BASE[i], edits?.[c.id] || {}))
}

// سقف رزرو پشت‌سرهم: مربی ۵ ساعت، بازیکن‌ها ۳ ساعت (مدیر در تنظیمات عوض می‌کند)
export const limitsOf = (club) => ({ coachRun: 5, playerRun: 3, ...(club?.limits || {}) })
export const DURATIONS = [
  { h: 1, name: '۱ ساعت' },
  { h: 2, name: '۲ ساعت', tag: 'محبوب' },
  { h: 3, name: '۳ ساعت' },
]

export const DEFAULT_PRICING = { offpeak: 1200000, peak: 1200000, peakFrom: 17 } // هر ساعت، کل زمین

export const LEVELS = [
  { id: 'A', title: 'حرفه‌ای', desc: 'سابقه مسابقه‌ی رسمی، کنترل کامل همه‌ی ضربه‌ها', color: '#141413', base: 2200 },
  { id: 'B+', title: 'پیشرفته‌ی قوی', desc: 'تاکتیک تیمی، اسمش و ویبورا', color: '#24344F', base: 1950 },
  { id: 'B', title: 'پیشرفته', desc: 'رالی طولانی، استفاده از دیوار و زاویه', color: '#2F5D8C', base: 1750 },
  { id: 'B-', title: 'نیمه‌پیشرفته', desc: 'ضربه‌های ثابت، شروع بازی تاکتیکی', color: '#2C7FA0', base: 1550 },
  { id: 'C+', title: 'متوسط قوی', desc: 'رالی پیوسته، سرویس مطمئن', color: '#0E9F98', base: 1400 },
  { id: 'C', title: 'متوسط', desc: 'بازی منظم با چند ماه سابقه', color: '#3DA57E', base: 1250 },
  { id: 'C-', title: 'متوسط مبتدی', desc: 'ضربه‌های پایه را بلدید ولی هنوز ناپایدار است', color: '#B8901C', base: 1100 },
  { id: 'D+', title: 'مبتدی باتجربه', desc: 'چند بار بازی کرده‌اید و قوانین را می‌دانید', color: '#D0692F', base: 950 },
  { id: 'D', title: 'تازه‌کار', desc: 'تازه شروع کرده‌اید — خوش آمدید!', color: '#C2503A', base: 800 },
]
export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id)
export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS[5]
export const nearLevels = (id, span = 1) => {
  const i = Math.max(0, levelIndex(id))
  return LEVELS.slice(Math.max(0, i - span), i + span + 1).map((l) => l.id)
}

export const DAYPARTS = [
  { id: 'any', name: 'هر ساعتی', from: 7, to: 24 },
  { id: 'morning', name: 'صبح', from: 7, to: 12 },
  { id: 'noon', name: 'ظهر', from: 12, to: 17 },
  { id: 'evening', name: 'عصر', from: 17, to: 21 },
  { id: 'night', name: 'شب', from: 21, to: 24 },
]

// مربی‌های نمونه — مدیر در پنل مربی اضافه یا ویرایش می‌کند و فهرست زنده از club.coaches خوانده می‌شود
export const BASE_COACHES = [
  { id: 'k1', name: 'فراز گلچین', title: 'سرمربی باشگاه', level: 'A', exp: 10, rating: 4.9, price: 2000000, img: img('overhead'),
    record: ['۱۰ سال سابقه‌ی مربیگری پدل', 'مدرک مربیگری فدراسیون', 'دارنده‌ی مدال مسابقات کشوری'], bio: 'سرمربی کوادرا؛ برنامه‌ی تمرینی مرحله‌به‌مرحله برای بازیکن‌های همه‌ی سطح‌ها.' },
  { id: 'k2', name: 'سهیل سهرابی', title: 'مربی پیشرفته و مسابقه', level: 'B+', exp: 8, rating: 4.9, price: 1900000, img: img('action'),
    record: ['۸ سال سابقه‌ی مربیگری', 'سابقه‌ی بازی در لیگ کشوری', 'دارنده‌ی مدال تورنمنت‌های باشگاهی'], bio: 'آماده‌سازی بازیکن‌ها برای تورنمنت‌ها و رنکینگ.' },
  { id: 'k3', name: 'کیمیا دانشفر', title: 'مربی بانوان', level: 'B+', exp: 7, rating: 5.0, price: 1800000, img: img('coach-b'),
    record: ['۷ سال سابقه‌ی مربیگری بانوان', 'مدرک مربیگری فدراسیون', 'دارنده‌ی مدال مسابقات بانوان'], bio: 'کلاس‌های خصوصی و گروهی بانوان از پایه تا پیشرفته.' },
  { id: 'k4', name: 'زهرا کهریزی', title: 'مربی پایه و نوجوانان', level: 'A', exp: 5, rating: 4.8, price: 1400000, img: img('coach-a'),
    record: ['۵ سال سابقه‌ی مربیگری', 'مدرک مربیگری فدراسیون', 'سابقه‌ی حضور در مسابقات کشوری'], bio: 'بهترین انتخاب برای شروع پدل و آموزش نوجوانان.' },
]
// فهرست زنده‌ی مربی‌ها (club.coaches)؛ مربی غیرفعال در اپ نشان داده نمی‌شود ولی سابقه‌اش می‌ماند
export const COACHES = []
let liveCoaches = null
export function setCoaches(list) {
  if (!list || list === liveCoaches) return
  liveCoaches = list
  COACHES.length = 0
  COACHES.push(...list)
}
export const coachById = (id) => COACHES.find((c) => c.id === id)
// اطلاعات خصوصی نمونه؛ فقط در پنل مدیر دیده می‌شود
const COACH_PRIVATE = [
  { phone: '09121234501', since: '1400/06/01', share: 60, note: 'قرارداد سالانه؛ تمدید در شهریور', login: { on: true, user: 'faraz', pass: '1234', day: 5, week: 15 } },
  { phone: '09121234502', since: '1401/02/15', share: 55, note: '', login: { on: false, user: 'soheil', pass: '5678', day: 5, week: 15 } },
  { phone: '09121234503', since: '1401/09/01', share: 55, note: 'فقط کلاس بانوان' },
  { phone: '09121234504', since: '1402/07/01', share: 50, note: 'کلاس‌های نوجوانان عصرها' },
]
// داده‌ی قبلی بدون مربی: مربی‌های نمونه با همه‌ی پکیج‌ها فعال اضافه می‌شوند
export function withCoaches(club) {
  if (club.coaches) return club
  return { ...club, coaches: BASE_COACHES.map((c, i) => ({ ...c, active: true, packs: { one: true, five: true, ten: true, group: true }, prices: {}, member: null, ...COACH_PRIVATE[i] })) }
}

// پکیج‌های مربی — قیمت بر اساس نرخ جلسه‌ی مربی
export const COACH_PACKS = [
  { id: 'one', name: 'تک جلسه', sessions: 1, off: 0, people: 1 },
  { id: 'five', name: 'پکیج ۵ جلسه', sessions: 5, off: 0.1, people: 1, tag: '۱۰٪ تخفیف' },
  { id: 'ten', name: 'پکیج ۱۰ جلسه', sessions: 10, off: 0.15, people: 1, tag: '۱۵٪ تخفیف' },
  { id: 'group', name: 'گروهی ۴ نفره', sessions: 1, off: 0, people: 4, mult: 0.4, tag: 'هر نفر' },
]
// قیمت پکیج: اگر مدیر برای این مربی قیمت دستی گذاشته همان، وگرنه از نرخ جلسه و تخفیف پکیج
export const coachPackPrice = (coach, pack) => coach.prices?.[pack.id] || Math.round(coach.price * pack.sessions * (1 - pack.off) * (pack.mult || 1) / 10000) * 10000
export const coachPacks = (coach) => COACH_PACKS.filter((p) => coach?.packs?.[p.id] !== false)

export const PACKAGES = [
  { id: 'p5', kind: 'series', name: 'پکیج ۵ جلسه زمین', sub: 'هفته‌ای یک جلسه، همان روز و ساعت', sessions: 5, off: 0.1, img: img('court-indoor'), perks: ['۱۰٪ ارزان‌تر از رزرو تکی', 'هر ۵ جلسه همان لحظه در تقویم رزرو می‌شود', 'مدت ۱، ۲ یا ۳ ساعت'] },
  { id: 'p10', kind: 'series', name: 'پکیج ۱۰ جلسه زمین', sub: 'هفته‌ای یک جلسه، همان روز و ساعت', sessions: 10, off: 0.15, img: img('court-pano'), perks: ['۱۵٪ ارزان‌تر از رزرو تکی', 'هر ۱۰ جلسه همان لحظه در تقویم رزرو می‌شود', 'مدت ۱، ۲ یا ۳ ساعت'], tag: 'پرفروش' },
  { id: 'gold', kind: 'member', name: 'عضویت طلایی', sub: 'ماهانه', off: 0.15, price: 2900000, days: 30, img: img('reach'), perks: ['۱۵٪ تخفیف همه‌ی رزروها', 'رزرو تا ۱۴ روز جلوتر', '۲ برابر امتیاز XP'] },
  { id: 'black', kind: 'member', name: 'عضویت بلک', sub: 'سه‌ماهه', off: 0.25, price: 7400000, days: 90, img: img('hit'), perks: ['۲۵٪ تخفیف همه‌ی رزروها', 'اولویت در تورنمنت‌ها', '۲ برابر XP + کمد اختصاصی'], tag: 'VIP' },
]
export const packageById = (id) => PACKAGES.find((p) => p.id === id)
// گزینه‌های تعداد جلسه در رزرو زمین (تک یا پکیج هفتگی)
export const SERIES = [
  { id: 'single', name: 'تک جلسه', sessions: 1, off: 0 },
  { id: 'p5', name: 'پکیج ۵ جلسه', sessions: 5, off: 0.1, tag: '۱۰٪ تخفیف' },
  { id: 'p10', name: 'پکیج ۱۰ جلسه', sessions: 10, off: 0.15, tag: '۱۵٪ تخفیف' },
]

// ---------- فروشگاه ----------
export const CATEGORIES = [
  { id: 'all', name: 'همه' },
  { id: 'racket', name: 'راکت' },
  { id: 'shoes', name: 'کفش' },
  { id: 'apparel', name: 'لباس' },
  { id: 'balls', name: 'توپ' },
  { id: 'bags', name: 'ساک' },
  { id: 'acc', name: 'لوازم جانبی' },
]
const S = ['S', 'M', 'L', 'XL']
const SHOE = ['۳۹', '۴۰', '۴۱', '۴۲', '۴۳', '۴۴', '۴۵']
export const BASE_PRODUCTS = [
  { id: 'r1', cat: 'racket', brand: 'Wilson', name: 'راکت Wilson Bela Pro', price: 14900000, was: 16900000, img: img('shop-wilson-racket'), rating: 4.9, reviews: 64, tag: 'پرفروش', stock: 6, gender: 'unisex', level: 'پیشرفته', desc: 'راکت امضای فرناندو بلاستگین؛ قاب کربن و تعادل بالا برای ضربه‌های قدرتی، اسمش و ویبورا.', specs: [['وزن', '۳۶۵ گرم'], ['شکل', 'الماسی'], ['هسته', 'EVA سخت'], ['تعادل', 'بالا']] },
  { id: 'r2', cat: 'racket', brand: 'Nox', name: 'راکت Nox ML10 Pro Cup', price: 9800000, img: img('shop-nox-racket'), rating: 4.7, reviews: 41, stock: 9, gender: 'unisex', level: 'متوسط', desc: 'سر گرد و نقطه‌ی شیرین بزرگ؛ کنترل و دقت، محبوب‌ترین راکت Nox.', specs: [['وزن', '۳۵۵ گرم'], ['شکل', 'گرد'], ['هسته', 'EVA نرم'], ['تعادل', 'پایین']] },
  { id: 'r3', cat: 'racket', brand: 'Adidas', name: 'راکت Adidas Match', price: 7400000, was: 8200000, img: img('shop-adidas-racket'), rating: 4.6, reviews: 28, tag: 'تخفیف', stock: 4, gender: 'unisex', level: 'مبتدی', desc: 'سبک و بخشنده؛ بهترین شروع برای سال اول پدل.', specs: [['وزن', '۳۴۵ گرم'], ['شکل', 'قطره‌ای'], ['هسته', 'فوم'], ['تعادل', 'متوسط']] },
  { id: 'r4', cat: 'racket', brand: 'Nox', name: 'راکت Nox SET', price: 12600000, img: img('shop-nox-racket-white'), rating: 4.8, reviews: 19, tag: 'جدید', stock: 3, gender: 'unisex', level: 'پیشرفته', desc: 'نسخه‌ی سفید و طلایی؛ سطح زبر برای اسپین بیشتر.', specs: [['وزن', '۳۶۰ گرم'], ['شکل', 'قطره‌ای'], ['هسته', 'EVA'], ['سطح', 'زبر 3D']] },
  { id: 'r5', cat: 'racket', brand: 'Head', name: 'راکت Head Delta Pro', price: 8900000, img: img('racket-orange'), rating: 4.5, reviews: 22, stock: 7, gender: 'unisex', level: 'متوسط', desc: 'تعادل همه‌کاره بین قدرت و کنترل؛ انتخاب حرفه‌ای‌های Head.', specs: [['وزن', '۳۵۸ گرم'], ['شکل', 'قطره‌ای'], ['هسته', 'EVA'], ['تعادل', 'متوسط']] },
  { id: 's1', cat: 'shoes', brand: 'Wilson', name: 'کفش Wilson Rush Pro', price: 8600000, img: img('shop-wilson-shoes'), rating: 4.8, reviews: 37, tag: 'پرفروش', stock: 12, gender: 'unisex', sizes: SHOE, desc: 'زیره‌ی هرینگ‌بون برای چمن مصنوعی و شن؛ ثبات در حرکات جانبی.', specs: [['زیره', 'هرینگ‌بون'], ['کاربرد', 'چمن / شن'], ['وزن', '۳۶۰ گرم']] },
  { id: 's2', cat: 'shoes', brand: 'Asics', name: 'کفش Asics Gel-Court Bella', price: 7900000, was: 8900000, img: img('shop-asics-shoes'), rating: 4.7, reviews: 52, tag: 'تخفیف', stock: 8, gender: 'women', sizes: SHOE.slice(0, 5), desc: 'ژل ضربه‌گیر پاشنه و رویه‌ی تنفسی؛ سبک برای بازی‌های طولانی.', specs: [['زیره', 'Omni'], ['ضربه‌گیر', 'GEL'], ['وزن', '۳۱۰ گرم']] },
  { id: 's3', cat: 'shoes', brand: 'Bullpadel', name: 'کفش Bullpadel Vertex Grip', price: 6400000, img: img('shoe-black'), rating: 4.5, reviews: 18, stock: 5, gender: 'men', sizes: SHOE.slice(2), desc: 'چسبندگی بالا روی کورت شنی؛ پنجه‌ی تقویت‌شده.', specs: [['زیره', 'Clay'], ['کاربرد', 'شن'], ['وزن', '۳۸۰ گرم']] },
  { id: 'a1', cat: 'apparel', brand: 'Quadra', name: 'تی‌شرت کوادرا Club', price: 1900000, art: { type: 'tee', color: '#141413' }, colors: [{ n: 'مشکی', c: '#141413' }, { n: 'سفید', c: '#F4F2EC' }, { n: 'فیروزه‌ای', c: '#19C9C1' }], rating: 4.9, reviews: 88, tag: 'جدید', stock: 40, gender: 'unisex', sizes: S, desc: 'پارچه‌ی دری‌فیت سبک با لوگوی کوادرا؛ لباس رسمی باشگاه.', specs: [['جنس', 'پلی‌استر دری‌فیت'], ['فرم', 'Regular']] },
  { id: 'a2', cat: 'apparel', brand: 'Quadra', name: 'پولو کوادرا Pro', price: 2400000, art: { type: 'polo', color: '#F4F2EC' }, colors: [{ n: 'سفید', c: '#F4F2EC' }, { n: 'مشکی', c: '#141413' }], rating: 4.7, reviews: 31, stock: 22, gender: 'men', sizes: S, desc: 'یقه‌دار، خنک و رسمی برای تورنمنت‌ها.', specs: [['جنس', 'پنبه + الاستان'], ['فرم', 'Slim']] },
  { id: 'a3', cat: 'apparel', brand: 'Quadra', name: 'شلوارک کوادرا Court', price: 1600000, art: { type: 'shorts', color: '#24344F' }, colors: [{ n: 'سرمه‌ای', c: '#24344F' }, { n: 'مشکی', c: '#141413' }], rating: 4.6, reviews: 26, stock: 18, gender: 'men', sizes: S, desc: 'جیب توپ کناری و کش راحت.', specs: [['جنس', 'پلی‌استر'], ['جیب', 'دو جیب توپ']] },
  { id: 'a4', cat: 'apparel', brand: 'Quadra', name: 'دامن‌شلوارک کوادرا', price: 1750000, art: { type: 'skirt', color: '#19C9C1' }, colors: [{ n: 'فیروزه‌ای', c: '#19C9C1' }, { n: 'سفید', c: '#F4F2EC' }, { n: 'مشکی', c: '#141413' }], rating: 4.8, reviews: 34, stock: 14, gender: 'women', sizes: S.slice(0, 3), desc: 'شلوارک داخلی با جیب توپ؛ حرکت آزاد.', specs: [['جنس', 'پلی‌استر + اسپندکس']] },
  { id: 'a5', cat: 'apparel', brand: 'Quadra', name: 'هودی کوادرا Night', price: 3200000, was: 3600000, art: { type: 'hoodie', color: '#141413' }, colors: [{ n: 'مشکی', c: '#141413' }, { n: 'طوسی', c: '#9A988F' }], rating: 4.9, reviews: 47, tag: 'تخفیف', stock: 9, gender: 'unisex', sizes: S, desc: 'هودی گرم برای بعد از بازی‌های شبانه‌ی زمین ۴.', specs: [['جنس', 'پنبه ۸۰٪'], ['فرم', 'Oversize']] },
  { id: 'a6', cat: 'apparel', brand: 'Quadra', name: 'کلاه کوادرا Cap', price: 900000, art: { type: 'cap', color: '#F4F2EC' }, colors: [{ n: 'سفید', c: '#F4F2EC' }, { n: 'مشکی', c: '#141413' }, { n: 'فیروزه‌ای', c: '#19C9C1' }], rating: 4.6, reviews: 52, stock: 30, gender: 'unisex', desc: 'نقاب سبک و تنفسی، بند قابل تنظیم.', specs: [['جنس', 'پلی‌استر سوراخ‌دار']] },
  { id: 'b1', cat: 'balls', brand: 'Babolat', name: 'توپ Babolat Padel+ — قوطی ۳تایی', price: 650000, img: img('shop-babolat-balls'), rating: 4.8, reviews: 120, tag: 'پرفروش', stock: 80, gender: 'unisex', desc: 'توپ رسمی تورنمنت‌های کوادرا؛ فشار پایدار و دوام بالا.', specs: [['تعداد', '۳ عدد'], ['فشار', 'استاندارد']] },
  { id: 'b2', cat: 'balls', brand: 'Head', name: 'توپ Head Padel Pro', price: 520000, img: img('shop-head-balls'), rating: 4.5, reviews: 44, stock: 50, gender: 'unisex', desc: 'سرعت بیشتر برای زمین‌های سرپوشیده.', specs: [['تعداد', '۳ عدد'], ['کاربرد', 'سرپوشیده']] },
  { id: 'b3', cat: 'balls', brand: 'Wilson', name: 'کارتن توپ Wilson — ۲۴ قوطی', price: 13900000, was: 15600000, img: img('shop-wilson-ball'), rating: 4.9, reviews: 12, tag: 'تخفیف', stock: 6, gender: 'unisex', desc: 'برای تیم‌ها و مربی‌ها؛ ۷۲ توپ.', specs: [['تعداد', '۷۲ عدد']] },
  { id: 'g1', cat: 'bags', brand: 'Quadra', name: 'ساک راکت کوادرا Tour', price: 4200000, art: { type: 'bag', color: '#141413' }, colors: [{ n: 'مشکی', c: '#141413' }, { n: 'فیروزه‌ای', c: '#19C9C1' }], rating: 4.8, reviews: 29, tag: 'جدید', stock: 7, gender: 'unisex', desc: 'جای ۳ راکت، جیب حرارتی و جای کفش جدا.', specs: [['ظرفیت', '۳ راکت'], ['جیب کفش', 'دارد']] },
  { id: 'g2', cat: 'bags', brand: 'Quadra', name: 'کوله کوادرا Daily', price: 2600000, art: { type: 'backpack', color: '#9A988F' }, colors: [{ n: 'طوسی', c: '#9A988F' }, { n: 'مشکی', c: '#141413' }], rating: 4.6, reviews: 15, stock: 11, gender: 'unisex', desc: 'کوله‌ی روزمره با جای یک راکت.', specs: [['ظرفیت', '۲۵ لیتر']] },
  { id: 'g3', cat: 'bags', brand: 'Wilson', name: 'ساک Wilson Super Tour', price: 5600000, img: img('shop-wilson-bag'), rating: 4.8, reviews: 21, tag: 'جدید', stock: 5, gender: 'unisex', desc: 'ساک دو جیب بزرگ برای ۶ راکت، جیب حرارتی و جای کفش جدا.', specs: [['ظرفیت', '۶ راکت'], ['جیب کفش', 'دارد']] },
  { id: 'x1', cat: 'acc', brand: 'Head', name: 'اورگریپ Head Prime — بسته ۳تایی', price: 380000, art: { type: 'grip', color: '#19C9C1' }, colors: [{ n: 'فیروزه‌ای', c: '#19C9C1' }, { n: 'سفید', c: '#F4F2EC' }, { n: 'مشکی', c: '#141413' }], rating: 4.7, reviews: 96, stock: 60, gender: 'unisex', desc: 'جذب عرق و چسبندگی بالا.', specs: [['تعداد', '۳ عدد']] },
  { id: 'x2', cat: 'acc', brand: 'Quadra', name: 'مچ‌بند کوادرا — جفت', price: 290000, art: { type: 'band', color: '#141413' }, colors: [{ n: 'مشکی', c: '#141413' }, { n: 'فیروزه‌ای', c: '#19C9C1' }], rating: 4.5, reviews: 40, stock: 45, gender: 'unisex', desc: 'حوله‌ای نرم با لوگوی بافته‌شده.', specs: [['تعداد', '۲ عدد']] },
  { id: 'x3', cat: 'acc', brand: 'Quadra', name: 'قمقمه‌ی حرارتی کوادرا', price: 850000, art: { type: 'bottle', color: '#19C9C1' }, colors: [{ n: 'فیروزه‌ای', c: '#19C9C1' }, { n: 'مشکی', c: '#141413' }, { n: 'سفید', c: '#F4F2EC' }], rating: 4.9, reviews: 58, tag: 'پرفروش', stock: 25, gender: 'unisex', desc: '۷۵۰ میلی‌لیتر؛ ۱۲ ساعت سرد.', specs: [['حجم', '۷۵۰ml'], ['جنس', 'استیل']] },
  { id: 'x4', cat: 'acc', brand: 'Quadra', name: 'حوله‌ی ورزشی کوادرا', price: 690000, art: { type: 'towel', color: '#F4F2EC' }, colors: [{ n: 'سفید', c: '#F4F2EC' }, { n: 'مشکی', c: '#141413' }], rating: 4.6, reviews: 21, stock: 2, gender: 'unisex', desc: 'میکروفایبر، سریع‌خشک.', specs: [['ابعاد', '۴۰×۸۰']] },
]
// کاتالوگ زنده: مدیر کالا اضافه یا ویرایش می‌کند و store با setCatalog همین‌جا جایگزینش می‌کند
export let PRODUCTS = []
export let BRANDS = []
export function setCatalog(list) {
  if (!list || list === PRODUCTS) return
  PRODUCTS = list
  BRANDS = [...new Set(list.filter((p) => p.active !== false).map((p) => p.brand))]
}
export const productById = (id) => PRODUCTS.find((p) => p.id === id)
// موجودی کل کالا = جمع موجودی همه‌ی تنوع‌ها (سایز × رنگ)
export const stockOf = (p) => (p?.variants || []).reduce((s, v) => s + v.stock, 0)
export const variantOf = (p, size, color) => p?.variants?.find((v) => (v.size || null) === (size || null) && (v.color || null) === (color || null)) || p?.variants?.[0]

// ---------- ابزار ----------
// رمز ورود هیچ‌وقت خام ذخیره نمی‌شود (نسخه‌ی نمایشی؛ در نسخه‌ی واقعی سمت سرور با bcrypt)
export function passHash(user, pass) {
  let a = 0x811c9dc5, b = 0x01000193
  const s = `quadra:${String(user).toLowerCase()}:${pass}`
  for (let k = 0; k < 3; k++) for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619) >>> 0; b = Math.imul(b ^ (a & 0xff), 2246822519) >>> 0 }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}
// نام کاربری مجاز: انگلیسی کوچک، عدد، نقطه و زیرخط، ۳ تا ۲۰ حرف
export const USER_RE = /^[a-z0-9._]{3,20}$/
export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  // ترکیب نهایی تا ورودی‌هایی که فقط در حرف آخر فرق دارند هم نتیجه‌ی کاملاً متفاوت بدهند
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967295
}
export const fa = (n) => Number(n).toLocaleString('fa-IR')
// پنل مدیر مبلغ‌ها را کامل و بدون واحد می‌نویسد (plainMoney)؛ اپ بازیکن همان شکل کوتاه با «تومان» را دارد
let PLAIN = false
export const plainMoney = (v) => { PLAIN = v }
const whole = (n) => fa(Math.round(n / 1000) * 1000)
export const toman = (n) => (PLAIN ? whole(n) : whole(n) + ' تومان')
export const mil = (n) => (PLAIN ? whole(n) : (n >= 1e9 ? fa(+(n / 1e9).toFixed(2)) + ' میلیارد' : fa(+(n / 1e6).toFixed(1)) + ' میلیون') + ' تومان')
export const short = (n) => (PLAIN ? whole(n) : n >= 1e9 ? fa(+(n / 1e9).toFixed(1)) + ' میلیارد' : n >= 1e6 ? fa(+(n / 1e6).toFixed(1)) + ' م' : fa(n))
export function hourLabel(h) {
  const hh = Math.floor(h) % 24, mm = h % 1 ? '۳۰' : '۰۰'
  return `${fa(hh).padStart(2, '۰')}:${mm}`
}
export const range = (s, d) => `${hourLabel(s)}–${hourLabel(s + d)}`

export function nextDays(n = 14, from = 0) {
  const out = []
  const base = new Date(); base.setHours(0, 0, 0, 0)
  for (let i = from; i < from + n; i++) { const d = new Date(base); d.setDate(base.getDate() + i); out.push(d) }
  return out
}
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
export const todayKey = () => dayKey(new Date())
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d) }
const wd = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })
const wds = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' })
const dm = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' })
const dn = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' })
export const weekday = (d) => wd.format(d)
export const weekdayShort = (d) => wds.format(d)
export const dayNum = (d) => dn.format(d)
export const dayMonth = (d) => dm.format(d)
export function dayLabel(d) {
  if (typeof d === 'string') d = fromKey(d)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((d - t) / 864e5)
  if (diff === 0) return 'امروز'
  if (diff === 1) return 'فردا'
  if (diff === -1) return 'دیروز'
  return weekday(d)
}
export const isWeekend = (d) => d.getDay() === 4 || d.getDay() === 5
export const daysFromToday = (k) => Math.round((fromKey(k) - fromKey(todayKey())) / 864e5)

export function isPeak(date, h, pricing) {
  return isWeekend(typeof date === 'string' ? fromKey(date) : date) || h >= pricing.peakFrom
}
// قیمت کل زمین برای یک بازه — هر نیم‌ساعت جداگانه حساب می‌شود
export function priceFor(date, start, dur, pricing) {
  let sum = 0
  for (let t = start; t < start + dur; t += 0.5) sum += (isPeak(date, t, pricing) ? pricing.peak : pricing.offpeak) / 2
  return sum
}

// ---------- اعضا ----------
const FIRST = ['آرین', 'نیما', 'سارا', 'مهسا', 'کیان', 'پارسا', 'الناز', 'رها', 'سینا', 'امید', 'تینا', 'بهار', 'ماهان', 'یاسمن', 'دانیال', 'نگار', 'آرمان', 'شیوا', 'پویا', 'هستی', 'رامین', 'لیلا', 'سپهر', 'مریم', 'کامیار', 'ترانه', 'بردیا', 'آیدا']
// نام‌های زنانه برای تعیین جنسیت اعضای نمونه
const FEMALE = new Set(['سارا', 'مهسا', 'الناز', 'رها', 'تینا', 'بهار', 'یاسمن', 'نگار', 'شیوا', 'هستی', 'لیلا', 'مریم', 'ترانه', 'آیدا'])
const LAST = ['کریمی', 'محمدی', 'رضایی', 'نوری', 'صالحی', 'جعفری', 'فرهادی', 'شریفی', 'طاهری', 'بهرامی', 'احمدی', 'موسوی', 'کاظمی', 'یزدانی']
// اعضای فعلی باشگاه (بقیه نمونه‌اند)
const CLUB_NAMES = ['خشایار نظری', 'آریان نسیمی‌فر', 'یاشار امین‌ترابی', 'امیرحسین حیدری', 'عرفان دیو', 'فراز گلچین', 'اشکان دهقان', 'نعیم تهرانی', 'خالد بوکوفسکی', 'اصغر سگ‌باز', 'اون یارو که همیشه داد می‌زنه']
export const SIDES = [
  { id: 'right', name: 'سمت راست', short: 'راست', desc: 'بیشتر از سمت راست زمین بازی می‌کنید' },
  { id: 'left', name: 'سمت چپ', short: 'چپ', desc: 'بیشتر از سمت چپ زمین بازی می‌کنید' },
  { id: 'both', name: 'هر دو سمت', short: 'هر دو', desc: 'هر جا تیم لازم داشت بازی می‌کنید' },
]
export const sideById = (id) => SIDES.find((x) => x.id === id)
export const BASE_MEMBERS = Array.from({ length: 56 }, (_, i) => {
  const r = (k) => hash('m' + i + k)
  const level = LEVELS[Math.min(8, Math.floor(r('lv') * r('lv2') * 9 + r('l3') * 3))].id
  const games = 3 + Math.floor(r('g') * 160)
  const first = CLUB_NAMES[i] ? null : FIRST[Math.floor(r('f') * FIRST.length)]
  return {
    id: 'm' + i,
    name: CLUB_NAMES[i] || first + ' ' + LAST[Math.floor(r('l') * LAST.length)],
    gender: first && FEMALE.has(first) ? 'f' : 'm',
    birth: 1345 + Math.floor(r('by') * 45), // سال تولد شمسی (۱۵ تا ۶۰ ساله)
    side: ['right', 'left', 'both'][Math.floor(r('sd') * 3)],
    phone: '0912' + String(1000000 + Math.floor(r('p') * 8999999)),
    level, games, wins: Math.floor(games * (0.3 + r('w') * 0.45)),
    points: levelById(level).base + Math.floor(r('pt') * 240),
    joined: Math.floor(r('j') * 400), last: Math.floor(r('ls') * r('ls2') * 70),
    member: r('mb') < 0.18 ? 'gold' : r('mb') < 0.24 ? 'black' : null,
  }
})
// فهرست زنده‌ی اعضا: اعضای نمونه + کسانی که از اپ ثبت‌نام کرده‌اند یا در پذیرش اضافه شده‌اند (club.members)
// ویرایش مدیر روی اعضای نمونه در club.memberEdits نگه داشته می‌شود
export const MEMBERS = []
let liveMembers = null
export function setMembers(list) {
  if (!list || list === liveMembers) return
  liveMembers = list
  MEMBERS.length = 0
  MEMBERS.push(...list)
}
export const memberById = (id) => MEMBERS.find((m) => m.id === id)

// ---------- رویدادها ----------
// دو نوع: «مسابقات آدینه» و «ایونت ویبورا»؛ هر دو با همان روال: تیم دونفره، گروهی + حذفی
export const EVENT_KIND = {
  friday: { name: 'مسابقات آدینه', sub: 'دوستانه با تیم‌های دونفره؛ معمولاً جمعه صبح' },
  official: { name: 'ایونت‌های ویبورا', sub: 'دورهمی ورزشی کوادرا؛ همان روال آدینه، تیم دونفره، گروهی + حذفی' },
}
export const FRIDAY = [
  { title: 'آدینه‌ی دوستانه', format: 'هر بازی با یار جدید' },
  { title: 'میکس بانوان آدینه', format: 'ویژه‌ی بانوان، هر بازی با یار جدید', gender: 'f' },
  { title: 'کینگ آف کورت آدینه', format: 'برنده روی زمین می‌مونه' },
  { title: 'میکس دبل آدینه', format: 'تیم‌های مختلط، هر بازی با یار جدید' },
]
export const OFFICIAL = [
  { title: 'ایونت ویبورا — شب پاییزی', format: 'تیم‌های دونفره، گروهی + حذفی', prize: 'راکت + کارت هدیه‌ی کافه', in: 9 },
  { title: 'ایونت ویبورا — میکس دوستانه', format: 'تیم‌های مختلط، گروهی + حذفی', prize: 'راکت + توپ', in: 23 },
]
// عکس‌های آماده‌ی رویداد (اولی عکس ایونت ویبورا)
export const VIBORA_IMG = img('vibora')
export const EV_IMG = [VIBORA_IMG, img('court-blue'), img('tiles'), img('court-outdoor'), img('ball-court'), img('welcome-courts'), img('welcome-night')]
// مسابقه‌های برگزارشده — برای نظر و امتیاز
export function pastEvents() {
  const out = []
  for (let d = -1; d >= -30 && out.length < 3; d--) {
    const k = addDays(todayKey(), d)
    if (fromKey(k).getDay() === 5) out.push({ id: 'fr-' + k, kind: 'friday', title: 'آدینه‌ی کوادرا', format: 'هر بازی با یار جدید', date: k, img: EV_IMG[1 + (out.length % (EV_IMG.length - 1))] })
  }
  const off = addDays(todayKey(), -12)
  out.push({ id: 'of-' + off, kind: 'official', title: 'ایونت ویبورا — دورهمی ماه', format: 'گروهی + حذفی', date: off, img: VIBORA_IMG })
  return out
}

// امتیاز ناشناس: میانگین و تعداد نظرها برای یک هدف (coach:k1 یا event:...)
export function ratingOf(club, target) {
  const list = (club.reviews || []).filter((r) => r.target === target)
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0
  return { avg: Math.round(avg * 10) / 10, count: list.length, list: [...list].sort((a, b) => b.at - a.at) }
}
// متن نظر فقط بعد از تأیید مدیر نشان داده می‌شود؛ ستاره‌ها بدون تأیید در میانگین حساب می‌شوند
export const shownReviews = (list) => list.filter((r) => r.text && r.ok !== false && !r.hidden)
// مربی‌ها به ترتیب امتیاز نظرها
export const coachesRanked = (club) => COACHES.filter((c) => c.active !== false).map((c) => ({ ...c, ...ratingOf(club, 'coach:' + c.id) })).sort((a, b) => b.avg - a.avg || b.count - a.count)

export function events() {
  const fridays = nextDays(28, 1).filter((d) => d.getDay() === 5).slice(0, 4).map((d, i) => {
    const r = hash('ev' + dayKey(d))
    const lv = Math.floor(r * 5)
    const f = i === 0 ? { ...FRIDAY[0], title: 'آدینه‌ی این هفته‌ی کوادرا' } : FRIDAY[i % FRIDAY.length]
    return {
      id: 'fr-' + dayKey(d), kind: 'friday', title: f.title, format: f.format, date: dayKey(d), start: 9, dur: 3,
      levels: LEVELS.slice(lv, lv + 3).map((l) => l.id), cap: 16, taken: Math.floor(16 * (0.4 + hash('tk' + i) * 0.5)),
      fee: 750000, prize: 'راکت Wilson + توپ', img: EV_IMG[1 + (i % (EV_IMG.length - 1))],
    }
  })
  const official = OFFICIAL.map((o, i) => {
    // نزدیک‌ترین پنجشنبه بعد از o.in روز
    const d = nextDays(7, o.in).find((x) => x.getDay() === 4)
    return {
      id: 'of-' + dayKey(d), kind: 'official', title: o.title, format: o.format, date: dayKey(d), start: 10, dur: 8,
      levels: LEVELS.slice(0, 5).map((l) => l.id), cap: 32, taken: Math.floor(32 * (0.35 + hash('of' + i) * 0.4)),
      fee: 900000, prize: o.prize, img: VIBORA_IMG,
    }
  })
  return [...fridays, ...official].sort((a, b) => fromKey(a.date) - fromKey(b.date))
}

// ---------- داده‌ی اولیه‌ی باشگاه (برای پنل مدیر) ----------
const METHODS = ['online', 'online', 'online', 'card', 'cash', 'wallet', 'package']
export const METHOD_NAME = { online: 'درگاه آنلاین', card: 'کارتخوان', cash: 'نقدی', wallet: 'کیف پول', package: 'پکیج', 'coach-pack': 'پکیج مربی' }
export const TYPE_NAME = { private: 'رزرو زمین', open: 'بازی باز', coach: 'کلاس مربی', event: 'ایونت', block: 'تعمیرات' }

export function seedClub() {
  const bookings = []
  const pricing = DEFAULT_PRICING
  const now = new Date()
  for (let d = -27; d <= 13; d++) {
    const k = addDays(todayKey(), d), date = fromKey(k)
    COURTS.forEach((c) => {
      let h = 7
      while (h < 23) {
        const r = hash(`s${k}${c.id}${h}`)
        const busyP = (h >= 17 ? 0.62 : h >= 9 && h < 12 ? 0.4 : 0.26) * (isWeekend(date) ? 1.15 : 1) * (d > 3 ? 0.55 : 1)
        if (r > busyP) { h += 1; continue }
        const dur = r < busyP * 0.5 ? 1 : r < busyP * 0.9 ? 2 : 3
        if (h + dur > 24) break
        const t = hash(`t${k}${c.id}${h}`)
        let type = t < 0.6 ? 'private' : t < 0.82 ? 'open' : 'coach'
        const m = MEMBERS[Math.floor(hash(`m${k}${c.id}${h}`) * MEMBERS.length)]
        let coach = type === 'coach' ? COACHES[Math.floor(t * 40) % COACHES.length] : null
        // یک مربی هم‌زمان روی دو زمین کلاس ندارد
        if (coach && bookings.some((b) => b.coach === coach.id && b.date === k && h < b.start + b.dur && b.start < h + dur)) { type = 'private'; coach = null }
        const price = type === 'coach' ? coach.price * dur : priceFor(k, h, dur, pricing)
        const past = d < 0 || (d === 0 && h + dur <= now.getHours())
        const players = type === 'open'
          ? Array.from({ length: past ? 4 : 1 + Math.floor(hash(`p${k}${c.id}${h}`) * 3) }, (_, j) => j === 0 ? m.id : MEMBERS[(MEMBERS.indexOf(m) + 1 + j * 7 + Math.floor(hash(`q${k}${c.id}${h}`) * 5)) % MEMBERS.length].id)
          : [m.id]
        const pr = hash(`pay${k}${c.id}${h}`)
        const source = hash('src' + k + c.id + h) < 0.75 ? 'app' : 'desk'
        // مثل اپ: رزرو از اپ همان موقع کامل پرداخت می‌شود، رزرو پذیرش در محل؛ در بازی باز هر بازیکن سهم خودش را می‌دهد
        const paid = type === 'open' ? Math.round(price / 4) * players.length : source === 'app' ? price : past ? (pr < 0.95 ? price : 0) : 0
        const cancelled = hash(`x${k}${c.id}${h}`) < 0.03
        bookings.push({
          id: `b${k}-${c.id}-${h}`, court: c.id, date: k, start: h, dur, type, by: m.id, players,
          levels: type === 'open' ? [m.level, ...nearLevels(m.level, 1)].filter((v, i, a) => a.indexOf(v) === i) : null,
          coach: coach?.id || null, price, paid, method: METHODS[Math.floor(pr * 70) % METHODS.length],
          status: cancelled ? 'cancelled' : 'ok', refunded: cancelled && paid > 0, source,
          at: fromKey(addDays(k, -1 - Math.floor(pr * 5))).getTime() + 36e5 * 10,
        })
        h += dur + (hash(`g${k}${c.id}${h}`) < 0.5 ? 0 : 1)
      }
    })
  }
  // تعمیرات نمونه
  // تعمیرات نمونه — رزروهای هم‌پوشان آن بازه حذف می‌شوند
  const blk = { court: 4, date: addDays(todayKey(), 2), start: 7, dur: 3 }
  for (let i = bookings.length - 1; i >= 0; i--) {
    const b = bookings[i]
    if (b.court === blk.court && b.date === blk.date && b.start < blk.start + blk.dur && blk.start < b.start + b.dur) bookings.splice(i, 1)
  }
  bookings.push({ id: 'blk1', court: 4, date: blk.date, start: 7, dur: 3, type: 'block', by: null, players: [], price: 0, paid: 0, status: 'ok', note: 'تعویض چمن مصنوعی', at: Date.now() })

  const orders = Array.from({ length: 34 }, (_, i) => {
    const r = (k) => hash('o' + i + k)
    const n = 1 + Math.floor(r('n') * 3)
    const items = Array.from({ length: n }, (_, j) => {
      const p = BASE_PRODUCTS[Math.floor(hash('oi' + i + j) * BASE_PRODUCTS.length)]
      return { pid: p.id, qty: 1 + Math.floor(hash('oq' + i + j) * (p.cat === 'balls' ? 3 : 1.2)), price: p.price, size: p.sizes?.[1] || null }
    })
    const ago = Math.floor(r('d') * r('d2') * 28)
    return {
      id: 'Q-' + (1200 + i), by: MEMBERS[Math.floor(r('m') * MEMBERS.length)].id, items,
      total: items.reduce((s, x) => s + x.qty * x.price, 0), method: METHODS[Math.floor(r('pm') * 4)],
      status: ago > 2 ? 'delivered' : ago > 0 ? 'ready' : 'new', at: Date.now() - ago * 864e5 - r('h') * 8 * 36e5,
    }
  })
  const sales = Array.from({ length: 26 }, (_, i) => {
    const r = (k) => hash('ps' + i + k)
    const coach = r('k') < 0.45
    const ago = Math.floor(r('d') * 30)
    if (coach) {
      const c = COACHES[Math.floor(r('c') * COACHES.length)], p = COACH_PACKS[1 + Math.floor(r('p') * 2)]
      return { id: 'S-' + (500 + i), kind: 'coach', item: c.id, pack: p.id, name: `${p.name}، ${c.name}`, by: MEMBERS[Math.floor(r('m') * MEMBERS.length)].id, price: coachPackPrice(c, p), method: 'online', at: Date.now() - ago * 864e5 }
    }
    const p = PACKAGES[Math.floor(r('p') * PACKAGES.length)]
    const price = p.kind === 'series' ? Math.round(p.sessions * 2 * pricing.offpeak * (1 - p.off) / 10000) * 10000 : p.price
    return { id: 'S-' + (500 + i), kind: 'package', item: p.id, name: p.name, by: MEMBERS[Math.floor(r('m') * MEMBERS.length)].id, price, method: r('pm') < 0.7 ? 'online' : 'card', at: Date.now() - ago * 864e5 }
  })
  // بازی‌های عمومی/خصوصی و چند دعوت نمونه برای کاربر اپ ('me')
  bookings.forEach((b) => { if (b.type === 'open') { b.visibility = 'public'; b.invited = [] } })
  bookings.filter((b) => b.type === 'open' && b.players.length < 4 && fromKey(b.date) > fromKey(todayKey())).slice(0, 3).forEach((b, k) => {
    b.visibility = 'private'; b.invited = ['me', MEMBERS[(k * 7 + 3) % MEMBERS.length].id]
  })
  // نظرهای ناشناس نمونه — امتیاز مربی‌ها و مسابقه‌ها از میانگین همین‌ها حساب می‌شود
  const NOTES = ['خیلی صبور و دقیق', 'تمرین‌ها هدفمند بود', 'سطحم واقعاً بهتر شد', 'وقت‌شناس و منظم', 'توضیح‌ها ساده و کاربردی', 'جلسه‌ها پرانرژی بود', '', '', '']
  const reviews = []
  COACHES.forEach((c, ci) => {
    const n = 14 + Math.floor(hash('rv' + c.id) * 24)
    for (let k = 0; k < n; k++) {
      const r = hash(`rv${c.id}${k}`)
      const stars = r < 0.62 + ci * 0.04 ? 5 : r < 0.9 ? 4 : r < 0.97 ? 3 : 2
      reviews.push({ id: `r-${c.id}-${k}`, target: 'coach:' + c.id, stars, text: NOTES[Math.floor(hash(`rt${c.id}${k}`) * NOTES.length)], at: Date.now() - Math.floor(r * 60) * 864e5 })
    }
  })
  pastEvents().forEach((e, ei) => {
    for (let k = 0; k < 6 + ei * 3; k++) {
      const r = hash(`re${e.id}${k}`)
      reviews.push({ id: `r-${e.id}-${k}`, target: 'event:' + e.id, stars: r < 0.55 ? 5 : r < 0.88 ? 4 : 3, text: ['برگزاری منظم بود', 'جو خیلی خوبی داشت', 'داوری می‌تونست بهتر باشه', ''][k % 4], at: fromKey(e.date).getTime() + 864e5 })
    }
  })
  const t1 = addDays(todayKey(), 1), t2 = addDays(todayKey(), 2)
  const coachReqs = [
    { id: 'CR-demo1', coach: 'k1', date: t1, court: 2, start: 8, dur: 1, student: null, note: 'جلسه‌ی آزمایشی شاگرد جدید', status: 'pending', at: Date.now() - 2 * 36e5 },
    { id: 'CR-demo2', coach: 'k1', date: t2, court: 3, start: 7, dur: 2, student: null, note: 'کلاس گروهی صبح', status: 'pending', at: Date.now() - 36e5 },
  ]
  const logins = { aryan: { phone: '09120000000', h: passHash('aryan', '123456') } }
  return { v: 19, pricing, off: {}, bookings, orders, sales, expenses: [], reviews, coachReqs, logins }
}

// ---------- گیمیفیکیشن ----------
// رتبه‌ی باشگاه: فقط بر اساس XP — هر فعالیت در باشگاه XP می‌دهد (XP_GUIDE)
export const RANKS = [
  { name: 'تازه‌وارد', xp: 0, c: '#B07A4E', desc: 'تازه به کوادرا پیوسته‌اید' },
  { name: 'بازیکن ثابت', xp: 150, c: '#8F8F8F', desc: 'چند بار بازی کرده‌اید و جای خودتان را پیدا کرده‌اید' },
  { name: 'بازیکن جدی', xp: 400, c: '#C9A227', desc: 'هر هفته در زمین هستید' },
  { name: 'حرفه‌ای باشگاه', xp: 800, c: '#2C7FA0', desc: 'از چهره‌های آشنای کوادرا' },
  { name: 'ستاره‌ی کوادرا', xp: 1400, c: '#19C9C1', desc: 'بازیکنی که همه می‌شناسند' },
  { name: 'اسطوره‌ی کوادرا', xp: 2200, c: '#141413', desc: 'بالاترین رتبه‌ی باشگاه' },
]
export const XP_GUIDE = [
  ['رزرو زمین', '۵۰'], ['ساختن بازی باز', '۷۰'], ['پیوستن به بازی باز', '۴۰'], ['جلسه با مربی', '۴۰'],
  ['خرید پکیج ۵ یا ۱۰ جلسه', '۴۰ + ۱۵ برای هر جلسه'], ['ثبت‌نام در مسابقه', '۸۰'], ['هر نشان جدید', '۱۵'],
  ['چالش‌های هفتگی', '۴۰ تا ۶۰'], ['خرید از فروشگاه', 'از ۱۰ به بالا'], ['عضویت طلایی یا بلک', 'XP دو برابر'],
]
export function rankOf(xp) {
  let i = 0
  while (i < RANKS.length - 1 && xp >= RANKS[i + 1].xp) i++
  const cur = RANKS[i], next = RANKS[i + 1]
  return { index: i, ...cur, next, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 }
}

// نشان‌ها — هر نشان یک کار مشخص در باشگاه است و ۱۵ XP جایزه دارد
export const BADGES = [
  { id: 'first', icon: '🎾', name: 'سرویس اول', desc: 'اولین رزرو یا بازی خود را ثبت کنید' },
  { id: 'host', icon: '📣', name: 'میزبان', desc: 'یک بازی باز بسازید تا بقیه به شما بپیوندند' },
  { id: 'social', icon: '🤝', name: 'یار تازه', desc: 'به بازی باز یک نفر دیگر بپیوندید' },
  { id: 'squad', icon: '🧩', name: 'چهار نفره‌ی کامل', desc: 'بازی‌ای که ساخته‌اید با ۴ بازیکن پر شود' },
  { id: 'quad', icon: '🏟', name: 'فاتح چهار زمین', desc: 'روی هر ۴ زمین کوادرا بازی کنید' },
  { id: 'early', icon: '🌅', name: 'سرویس صبحگاهی', desc: 'بازی‌ای که قبل از ساعت ۹ صبح شروع شود' },
  { id: 'night', icon: '🌙', name: 'ستاره‌ی شب', desc: 'بازی‌ای که بعد از ساعت ۲۲ تمام شود' },
  { id: 'student', icon: '🧢', name: 'شاگرد مربی', desc: 'اولین جلسه با مربی را رزرو کنید' },
  { id: 'champ', icon: '🏆', name: 'اهل مسابقه', desc: 'در مسابقات آدینه یا یک تورنمنت ثبت‌نام کنید' },
  { id: 'shopper', icon: '🛍', name: 'تجهیزات کامل', desc: 'اولین خرید از فروشگاه باشگاه' },
  { id: 'loyal', icon: '💎', name: 'عضو ثابت', desc: 'یک پکیج ۵ یا ۱۰ جلسه یا عضویت بخرید' },
]

export const CREDITS = [
  'Jjanhone — Wilson padel rackets and Wilson Rush Pro shoes (CC BY-SA 4.0, Wikimedia Commons)',
  'Jennifer Nel — Nox rackets and Babolat Padel+ balls (CC BY-SA 4.0, Wikimedia Commons)',
  'consiliumonline — Adidas padel racket (CC BY 2.0, Flickr)',
  'R. Henrik Nilsson — Head Tour balls (CC BY 4.0, Wikimedia Commons)',
  'Muhammad Taslim Razin — Wilson ball (CC BY-SA 2.0, Wikimedia Commons)',
  'Warinhari — Asics Gel Court Bella shoes (CC BY-SA 4.0, Wikimedia Commons)',
  'Valenzuela400 — Wilson racket bag (CC BY-SA 4.0, Wikimedia Commons)',
  'Karl Schlich / TC Rheinbach e.V. — Vibora event group photo, Wikimedia Commons (copyrighted free use)',
  'Gianluca Guidi — aerial view of padel court, welcome video (Pexels License)',
  'Vincenzo Morelli — padel rackets on court (Unsplash License)',
  'Padel courts from above — welcome screen (photo supplied by the club)',
  'Unsplash — padel photos (Unsplash License)',
  'Nenad Stojković — padel courts aerial (CC BY 2.0, Wikimedia Commons)',
  'Samson Ssemakadde — padel court (CC0, Wikimedia Commons)',
  'Ainali — outdoor padel court Mariestad (CC BY-SA 4.0, Wikimedia Commons)',
  'SG Padel — Mejorset panoramic padel court (CC BY-SA 4.0, Wikimedia Commons)',
  'Wilson Rush Pro tennis shoes (CC BY-SA 4.0, Wikimedia Commons)',
  'Asics Gel Court Bella Femme (CC BY-SA 4.0, Wikimedia Commons)',
  'ChaussuresTennis (CC BY-SA 4.0, Wikimedia Commons)',
  'Cmglee — tennis balls (CC BY-SA 4.0, Wikimedia Commons)',
  'A type of tennis ball; Closeup of a tennis ball (CC0, Wikimedia Commons)',
  // عکس‌های منوی کافه
  "Kritzolina — Cup of espresso 02.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Firzafp — A cup of Americano in Lano Coffee (Palembang, SS).jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Peachyeung316 — Classical Cappuccino in Savour Cafe.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Maksym Kozlenko — Caffe Latte cup.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Andy Li — Mocha - Potatoast 2025-12-30.jpg (CC0, Wikimedia Commons)",
  "Mulo Emmanuel — Caffe macchiato.jpg (CC BY-SA 3.0, Wikimedia Commons)",
  "Quercus acuta — Japanese iced coffee - 01.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Tony Webster — Iced Coffee in Glass - Sunshine Coffee - Laramie Cafe (53838344552).jpg (CC BY 2.0, Wikimedia Commons)",
  "christopher cornelius — Cold brew for Terra.jpg (CC BY 2.0, Wikimedia Commons)",
  "Richard Huber — Affogato al Caffe.jpg (CC BY-SA 3.0, Wikimedia Commons)",
  "Sm faysal — A cup of black tea from Srimangal Bangladesh.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "Douglas P Perkins — White cup with green tea in it.jpg (CC BY 3.0, Wikimedia Commons)",
  "David.Monniaux — Hot chocolate p1150797.jpg (CC BY-SA 3.0, Wikimedia Commons)",
  "NuCastiel from Bangkok, Thailand — Matcha Green Tea Latte (35487991553).jpg (CC BY 2.0, Wikimedia Commons)",
  "Kurt Kaiser — Glass of water ouside.jpg (CC0, Wikimedia Commons)",
  "pic_p_ter — Glass cola.jpg (Public domain, Wikimedia Commons)",
  "k7hpn — Mint Lemonade, Honest Burgers Brewer Street, Soho 2026-08-15.jpg (CC BY 4.0, Wikimedia Commons)",
  "Vodopivez at Italian Wikipedia — Mojito-party.jpg (Public domain, Wikimedia Commons)",
  "Pink Sherbet Photography from USA — Refreshing Sugar Sweet Red Strawberry Martini Drink (3405075157).jpg (CC BY 2.0, Wikimedia Commons)",
  "Shixart1985 — Tequila sunrise in a stylish glass.jpg (CC BY 2.0, Wikimedia Commons)",
  "에그란 — Homemade chicken tender sandwich 1.jpg (CC BY 4.0, Wikimedia Commons)",
  "jeffreyw — Ham and cheese sandwich.jpg (CC BY 2.0, Wikimedia Commons)",
  "jeffreyw — Tuna salad sandwich (1).jpg (CC BY 2.0, Wikimedia Commons)",
  "Andy Li — Panini (Spinach, mushrooms & fresh tomato) - Breakfast At Tiffany's Brighton 2023-11-23.jpg (CC0, Wikimedia Commons)",
  "BrokenSphere — Chicken penne alfredo.JPG (CC BY-SA 3.0, Wikimedia Commons)",
  "hozinja — Spaghetti bolognese (hozinja) (cropped).jpg (CC BY 2.0, Wikimedia Commons)",
  "StockSnap — French Fries.JPG (CC0, Wikimedia Commons)",
  "Daderot — Chicken Caesar salad - Auckland, New Zealand.jpg (CC0, Wikimedia Commons)",
  "Flunse — Orange juice without any fruits.jpg (CC BY-SA 3.0, Wikimedia Commons)",
  "Evening42 — Homemade Mint Lemonade,Bangladesh.jpg (CC BY-SA 4.0, Wikimedia Commons)",
  "OrangeRaver — EnergyDrinkBubbles.jpg (CC BY-SA 4.0, Wikimedia Commons)",
]
