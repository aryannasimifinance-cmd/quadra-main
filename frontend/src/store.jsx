import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, fromKey, limitsOf, hoursOf, COURTS, PACKAGES, DEFAULT_PRICING, levelById, productById, stockOf, setCatalog, setCoaches, setCourts, setMembers, todayKey, variantOf } from './data'
import { makeVariants, nextCode } from './catalog'
import { nextIngCode, nextItemCode, receiveInto } from './cafe'
import { jMonthLabel } from './jalali'
import { payroll } from './hr'
import { syncBlocks } from './events'
import * as net from './api'

// داده‌ها روی سرور (لاراول) هستند؛ این‌جا فقط تصویر آن‌ها برای نمایش نگه داشته می‌شود.
// همه‌ی تصمیم‌های حساس (قیمت، خالی بودن زمین، موجودی کیف پول و انبار، ظرفیت) با سرور است.

// شناسه‌ی عضوِ واردشده؛ همه‌ی صفحه‌ها با ME کاربر فعلی را پیدا می‌کنند (live binding)
export let ME = 'me'
const setMe = (id) => { ME = id || 'me' }

const blankPlayer = { user: null, xp: 0, badges: [], wallet: 0, rated: [], membership: null, cart: [], wish: [], notifications: [], quests: {}, events: [], cafeCart: [] }
const emptyClub = () => ({
  pricing: DEFAULT_PRICING, hours: null, limits: null, off: {}, courtEdits: {}, welcome: {}, bookings: [], orders: [], sales: [], expenses: [], reviews: [], coachReqs: [], logins: {},
  events: [], products: [], receipts: [], stockMoves: [], apPays: [], journals: [], opening: null, suppliers: [], staff: [], shifts: {}, attendance: {}, leaves: [], advances: [],
  payrolls: [], hrCfg: {}, cafeItems: [], cafeIngs: [], cafeOrders: [], cafeReceipts: [], cafeMoves: [], coaches: [], members: [], memberEdits: {},
})
const PERSONAL = ['user', 'xp', 'badges', 'wallet', 'rated', 'membership', 'notifications', 'quests', 'events']
// خطاهایی که store خودش پیام می‌دهد (بقیه را صفحه‌ها با متن مخصوص خودشان نشان می‌دهند)
const SYSTEM = ['network', 'server', 'auth', 'slow', 'bad', 'wallet', 'payment_off', 'gateway', 'gone', 'denied']

const cartKey = (id) => 'quadra-cart-' + id
const readCart = (id) => { try { return JSON.parse(localStorage.getItem(cartKey(id))) || {} } catch { return {} } }

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// شنبه‌ی همین هفته به تاریخ محلی (همان کلید چالش‌های سرور)
export const weekKey = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 1) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// امتیاز رنکینگ کاربر = پایه‌ی سطح + نصف XP
export const myPoints = (s) => (s.user ? levelById(s.user.level).base + Math.floor(s.xp / 2) : 0)
export const memberOff = (s) => (s.membership && s.membership.until > Date.now() ? packageById(s.membership.id)?.off || 0 : 0)
const packageById = (id) => PACKAGES.find((p) => p.id === id)

