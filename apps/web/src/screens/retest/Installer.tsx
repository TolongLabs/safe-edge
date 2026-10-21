import type { Finding, Remedy, RouteClosure, WorkOrder } from '@safe-edge/contracts'
import { useState } from 'react'
import type { Scene } from '../../scenes'
import { Photo } from '../fix-lens/Photo'
import { OPENING_LABEL, useRun } from '../fix-lens/lens'
import { client } from '../../store'
import { sampleEvidence } from './useRepair'

/** The installer's two steps: start the repair, then record it as done with a note and a sample photo. */
export function Installer({
  workOrder,
  remedy,
  closure,
  finding,
  scene
}: {
  workOrder: WorkOrder
  remedy: Remedy | undefined
  closure: RouteClosure
  finding: Finding
  scene: Scene
}) {
  const [note, setNote] = useState('')
  const { run, denied } = useRun(() => undefined)
  const started = workOrder.status === 'in_progress'
  const id = { params: { id: workOrder.id } }
  const noNote = note.trim() === ''
  return (
    <section className="rt-work" aria-label="Your repair">
      <div className="rt-card">
        <h2>{started ? 'Repair started' : 'Repair waiting to start'}</h2>
        {remedy && (
          <>
            <p>
              <b>{remedy.label}</b>
            </p>
            <ul className="rt-quantities">
              {remedy.quantities.map((q) => (
                <li key={q.item}>
                  {q.amount} {q.unit} · {q.item}
                </li>
              ))}
            </ul>
            <Photo
              scene={scene}
              when={`Finding ${new Date(finding.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
              plates={closure.openings.flatMap((o, n) => {
                const mark = o.photoMarks[0]
                const blocked = remedy.blocksOpeningIds.includes(o.id)
                return mark
                  ? [
                      {
                        key: o.id,
                        text: `${n + 1} ${OPENING_LABEL[o.type]}`,
                        x: mark.x,
                        y: mark.y,
                        name: `${blocked ? 'Work at' : 'Not blocked by this fix:'} opening ${n + 1}, ${OPENING_LABEL[o.type]}`,
                        dashed: blocked
                      }
                    ]
                  : []
              })}
            />
            <p>Acceptance test: {remedy.acceptanceTest}</p>
          </>
        )}
        {started && (
          <label className="rt-field">
            <span>Note for the person who checks it</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
        )}
      </div>
      <div className="rt-bar">
        {denied && (
          <p role="alert" className="rt-error">
            {denied}
          </p>
        )}
        {!started ? (
          <button className="btn primary" onClick={() => void run(() => client().startWorkOrder(id))}>
            Start work
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={noNote}
            aria-describedby="rt-done-why"
            onClick={() =>
              void run(() =>
                client().completeWorkOrder({
                  ...id,
                  body: { evidence: [sampleEvidence(`evd_sample_${workOrder.id}_done`)], note: note.trim() }
                })
              )
            }
          >
            Mark work complete
          </button>
        )}
        <p id="rt-done-why" className="rt-status" role="status">
          {!started
            ? 'Once you start, the repair shows as in progress.'
            : noNote
              ? 'Write a note first.'
              : 'A different person checks the repair.'}
        </p>
      </div>
    </section>
  )
}
