const { join } = require('path');
const harnessUiTailwindConfig = require('@harnessio/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [harnessUiTailwindConfig],
  content: [join(__dirname, 'ui/**/*.{ts,tsx,html}')],
  theme: {
    extend: {},
  },
  plugins: [],
};
