import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'inbox' }
  | { name: 'fixLens'; findingId: string | null }
  | { name: 'passes' }
  | { name: 'passIssued'; passId: string }
  | { name: 'retest'; workOrderId: string | null }
  | { name: 'capture'; segmentId: string | null }
  | { name: 'notFound' }

/** Hash routes: `#/inbox` (also empty), `#/fix-lens[/id]`, `#/passes[/id]`, `#/retest[/id]`, `#/capture[/id]`. */
export function parseRoute(hash: string): Route {
  let parts: string[]
  try {
    parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  } catch (error) {
    if (error instanceof URIError) return { name: 'notFound' } // a malformed %-escape in the address
    throw error
  }
  const [head, id, ...rest] = parts
  if (rest.length > 0) return { name: 'notFound' }
  switch (head) {
    case undefined:
      return id === undefined ? { name: 'inbox' } : { name: 'notFound' }
    case 'inbox':
      return id === undefined ? { name: 'inbox' } : { name: 'notFound' }
    case 'passes':
      return id === undefined ? { name: 'passes' } : { name: 'passIssued', passId: id }
    case 'fix-lens':
      return { name: 'fixLens', findingId: id ?? null }
    case 'retest':
      return { name: 'retest', workOrderId: id ?? null }
    case 'capture':
      return { name: 'capture', segmentId: id ?? null }
    default:
      return { name: 'notFound' }
  }
}

/** Phone screens use the phone top bar instead of the rail. */
export const isPhone = (r: Route) => r.name === 'retest' || r.name === 'capture'

const subscribe = (l: () => void) => (
  window.addEventListener('hashchange', l),
  () => window.removeEventListener('hashchange', l)
)
export const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash)
