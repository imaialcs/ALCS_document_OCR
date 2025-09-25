import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  // Electronの file:// プロトコルで正しく動作させるために `base` を設定
  base: './',
  // We no longer define the API key here. It will be fetched securely
  // from the main process via IPC.
  build: {
    outDir: 'dist', // Explicitly set renderer output dir
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'), // index.htmlをメインのエントリーポイントとして指定
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
})
