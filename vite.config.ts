import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electronの file:// プロトコルで正しく動作させるために `base` を設定
  base: './',
  // We no longer define the API key here. It will be fetched securely
  // from the main process via IPC.
  build: {
    outDir: 'dist', // Explicitly set renderer output dir
    rollupOptions: {
      // No longer externalizing any modules. All will be bundled.
    },
  },
})