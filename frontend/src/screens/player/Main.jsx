import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { MEMBERS, courtById, dayLabel, fa, hourLabel } from '../../data'
import { openGames } from '../../select'
import { chime, haptic, systemNotify } from '../../fx'
import { ME, useStore } from '../../store'
import { Icon } from '../../components/ui'
import Home from './Home'
import Games from './Games'
import Shop from './Shop'
import Cafe from './Cafe'
import Me from './Me'
import { Coaches, Events, Journey, Notifications, Packages, Ranking } from './Pages'
import Wizard from '../wizard/Wizard'

const TABS = [
  { id: 'home', name: 'خانه', icon: 'home' },
  { id: 'games', name: 'بازی‌ها', icon: 'cal' },
  { id: 'new', name: '', icon: 'plus' },
  { id: 'shop', name: 'فروشگاه', icon: 'bag' },
  { id: 'me', name: 'من', icon: 'user' },
]
const PAGES = { coaches: Coaches, packages: Packages, ranking: Ranking, events: Events, notifs: Notifications, journey: Journey }

export default function Main() {
  const { cart, cafeCart = [] } = useStore()
  const [tab, setTab] = useState('home')
  const [page, setPage] = useState(null)
  // اپ مستقیم از صفحه‌ی + باز می‌شود؛ در مرحله‌ی اول ویزارد نوار پایین دیده می‌شود تا هر بخش دیگری را انتخاب کنند
  const [wizard, setWizard] = useState({})
  const [wzStep, setWzStep] = useState('intent')
  const [wzKey, setWzKey] = useState(0)
  const scrollRef = useRef(null)
  const cartN = cart.reduce((s, x) => s + x.qty, 0) + cafeCart.reduce((s, x) => s + x.qty, 0)
  useMatchmaking(setTab)
  useLiveNotifications(setTab)

  const nav = {
    tab: (t) => { setPage(null); setWizard(null); haptic(6); setTab(t); scrollRef.current?.scrollTo({ top: 0 }) },
    open: (name, props = {}) => { haptic(6); setPage({ name, props }); scrollRef.current?.scrollTo({ top: 0 }) },
    start: (preset = {}) => { setPage(null); setWizard(preset); setWzKey((k) => k + 1); scrollRef.current?.scrollTo({ top: 0 }) },
  }
  const Page = page && PAGES[page.name]
  const on = (id) => !wizard && (tab === id || (id === 'shop' && tab === 'cafe'))

  return (
    <motion.div className="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={`app-scroll ${wizard && wzStep === 'intent' ? 'locked' : ''}`} ref={scrollRef}>
        <AnimatePresence mode="wait">
          {wizard ? (
            <motion.div key={'wz' + wzKey} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Wizard preset={wizard} onStep={setWzStep} onClose={() => setWizard(null)} onDone={(t) => { setWizard(null); setTab(t) }} />
            </motion.div>
          ) : Page ? (
            <motion.div key={'p' + page.name} initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Page {...page.props} nav={nav} onBack={() => setPage(null)} />
            </motion.div>
          ) : (
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {tab === 'home' && <Home nav={nav} />}
              {tab === 'games' && <Games nav={nav} />}
              {tab === 'shop' && <Shop nav={nav} />}
              {tab === 'cafe' && <Cafe nav={nav} />}
              {tab === 'me' && <Me nav={nav} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {(
          <motion.nav className="nav" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            {TABS.map((t) => t.id === 'new' ? (
              <motion.button key={t.id} className={`fab ${wizard ? 'on' : ''}`} whileTap={{ scale: 0.85, rotate: 90 }} whileHover={{ scale: 1.06 }} onClick={() => nav.start({})} aria-label="بازی جدید">
                <Icon name="plus" size={28} stroke={2.6} />
              </motion.button>
            ) : (
              <button key={t.id} className={`nav-i ${on(t.id) ? 'on' : ''}`} onClick={() => nav.tab(t.id === 'shop' && tab === 'cafe' ? 'cafe' : t.id)}>
                {on(t.id) && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span className="nav-ic">
                  <Icon name={t.id === 'shop' && tab === 'cafe' ? 'cup' : t.icon} size={22} stroke={on(t.id) ? 2.5 : 1.8} />
                  {t.id === 'shop' && cartN > 0 && <motion.i key={cartN} className="nav-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>{fa(cartN)}</motion.i>}
                </span>
                <small>{t.id === 'shop' && tab === 'cafe' ? 'کافه' : t.name}</small>
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// اعلان‌های تازه‌ی سرور (پیوستن بازیکن به بازی شما، آماده شدن سفارش کافه، دعوت، لغو…) همان لحظه نشان داده می‌شوند
function useLiveNotifications(setTab) {
  const { notifications, toast } = useStore()
  const seen = useRef(null)
  useEffect(() => {
    const ids = new Set(notifications.map((n) => n.id))
    if (seen.current) {
      notifications.filter((n) => !n.read && !seen.current.has(n.id) && Date.now() - n.at < 10 * 60e3).slice(0, 2).reverse().forEach((n) => {
        chime('alarm'); haptic([40, 30, 40]); systemNotify('کوادرا', `${n.title}${n.body ? '، ' + n.body : ''}`)
        const go = n.icon === '☕' ? 'cafe' : ['🙋', '✉️', '↩️', '👋'].includes(n.icon) ? 'games' : null
        toast({ icon: n.icon, title: n.title, body: n.body, duration: 6500, ...(go ? { action: { label: 'ببینید', run: () => setTab(go) } } : {}) })
      })
    }
    seen.current = ids
  }, [notifications]) // eslint-disable-line react-hooks/exhaustive-deps
}

// یک بار در هر نشست: اعلان بازی باز هم‌سطح
function useMatchmaking(setTab) {
  const store = useStore()
  const live = useRef(store); live.current = store

  // یک بار در هر نشست: اعلان بازی باز هم‌سطح
  useEffect(() => {
    const t = setTimeout(() => {
      const { user, club, toast } = live.current
      const g = openGames(club, user.level).find((b) => !b.mine && b.gap <= 1)
      if (!g) return
      chime('alarm'); haptic([40, 30, 40])
      toast({ icon: '📣', title: 'بازی هم‌سطح شما پیدا شد', body: `${dayLabel(g.date)} ${hourLabel(g.start)}، ${fa(4 - g.players.length)} جای خالی`, duration: 6000, action: { label: 'ببینید', run: () => setTab('games') } })
    }, 15000)
    return () => clearTimeout(t)
  }, [])
}
