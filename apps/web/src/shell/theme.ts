// Appearance: light, dark or system. System removes data-theme so the prefers-color-scheme rules apply.
export type Theme = 'light' | 'dark' | 'system'
const KEY = 'safeEdge.theme'

export function getTheme(): Theme {
  try {
    const t = sessionStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system' // storage blocked: not remembered across a reload
  }
}

// The browser's own bar takes the canvas colour (--bg-canvas in app.css). index.html holds one theme-color tag per
// colour scheme; a chosen theme sets both, System gives each its own scheme's colour back.
const CANVAS = { light: '#e7ebe8', dark: '#111a17' } as const

export function setTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    meta.content = CANVAS[theme === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : theme]
  try {
    sessionStorage.setItem(KEY, theme)
  } catch {
    // see getTheme()
  }
}

// Apply the remembered choice before the first paint.
setTheme(getTheme())
