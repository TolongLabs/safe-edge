import type { Actor } from '@safe-edge/contracts'
import { createSafeEdgeClient, SafeEdgeApiError, SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState, useSyncExternalStore } from 'react'

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

/** A check the Settings screen runs, or the live API's answer to who a token acts as. */
export type Check<T> =
  { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; text: string } | { kind: 'done'; value: T }

/** A failed connection in words that say how to get past it; null for anything else, which is a bug to throw. */
export function liveFailure(error: unknown, baseUrl: string): string | null {
  if (error instanceof TypeError)
    return `Could not reach ${baseUrl}. Check that the API runs there and that SAFE_EDGE_CORS_ORIGINS lists ${window.location.origin}.`
  if (error instanceof SafeEdgeApiError && error.status === 401)
    return `The API refused this token (401): ${error.message}. Print one with bun run dev:token usr_manager.`
  if (error instanceof SafeEdgeApiError) return `The API answered ${error.status} ${error.error}: ${error.message}`
  if (error instanceof SafeEdgeDeniedError) return `The API refused this (${error.rule}): ${error.message}`
  return null
}

/** Who the saved token acts as, asked again whenever the saved API changes, so a server that stopped shows. */
export function useActsAs(api: LiveApi | null) {
  const [state, setState] = useState<Check<Actor>>({ kind: 'idle' })
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  if (fatal) throw fatal.error
  useEffect(() => {
    if (!api) return setState({ kind: 'idle' })
    let live = true
    setState({ kind: 'checking' })
    liveClient(api)
      .getMe()
      .then(
        (actor) => live && setState({ kind: 'done', value: actor }),
        (error: unknown) => {
          if (!live) return
          const text = liveFailure(error, api.baseUrl)
          if (text === null) setFatal({ error })
          else setState({ kind: 'error', text })
        }
      )
    return () => {
      live = false
    }
  }, [api])
  return state
}
