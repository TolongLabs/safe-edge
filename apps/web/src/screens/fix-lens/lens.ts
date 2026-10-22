import type { OpeningType, Remedy, Role, RouteClosure, User } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useCallback, useEffect, useState } from 'react'
import { client, onReset, refresh } from '../../store'

export const OPENING_LABEL: Record<OpeningType, string> = {
  fence_gap: 'Panel gap',
  fence_end: 'Fence end',
  gate: 'Gate',
  missing_cover: 'Missing cover',
  low_barrier: 'Low barrier'
}
export const REMEDY_LABEL: Record<Remedy['type'], string> = {
  panel_replacement: 'Panel replacement',
  barrier_extension: 'Barrier extension',
  cover: 'Cover',
  gate: 'Gate',
  other: 'Other'
}
export const FROM_LABEL = { path: 'path', gate: 'gate', play_area: 'play area' } as const
// The name on a route's feature box in the plan drawing; the full route label stays on the route.
export const FEATURE_BOX = { path: 'Path', gate: 'Gate', play_area: 'Play area' } as const
/** A lookup that must succeed: a missing record is a bug in the data flow, so say so instead of showing a fallback. */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`)
  return value
}
export const letter = (i: number) => String.fromCharCode(65 + i)
// Display words only; what a role may do always comes from the contracts.
export const ROLE_WORDS: Record<Role, string> = {
  manager: 'park manager',
  engineer: 'engineer',
  reviewer: 'reviewer',
  installer: 'installer',
  crew: 'walk crew',
  gm: 'township general manager',
  pilot: 'pilot',
  integrator: 'integrator',
  agent: 'automated agent',
  system: 'system',
  provider: 'provider'
}
// The seed names carry the role in brackets, and the page shows the role beside the name already.
export const plain = (name: string) => name.replace(/\s*\([^)]*\)$/, '')
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const quoteWords = (q: Remedy['quote']) =>
  q === 'quote_needed' ? 'quote needed' : `${q.currency} ${q.amount} quoted ${q.date}`

/** A work-order quantity as a bill of quantities reads it: the item, then how much ("Fence panel 2.4 m: 1 panel"). */
export const quantityWords = (q: Remedy['quantities'][number]) => `${q.item}: ${q.amount} ${q.unit}`

/** The remedy IDs proposed in this session, per segment. Core has no list of remedies, so the screen keeps the IDs only. */
const proposed: Record<string, string[]> = {}
onReset(() => {
  for (const k of Object.keys(proposed)) delete proposed[k]
})
export const addProposed = (segmentId: string, id: string) => {
  const ids = (proposed[segmentId] ??= [])
  if (!ids.includes(id)) ids.push(id)
}
export const removeProposed = (segmentId: string, id: string) => {
  proposed[segmentId] = (proposed[segmentId] ?? []).filter((x) => x !== id)
}

export type Lens = { base: RouteClosure; per: Record<string, RouteClosure> }

/** A refusal from core says in plain words, record ids become their names on screen. */
export const plainReason = (message: string, names: Record<string, string>) =>
  message.replace(/\b[a-z]+_[A-Za-z0-9]+\b/g, (id) => names[id] ?? 'another record')

export function recordNames(lens: Lens, users: User[]): Record<string, string> {
  const names: Record<string, string> = {}
  lens.base.openings.forEach((o, index) => {
    names[o.id] = `Opening ${index + 1}, ${OPENING_LABEL[o.type]}`
  })
  lens.base.routes.forEach((r) => {
    names[r.id] = r.fromFeature.label
  })
  lens.base.remedies.forEach((r, index) => {
    names[r.id] = `fix ${letter(index)}`
  })
  users.forEach((u) => {
    names[u.id] = plain(u.name)
  })
  return names
}

/**
 * Everything on screen is read back from core: one preview with every remedy proposed here (the openings, routes and
 * remedy details) and one preview per remedy (what that fix alone would do).
 */
export function useLens(segmentId: string, sentRemedyId: string | null) {
  const [lens, setLens] = useState<Lens | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => onReset(reload), [reload])
  useEffect(() => {
    let live = true
    if (sentRemedyId) addProposed(segmentId, sentRemedyId)
    const ids = [...(proposed[segmentId] ?? [])]
    const preview = (remedyIds: string[]) =>
      client().previewRouteClosure({ params: { id: segmentId }, body: { remedyIds } })
    Promise.all([preview(ids), Promise.all(ids.map(async (id) => [id, await preview([id])] as const))]).then(
      ([base, per]) => live && (setError(null), setLens({ base, per: Object.fromEntries(per) })),
      (e) => live && setError(e instanceof Error ? e : new Error(String(e)))
    )
    return () => {
      live = false
    }
  }, [segmentId, sentRemedyId, version])
  return { lens, error, reload }
}

/** Runs a write and says whether core accepted it; a refusal is shown with its rule, anything else is a bug and is thrown. */
export function useRun(reload: () => void, names: Record<string, string> = {}) {
  const [refusal, setRefusal] = useState<{ text: string; rule: string; message: string } | null>(null)
  const run = async (call: () => Promise<unknown>): Promise<boolean> => {
    setRefusal(null)
    let accepted = true
    try {
      await call()
    } catch (error) {
      if (!(error instanceof SafeEdgeDeniedError)) throw error
      setRefusal({
        text: `Could not complete this: ${plainReason(error.message, names)}.`,
        rule: error.rule,
        message: error.message
      })
      accepted = false
    }
    reload()
    await refresh()
    return accepted
  }
  // `denied` keeps the one-line form the re-test screens show; Fix Lens shows `refusal` in plain words.
  const denied = refusal && `Core refused this (${refusal.rule}): ${refusal.message}`
  return { run, denied, refusal }
}
