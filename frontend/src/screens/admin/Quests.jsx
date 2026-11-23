import { useState } from 'react'
import { fa } from '../../data'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { QUEST_METRICS, QUEST_PERIODS, questDefs } from '../../select'
import { Icon } from '../../components/ui'
import { Quest } from '../player/Home'
import { Card, Empty, Guide } from './kit'

// چالش‌ها و امتیاز: مدیر چالش می‌سازد، بازیکن در خانه و «مسیر باشگاه» می‌بیند و XP می‌گیرد
const MAX = 30
const ICONS = ['🎾', '🤝', '🧢', '🏆', '🔥', '⚡', '🎯', '🛍', '☕', '🌅', '🌙', '💪']
const blank = () => ({ id: null, icon: '🎯', name: '', desc: '', metric: 'play', goal: 3, xp: 100, period: 'week', active: true })
const newId = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const PERIOD_HINT = { week: 'هر شنبه از نو شروع می‌شود', month: 'اول هر ماه شمسی از نو شروع می‌شود', once: 'هر بازیکن فقط یک بار جایزه می‌گیرد؛ فعالیت‌های قبلی هم حساب است' }

// اعتبارسنجی همان قاعده‌های سرور (AdminActions::adminQuest)
function check(f) {
  if (!f.icon.trim() || [...f.icon.trim()].length > 8) return 'یک ایموجی برای آیکون بگذارید'
  if (f.name.trim().length < 2 || f.name.trim().length > 40) return 'نام چالش ۲ تا ۴۰ حرف باشد'
  if (f.desc.length > 160) return 'توضیح حداکثر ۱۶۰ حرف باشد'
  if (!Number.isInteger(+f.goal) || +f.goal < 1 || +f.goal > 100) return 'هدف عددی بین ۱ تا ۱۰۰ باشد'
  if (!Number.isInteger(+f.xp) || +f.xp < 5 || +f.xp > 1000) return 'جایزه بین ۵ تا ۱۰۰۰ XP باشد'
  return null
}

