import { defineConfig } from 'vite'

// The landing page and the sign-in page. They run beside the web app, which takes 5173.
export default defineConfig({
  server: { port: 5174, strictPort: true },
  build: { rollupOptions: { input: { main: 'index.html', 'sign-in': 'sign-in.html' } } }
})
