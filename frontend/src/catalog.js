// کدگذاری کالا: هر کالا یک کد ۵ رقمی (۲ رقم دسته + ۳ رقم ردیف) و هر تنوع (سایز × رنگ) یک SKU جدا دارد.
// کد حساب تفصیلی موجودی هر کالا = ۱۳۰۱-کد کالا، درآمد فروش هر دسته = ۶۱۰۵-کد دسته
import { CATEGORIES, hash } from './data'

export const COLORS = [
  { id: 'BK', n: 'مشکی', c: '#141413' }, { id: 'WH', n: 'سفید', c: '#F4F2EC' }, { id: 'TQ', n: 'فیروزه‌ای', c: '#19C9C1' },
  { id: 'NV', n: 'سرمه‌ای', c: '#24344F' }, { id: 'GR', n: 'طوسی', c: '#9A988F' }, { id: 'RD', n: 'قرمز', c: '#C2503A' },
  { id: 'OR', n: 'نارنجی', c: '#E07B39' }, { id: 'BL', n: 'آبی', c: '#2F5D8C' }, { id: 'YL', n: 'زرد', c: '#E7C25A' },
  { id: 'PK', n: 'صورتی', c: '#E79BB8' }, { id: 'GN', n: 'سبز', c: '#3DA57E' },
]
export const colorByName = (n) => COLORS.find((c) => c.n === n)
export const CAT_CODE = { racket: '11', shoes: '12', apparel: '13', balls: '14', bags: '15', acc: '16' }
export const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name || id
export const SIZE_SETS = {
  apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  shoes: ['۳۶', '۳۷', '۳۸', '۳۹', '۴۰', '۴۱', '۴۲', '۴۳', '۴۴', '۴۵', '۴۶'],
  racket: [], balls: [], bags: [], acc: ['S/M', 'L/XL'],
}
export const GENDER_NAME = { unisex: 'یونیسکس', men: 'آقایان', women: 'بانوان' }
export const TAGS = ['', 'جدید', 'پرفروش', 'تخفیف']
// حاشیه‌ی سود پیش‌فرض هر دسته برای بهای خرید کالاهای نمونه
const COST_RATIO = { racket: 0.64, shoes: 0.62, apparel: 0.42, balls: 0.66, bags: 0.5, acc: 0.45 }

const latin = (s) => String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
export const skuOf = (code, size, color) => `${code}-${size ? latin(size).replace('/', '') : '00'}-${color ? colorByName(color)?.id || 'XX' : '00'}`
export const accCode = (p) => `1301-${p.code}`

// ترکیب سایز × رنگ؛ موجودی تنوع‌های قبلی حفظ می‌شود
export function makeVariants(p, old = []) {
  const sizes = p.sizes?.length ? p.sizes : [null]
  const colors = p.colors?.length ? p.colors.map((c) => c.n) : [null]
  const out = []
  sizes.forEach((size) => colors.forEach((color) => {
    const sku = skuOf(p.code, size, color)
    const prev = old.find((v) => v.sku === sku)
    out.push({ sku, size, color, stock: prev ? prev.stock : 0 })
  }))
  // تنوعی که حذف شده ولی هنوز موجودی دارد نگه داشته می‌شود
  old.forEach((v) => { if (v.stock > 0 && !out.some((x) => x.sku === v.sku)) out.push(v) })
  return out
}

export function nextCode(products, cat) {
  const pre = CAT_CODE[cat] || '19'
  const n = products.filter((p) => p.code?.startsWith(pre)).map((p) => +p.code.slice(2)).reduce((a, b) => Math.max(a, b), 0)
  return pre + String(n + 1).padStart(3, '0')
}

// کاتالوگ اولیه از کالاهای نمونه: کد، بهای خرید و پخش موجودی بین تنوع‌ها
export function buildCatalog(base) {
  const list = []
  base.forEach((b) => {
    const code = nextCode(list, b.cat)
    const p = { ...b, code, active: true, cost: Math.round(b.price * COST_RATIO[b.cat] / 10000) * 10000 }
    p.variants = makeVariants(p)
    let left = b.stock
    p.variants.forEach((v, i) => {
      const share = i === p.variants.length - 1 ? left : Math.min(left, Math.round((b.stock / p.variants.length) * (0.5 + hash(v.sku))))
      v.stock = Math.max(0, share); left -= v.stock
    })
    delete p.stock
    list.push(p)
  })
  return list
}
