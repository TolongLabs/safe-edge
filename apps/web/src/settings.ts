import { createSafeEdgeClient } from '@safe-edge/sdk'
import { useSyncExternalStore } from 'react'

// The person's own keys for this demo (the Settings screen): an Anthropic API key that runs the agent in the page, and
// a live Safe Edge API with a token that the Developers page's Try it calls. Both stay in this tab's sessionStorage,
// like the signed-in person and the theme, so closing the tab forgets them.

export type LiveApi = { baseUrl: string; token: string }
export type Settings = { anthropicKey: string | null; liveApi: LiveApi | null }

const KEY = { anthropicKey: 'safeEdge.anthropicKey', liveApi: 'safeEdge.liveApi' } as const

const read = (key: string) => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null // storage blocked: kept for this page only (see write)
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // storage blocked: the value lives until this page reloads
  }
}

function parseLiveApi(text: string | null): LiveApi | null {
  if (text === null) return null
  const value: unknown = JSON.parse(text)
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as LiveApi).baseUrl !== 'string' ||
    typeof (value as LiveApi).token !== 'string'
  )
    throw new Error(`sessionStorage ${KEY.liveApi} does not hold a live API (baseUrl and token)`)
  const { baseUrl, token } = value as LiveApi
  return { baseUrl, token }
}

let current: Settings = { anthropicKey: read(KEY.anthropicKey), liveApi: parseLiveApi(read(KEY.liveApi)) }
const listeners = new Set<() => void>()
const publish = (next: Settings) => {
  current = next
  listeners.forEach((l) => l())
}

export const getSettings = () => current

/** Saves the Anthropic key, or forgets it with null. */
export function setAnthropicKey(key: string | null) {
  write(KEY.anthropicKey, key)
  publish({ ...current, anthropicKey: key })
}

/** Saves the live API the Developers page calls, or goes back to the demo core with null. */
export function setLiveApi(api: LiveApi | null) {
  write(KEY.liveApi, api && JSON.stringify(api))
  publish({ ...current, liveApi: api })
}

export const useSettings = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current
  )

/** The http client for a live API: Settings' connection check and the Developers page's Try it. */
export const liveClient = ({ baseUrl, token }: LiveApi) => createSafeEdgeClient({ transport: 'http', baseUrl, token })
