// ارتباط با سرور لاراول. توکن ورود هر تب جدا (sessionStorage) و آخرین ورود دستگاه (localStorage)
// تا مثل قبل مدیر و بازیکن بتوانند در دو تب هم‌زمان کار کنند.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api'
const TOKEN = 'quadra-token'

export function getToken() {
  try { return sessionStorage.getItem(TOKEN) || localStorage.getItem(TOKEN) || null } catch { return null }
}
export function setToken(t) {
  try {
    if (t) { sessionStorage.setItem(TOKEN, t); localStorage.setItem(TOKEN, t) } else {
      const cur = sessionStorage.getItem(TOKEN)
      sessionStorage.removeItem(TOKEN)
      if (!cur || localStorage.getItem(TOKEN) === cur) localStorage.removeItem(TOKEN)
    }
  } catch { /* */ }
}

let onAuthLost = () => {}
export const handleAuthLost = (fn) => { onAuthLost = fn }

// خطای شبکه یا سرور: { error: 'network' | 'server' | 'auth' }
export async function request(method, path, body) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    return { error: 'network' }
  }
  if (res.status === 401) { onAuthLost(); return { error: 'auth' } }
  if (res.status === 429) return { error: 'slow' }
  let data = null
  try { data = await res.json() } catch { /* */ }
  if (!res.ok) return { error: res.status === 422 ? 'bad' : res.status === 404 ? 'gone' : 'server', ...(data || {}) }
  return data || {}
}
export const get = (path) => request('GET', path)
export const post = (path, body = {}) => request('POST', path, body)

// صف درخواست‌های تغییر: به ترتیب اجرا می‌شوند تا کارهای پشت‌سرهم (مثلاً ساخت کالا و بعد ورود موجودی) قاطی نشوند
let chain = Promise.resolve()
let inflight = 0
export const busy = () => inflight > 0
export function enqueue(fn) {
  inflight++
  const p = chain.then(fn, fn).finally(() => { inflight-- })
  chain = p.catch(() => {})
  return p
}

// پیام فارسی برای کدهای خطای سرور
export const ERR = {
  network: 'اتصال به سرور برقرار نشد؛ اینترنت را بررسی کنید.',
  server: 'خطای سرور؛ چند لحظه بعد دوباره تلاش کنید.',
  slow: 'تعداد تلاش‌ها زیاد بود؛ کمی بعد دوباره امتحان کنید.',
  auth: 'نشست شما تمام شده؛ دوباره وارد شوید.',
  bad: 'اطلاعات واردشده درست نیست.',
  gone: 'این مورد دیگر وجود ندارد.',
  busy: 'این زمان دیگر خالی نیست.',
  wallet: 'موجودی کیف پول کافی نیست.',
  payment_off: 'پرداخت آنلاین هنوز راه‌اندازی نشده؛ از کیف پول یا پذیرش استفاده کنید.',
  gateway: 'اتصال به درگاه بانک برقرار نشد؛ دوباره تلاش کنید.',
  stock: 'موجودی کافی نیست.',
  phone: 'شماره موبایل درست نیست.',
  phone_taken: 'این شماره برای عضو دیگری ثبت شده است.',
  taken: 'این نام کاربری گرفته شده است.',
  weak: 'رمز حداقل ۶ کاراکتر باشد.',
  paid: 'این مورد پرداخت دارد و پاک نمی‌شود.',
  unbalanced: 'جمع بدهکار و بستانکار برابر نیست.',
  image: 'عکس نامعتبر است یا حجمش بیش از ۴ مگابایت است.',
  dup: 'قبلاً ثبت شده است.',
  late: 'کمتر از ۶ ساعت به شروع مانده و لغو ممکن نیست.',
  closed: 'ثبت‌نام این مسابقه دیگر ممکن نیست.',
  full: 'این بازی همین الان پر شد.',
  off: 'دسترسی شما هنوز توسط مدیر فعال نشده است.',
  denied: 'اجازه‌ی این کار را ندارید.',
  done: 'قبلاً دریافت کرده‌اید.',
  notyet: 'هنوز شرط این چالش کامل نشده.',
  sms: 'ارسال پیامک ممکن نشد؛ کمی بعد دوباره تلاش کنید.',
  limit: 'برای این شماره پیامک زیادی فرستاده شده؛ یک ساعت دیگر امتحان کنید.',
}
export const errText = (r) => (r?.error === 'wait' ? `لطفاً ${Number(r.sec || 60).toLocaleString('fa-IR')} ثانیه صبر کنید.`
  : r?.error === 'event_clash' ? `«${r.title || 'مسابقه‌ی دیگری'}» همین ساعت روی همین زمین‌هاست؛ روز، ساعت یا زمین دیگری انتخاب کنید.`
  : ERR[r?.error] || 'انجام نشد؛ دوباره تلاش کنید.')

// شناسه‌ی پیشنهادی برای ساخت چیزهای تازه در پنل مدیر (سرور اگر معتبر باشد همان را می‌پذیرد)
export const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
