import type { Opening, RetestCheck, RetestOutcome } from '@safe-edge/contracts'
import { Check, X } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Scene } from '../../scenes'
import { Photo } from '../fix-lens/Photo'
import { useRun } from '../fix-lens/lens'
import { OPEN_FLAG_RULE } from './names'

type Item = {
  key: string
  kind: RetestCheck['kind']
  subjectId: string | null
  title: string
  opening?: Opening
}
type Answer = { result?: 'pass' | 'fail'; reason: string }

export type { Item }

/** The reviewer's checks: a result and a reason for every one, then the pinned action bar. Used by the repair re-test and the clearance. */
export function CheckForm({
  items,
  intro,
  scene,
  simulated,
  acceptance,
  signLabel,
  failLabel,
  rule = OPEN_FLAG_RULE,
  record,
  onDone
}: {
  items: Item[]
  intro: string
  scene: Scene
  simulated: boolean
  acceptance?: string
  signLabel: string
  failLabel: string
  rule?: string
  record: (result: 'accepted' | 'rejected', checklist: RetestCheck[], reason: string) => Promise<RetestOutcome>
  onDone: (outcome: RetestOutcome) => void
}) {
  // The sample reading is the mockup's 6 cm; the caption says it is not measured.
  const SAMPLE_CM = '6'
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [cm, setCm] = useState<Record<string, string>>({})
  const { run, denied } = useRun(() => undefined)
  const [busy, setBusy] = useState(false)
  const answer = (k: string): Answer => answers[k] ?? { reason: '' }
  const put = (k: string, patch: Partial<Answer>) => setAnswers({ ...answers, [k]: { ...answer(k), ...patch } })
  const reading = (it: Item) => cm[it.key] ?? SAMPLE_CM
  const badReading = (it: Item) =>
    it.opening !== undefined &&
    !(reading(it).trim() !== '' && Number.isFinite(Number(reading(it))) && Number(reading(it)) >= 0)

  const unanswered = items.filter((i) => answer(i.key).result === undefined).length
  const noReason = items.filter((i) => answer(i.key).result !== undefined && answer(i.key).reason.trim() === '').length
  const bad = items.filter(badReading).length
  const failed = items.filter((i) => answer(i.key).result === 'fail').length
  const passed = items.filter((i) => answer(i.key).result === 'pass').length
  const complete = unanswered === 0 && noReason === 0 && bad === 0
  const why =
    unanswered > 0
      ? `Choose Pass or Fail for ${unanswered} more ${unanswered === 1 ? 'check' : 'checks'}.`
      : noReason > 0
        ? `Write a reason for ${noReason} more ${noReason === 1 ? 'check' : 'checks'}.`
        : bad > 0
          ? 'Fix the gauge reading: it must be a number of centimetres.'
          : failed > 0
            ? `A failed check cannot be signed as a pass. Use ${failLabel}.`
            : null

  async function submit(result: 'accepted' | 'rejected') {
    const checklist: RetestCheck[] = items.map((i) => ({
      kind: i.kind,
      subjectId: i.subjectId,
      result: answer(i.key).result!,
      reason: answer(i.key).reason.trim(),
      measuredMm: i.opening ? Math.round(Number(reading(i)) * 10) : null
    }))
    const reason =
      result === 'accepted'
        ? `${passed} of ${items.length} checks passed`
        : `Failed: ${items
            .filter((i) => answer(i.key).result === 'fail')
            .map((i) => `${i.title}, ${answer(i.key).reason.trim()}`)
            .join('; ')}`
    setBusy(true)
    try {
      let outcome: RetestOutcome | null = null
      const ok = await run(async () => {
        outcome = await record(result, checklist, reason)
      })
      if (ok && outcome) onDone(outcome)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rt-checks" aria-label="Checks">
      <p className="rt-fixed">{intro}</p>
      <div className="rt-card">
        <h2>{items.length} checks at the fence</h2>
        <ol className="rt-items">
          {items.map((it) => {
            const a = answer(it.key)
            return (
              <li key={it.key} className="rt-item">
                <fieldset>
                  <legend>{it.title}</legend>
                  {it.kind === 'saved_view' && <p className="rt-help">Compare with the baseline view.</p>}
                  {it.kind === 'route_check' && <p className="rt-help">Is this way to the water closed now?</p>}
                  {it.kind === 'photo' && (
                    <Photo scene={scene} plates={[]} caption={{ when: 'Re-test photo', simulated }} />
                  )}
                  {it.opening && (
                    <>
                      <label className="rt-field">
                        <span>{it.title} reading</span>
                        <span className="rt-number">
                          <input
                            inputMode="decimal"
                            value={reading(it)}
                            aria-invalid={badReading(it)}
                            onChange={(e) => setCm({ ...cm, [it.key]: e.target.value })}
                          />
                          <span className="rt-unit">cm</span>
                        </span>
                      </label>
                      {badReading(it) && (
                        <p className="rt-error" role="alert">
                          Enter the gap as a number of centimetres.
                        </p>
                      )}
                      {reading(it) === SAMPLE_CM && <p className="rt-help">Sample reading, not measured on site</p>}
                      {acceptance && <p className="rt-help">Acceptance test: {acceptance}</p>}
                    </>
                  )}
                  <div className="rt-pf" role="radiogroup" aria-label={`${it.title} result`}>
                    {(['pass', 'fail'] as const).map((r) => (
                      <label key={r} className={`rt-seg ${r}${a.result === r ? ' on' : ''}`}>
                        <input
                          type="radio"
                          name={it.key}
                          aria-label={r === 'pass' ? 'Pass' : 'Fail'}
                          checked={a.result === r}
                          onChange={() => put(it.key, { result: r })}
                        />
                        {r === 'pass' ? (
                          <Check size={20} weight="bold" aria-hidden="true" />
                        ) : (
                          <X size={20} weight="bold" aria-hidden="true" />
                        )}
                        <span>{r === 'pass' ? 'Pass' : 'Fail'}</span>
                      </label>
                    ))}
                  </div>
                  <label className="rt-field">
                    <span>Reason for {it.title}</span>
                    <input value={a.reason} onChange={(e) => put(it.key, { reason: e.target.value })} />
                  </label>
                </fieldset>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="rt-bar">
        <p className="rt-help">{rule}</p>
        {why && (
          <p id="rt-why" className="rt-help">
            {why}
          </p>
        )}
        {denied && (
          <p role="alert" className="rt-error">
            {denied}
          </p>
        )}
        <div className="rt-buttons">
          <button
            className="btn primary"
            disabled={!complete || failed > 0 || busy}
            aria-describedby="rt-why"
            onClick={() => void submit('accepted')}
          >
            {signLabel}
          </button>
          {failed > 0 && (
            <button className="btn danger" disabled={!complete || busy} onClick={() => void submit('rejected')}>
              {failLabel}
            </button>
          )}
        </div>
        <p className="rt-status" role="status">
          {passed} of {items.length} checks passed
        </p>
      </div>
    </section>
  )
}