// وضعیت پرداخت هر رکورد — برای پنل مدیر
export function payState(x) {
  if (x.status === 'cancelled') return x.refunded ? 'refunded' : 'void'
  if (x.paid >= x.price) return 'paid'
  return x.paid > 0 ? 'partial' : 'pending'
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => ({ booted: false, offline: false, config: { demo: false, pay: false, smsTest: false, topup: { min: 100000, max: 50000000 } }, session: null, club: emptyClub(), v: {}, ...blankPlayer }))
  const [toasts, setToasts] = useState([])
  const [, setTick] = useState(0)
  const toastId = useRef(0)
  const ref = useRef(state)
  ref.current = state
  const takenRef = useRef({})
  // کاتالوگ، اعضا، مربی‌ها و زمین‌ها از داده‌ی سرور
  setCatalog(state.club.products)
  setMembers(state.club.members)
  setCoaches(state.club.coaches)
  setCourts(state.club.courtEdits)

  const toastRef = useRef(null)
  const toast = useCallback((t) => {
    const id = ++toastId.current
    setToasts((x) => [...x, { id, ...t }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.duration || 3200)
  }, [])
  toastRef.current = toast

  // سبد خرید و علاقه‌مندی‌ها روی همین دستگاه (برای هر عضو جدا)
  const memberId = state.session?.role === 'player' ? state.session.id : null
  useEffect(() => {
    if (!memberId) return
    try { localStorage.setItem(cartKey(memberId), JSON.stringify({ cart: state.cart, wish: state.wish, cafeCart: state.cafeCart })) } catch { /* */ }
  }, [memberId, state.cart, state.wish, state.cafeCart])

  const api = useMemo(() => {
    const commit = (fn) => { const next = fn(ref.current); ref.current = next; setState(next); return next }
    const club = (fn) => commit((s) => ({ ...s, club: fn(s.club) }))

    // ---------- همگام‌سازی با سرور ----------
    function apply(r) {
      if (!r?.session) return
      const role = r.session.role
      const prev = ref.current.session
      setMe(role === 'player' ? r.session.id : null)
      commit((s) => {
        let next = { ...s, session: { role, id: r.session.id, name: r.session.name }, club: { ...s.club, ...(Array.isArray(r.club) ? {} : r.club) }, v: { ...s.v, ...r.v } }
        if (r.me) PERSONAL.forEach((k) => { next[k] = r.me[k] })
        if (role === 'player' && (!prev || prev.id !== r.session.id)) next = { ...next, cart: [], wish: [], cafeCart: [], ...readCart(r.session.id) }
        return next
      })
    }
    async function loadAll() {
      const r = await net.get('/state')
      if (!r.error) apply(r)
      return r
    }
    async function refresh(v) {
      if (!v || !ref.current.session) return
      const cur = ref.current.v
      const parts = Object.keys(v).filter((k) => k !== 'me' && v[k] !== cur[k])
      const me = v.me !== undefined && v.me !== cur.me
      if (!parts.length && !me) return
      const r = await net.get(`/state?only=${parts.length ? parts.join(',') : 'none'}${me ? '&me=1' : ''}`)
      if (!r.error) apply(r)
    }
    function resetLocal() {
      setMe(null)
      takenRef.current = {}
      commit((s) => ({ ...s, ...blankPlayer, session: null, club: emptyClub(), v: {} }))
    }
    net.handleAuthLost(() => { net.setToken(null); if (ref.current.session) { resetLocal(); toastRef.current?.({ icon: '🔒', title: 'از حساب خارج شدید', body: 'دوباره وارد شوید.' }) } })

    // کار بازیکن یا مربی: منتظر جواب سرور؛ پرداخت آنلاین = رفتن به درگاه
    const act = (path, body) => net.enqueue(async () => {
      const r = await net.post(path, body)
      if (r.v) await refresh(r.v)
      if (r.pay?.url) { window.location.assign(r.pay.url); return new Promise(() => {}) }
      if (r.error && SYSTEM.includes(r.error)) { r.shown = true; toastRef.current?.({ icon: '⛔', title: 'انجام نشد', body: net.errText(r), duration: 5000 }) }
      return r
    })
    const player = (name, body = {}) => act('/player/' + name, body)
    const coach = (name, body = {}) => act('/coach/' + name, body)

    // دستور مدیر: همان لحظه در صفحه اعمال می‌شود و پشت‌صحنه به سرور می‌رود؛ اگر سرور نپذیرفت، داده از سرور برمی‌گردد
    const send = (cmd, args, quiet = false) => net.enqueue(async () => {
      const r = await net.post('/admin/' + cmd, { args })
      if (r.error) {
        if (!quiet) toastRef.current?.({ icon: '⛔', title: 'روی سرور ثبت نشد', body: net.errText(r), duration: 6000 })
        if (r.error !== 'auth') await loadAll()
      } else if (r.v) await refresh(r.v)
      return r
    })

    async function startSession(token) {
      net.setToken(token)
      const r = await loadAll()
      if (r.error) { net.setToken(null); return r }
      return { ok: true }
    }

    return {
      // ---------- راه‌اندازی ----------
      async boot() {
        const cfg = await net.get('/config')
        if (!cfg.error) commit((s) => ({ ...s, config: { ...s.config, ...cfg } }))
        if (net.getToken()) {
          const r = await loadAll()
          if (r.error === 'network' || r.error === 'server') { commit((s) => ({ ...s, offline: true })); return false }
        }
        commit((s) => ({ ...s, booted: true, offline: false }))
        return true
      },
      async sync() {
        if (!ref.current.session || net.busy()) return
        const r = await net.get('/sync')
        if (r.v && !net.busy()) await refresh(r.v)
      },
      reload: loadAll,

      // ---------- ورود ----------
      requestOtp(phone) { return net.post('/auth/otp', { phone }) },
      async verifyOtp(phone, code) {
        const r = await net.post('/auth/verify', { phone, code })
        if (r.token) return { ...(await startSession(r.token)), member: true }
        return r
      },
      async register(ticket, form) {
        const r = await net.post('/auth/register', { ticket, ...form })
        return r.token ? startSession(r.token) : r
      },
      async loginWithPass(u, pass) {
        const r = await net.post('/auth/password', { username: String(u).trim().toLowerCase(), password: pass })
        return r.token ? startSession(r.token) : r
      },
      async staffLogin(role, u, pass) {
        const r = await net.post('/auth/staff', { role, username: String(u).trim().toLowerCase(), password: pass })
        return r.token ? { ...(await startSession(r.token)), name: r.name } : r
      },
      // نام کاربری آزاد است؟ (جواب سرور در حافظه می‌ماند و صفحه دوباره رسم می‌شود)
      loginTaken(u) {
        const k = String(u || '').trim().toLowerCase()
        const c = takenRef.current
        if (k in c) return c[k]
        c[k] = false
        net.get('/auth/username?u=' + encodeURIComponent(k)).then((r) => { if (!r.error) { c[k] = !!r.taken; setTick((t) => t + 1) } })
        return false
      },
      logout() {
        net.post('/auth/logout').catch(() => {})
        net.setToken(null)
        resetLocal()
      },
      async resetDemo() {
        const r = await net.post('/admin/adminDemoReset', { args: [] })
        if (r.error) { toastRef.current?.({ icon: '⛔', title: 'بازنشانی انجام نشد', body: net.errText(r) }); return }
        net.setToken(null); window.location.reload()
      },

      // ---------- بازیکن ----------
      async setLogin(u, pass) {
        const r = await player('setLogin', { user: u, pass })
        if (!r.error) takenRef.current = {}
        return r
      },
      updateProfile(p) { commit((s) => ({ ...s, user: { ...s.user, ...p } })); return player('updateProfile', p) },
      updateUser(p) { return api.updateProfile(p) },
      book(b, method) { return player('book', { ...b, method }) },
      joinGame(id, method) { return player('joinGame', { id, method }) },
      declineInvite(id) {
        club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id ? { ...b, invited: (b.invited || []).filter((p) => p !== ME) } : b)) }))
        return player('declineInvite', { id })
      },
      addReview(target, stars, text) { return player('addReview', { target, stars, text }) },
      cancelMine(id) { return player('cancelMine', { id }) },
      registerEvent(ev, method, partner) { return player('registerEvent', { id: ev.id, method, partner }) },
      bookSeries(list, sale, method) { return player('bookSeries', { list, sale, method }) },
      buyPackage(p, method) { return player('buyPackage', { id: p.id, method }) },
      topUp(n) { return player('topUp', { amount: n }) },

      // سبد خرید (روی دستگاه)
      addToCart(item) {
        commit((s) => {
          const k = s.cart.findIndex((x) => x.pid === item.pid && x.size === item.size && x.color === item.color)
          const p = productById(item.pid), max = variantOf(p, item.size, item.color)?.stock ?? stockOf(p)
          const cart = k < 0 ? [...s.cart, { ...item, qty: Math.min(item.qty, max) }] : s.cart.map((x, i) => (i === k ? { ...x, qty: Math.min(max, x.qty + item.qty) } : x))
          return { ...s, cart }
        })
      },
      setQty(i, qty) { commit((s) => ({ ...s, cart: qty <= 0 ? s.cart.filter((_, k) => k !== i) : s.cart.map((x, k) => (k === i ? { ...x, qty } : x)) })) },
      toggleWish(pid) { commit((s) => ({ ...s, wish: s.wish.includes(pid) ? s.wish.filter((x) => x !== pid) : [...s.wish, pid] })) },
      async checkout(method) {
        const r = await player('checkout', { items: ref.current.cart.map(({ pid, size, color, qty }) => ({ pid, size: size || null, color: color || null, qty })), method })
        if (!r.error) commit((s) => ({ ...s, cart: [] }))
        return r
      },
      // کافه — سبد جدا از فروشگاه؛ تحویل در کافه یا سر زمین
      cafeAdd(item) {
        commit((s) => {
          const cart = s.cafeCart || []
          const k = cart.findIndex((x) => x.iid === item.iid && !!x.big === !!item.big && (x.note || '') === (item.note || ''))
          return { ...s, cafeCart: k < 0 ? [...cart, item] : cart.map((x, i) => (i === k ? { ...x, qty: x.qty + item.qty } : x)) }
        })
      },
      cafeQty(i, qty) { commit((s) => ({ ...s, cafeCart: qty <= 0 ? s.cafeCart.filter((_, k) => k !== i) : s.cafeCart.map((x, k) => (k === i ? { ...x, qty } : x)) })) },
      async cafeCheckout(method, to) {
        const r = await player('cafeCheckout', { lines: ref.current.cafeCart.map(({ iid, qty, big, note }) => ({ iid, qty, big: !!big, note: note || '' })), method, to: to || null })
        if (!r.error) commit((s) => ({ ...s, cafeCart: [] }))
        return r
      },
      clearCart(kind) { commit((s) => ({ ...s, [kind]: [] })) },
      claimQuest(id) { return player('claimQuest', { id }) },
      notify(n) { if (ref.current.session?.role === 'player') player('notify', n) },
      readAll() {
        if (!ref.current.notifications.some((n) => !n.read)) return
        commit((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
        player('readAll')
      },
      paymentStatus(id) { return net.get('/pay/' + encodeURIComponent(id)) },

      // ---------- پنل مربی ----------
      coachReq(r) { return coach('coachReq', r) },
      async coachSetPlayers(coachId, id, players) {
        club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id && b.coach === coachId ? { ...b, players: players.slice(0, 2), by: players[0] || null } : b)) }))
        const r = await coach('coachSetPlayers', { id, players: players.slice(0, 2) })
        if (r.error) await loadAll()
        return r
      },
      coachReqCancel(id) {
        club((c) => ({ ...c, coachReqs: (c.coachReqs || []).map((x) => (x.id === id && x.status === 'pending' ? { ...x, status: 'cancelled' } : x)) }))
        return coach('coachReqCancel', { id })
      },

      // ---------- مدیر ----------
      adminMember(m) {
        const id = net.uid('m')
        club((c) => ({ ...c, members: [...(c.members || []), { id, games: 0, wins: 0, points: levelById(m.level).base, joined: 0, at: Date.now(), source: 'desk', member: null, ...m }] }))
        send('adminMember', [{ ...m, id }])
        return id
      },
      adminMemberEdit(id, patch) {
        club((c) => ({ ...c, members: (c.members || []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
        send('adminMemberEdit', [id, patch])
      },
      adminWalletAdjust(id, amount, note) { return send('adminWalletAdjust', [id, amount, note || '']) },
      // مربی جدید یا ویرایش؛ بخش «نمایش در اپ» و «فقط مدیر» در یک رکورد
      adminCoachSave(co) {
        let saved
        club((c) => {
          const old = c.coaches.find((x) => x.id === co.id)
          saved = old ? { ...old, ...co } : { active: true, packs: { one: true, five: true, ten: true, group: true }, prices: {}, record: [], ...co, id: net.uid('k') }
          return { ...c, coaches: old ? c.coaches.map((x) => (x.id === old.id ? saved : x)) : [...c.coaches, saved] }
        })
        send('adminCoachSave', [{ ...co, id: saved.id }])
        return saved
      },
      adminCoachReq(id, ok) {
        let out = { ok: true }
        club((c) => {
          const r = (c.coachReqs || []).find((x) => x.id === id)
          if (!r || r.status !== 'pending') { out = { error: 'gone' }; return c }
          const reqs = (status) => c.coachReqs.map((x) => (x.id === id ? { ...x, status, done: Date.now() } : x))
          if (!ok) return { ...c, coachReqs: reqs('rejected') }
          if (!isFree(c, r.date, r.court, r.start, r.dur)) { out = { error: 'busy' }; return c }
          const co = c.coaches.find((x) => x.id === r.coach), now = Date.now()
          const hours = Array.from({ length: r.dur }, (_, i) => ({ id: `cb${now}-${i}`, status: 'ok', source: 'coach', at: now, type: 'coach', coach: r.coach, court: r.court, date: r.date, start: r.start + i, dur: 1, players: r.student ? [r.student] : [], by: r.student || null, price: co?.price || 0, paid: 0, note: r.note || '', block: r.id }))
          return { ...c, coachReqs: reqs('ok'), bookings: [...c.bookings, ...hours] }
        })
        if (!out.error) send('adminCoachReq', [id, !!ok])
        return out
      },
      adminLimits(l) { club((c) => ({ ...c, limits: { ...limitsOf(c), ...l } })); send('adminLimits', [l]) },
      adminCoachLogin(id, login) {
        club((c) => ({ ...c, coaches: c.coaches.map((x) => (x.id === id ? { ...x, login: { ...x.login, ...login, pass: '', set: !!login.pass || !!x.login?.set } } : x)) }))
        send('adminCoachLogin', [id, login])
      },
      adminAddBooking(b) {
        const id = net.uid('d')
        club((c) => ({ ...c, bookings: [...c.bookings, { id, status: 'ok', source: 'desk', at: Date.now(), ...b }] }))
        send('adminAddBooking', [{ ...b, id }])
      },
      adminReview(id, patch) { club((c) => ({ ...c, reviews: (c.reviews || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) })); send('adminReview', [id, patch]) },
      adminPayin(p) {
        const id = net.uid('PI')
        club((c) => ({ ...c, payins: [{ id, at: Date.now(), date: todayKey(), ...p }, ...(c.payins || [])] }))
        send('adminPayin', [{ ...p, id }])
      },
      adminPayinDel(id) { club((c) => ({ ...c, payins: (c.payins || []).filter((p) => p.id !== id) })); send('adminPayinDel', [id]) },
      adminSettle(id, method) {
        club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id && b.paid < b.price
          ? { ...b, paid: b.price, method: b.method || method, settled: [...(b.settled || []), { amt: b.price - b.paid, at: Date.now(), method }] } : b)) }))
        send('adminSettle', [id, method])
      },
      adminCancel(id, refund) { club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled', refunded: refund && b.paid > 0 } : b)) })); send('adminCancel', [id, !!refund]) },
      adminMove(id, patch) { club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })); send('adminMove', [id, patch]) },
      adminOrder(id, status) { club((c) => ({ ...c, orders: c.orders.map((o) => (o.id === id ? { ...o, status } : o)) })); send('adminOrder', [id, status]) },
      // ---------- فروشگاه و انبار ----------
      adminProduct(p) {
        let saved
        club((c) => {
          const old = c.products.find((x) => x.id === p.id)
          const code = old?.code || nextCode(c.products, p.cat)
          saved = { ...old, ...p, id: old?.id || net.uid('p'), code, active: p.active ?? true }
          saved.variants = makeVariants(saved, old?.variants)
          return { ...c, products: old ? c.products.map((x) => (x.id === old.id ? saved : x)) : [...c.products, saved] }
        })
        const { variants, code, ...rest } = saved // eslint-disable-line no-unused-vars
        send('adminProduct', [{ ...p, ...rest, id: saved.id }])
        return saved
      },
      // اصلاح موجودی یک SKU (کسری یا اضافه)
      adminAdjust(pid, sku, delta, note = '') {
        club((c) => {
          const p = c.products.find((x) => x.id === pid), v = p?.variants.find((x) => x.sku === sku)
          if (!v) return c
          const qty = Math.max(-v.stock, delta)
          if (!qty) return c
          return {
            ...c, products: c.products.map((x) => (x.id !== pid ? x : { ...x, variants: x.variants.map((y) => (y.sku === sku ? { ...y, stock: y.stock + qty } : y)) })),
            stockMoves: [{ id: net.uid('M'), date: todayKey(), kind: 'adjust', pid, code: p.code, sku, qty, cost: p.cost, note }, ...(c.stockMoves || [])],
          }
        })
        send('adminAdjust', [pid, sku, delta, note])
      },
      // ورود کالا با فاکتور خرید؛ بهای هر کالا به روش میانگین موزون
      adminReceive(r) {
        club((c) => {
          const products = c.products.map((p) => {
            const lines = r.items.filter((x) => x.pid === p.id)
            if (!lines.length) return p
            const have = p.variants.reduce((s, v) => s + v.stock, 0), add = lines.reduce((s, x) => s + x.qty, 0)
            const cost = Math.round((have * p.cost + lines.reduce((s, x) => s + x.qty * x.cost, 0)) / (have + add))
            return { ...p, cost, variants: p.variants.map((v) => ({ ...v, stock: v.stock + lines.filter((x) => x.sku === v.sku).reduce((s, x) => s + x.qty, 0) })) }
          })
          const rec = { id: net.uid('R-'), at: Date.now(), ...r, items: r.items.map((x) => ({ ...x, code: c.products.find((p) => p.id === x.pid)?.code })), total: r.items.reduce((s, x) => s + x.qty * x.cost, 0) }
          const suppliers = c.suppliers.includes(r.supplier) ? c.suppliers : [...c.suppliers, r.supplier]
          return { ...c, products, receipts: [rec, ...c.receipts], suppliers }
        })
        send('adminReceive', [r])
      },
      // فروش حضوری در پذیرش — منتظر سرور، چون شماره‌ی فاکتور را سرور می‌دهد
      async adminPos(items, method, by) {
        const r = await send('adminPos', [items, method, by || null], true)
        if (r.error) return r.error === 'stock' ? null : { failed: true, error: r.error }
        return ref.current.club.orders.find((o) => o.id === r.id) || { id: r.id, total: items.reduce((s, x) => s + x.qty * (x.price || 0), 0) }
      },
      adminApPay(p) { club((c) => ({ ...c, apPays: [{ id: net.uid('AP'), date: todayKey(), ...p }, ...c.apPays] })); send('adminApPay', [p]) },
      // ---------- کافه ----------
      adminCafeItem(it) {
        let saved
        club((c) => {
          const old = c.cafeItems.find((x) => x.id === it.id)
          saved = { ...old, ...it, id: old?.id || net.uid('ci'), code: old?.code || nextItemCode(c.cafeItems, it.cat), active: it.active ?? true }
          return { ...c, cafeItems: old ? c.cafeItems.map((x) => (x.id === old.id ? saved : x)) : [...c.cafeItems, saved] }
        })
        send('adminCafeItem', [{ ...it, id: saved.id }])
        return saved
      },
      adminCafeIng(g) {
        let saved
        club((c) => {
          const old = c.cafeIngs.find((x) => x.id === g.id)
          saved = { stock: 0, ...old, ...g, id: old?.id || net.uid('g'), code: old?.code || nextIngCode(c.cafeIngs, g.cat), active: g.active ?? true }
          return { ...c, cafeIngs: old ? c.cafeIngs.map((x) => (x.id === old.id ? saved : x)) : [...c.cafeIngs, saved] }
        })
        send('adminCafeIng', [{ ...g, id: saved.id }])
        return saved
      },
      // خرید مواد اولیه؛ مقدار و بها به واحد پایه (گرم / میلی‌لیتر / عدد)
      adminCafeReceive(r) {
        club((c) => {
          const items = r.items.map((x) => { const g = c.cafeIngs.find((y) => y.id === x.ing); return { ...x, code: g?.code, name: g?.name } })
          const rec = { id: net.uid('CR-'), at: Date.now(), ...r, items, total: items.reduce((s, x) => s + Math.round(x.qty * x.cost), 0) }
          const suppliers = c.suppliers.includes(r.supplier) ? c.suppliers : [...c.suppliers, r.supplier]
          return { ...c, cafeIngs: receiveInto(c.cafeIngs, items), cafeReceipts: [rec, ...c.cafeReceipts], suppliers }
        })
        send('adminCafeReceive', [r])
      },
      // ضایعات (منفی) یا اضافه‌ی شمارش (مثبت) به واحد پایه
      adminCafeAdjust(id, delta, note = '') {
        club((c) => {
          const g = c.cafeIngs.find((x) => x.id === id)
          if (!g) return c
          const qty = Math.max(-g.stock, delta), amount = Math.round(qty * g.cost)
          if (!qty) return c
          return {
            ...c, cafeIngs: c.cafeIngs.map((x) => (x.id === id ? { ...x, stock: Math.max(0, x.stock + qty) } : x)),
            cafeMoves: amount ? [{ id: net.uid('CM'), date: todayKey(), ing: id, code: g.code, name: g.name, qty, amount, note }, ...c.cafeMoves] : c.cafeMoves,
          }
        })
        send('adminCafeAdjust', [id, delta, note])
      },
      adminCafeOrder(id, status) { club((c) => ({ ...c, cafeOrders: c.cafeOrders.map((o) => (o.id === id ? { ...o, status } : o)) })); send('adminCafeOrder', [id, status]) },
      // سفارش حضوری؛ now = تحویل همان لحظه، وگرنه به صف آماده‌سازی می‌رود
      async adminCafePos(lines, method, by, to, now = false) {
        const r = await send('adminCafePos', [lines.map(({ iid, qty, big, note }) => ({ iid, qty, big: !!big, note: note || '' })), method, by || null, to || null, !!now], true)
        if (r.error) return r.error === 'stock' ? null : { failed: true, error: r.error }
        return ref.current.club.cafeOrders.find((o) => o.id === r.id) || { id: r.id, total: 0, status: now ? 'delivered' : 'prep', to: to || null }
      },
      // ---------- آدینه‌ها و تورنمنت‌ها ----------
      adminEventSave(ev) {
        let saved
        club((c) => {
          const old = c.events.find((e) => e.id === ev.id)
          saved = old ? { ...old, ...ev } : { regs: [], teams: [], groups: [], matches: [], courts: [1, 2, 3, 4], note: '', ...ev, id: net.uid('ev') }
          // زمین‌های انتخابی در همان روز و ساعت برای مسابقه بسته می‌شوند
          return { ...c, events: old ? c.events.map((e) => (e.id === old.id ? saved : e)) : [saved, ...c.events], bookings: syncBlocks(c.bookings, saved) }
        })
        const { regs, ...rest } = saved // eslint-disable-line no-unused-vars
        send('adminEventSave', [c0(ev.id) ? { ...ev, id: saved.id } : { ...rest, id: saved.id }])
        return saved
      },
      adminEventDel(id) { club((c) => ({ ...c, events: c.events.filter((e) => e.id !== id), bookings: c.bookings.filter((b) => b.event !== id) })); send('adminEventDel', [id]) },
      // تغییر تیم‌ها، گروه‌ها و نتیجه‌ها با توابع events.js
      adminEventSet(id, fn) {
        let next = null
        club((c) => ({ ...c, events: c.events.map((e) => (e.id === id ? (next = fn(e)) : e)) }))
        if (next) send('adminEventSet', [id, { teams: next.teams, groups: next.groups, matches: next.matches, setup: next.setup ?? null, regs: next.regs.map((r) => ({ id: r.id, pair: r.pair || null, waiting: !!r.waiting })) }])
      },
      // ثبت‌نام حضوری؛ با یار، دو نفر یک تیم می‌شوند و نفر اول ورودی هر دو را می‌دهد (each = ورودی هر نفر)
      adminEventReg(id, p, method, each, partner) {
        club((c) => {
          const ev = c.events.find((e) => e.id === id), now = Date.now()
          const ps = [p, partner].filter(Boolean), total = each * ps.length
          const sale = total > 0 ? { id: 'S-' + now, kind: 'event', item: id, name: partner ? `${ev.title}، تیم ${p.name.split(' ')[0]} و ${partner.name.split(' ')[0]}` : ev.title, by: p.by, price: total, method, at: now } : null
          const regs = ps.map((x, i) => ({ id: 'r' + now + (i ? 'b' : ''), at: now, method: total > 0 ? method : 'free', paid: each, source: 'desk', sale: sale?.id || null, ...(partner ? { pair: 'p' + now, payer: p.by } : {}), ...x }))
          return { ...c, events: c.events.map((e) => (e.id === id ? { ...e, regs: [...e.regs, ...regs] } : e)), sales: sale ? [sale, ...c.sales] : c.sales }
        })
        send('adminEventReg', [id, p, method, each, partner || null])
      },
      // حذف شرکت‌کننده = برگرداندن ورودی؛ اگر با یار ثبت‌نام کرده، هر دو با هم حذف می‌شوند
      adminEventUnreg(id, rid) {
        club((c) => {
          const ev = c.events.find((e) => e.id === id), reg = ev?.regs.find((r) => r.id === rid)
          if (!ev) return c
          const gone = (r) => r.id === rid || (reg?.pair && r.pair === reg.pair)
          const next = { ...ev, regs: ev.regs.filter((r) => !gone(r)), teams: [], groups: [], matches: [] }
          return { ...c, events: c.events.map((e) => (e.id === id ? next : e)), sales: c.sales.filter((s) => s.id !== reg?.sale) }
        })
        send('adminEventUnreg', [id, rid])
      },
      adminHours(h) { club((c) => ({ ...c, hours: h })); send('adminHours', [h]) },
      adminPricing(p) { club((c) => ({ ...c, pricing: { ...c.pricing, ...p } })); send('adminPricing', [p]) },
      adminWelcome(w) { club((c) => ({ ...c, welcome: w })); send('adminWelcome', [w]) },
      adminCourtEdit(id, edit) { club((c) => ({ ...c, courtEdits: { ...c.courtEdits, [id]: edit } })); send('adminCourtEdit', [id, edit || null]) },
      adminCourt(id, off) { club((c) => ({ ...c, off: { ...c.off, [id]: off } })); send('adminCourt', [id, !!off]) },
      // ---------- حسابداری ----------
      adminExpense(e) { const id = net.uid('e'); club((c) => ({ ...c, expenses: [{ id, at: Date.now(), ...e }, ...c.expenses] })); send('adminExpense', [{ ...e, id }]) },
      adminExpenseDel(id) { club((c) => ({ ...c, expenses: c.expenses.filter((e) => e.id !== id) })); send('adminExpenseDel', [id]) },
      adminJournal(j) { const id = net.uid('J'); club((c) => ({ ...c, journals: [{ id, at: Date.now(), ...j }, ...c.journals] })); send('adminJournal', [{ ...j, id }]) },
      adminJournalDel(id) { club((c) => ({ ...c, journals: c.journals.filter((j) => j.id !== id) })); send('adminJournalDel', [id]) },

      // ---------- منابع انسانی ----------
      adminStaff(p) {
        let id = p.id
        club((c) => {
          if (id && c.staff.some((s) => s.id === id)) return { ...c, staff: c.staff.map((s) => (s.id === id ? { ...s, ...p } : s)) }
          id = net.uid('h')
          return { ...c, staff: [...c.staff, { status: 'active', docs: {}, ...p, id }], shifts: { ...c.shifts, [id]: ['off', 'off', 'off', 'off', 'off', 'off', 'off'] } }
        })
        send('adminStaff', [{ ...p, id }])
        return id
      },
      adminShift(staffId, day, code) { club((c) => ({ ...c, shifts: { ...c.shifts, [staffId]: (c.shifts[staffId] || Array(7).fill('off')).map((x, i) => (i === day ? code : x)) } })); send('adminShift', [staffId, day, code]) },
      adminAttend(date, staffId, patch) {
        club((c) => {
          const day = { ...(c.attendance[date] || {}) }
          const rec = { ...(day[staffId] || {}), ...patch }
          if (rec.in == null) delete day[staffId]; else day[staffId] = rec
          return { ...c, attendance: { ...c.attendance, [date]: day } }
        })
        send('adminAttend', [date, staffId, patch])
      },
      adminLeave(l) { const id = net.uid('L'); club((c) => ({ ...c, leaves: [{ id, at: Date.now(), status: 'pending', ...l }, ...c.leaves] })); send('adminLeave', [{ ...l, id }]) },
      adminLeaveStatus(id, status) { club((c) => ({ ...c, leaves: c.leaves.map((l) => (l.id === id ? { ...l, status } : l)) })); send('adminLeaveStatus', [id, status]) },
      adminAdvance(a) { const id = net.uid('A'); club((c) => ({ ...c, advances: [{ id, date: todayKey(), ...a }, ...c.advances] })); send('adminAdvance', [{ ...a, id }]) },
      adminHrCfg(p) { club((c) => ({ ...c, hrCfg: { ...c.hrCfg, ...p } })); send('adminHrCfg', [p]) },
      // ثبت سند حقوق یک ماه با تصویر محاسبه در همان لحظه
      adminPayroll(mk) {
        let rows = null
        club((c) => {
          if (c.payrolls.some((p) => p.month === mk)) return c
          rows = payroll(c, mk)
          return { ...c, payrolls: [{ id: 'PR-' + mk, month: mk, label: jMonthLabel(mk), date: todayKey(), rows, at: Date.now() }, ...c.payrolls] }
        })
        if (rows) send('adminPayroll', [mk, rows, jMonthLabel(mk)])
      },
      adminPayrollPay(mk, field) { club((c) => ({ ...c, payrolls: c.payrolls.map((p) => (p.month === mk ? { ...p, [field]: todayKey() } : p)) })); send('adminPayrollPay', [mk, field]) },
      adminPayrollUndo(mk) { club((c) => ({ ...c, payrolls: c.payrolls.filter((p) => p.month !== mk || p.paidAt) })); send('adminPayrollUndo', [mk]) },
      toast,
    }
    // رویداد تازه یا ویرایش؟ (برای فرستادن فقط تغییرها در ویرایش)
    function c0(id) { return !!id && ref.current.club.events.some((e) => e.id === id) }
  }, [toast])

  // راه‌اندازی و همگام‌سازی دوره‌ای (هر ۷ ثانیه وقتی صفحه دیده می‌شود)
  useEffect(() => {
    let alive = true, timer = null
    const start = async () => {
      const ok = await api.boot()
      if (!ok && alive) timer = setTimeout(start, 4000)
    }
    start()
    const tick = setInterval(() => { if (document.visibilityState === 'visible') api.sync() }, 7000)
    const vis = () => { if (document.visibilityState === 'visible') api.sync() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearTimeout(timer); clearInterval(tick); document.removeEventListener('visibilitychange', vis) }
  }, [api])

  return <Ctx.Provider value={{ ...state, ...api, toasts }}>{children}</Ctx.Provider>
}

