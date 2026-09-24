import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
  // JSX lives in .js files (CRA convention) — treat all src/*.js(x) as JSX
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    css: false,
    exclude: ['e2e/**', 'node_modules/**', 'build/**'],
  },
});
