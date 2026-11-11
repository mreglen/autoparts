const web = require('../../frontend/my-autoparts/tailwind.config.js');

/**
 * Единый источник токенов — конфигурация Tailwind веб-фронтенда: её `theme`
 * подхватывается целиком, ниже добавляются только мобильные величины.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./index.ts', './App.tsx', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    ...web.theme,
    extend: {
      ...web.theme.extend,
      spacing: {
        'sg-tap': '44px',
        'sg-gap': '12px',
        'sg-edge': '16px',
      },
      height: {
        ...web.theme.extend.height,
        'sg-row': '56px',
        'sg-input': '48px',
      },
    },
  },
  plugins: [],
};
