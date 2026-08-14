import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Every date assertion assumes Singapore time; pin it so results do not depend on the
    // machine running the suite.
    env: { TZ: 'Asia/Singapore' },
  },
});
