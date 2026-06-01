import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      external: [],
    },
  },
  optimizeDeps: {
    include: ['chart.js'],
  },
  server: {
    port: 3000,
  }
})
