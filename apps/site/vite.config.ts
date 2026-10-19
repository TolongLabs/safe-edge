import { defineConfig } from 'vite'

// The landing page. It runs beside the web app, which takes 5173.
export default defineConfig({
  server: { port: 5174, strictPort: true }
})