export function QuestsAdmin() {
  const { club, adminQuest, toast } = useStore()
  const list = questDefs(club)
  const [f, setF] = useState(null)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const err = f && check(f)
  const full = list.length >= MAX
  const active = list.filter((q) => q.active)
  const xs = active.map((q) => q.xp)

  const save = async () => {
    if (err) return
    const id = f.id || newId()
    const q = { icon: f.icon.trim(), name: f.name.trim(), desc: f.desc.trim(), metric: f.metric, goal: +f.goal, xp: +f.xp, period: f.period, active: f.active }
    setF(null)
    const r = await adminQuest(id, q)
    if (!r?.error) { chime('success'); toast({ icon: q.icon, title: 'چالش ذخیره شد', body: `«${q.name}» ${q.active ? 'در اپ بازیکن‌ها نشان داده می‌شود' : 'غیرفعال است'}` }) }
  }
  const del = (q) => {
    if (!confirm(`چالش «${q.name}» حذف شود؟ جایزه‌هایی که قبلاً گرفته شده سر جایش می‌ماند.`)) return
    if (f?.id === q.id) setF(null)
    adminQuest(q.id, null); chime('tap')
  }
  const toggle = (q) => { const { id, ...rest } = q; adminQuest(id, { ...rest, active: !q.active }); chime('tap') }

  // پیش‌نمایش: کارت بازیکن در نیمه‌ی راه
  const pv = f && { ...f, id: 'preview', name: f.name.trim() || 'نام چالش', desc: f.desc.trim(), goal: Math.max(1, +f.goal || 1), xp: +f.xp || 0, have: Math.floor(Math.max(1, +f.goal || 1) / 2), when: QUEST_PERIODS[f.period], ready: false, claimed: false }

  return (
    <div className="two qa">
      <Card title="چالش‌ها" sub={`${fa(active.length)} فعال از ${fa(list.length)}${xs.length ? `، جایزه ${fa(Math.min(...xs))} تا ${fa(Math.max(...xs))} XP` : ''}`}
        right={<button className="adm-btn primary sm" disabled={full} onClick={() => setF(blank())} data-tip={full ? `حداکثر ${fa(MAX)} چالش` : 'ساختن چالش تازه'}><Icon name="plus" size={16} />چالش تازه</button>}>
        <Guide>بازیکن‌ها چالش‌های فعال را در صفحه‌ی خانه و «مسیر باشگاه» می‌بینند. وقتی شرط کامل شد، خودشان جایزه را می‌گیرند (هر بازه یک بار).</Guide>
        {list.length === 0 ? <Empty>هنوز چالشی نیست؛ «چالش تازه» را بزنید.</Empty> : (
          <div className="qa-list">
            {list.map((q) => (
              <div key={q.id} className={`qa-row ${q.active ? '' : 'off'} ${f?.id === q.id ? 'on' : ''}`}>
                <span className="qa-ic">{q.icon}</span>
                <div className="grow">
                  <b>{q.name}</b>
                  <small>{QUEST_METRICS[q.metric]?.name || q.metric}، {fa(q.goal)} {QUEST_METRICS[q.metric]?.unit || 'بار'} · {QUEST_PERIODS[q.period]}</small>
                </div>
                <em className="qa-xp">+{fa(q.xp)} XP</em>
                <button className={`tgl-adm ${q.active ? 'on' : ''}`} onClick={() => toggle(q)} data-tip="نمایش یا پنهان کردن برای بازیکن‌ها"><i /><span>{q.active ? 'فعال' : 'خاموش'}</span></button>
                <button className="adm-btn ghost sm" onClick={() => setF({ ...blank(), ...q, desc: q.desc || '' })}><Icon name="cog" size={14} />ویرایش</button>
                <button className="adm-btn danger sm" onClick={() => del(q)} aria-label="حذف" title="حذف"><Icon name="close" size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="stack">
        {pv && (
          <Card title="پیش‌نمایش در اپ بازیکن" sub="کارت چالش در صفحه‌ی خانه، وقتی نصف راه رفته">
            <div className="qa-preview" dir="rtl"><div className="quests"><Quest q={pv} /></div></div>
          </Card>
        )}
        {f ? (
          <Card title={f.id ? 'ویرایش چالش' : 'چالش تازه'} sub="هر چالش یک فعالیت قابل‌شمارش، یک هدف و یک جایزه دارد">
            <div className="form">
              <label>آیکون
                <div className="qa-icons">
                  {ICONS.map((i) => <button key={i} type="button" className={f.icon === i ? 'on' : ''} onClick={() => set({ icon: i })}>{i}</button>)}
                  <input value={f.icon} onChange={(e) => set({ icon: e.target.value })} maxLength={8} aria-label="ایموجی دلخواه" />
                </div>
              </label>
              <label>نام چالش<input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} placeholder="مثلاً ۳ بازی این ماه" autoFocus /></label>
              <label>توضیح برای بازیکن<input value={f.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={160} placeholder="مثلاً این ماه ۳ بار به زمین بیایید" /></label>
              <label>چه چیزی شمرده شود؟
                <select value={f.metric} onChange={(e) => set({ metric: e.target.value })}>
                  {Object.entries(QUEST_METRICS).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                </select>
              </label>
              <div className="form-2">
                <label>هدف (تعداد)<input type="number" min="1" max="100" value={f.goal} onChange={(e) => set({ goal: e.target.value })} /></label>
                <label>جایزه (XP)<input type="number" min="5" max="1000" step="5" value={f.xp} onChange={(e) => set({ xp: e.target.value })} /></label>
              </div>
              <label>بازه
                <select value={f.period} onChange={(e) => set({ period: e.target.value })}>
                  {Object.entries(QUEST_PERIODS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
              <p className="muted small">{PERIOD_HINT[f.period]}</p>
              <div className="qa-active">
                <span>نمایش برای بازیکن‌ها</span>
                <button type="button" className={`tgl-adm ${f.active ? 'on' : ''}`} onClick={() => set({ active: !f.active })}><i /><span>{f.active ? 'فعال' : 'خاموش'}</span></button>
              </div>
              {err && <p className="login-why">{err}</p>}
              <div className="qa-actions">
                <button className="adm-btn primary" disabled={!!err} onClick={save}>ذخیره</button>
                <button className="adm-btn ghost" onClick={() => setF(null)}>انصراف</button>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="ساخت یا ویرایش">
            <p className="muted small">یک چالش را برای ویرایش انتخاب کنید یا «چالش تازه» را بزنید.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
