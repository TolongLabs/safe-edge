import type { Candidate, EdgePass } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { can, client, onReset, useStore } from '../../store'

export type Clearable = { candidateId: string; title: string; status: 'rejected' | 'needs_recapture' }

/**
 * Flags this page already cleared. Core keeps a cleared flag's own status (rejected or needs_recapture) as it was,
 * so without this a cleared flag would be offered again while another flag still holds the pass.
 */
const cleared = new Set<string>()
onReset(() => cleared.clear())
export const markCleared = (candidateId: string) => void cleared.add(candidateId)

/** A Tier 2 flag the manager rejected or sent to "Look again", on a segment whose pass is suspended, not yet cleared. */
export const isClearable = (c: Candidate, passes: EdgePass[]) =>
  c.tier === 2 &&
  (c.status === 'rejected' || c.status === 'needs_recapture') &&
  !cleared.has(c.id) &&
  passes.some((p) => p.segmentId === c.segmentId && p.state === 'suspended')

/**
 * The false alarms waiting for a clearance re-test.
 * shortcut: a reviewer cannot list candidates, so only the flags this page raised (the keys of `metas`) are found;
 * upgrade when core gives reviewers a list of open suspicions.
 */
export function useClearable() {
  const s = useStore().snapshot!
  const allowed = can('getCandidate')
  // Roles that may not read candidates have nothing to wait for.
  const [found, setFound] = useState<Clearable[] | null>(allowed ? null : [])
  const [error, setError] = useState<Error | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    if (!allowed) {
      setFound([])
      return
    }
    Promise.all(
      [...new Set([...Object.keys(s.metas), ...s.damageReports.map((report) => report.candidateId)])].map((id) =>
        client().getCandidate({ params: { id } })
      )
    ).then(
      (all) =>
        live &&
        (setError(null),
        setFound(
          all.flatMap(({ candidate: c }) =>
            isClearable(c, s.passes)
              ? [
                  {
                    candidateId: c.id,
                    title:
                      s.metas[c.id]?.title ??
                      s.damageReports.find((report) => report.candidateId === c.id)?.description ??
                      c.rationale,
                    status: c.status as Clearable['status']
                  }
                ]
              : []
          )
        )),
      (e) => live && setError(e instanceof Error ? e : new Error(String(e)))
    )
    return () => {
      live = false
    }
  }, [s, allowed, version])
  return { found, error, retry: () => setVersion((v) => v + 1) }
}
