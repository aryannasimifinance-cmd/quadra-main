// تصویر آیتم کافه: عکس واقعی، و اگر نبود شکلک روی کاشی رنگی دسته
export function Dish({ it, big }) {
  if (it.img) return <span className={`dish has-img d-${it.cat} ${big ? 'big' : ''}`}><img src={it.img} alt="" loading="lazy" draggable={false} /></span>
  return <span className={`dish d-${it.cat} ${big ? 'big' : ''}`} aria-hidden="true">{it.emoji}</span>
}
