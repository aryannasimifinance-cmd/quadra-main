// دریافت‌های امروز به تفکیک اپ، کارتخوان و نقدی؛ و ثبت دستی دریافت در پذیرش
import { useMemo, useState } from 'react'
import { fa, toman } from '../../data'
import { INCOME_ACCS } from '../../accounting'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon } from '../../components/ui'
import { payments } from './derive'
import { Card, Field, Money, Secret, Seg, Side } from './kit'
import { CustomerField, useCustomer } from './PosKit'

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const isToday = (t) => new Date(t).toDateString() === new Date().toDateString()
export const CHANNEL = { app: ['از اپ', 'درگاه آنلاین و کیف پول', 'card'], card: ['کارتخوان', 'دستگاه پذیرش', 'cash'], cash: ['نقدی', 'صندوق', 'wallet'] }
export const channelOf = (m) => (m === 'cash' ? 'cash' : m === 'card' ? 'card' : 'app')

export function useTodayIn() {
  const { club, user } = useStore()
  return useMemo(() => {
    const list = payments(club, user).filter((p) => p.paid > 0 && p.at <= Date.now() && isToday(p.at))
    const by = { app: 0, card: 0, cash: 0 }
    list.forEach((p) => { by[channelOf(p.method)] += p.paid })
    return { list, by, total: by.app + by.card + by.cash, manual: (club.payins || []).filter((p) => isToday(p.at)) }
  }, [club, user])
}

// کارت دریافت‌های امروز: برای داشبورد و صفحه‌ی دریافت‌ها
export function TodayIn({ compact }) {
  const { adminPayinDel, toast } = useStore()
  const t = useTodayIn()
  const [add, setAdd] = useState(false)
  // در داشبورد هر مبلغ جدا پنهان است و چشم خودش را دارد
  const m = (n) => (compact ? <Secret value={toman(n)} /> : toman(n))
  return (
    <Card className="today-in" title="دریافت‌های امروز" sub={<>{fa(t.list.length)} دریافت، جمع {m(t.total)}</>}
      right={<div className="row-btns"><button className="adm-btn primary sm" onClick={() => setAdd(true)} data-tip="پول نقد یا کارتخوانی که در پذیرش گرفتید و در سیستم نیست"><Icon name="plus" size={15} />ثبت دریافت دستی</button></div>}>
      <div className="ti-ch">
        {Object.entries(CHANNEL).map(([k, [n, sub]]) => (
          <div key={k} className={`ti-${k}`}>
            <small>{n}</small><b>{m(t.by[k])}</b>
            <i style={{ width: `${t.total ? (t.by[k] / t.total) * 100 : 0}%` }} />
            <em>{sub}</em>
          </div>
        ))}
      </div>
      {!compact && t.manual.length > 0 && (
        <div className="ti-manual">
          <small>ثبت‌های دستی امروز</small>
          {t.manual.map((p) => (
            <div key={p.id}><span>{time.format(p.at)}</span><b>{p.title}</b><em>{p.name || 'مشتری حضوری'}، {CHANNEL[p.method][0]}</em><b className="num">{toman(p.amount)}</b>
              <button className="icon-btn" onClick={() => { if (window.confirm('این دریافت حذف شود؟')) { adminPayinDel(p.id); toast({ icon: '🗑', title: 'دریافت حذف شد' }) } }} aria-label="حذف"><Icon name="close" size={14} /></button></div>
          ))}
        </div>
      )}
      <Side open={add} onClose={() => setAdd(false)} title="ثبت دریافت دستی">{add && <PayinForm onClose={() => setAdd(false)} />}</Side>
    </Card>
  )
}

const CATS = [['6101', 'زمین'], ['6102', 'کلاس مربی'], ['6103', 'پکیج و عضویت'], ['6104', 'آدینه و مسابقه'], ['6105', 'فروشگاه'], ['6106', 'کافه'], ['6201', 'سایر']]
export function PayinForm({ onClose }) {
  const { adminPayin, toast } = useStore()
  const cu = useCustomer()
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('card')
  const [acc, setAcc] = useState('6101')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const save = () => {
    const name = cu.member?.name || cu.mq.trim() || ''
    adminPayin({ amount, method, acc, title: title.trim() || CATS.find((c) => c[0] === acc)[1], note: note.trim(), by: cu.member?.id || null, name })
    chime('success'); toast({ icon: '💳', title: `${toman(amount)} ثبت شد`, body: `${CHANNEL[method][0]}؛ در دریافت‌ها و حسابداری آمد` }); onClose()
  }
  return (
    <div className="form">
      <Field label="مبلغ"><Money value={amount} onChange={setAmount} autoFocus /></Field>
      <Field label="روش"><Seg value={method} onChange={setMethod} options={{ card: 'کارتخوان', cash: 'نقدی' }} /></Field>
      <Field label="بابت" tip="در حسابداری به همین درآمد می‌رود"><div className="pick-chips">{CATS.map(([k, n]) => <button key={k} type="button" className={acc === k ? 'on' : ''} onClick={() => setAcc(k)}>{n}</button>)}</div></Field>
      <Field label="شرح" hint="مثلاً «تمدید ساعت بازی زمین ۲»"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={CATS.find((c) => c[0] === acc)[1]} /></Field>
      <CustomerField c={cu} />
      <Field label="یادداشت"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختیاری" /></Field>
      <p className="ev-hold"><Icon name="check" size={15} />در «دریافت‌ها»، داشبورد و سند روزانه‌ی حسابداری (حساب {INCOME_ACCS.find((a) => a.code === acc)?.name}) ثبت می‌شود.</p>
      <button className="adm-btn primary full" disabled={!amount} onClick={save}>ثبت {amount ? toman(amount) : ''}</button>
    </div>
  )
}
