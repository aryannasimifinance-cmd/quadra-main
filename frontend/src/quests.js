// چالش‌ها و امتیاز: ثابت‌ها (بدون وابستگی تا store و select هر دو بتوانند وارد کنند)
// تعریف‌ها را مدیر می‌سازد (club.quests)؛ تا وقتی سرور چیزی نفرستاده همان سه چالش قبلی
export const DEFAULT_QUESTS = [
  { id: 'play2', icon: '🎾', name: 'هفته‌ی پرکار', desc: 'این هفته ۲ بار به زمین بیایید (رزرو، بازی باز یا کلاس)', metric: 'play', goal: 2, xp: 60, period: 'week', active: true },
  { id: 'social', icon: '🤝', name: 'یار جدید', desc: 'یک بازی باز بسازید یا به بازی باز دیگران بپیوندید', metric: 'open', goal: 1, xp: 40, period: 'week', active: true },
  { id: 'coach', icon: '🧢', name: 'جلسه‌ی هفته', desc: 'این هفته یک جلسه با یکی از مربی‌ها داشته باشید', metric: 'coach', goal: 1, xp: 40, period: 'week', active: true },
]
// فعالیت‌هایی که سرور هم دقیقاً همین‌طور می‌شمارد (App\Domain\Quests::progress)
export const QUEST_METRICS = {
  play: { name: 'هر رزرو یا بازی', unit: 'بازی' },
  open: { name: 'بازی باز (ساختن یا پیوستن)', unit: 'بازی باز' },
  coach: { name: 'جلسه با مربی', unit: 'جلسه' },
  event: { name: 'ثبت‌نام در آدینه یا مسابقه', unit: 'ثبت‌نام' },
  shop: { name: 'سفارش از فروشگاه', unit: 'سفارش' },
  cafe: { name: 'سفارش از کافه', unit: 'سفارش' },
}
export const QUEST_PERIODS = { week: 'این هفته', month: 'این ماه', once: 'یک‌بار' }
