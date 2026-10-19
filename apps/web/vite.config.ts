import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.WEB_PORT ?? 5173), strictPort: true },
  // The Elmina scene has its own page so it can grow next to the Inbox app without sharing its entry.
  build: { rollupOptions: { input: { main: 'index.html', scene: 'scene.html' } } }
})
