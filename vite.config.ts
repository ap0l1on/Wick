import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages: served from /Wick/ until a custom domain is set,
// then switch base to '/'.
export default defineConfig({
  plugins: [preact()],
  base: '/Wick/',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
