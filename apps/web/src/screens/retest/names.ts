import { SafeEdgeApiError, SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'
import { client, type Snapshot } from '../../store'
import { must } from '../fix-lens/lens'

/** Shown wherever a pass could be held; core issues a pass only when no other suspicion is open on the segment. */
export const OPEN_FLAG_RULE =
  'A pass is issued only if no other flag on this edge is still open. A manager decides open flags in the Inbox.'

/** Names of flags this page did not raise (a drone flag or a missed patrol), by their id; see `useFlagNames`. */
export type FlagNames = Record<string, string>

const flagIds = (text: string) => text.match(/(?:cand|fnd)_\w+/g) ?? []
const candidateOf = (id: string, s: Snapshot) =>
  id.startsWith('fnd_') ? s.findings.find((f) => f.id === id)?.candidateId : id
const sampleTitle = (id: string, s: Snapshot) => {
  const candidateId = candidateOf(id, s)
  return candidateId === undefined ? undefined : s.metas[candidateId]?.title
}

/**
 * Names the flags in a reason that the page did not raise, through `getCandidate`, by their class in plain words.
 * Null while they load. A flag the person may not read is named only "Another flag".
 */
export function useFlagNames(text: string | null, s: Snapshot): FlagNames | null {
  const unknown = flagIds(text ?? '').filter((id) => sampleTitle(id, s) === undefined)
  const key = unknown.join(',')
  const [names, setNames] = useState<{ key: string; names: FlagNames } | null>(null)
  useEffect(() => {
    let live = true
    Promise.all(
      unknown.map(async (id) => {
        try {
          const candidateId = candidateOf(id, s) ?? (await client().getFinding({ params: { id } })).candidateId
          const { candidate } = await client().getCandidate({ params: { id: candidateId } })
          return [id, candidate.class === 'missed_patrol' ? 'Missed patrol' : 'Drone flag'] as const
        } catch (e) {
          if (
            e instanceof SafeEdgeDeniedError ||
            (e instanceof SafeEdgeApiError && (e.status === 403 || e.status === 404))
          )
            return [id, 'Another flag'] as const
          throw e
        }
      })
    ).then(
      (pairs) => live && setNames({ key, names: Object.fromEntries(pairs) }),
      (e) =>
        live &&
        setNames(() => {
          throw e
        })
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `unknown`
  }, [key])
  return unknown.length === 0 ? {} : names?.key === key ? names.names : null
}

/** Core's own words name records by id; the screens show their plain names instead. */
export function plainReason(text: string, s: Snapshot, names: FlagNames): string {
  const flag = (id: string) => must(sampleTitle(id, s) ?? names[id], `a name for ${id}`)
  return text
    .replace(/(?:cand|fnd)_\w+/g, (id) => flag(id))
    .replace(/[Rr]e-test rt_\w+/g, 'the re-test')
    .replace(/seg_\w+/g, 'this part of the lake edge')
    .replace(/\b(wo|rt|pass)_\w+/g, 'this record')
}

/** The flags a held pass names, by their plain titles. */
export function openFlags(reason: string | null, s: Snapshot, names: FlagNames): string[] {
  return flagIds(reason ?? '').map((id) => plainReason(id, s, names))
}

const ACTIONS: Record<string, string> = {
  raiseCandidate: 'Drone spotted something',
  decideCandidate: 'Confirmed: needs a fix',
  completeTask: 'Interim protection done',
  createOpening: 'Opening marked',
  createRoute: 'Way to the water recorded',
  createRemedy: 'Fix proposed',
  approveRemedy: 'Engineer approved the fix',
  submitWorkOrder: 'Fix sent to the crew',
  startWorkOrder: 'Repair started',
  completeWorkOrder: 'Repair marked done',
  recordRetest: 'Checked and signed'
}
const camel = (a: string) => {
  const t = a.replace(/([A-Z])/g, ' $1').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const actionWords = (action: string) => ACTIONS[action] ?? camel(action)
