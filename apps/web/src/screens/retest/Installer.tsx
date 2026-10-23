import type { Finding, Remedy, RouteClosure, WorkOrder, WorkOrderProgress } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import type { Scene } from '../../scenes'
import { Photo } from '../fix-lens/Photo'
import { OPENING_LABEL, quantityWords, useRun } from '../fix-lens/lens'
import { client } from '../../store'
import { sampleEvidence } from './useRepair'

const asIso = (date: string) => (date === '' ? null : new Date(`${date}T00:00:00.000Z`).toISOString())
const datePart = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

/** The installer's steps: start, say where the repair is, change the finish date, then record it as done. */
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
  scene: Scene | null
}) {
  const [note, setNote] = useState('')
  const { run, denied } = useRun(() => undefined)
  const started = workOrder.status === 'in_progress'
  const id = { params: { id: workOrder.id } }

  const [progress, setProgress] = useState<WorkOrderProgress>(workOrder.progress ?? 'buying_materials')
  const [expectedDate, setExpectedDate] = useState(datePart(workOrder.expectedDeliveryAt))
  const [tracking, setTracking] = useState(workOrder.trackingNumber ?? '')
  const [noTracking, setNoTracking] = useState(workOrder.noTracking ?? false)
  const [newDueDate, setNewDueDate] = useState(datePart(workOrder.dueAt))
  const [dueReason, setDueReason] = useState('')
  const [spent, setSpent] = useState('')
  const [overspendReason, setOverspendReason] = useState('')

  useEffect(() => {
    setProgress(workOrder.progress ?? 'buying_materials')
    setExpectedDate(datePart(workOrder.expectedDeliveryAt))
    setTracking(workOrder.trackingNumber ?? '')
    setNoTracking(workOrder.noTracking ?? false)
    setNewDueDate(datePart(workOrder.dueAt))
  }, [workOrder])

  const noNote = note.trim() === ''
  const spentText = spent.trim()
  const spentAmount = spentText === '' ? null : Number(spentText)
  const spentInvalid = spentAmount !== null && (!Number.isFinite(spentAmount) || spentAmount < 0)
  const estimate = remedy && remedy.quote !== 'quote_needed' ? remedy.quote.amount : null
  const overEstimate =
    spentAmount !== null && !spentInvalid && estimate !== null && estimate > 0 && spentAmount > estimate * 1.2
  const needsOverspendReason = overEstimate && overspendReason.trim() === ''
  const spentQuote =
    spentAmount !== null && !spentInvalid
      ? { amount: spentAmount, currency: 'MYR', date: new Date().toISOString().slice(0, 10) }
      : null
  const canComplete = !noNote && !spentInvalid && !needsOverspendReason

  const saveProgress = () =>
    run(() =>
      client().updateWorkOrderProgress({
        ...id,
        body: {
          progress,
          expectedDeliveryAt: asIso(expectedDate),
          trackingNumber: noTracking || tracking.trim() === '' ? null : tracking.trim(),
          noTracking
        }
      })
    )

  const changeDueDate = () =>
    run(() =>
      client().changeWorkOrderDueDate({
        ...id,
        body: { dueAt: asIso(newDueDate) ?? new Date().toISOString(), reason: dueReason.trim() }
      })
    )

  const complete = () =>
    run(() =>
      client().completeWorkOrder({
        ...id,
        body: {
          evidence: [sampleEvidence(`evd_sample_${workOrder.id}_done`)],
          note: note.trim(),
          ...(spentQuote ? { spent: spentQuote } : {}),
          ...(overspendReason.trim() !== '' ? { overspendReason: overspendReason.trim() } : {})
        }
      })
    )

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
                <li key={q.item}>{quantityWords(q)}</li>
              ))}
            </ul>
            {scene && (
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
            )}
            <p>Acceptance test: {remedy.acceptanceTest}</p>
          </>
        )}

        {started && (
          <>
            <div className="rt-progress">
              <label className="rt-field">
                <span>Repair progress</span>
                <select value={progress} onChange={(e) => setProgress(e.target.value as WorkOrderProgress)}>
                  <option value="buying_materials">Buying materials</option>
                  <option value="waiting_for_delivery">Waiting for delivery</option>
                  <option value="fixing">Fixing</option>
                </select>
              </label>
              <label className="rt-field">
                <span>Expected delivery date</span>
                <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </label>
              <label className="rt-field">
                <span>Shipment tracking number</span>
                <input
                  value={noTracking ? '' : tracking}
                  disabled={noTracking}
                  placeholder={noTracking ? 'Not needed' : ''}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
              <label className="rt-check">
                <input
                  type="checkbox"
                  checked={noTracking}
                  onChange={(e) => {
                    setNoTracking(e.target.checked)
                    if (e.target.checked) setTracking('')
                  }}
                />
                <span>The supplier gave no tracking number</span>
              </label>
              <button className="btn" type="button" onClick={() => void saveProgress()}>
                Save progress
              </button>
            </div>

            <div className="rt-progress">
              <label className="rt-field">
                <span>New finish date</span>
                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </label>
              <label className="rt-field">
                <span>Reason for changing finish date</span>
                <input value={dueReason} onChange={(e) => setDueReason(e.target.value)} />
              </label>
              <button
                className="btn"
                type="button"
                disabled={newDueDate === '' || dueReason.trim() === ''}
                onClick={() => void changeDueDate()}
              >
                Change finish date
              </button>
            </div>

            <label className="rt-field">
              <span>Note for the person who checks it</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </label>

            <div className="rt-progress">
              <label className="rt-field">
                <span>Amount spent (RM)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={spent}
                  onChange={(e) => setSpent(e.target.value)}
                />
              </label>
              {spentInvalid && <p className="rt-error">Enter the amount spent in ringgit, or leave it blank.</p>}
              {estimate !== null && (
                <p className="rt-help">
                  Estimate: RM {estimate.toLocaleString('en-MY')}.
                  {overEstimate && ' This is more than 20% over the estimate.'}
                </p>
              )}
              {overEstimate && (
                <label className="rt-field">
                  <span>Reason for spending more</span>
                  <textarea value={overspendReason} onChange={(e) => setOverspendReason(e.target.value)} rows={2} />
                </label>
              )}
            </div>
          </>
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
            disabled={!canComplete}
            aria-describedby="rt-done-why"
            onClick={() => void complete()}
          >
            Mark work complete
          </button>
        )}
        <p id="rt-done-why" className="rt-status" role="status">
          {!started
            ? 'Once you start, the repair shows as in progress.'
            : noNote
              ? 'Write a note first.'
              : spentInvalid
                ? 'Enter the amount spent in ringgit, or leave it blank.'
                : needsOverspendReason
                  ? 'Say why the repair cost more than the estimate.'
                  : 'A different person checks the repair.'}
        </p>
      </div>
    </section>
  )
}
