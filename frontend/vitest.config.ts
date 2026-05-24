import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Redirect @convex/_generated/* to our __mocks__ directory so tests
      // never need the real generated files.
      '@convex/_generated/api': path.resolve(__dirname, './src/__mocks__/convex-generated-api.ts'),
      '@convex/_generated/dataModel': path.resolve(
        __dirname,
        './src/__mocks__/convex-generated-dataModel.ts',
      ),
    },
  },
});
