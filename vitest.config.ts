import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': './shared',
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
});
