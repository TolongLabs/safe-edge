import { defineConfig } from 'vite'
import { CLEAN_PATHS, cleanUrls, siteChrome } from './chrome.ts'

// The landing page, the product pages and the sign-in page. They run beside the web app, which takes 5173.
export default defineConfig({
  plugins: [siteChrome(), cleanUrls()],
  server: { port: 5174, strictPort: true },
  build: {
    rollupOptions: {
      input: { main: 'index.html', ...Object.fromEntries(CLEAN_PATHS.map((path) => [path, `${path}.html`])) }
    }
  }
})
