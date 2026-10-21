import { WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { NotInSession, Screen } from '../../shell/Shell'
import { SafeEdgeApiError } from '@safe-edge/sdk'
import type { CandidateEvidence, RetestOutcome } from '@safe-edge/contracts'
import { can, client, useStore } from '../../store'
import { must } from '../fix-lens/lens'
import { CheckForm, type Item } from './CheckForm'
import { Held } from './Held'
import { sampleEvidence } from './useRepair'
import { isClearable, markCleared } from './useClearable'
import './retest.css'

/** `#/retest/<candidateId>`: a reviewer checks the edge of a flag the manager called a false alarm. */
export function Clearance({ candidateId }: { candidateId: string }) {
  const s = useStore().snapshot!
  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [missing, setMissing] = useState(false)
  const [version, setVersion] = useState(0)
  const [done, setDone] = useState<RetestOutcome | null>(null)
  // Only some roles may read a flag; the rest see who checks it without its details.
  const readable = can('getCandidate')
  useEffect(() => {
    if (!readable) return
    let live = true
    setError(null)
    client()
      .getCandidate({ params: { id: candidateId } })
      .then(
        (e) => live && setEvidence(e),
        (e) => {
          if (!live) return
          if (e instanceof SafeEdgeApiError && (e.status === 404 || e.error === 'invalid_input')) setMissing(true)
          else setError(e instanceof Error ? e : new Error(String(e)))
        }
      )
    return () => {
      live = false
    }
  }, [candidateId, version, readable])
  const frame = (context: string, body: React.ReactNode) => (
    <Screen title="Check a false alarm" context={context}>
      <main className="detail island rt-main">{body}</main>
    </Screen>
  )
  if (!readable)
    return frame(
      'A false alarm',
      <div className="rt-card">
        <h2>A reviewer checks this false alarm</h2>
        <p>Your role cannot open this flag's details. A reviewer checks the edge and signs.</p>
        <a className="btn" href="#/retest">
          Back to the list
        </a>
      </div>
    )
  if (missing) return <NotInSession />
  if (error)
    return frame(
      'Could not load',
      <div className="banner error" role="alert">
        <WarningCircle size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>Could not load this flag.</b> {error.message}. Nothing was changed.
        </span>
        <button className="btn small" onClick={() => setVersion(version + 1)}>
          Try again
        </button>
      </div>
    )
  if (!evidence)
    return frame(
      'Loading the flag',
      <div className="rt-skel" role="status">
        <p className="rt-help">Loading the flag</p>
        <i />
        <i />
      </div>
    )
  const { candidate, segment } = evidence
  const meta = must(s.metas[candidate.id], `sample details for ${candidate.id}`)
  const pass = s.passes.find((p) => p.segmentId === candidate.segmentId)
  const clearable = isClearable(candidate, s.passes)
  const context = `${meta.title} · ${segment.name}`
  if (done) {
    return frame(
      context,
      <div className="rt-card">
        <h2>{done.retest.result === 'accepted' ? 'False alarm checked' : 'The pass stays held'}</h2>
        {done.retest.result === 'accepted' ? (
          <Held pass={pass} s={s} />
        ) : (
          <>
            <p>A check failed, so the edge stays under suspicion. A manager decides what happens next in the Inbox.</p>
            <a className="btn" href="#/inbox">
              Back to Inbox
            </a>
          </>
        )}
      </div>
    )
  }
  if (!clearable)
    return frame(
      context,
      <div className="rt-card">
        <h2>Nothing to check here</h2>
        <p>
          This flag is not waiting for a clearance check. It is {candidate.status.replace('_', ' ')} and the pass is{' '}
          {pass?.state ?? 'unknown'}.
        </p>
        <a className="btn" href="#/retest">
          Back to the list
        </a>
      </div>
    )
  if (!can('recordClearance'))
    return frame(
      context,
      <div className="rt-card">
        <h2>A reviewer checks this false alarm</h2>
        <p>
          The park manager called {meta.title} not a problem, or asked to look again. The safety pass for this edge
          stays paused until a reviewer checks it. You can read it here; you cannot sign it.
        </p>
      </div>
    )
  const items: Item[] = [
    ...segment.viewpoints.map((v, i) => ({
      key: `vp:${v.id}`,
      kind: 'saved_view' as const,
      subjectId: v.id,
      title: `Saved view ${i + 1}`
    })),
    { key: 'photo', kind: 'photo' as const, subjectId: null, title: 'Re-test photo' }
  ]
  return frame(
    context,
    <>
      <p className="rt-help">
        {segment.name} · {candidate.status === 'rejected' ? 'marked not a problem' : 'sent to look again'}
        {candidate.simulated && ' · simulated'}
      </p>
      <CheckForm
        items={items}
        intro={`The park manager called ${meta.title} a false alarm. You did not decide it, so you can check it.`}
        scene={meta.scene}
        simulated={candidate.simulated}
        signLabel="Sign and clear this flag"
        failLabel="Keep the pass held"
        rule="Signing clears this flag. A held pass is issued once no other flag on this edge is open."
        record={(result, checklist, reason) =>
          client().recordClearance({
            params: { id: candidate.id },
            body: { checklist, evidence: [sampleEvidence(`evd_sample_${candidate.id}_clearance`)], result, reason }
          })
        }
        onDone={(out) => {
          if (out.retest.result === 'accepted') markCleared(candidate.id)
          if (out.pass) window.location.hash = `#/passes/${out.pass.id}`
          else setDone(out)
        }}
      />
    </>
  )
}
