// خروجی داده‌ی اولیه برای سرور از روی همان کدهای اپ:
//   catalog.json — کاتالوگ فروشگاه، منوی کافه و مربی‌ها (برای نصب واقعی؛ موجودی صفر)
//   demo.json    — داده‌ی نمایشی کامل باشگاه (فقط برای تست / حالت نمایشی)
// اجرا: npm run seed:export   (منطقه‌ی زمانی تهران)
process.env.TZ = process.env.TZ || 'Asia/Tehran' // تاریخ‌های نمونه به وقت تهران
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../src')
const out = resolve(here, '../../backend/database/seed')
mkdirSync(out, { recursive: true })

const entry = `
import { seedClub, withCoaches, BASE_PRODUCTS, BASE_MEMBERS, setMembers, setCoaches } from './data'
import { withOps } from './ops'
import { withEvents } from './events'
import { buildCatalog } from './catalog'
import { buildCafe } from './cafe'
export function catalog() {
  const products = buildCatalog(BASE_PRODUCTS).map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, stock: 0 })) }))
  const cafe = buildCafe()
  const coaches = withCoaches({}).coaches.map(({ login, ...c }) => c)
  return { products, cafeItems: cafe.items, cafeIngs: cafe.ings.map((g) => ({ ...g, stock: 0 })), coaches }
}
export function demo() {
  setMembers(BASE_MEMBERS)
  setCoaches(withCoaches({}).coaches)
  const club = withCoaches(withEvents(withOps(seedClub())))
  return { club, members: [...BASE_MEMBERS], today: new Date().toISOString() }
}
`
const tmp = resolve(here, '.export-tmp.mjs')
await build({ stdin: { contents: entry, resolveDir: src, loader: 'js' }, bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' })
const mod = await import(pathToFileURL(tmp).href + '?t=' + Date.now())
writeFileSync(resolve(out, 'catalog.json'), JSON.stringify(mod.catalog(), null, 1))
writeFileSync(resolve(out, 'demo.json'), JSON.stringify(mod.demo()))
const { unlinkSync } = await import('node:fs')
unlinkSync(tmp)
console.log('seed files written to', out)
