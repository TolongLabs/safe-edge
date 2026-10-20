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

export function setTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  try {
    sessionStorage.setItem(KEY, theme)
  } catch {
    // see getTheme()
  }
}

// Apply the remembered choice before the first paint.
setTheme(getTheme())
