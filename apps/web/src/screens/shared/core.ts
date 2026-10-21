import { operations, type OperationId, type Role, type User } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'
import { useStore } from '../../store'

// The callers that are not people at a desk: they never appear as "who does this".
const NOT_PEOPLE: Role[] = ['agent', 'system', 'provider', 'integrator']

/** The seeded people the contracts let call the operation, as "Name (role)", for a lock line. */
export function peopleWho(id: OperationId, users: User[]): string {
  const roles: readonly Role[] | 'any' = operations[id].roles
  const names = users
    .filter((u) => !NOT_PEOPLE.includes(u.role) && (roles === 'any' || roles.includes(u.role)))
    .map((u) => u.name)
  if (names.length === 0) throw new Error(`No seeded person may call ${id}`)
  return names.join(', ')
}

// Every date and time these screens show is Malaysian time, whatever the machine's zone (as in the Inbox).
const KL = 'Asia/Kuala_Lumpur'
const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: KL })
export const fmt = (iso: string) => intl({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) + ' MYT'
export const clock = (iso: string) =>
  intl({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso))

/** Core's refusal in words, with its rule, as the Inbox shows it. */
export const refusalText = (error: SafeEdgeDeniedError) => `Core refused this (${error.rule}): ${error.message}`

/**
 * Runs a change as someone and keeps core's refusal to show. Any other failure is a bug, so it is thrown into the
 * screen's error boundary instead of being swallowed by the click handler.
 */
export function useAction() {
  const [refused, setRefused] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  if (fatal) throw fatal.error
  const run = async (call: () => Promise<unknown>): Promise<boolean> => {
    setRefused(null)
    setBusy(true)
    try {
      await call()
      return true
    } catch (error) {
      if (error instanceof SafeEdgeDeniedError) setRefused(refusalText(error))
      else setFatal({ error })
      return false
    } finally {
      setBusy(false)
    }
  }
  return { run, refused, busy, clear: () => setRefused(null) }
}

export type Read<T> = { data: T | null; error: Error | null; reload: () => void }

/**
 * Reads from core with `read` (a module-level function, so it stays the same), again whenever the shared snapshot
 * changes: after any change core reports, a sign-in, or Reset demo. The last data stays on screen while it re-reads.
 */
export function useCoreRead<T>(read: () => Promise<T>): Read<T> {
  const { snapshot } = useStore()
  const [state, setState] = useState<{ data: T | null; error: Error | null }>({ data: null, error: null })
  const [asked, setAsked] = useState(0)
  useEffect(() => {
    let live = true
    read().then(
      (data) => live && setState({ data, error: null }),
      (error: unknown) =>
        live && setState((s) => ({ data: s.data, error: error instanceof Error ? error : new Error(String(error)) }))
    )
    return () => {
      live = false
    }
  }, [read, snapshot, asked])
  return { ...state, reload: () => setAsked((n) => n + 1) }
}
