/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:9754', ws: true },
      '/cmd': { target: 'http://localhost:9754' },
      '/health': { target: 'http://localhost:9754' },
      '/events': { target: 'http://localhost:9754' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
