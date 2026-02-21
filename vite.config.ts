import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/mh': {
        target: 'https://api-firma.onrender.com/firma',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mh/, ''),
      },
    },
  },
  resolve: {
    alias: {
      'node:async_hooks': path.resolve(__dirname, './utils/shims/async_hooks.ts'),
      'async_hooks': path.resolve(__dirname, './utils/shims/async_hooks.ts'),
    },
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events'], 
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    } as any),
  ],
})