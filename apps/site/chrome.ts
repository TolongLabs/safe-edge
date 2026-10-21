// The header and footer every landing-site page shares, put into each page's HTML at build time, so they read
// without JavaScript. A page marks where they go with <!-- site:header --> and <!-- site:footer -->.
import { basename } from 'node:path'
import type { Connect, Plugin } from 'vite'

/** The product pages, in header order. Each is served at /<key> as well as /<key>.html. */
export const PAGES = [
  { key: 'drone', short: 'Drone', long: 'Drone patrols' },
  { key: 'agents', short: 'Agents', long: 'Agents' },
  { key: 'sdk', short: 'SDK', long: 'SDK and API' },
  { key: 'privacy', short: 'Privacy', long: 'Privacy' }
] as const

type PageKey = 'home' | (typeof PAGES)[number]['key']

/** Paths served without .html, on Vercel (scripts/build-demo-site.ts) and in `vite dev`. */
export const CLEAN_PATHS = ['sign-in', ...PAGES.map((page) => page.key)]

function header(page: PageKey) {
  const home = page === 'home'
  const links = PAGES.map(
    ({ key, short }) => `<a href="/${key}"${page === key ? ' aria-current="page"' : ''}>${short}</a>`
  ).join('\n')
  // The landing page keeps its clock in the middle of the bar, on screens wide enough to hold it beside the links.
  const clock = home
    ? `<p class="clock" aria-hidden="true">
        <span class="clock-time">06:42</span>
        <span class="clock-what">Panel 4 missing</span>
      </p>`
    : ''
  return `<header class="topbar" aria-label="Site">
      <div class="topbar-start">
        <a class="wordmark" href="${home ? '#top' : '/'}" aria-label="${home ? 'Safe Edge, back to top' : 'Safe Edge, home'}">
          <img src="/mark-rail.svg" alt="" width="28" height="28" />
          <span>Safe Edge</span>
        </a>
        <nav class="topnav" aria-label="Pages">
${links}
        </nav>
      </div>
      ${clock}
      <div class="topbar-end">
        <span class="sim-label">Simulation</span>
        <a class="button button--ink button--small" href="/sign-in">Open the demo</a>
      </div>
    </header>`
}

function footer(page: PageKey) {
  const home = page === 'home'
  const simulated = home
    ? 'Every flight, photo, person and repair on this page is simulated.'
    : 'The demo runs on simulated data, and labels everything simulated.'
  const pages = [
    ...(home ? [] : [`<a href="/">Home</a>`]),
    ...PAGES.map(({ key, long }) => `<a href="/${key}"${page === key ? ' aria-current="page"' : ''}>${long}</a>`)
  ].join('\n')
  const onThisPage = home
    ? `<nav aria-label="On this page">
            <p class="footer-head">On this page</p>
            <a href="#problem">The problem</a>
            <a href="#loop">One fence, one day</a>
            <a href="#fix">Fix check</a>
            <a href="#rules">The rules</a>
          </nav>`
    : ''
  return `<footer class="footer${home ? '' : ' footer--page'}">
      <div class="night" aria-hidden="true">
        <img class="night-art" src="/night.svg" alt="" width="1600" height="440" />
      </div>
      <div class="footer-in">
        <p class="footer-pass">
          <span class="plate-code">LK·S12</span>
          <span class="mark mark--valid" aria-hidden="true"></span>
          <span>Fence by the playground, valid to 20 Oct 2027. The new panel and 6 m of fence are lit in green.</span>
        </p>
        <div class="footer-lead">
          <p class="footer-word" aria-label="Safe Edge">SAFE EDGE</p>
          <a class="button button--mist" href="/sign-in">Open the demo</a>
        </div>
        <div class="footer-cols">
          ${onThisPage}
          <nav aria-label="Pages, footer">
            <p class="footer-head">Pages</p>
${pages}
          </nav>
          <div>
            <p class="footer-head">The project</p>
            <p>SDP Hack 2026, Township of Tomorrow</p>
            <p>Built by TolongLabs</p>
          </div>
          <div>
            <p class="footer-head">Credits</p>
            <p>Map data © OpenStreetMap contributors (ODbL)</p>
            <p>Type: Atkinson Hyperlegible Next (SIL OFL)</p>
            <p>Icons: Phosphor (MIT)</p>
          </div>
          <div>
            <p class="footer-head">Simulated</p>
            <p>${simulated}</p>
          </div>
        </div>
        <div class="footer-end">
          <p>© 2026 TolongLabs</p>
          <a class="button button--mist button--small" href="#top">Back to top</a>
        </div>
      </div>
    </footer>`
}

/** Puts the shared header and footer into every page that has them; sign-in has its own brand pane instead. */
export const siteChrome = (): Plugin => ({
  name: 'safe-edge-site-chrome',
  transformIndexHtml: {
    order: 'pre',
    handler(html, { filename }) {
      const name = basename(filename, '.html')
      const page: PageKey | undefined = name === 'index' ? 'home' : PAGES.find((p) => p.key === name)?.key
      if (!page) return html
      for (const mark of ['<!-- site:header -->', '<!-- site:footer -->'])
        if (!html.includes(mark)) throw new Error(`${filename} has no ${mark}`)
      return html.replace('<!-- site:header -->', header(page)).replace('<!-- site:footer -->', footer(page))
    }
  }
})

// /drone and the other clean paths serve their .html file, as Vercel's routes do in the deployed site.
const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
  const match = req.url?.match(/^\/([a-z-]+)\/?(\?.*)?$/)
  if (match && CLEAN_PATHS.includes(match[1])) req.url = `/${match[1]}.html${match[2] ?? ''}`
  next()
}

export const cleanUrls = (): Plugin => ({
  name: 'safe-edge-clean-urls',
  configureServer: (server) => void server.middlewares.use(rewrite),
  configurePreviewServer: (server) => void server.middlewares.use(rewrite)
})
