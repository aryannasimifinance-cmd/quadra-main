import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

// خروجی build مستقیم در backend/public می‌رود تا لاراول اپ را از همان دامنه سرو کند.
// index.html به spa.html تغییر نام می‌دهد (index.php لاراول سر جایش می‌ماند).
const OUT = resolve(__dirname, '../backend/public')
const intoLaravel = () => ({
  name: 'quadra-into-laravel',
  apply: 'build',
  buildStart() { rmSync(resolve(OUT, 'assets'), { recursive: true, force: true }) },
  closeBundle() {
    const html = resolve(OUT, 'index.html')
    if (existsSync(html)) renameSync(html, resolve(OUT, 'spa.html'))
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), intoLaravel()],
  // توسعه: npm run dev و در پوشه‌ی backend «php artisan serve»
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: { outDir: OUT, emptyOutDir: false },
})
