// اجزای مشترک صندوق حضوری فروشگاه و کافه: ستون فاکتور که همیشه دیده می‌شود و انتخاب مشتری
import { useState } from 'react'
import { MEMBERS, fa, toman } from '../../data'
import { Icon } from '../../components/ui'
import { Empty, Field } from './kit'

// فاکتور: فقط اقلام اسکرول می‌خورند؛ گزینه‌ها، جمع و دکمه‌ی ثبت پایین ثابت‌اند؛ در موبایل با زدن سرش باز و بسته می‌شود
export function Ticket({ count, total, children, options, warn, action, disabled, onSubmit, onClear, empty }) {
  const [open, setOpen] = useState(false)
  return (
    <aside className={`pos-ticket ${open ? 'open' : ''}`}>
      <div className="pt-head" onClick={() => setOpen(!open)}>
        <b>فاکتور</b>{count > 0 && <em>{fa(count)}</em>}
        {count > 0 && onClear && <button type="button" className="link" onClick={(e) => { e.stopPropagation(); onClear() }}>خالی کردن</button>}
        <Icon name="back" size={16} className="pt-chev" />
      </div>
      <div className="pt-body">
        <div className="pt-lines">{count > 0 ? children : <Empty>{empty}</Empty>}</div>
      </div>
      {count > 0 && <div className="pt-opts">{options}</div>}
      <div className="pt-foot">
        {warn}
        <div className="dr-total"><span>{fa(count)} قلم</span><b>{toman(total)}</b></div>
        <button className="adm-btn primary full" disabled={disabled || !count} onClick={onSubmit}>{action}</button>
      </div>
    </aside>
  )
}

export function Qty({ qty, onMinus, onPlus, canPlus = true }) {
  return <div className="qty"><button type="button" onClick={onMinus} aria-label="کم کردن">−</button><b>{fa(qty)}</b><button type="button" onClick={onPlus} disabled={!canPlus} aria-label="اضافه کردن">+</button></div>
}

// مشتری: عضو باشگاه (با نام یا شماره) یا نام آزاد مشتری حضوری؛ خروجی شناسه‌ی سفارش است
export function useCustomer() {
  const [mq, setMq] = useState('')
  const [member, setMember] = useState(null)
  const guest = mq.trim()
  return { mq, setMq, member, setMember, by: member?.id || (guest ? 'f:' + guest : null) }
}
export function CustomerField({ c }) {
  const found = c.mq ? MEMBERS.filter((m) => !m.inactive && (m.name?.includes(c.mq) || m.phone?.includes(c.mq))).slice(0, 5) : []
  return (
    <Field label="مشتری">
      {c.member ? <div className="picked"><b>{c.member.name}</b><button type="button" className="link" onClick={() => c.setMember(null)}>تغییر</button></div>
        : <><input placeholder="نام مشتری (اختیاری) یا جستجوی عضو" value={c.mq} onChange={(e) => c.setMq(e.target.value)} />
          {found.length > 0 && <div className="pick-list">{found.map((m) => <button type="button" key={m.id} onClick={() => { c.setMember(m); c.setMq('') }}><b>{m.name}</b><small dir="ltr">{m.phone}</small></button>)}</div>}</>}
    </Field>
  )
}
