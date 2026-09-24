import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // transform.test.ts is a node:test suite, run via `npm run test:data`.
    exclude: ['tests/transform.test.ts'],
  },
});
