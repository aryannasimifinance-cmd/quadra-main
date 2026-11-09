import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
export default [
  { ignores: ['scripts/.export-tmp.mjs'] },
  {
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: '18.3' } },
    rules: {
      'no-undef': 'error', 'react/jsx-no-undef': 'error', 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'warn' /* این نسخه برای حلقه‌های بعد از hook هشدار اشتباه می‌دهد */, 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-dupe-keys': 'error', 'no-unreachable': 'warn', 'no-const-assign': 'error', 'import/no-unresolved': 'off',
    },
  },
]
