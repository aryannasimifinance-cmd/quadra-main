import confetti from 'canvas-confetti'

export function haptic(pattern = 8) {
  try { navigator.vibrate?.(pattern) } catch { /* بدون پشتیبانی */ }
}

// موج لمس روی کارت‌ها و باکس‌ها — یک شنونده‌ی سراسری، بدون تغییر در تک‌تک کامپوننت‌ها
const BOX = 'button, .p-card, .coach-card, .intent-card, .event-banner, .ticket, .quest, .og-card, .pkg, .coach-big, .ev-card, .peek'
export function installTapFx() {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(BOX)
    if (!el || el.disabled || el.closest('.nav, .co-tabs') || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    if (r.width < 72 || r.height < 40) return
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    const wrap = document.createElement('span'), dot = document.createElement('i')
    wrap.className = 'tap-fx'
    const d = Math.hypot(r.width, r.height) * 2
    Object.assign(dot.style, { width: d + 'px', height: d + 'px', left: e.clientX - r.left - d / 2 + 'px', top: e.clientY - r.top - d / 2 + 'px' })
    wrap.appendChild(dot); el.appendChild(wrap)
    el.classList.remove('tap-on'); void el.offsetWidth; el.classList.add('tap-on')
    setTimeout(() => { wrap.remove(); el.classList.remove('tap-on') }, 650)
  }, { passive: true })
}

let ctx
function audio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null } }
  return ctx
}
// صدای کوتاه و نرم — «tap»، «success» و «alarm» برای اعلان مچ‌میکینگ
export function chime(kind = 'tap') {
  const a = audio(); if (!a) return
  const notes = { tap: [880], success: [660, 880, 1320], alarm: [988, 740, 988, 740], level: [523, 659, 784, 1047] }[kind]
  notes.forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain()
    o.type = 'sine'; o.frequency.value = f
    const t = a.currentTime + i * 0.09
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(kind === 'tap' ? 0.03 : 0.08, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.3)
  })
}

export function celebrate(colors = ['#19C9C1', '#141413', '#F4F2EC', '#7FF2EB']) {
  const base = { spread: 70, ticks: 220, gravity: 0.9, scalar: 1, colors, disableForReducedMotion: true }
  confetti({ ...base, particleCount: 70, origin: { x: 0.15, y: 0.7 }, angle: 60 })
  confetti({ ...base, particleCount: 70, origin: { x: 0.85, y: 0.7 }, angle: 120 })
  setTimeout(() => confetti({ ...base, particleCount: 90, spread: 120, origin: { y: 0.35 }, shapes: ['circle'], scalar: 1.2 }), 250)
}

export async function askNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'default') {
    try { return await Notification.requestPermission() } catch { return 'denied' }
  }
  return Notification.permission
}
export function systemNotify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: './brand/icon-192.png' })
  } catch { /* موبایل بدون service worker */ }
}
