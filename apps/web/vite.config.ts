import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.WEB_PORT ?? 5173), strictPort: true },
  build: {
    // The licence notices ship with the code (docs/licences.md): the minifier keeps legal comments, and licences.md
    // collects the licence file of every bundled dependency that ships one.
    license: { fileName: 'licences.md' },
    // The Elmina scene has its own page so it can grow next to the Inbox app without sharing its entry.
    rolldownOptions: { input: { main: 'index.html', scene: 'scene.html' }, output: { comments: { legal: true } } }
  }
})