// ---------- انتخاب‌گرهای مشترک ----------
// سقف رزرو مربی: روزانه و هفتگی (شنبه تا جمعه) برای هر مربی، و پشت‌سرهم برای همه‌ی مربی‌ها
// درخواست‌های منتظر و تأییدشده از سقف کم می‌شوند
export const coachCaps = (co) => ({ day: co?.login?.day ?? 5, week: co?.login?.week ?? co?.login?.hours ?? 15 })
export function weekOf(date) {
  const from = addDays(date, -((fromKey(date).getDay() + 1) % 7))
  return [from, addDays(from, 6)]
}
const liveReqs = (club, co) => (club.coachReqs || []).filter((r) => r.coach === co.id && (r.status === 'pending' || r.status === 'ok'))
export function coachLimits(club, co, date) {
  if (!co) return { day: 0, week: 0, run: 0, caps: coachCaps(co) }
  const caps = coachCaps(co), [a, z] = weekOf(date), reqs = liveReqs(club, co)
  const dayUsed = reqs.filter((r) => r.date === date).reduce((s, r) => s + r.dur, 0)
  const weekUsed = reqs.filter((r) => fromKey(r.date) >= fromKey(a) && fromKey(r.date) <= fromKey(z)).reduce((s, r) => s + r.dur, 0)
  return { day: Math.max(0, caps.day - dayUsed), week: Math.max(0, caps.week - weekUsed), run: limitsOf(club).coachRun, caps }
}
// طول بلوک پشت‌سرهمِ مربی در آن روز اگر این بازه اضافه شود (کلاس‌ها + درخواست‌های منتظر)
export function coachRun(club, co, date, start, dur) {
  const spans = [
    ...club.bookings.filter((b) => b.coach === co.id && b.date === date && b.status !== 'cancelled').map((b) => [b.start, b.start + b.dur]),
    ...(club.coachReqs || []).filter((r) => r.coach === co.id && r.date === date && r.status === 'pending').map((r) => [r.start, r.start + r.dur]),
  ]
  let a = start, z = start + dur, grew = true
  while (grew) { grew = false; spans.forEach(([s, e]) => { if (s <= z && e >= a && (s < a || e > z)) { a = Math.min(a, s); z = Math.max(z, e); grew = true } }) }
  return z - a
}
// ساعت‌های تأییدشده‌ی مربی که هنوز شاگرد ندارند (کلاس آموزشی نباید بی‌شاگرد بماند)
export const openHours = (club, coachId) => club.bookings.filter((b) => b.coach === coachId && b.block && b.status !== 'cancelled' && !b.players.length && fromKey(b.date).getTime() + (b.start + b.dur) * 36e5 > Date.now())
// طول بلوک پشت‌سرهمِ رزروهای خود بازیکن در آن روز (روی هر زمینی) اگر این بازه اضافه شود
export function playerRun(club, date, start, dur) {
  const spans = club.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && b.type !== 'coach' && (b.by === ME || b.players?.includes(ME))).map((b) => [b.start, b.start + b.dur])
  let a = start, z = start + dur, grew = true
  while (grew) { grew = false; spans.forEach(([s, e]) => { if (s <= z && e >= a && (s < a || e > z)) { a = Math.min(a, s); z = Math.max(z, e); grew = true } }) }
  return z - a
}
export function busyOn(club, date, court) {
  return club.bookings.filter((b) => b.date === date && b.court === court && b.status !== 'cancelled')
}
export function isFree(club, date, court, start, dur) {
  if (club.off[court]) return false
  const { open, close } = hoursOf(club)
  if (start < open || start + dur > close) return false
  return !busyOn(club, date, court).some((b) => start < b.start + b.dur && b.start < start + dur)
}
export function freeStarts(club, date, court, dur, from = 0, to = 24) {
  const { open, close } = hoursOf(club)
  const now = new Date(), today = date === todayKey()
  const out = []
  for (let h = Math.max(open, from); h + dur <= close && h < to; h += 1) {
    if (today && h <= now.getHours() + now.getMinutes() / 60) continue
    if (isFree(club, date, court, h, dur)) out.push(h)
  }
  return out
}
export const courtsList = COURTS
