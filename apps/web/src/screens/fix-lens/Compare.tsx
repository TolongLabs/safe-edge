import { CheckCircle, Circle, LockSimple, Prohibit, Trash, XCircle } from '@phosphor-icons/react'
import { RemedyType, type Finding, type Remedy, type WorkOrder } from '@safe-edge/contracts'
import { useState } from 'react'
import { can, client, useSignedIn, useStore } from '../../store'
import {
  OPENING_LABEL,
  REMEDY_LABEL,
  addProposed,
  letter,
  must,
  plain,
  quoteWords,
  recordNames,
  removeProposed,
  useRun,
  type Lens
} from './lens'
import { PlanDrawing } from './PlanDrawing'

type Closure = Lens['per'][string]

/** The result line, counted from the routes core returns; an unknown way is never counted as closed. */
function result(c: Closure) {
  const open = c.routes.filter((r) => r.projectedStatus === 'open')
  const unknown = c.routes.filter((r) => r.projectedStatus === 'unknown')
  const ways = (n: number) => `${n} ${n === 1 ? 'way' : 'ways'}`
  const names = (rs: typeof open) => rs.map((r) => r.fromFeature.label).join('; ')
  if (c.routes.length === 0)
    return { tone: 'unknown', text: 'No ways to the water are recorded, so nothing is shown closed' }
  if (open.length > 0)
    return {
      tone: 'open',
      text: `Leaves ${ways(open.length)} to the water open, ${names(open)}${unknown.length ? `; ${unknown.length} not known` : ''}`
    }
  if (unknown.length > 0)
    return {
      tone: 'unknown',
      text: `Not known: ${ways(unknown.length)} to the water could not be shown closed, ${names(unknown)}`
    }
  return {
    tone: 'closed',
    text: `Closes all ${c.routes.length} ${c.routes.length === 1 ? 'way' : 'ways'} to the water`
  }
}

const summary = (r: Remedy) =>
  `${r.quantities.map((q) => `${q.amount} ${q.unit} ${q.item}`).join(' and ') || 'no quantities'} · ${quoteWords(r.quote)}`

/** Step 2: one option card per proposed fix, with the engineer's approval and the send action. */
export function Compare({
  finding,
  lens,
  reload,
  workOrder,
  failed,
  chosen,
  setChosen,
  onSent
}: {
  finding: Finding
  lens: Lens
  reload: () => void
  workOrder: WorkOrder | null
  /** The newest order a re-test rejected, when the finding has no current order: a new one is made on send. */
  failed: WorkOrder | null
  chosen: string | null
  setChosen: (id: string) => void
  onSent: () => void
}) {
  const { snapshot } = useStore()
  const { user } = useSignedIn()
  const s = snapshot!
  const names = recordNames(lens, s.users)
  const { run, refusal } = useRun(reload, names)
  const { openings, remedies } = lens.base
  const name = (id: string) =>
    plain(
      must(
        s.users.find((u) => u.id === id),
        `user ${id}`
      ).name
    )
  const installers = s.users.filter((u) => u.role === 'installer')
  const [installerId, setInstallerId] = useState(must(installers[0], 'an installer in the seed users').id)
  const [due, setDue] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10))
  // Malaysia time, so the minimum due date does not lag behind the park's own day.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const sent = workOrder !== null && workOrder.status !== 'draft'
  const index = remedies.findIndex((r) => r.id === chosen)
  const pick = remedies[index]
  const maySend = can('updateWorkOrder') && can('submitWorkOrder')
  const reason = sent
    ? null
    : !pick
      ? 'Choose a fix first.'
      : pick.engineerApprovedBy === null
        ? `An engineer must approve fix ${letter(index)} first.`
        : finding.status !== 'interim_protected' && finding.status !== 'reopened'
          ? 'Interim protection must be done first.'
          : !due
            ? 'Choose a due date.'
            : due < today
              ? 'Choose a due date from today on.'
              : null
  const failedIndex = failed ? remedies.findIndex((r) => r.id === failed.remedyId) : -1
  const [sampling, setSampling] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const sampleFixes = () => {
    setSampling(true)
    setSampleError(null)
    void run(async () => {
      const gap = must(
        openings.find((o) => o.type === 'fence_gap'),
        'the panel gap opening'
      )
      const end = must(
        openings.find((o) => o.type === 'fence_end'),
        'the fence end opening'
      )
      const a = await client().createRemedy({
        body: {
          segmentId: finding.segmentId,
          type: 'panel_replacement',
          label: 'Replace panel 4',
          blocksOpeningIds: [gap.id],
          quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
          acceptanceTest: 'No gap over 100 mm at panel 4',
          quote: 'quote_needed'
        }
      })
      addProposed(finding.segmentId, a.id)
      const b = await client().createRemedy({
        body: {
          segmentId: finding.segmentId,
          type: 'barrier_extension',
          label: 'Replace panel 4 and extend the fence end to the headwall',
          blocksOpeningIds: [gap.id, end.id],
          quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
          acceptanceTest: 'No gap over 100 mm along the run and around both fence ends',
          quote: 'quote_needed'
        }
      })
      addProposed(finding.segmentId, b.id)
    })
      .then(
        () => undefined,
        (e: unknown) => setSampleError(e instanceof Error ? e.message : String(e))
      )
      // Re-read core even after a failure halfway, so the screen shows what was recorded and the button cannot repeat it.
      .finally(() => {
        setSampling(false)
        reload()
      })
  }
  // The sample fixes block the S2 panel gap and fence end, so they are offered only when both are marked.
  const sampleFits = openings.some((o) => o.type === 'fence_gap') && openings.some((o) => o.type === 'fence_end')

  return (
    <div className="fl-compare">
      <h2 className="fl-question">Which fix closes every way to the water?</h2>
      <p className="fl-muted">Fix Lens follows each way a child could walk from the play area to the lake.</p>
      {failed && (
        <p className="banner info" role="status">
          {failedIndex < 0 ? 'The last fix' : `Fix ${letter(failedIndex)}`} failed its re-test. Choose a fix again.
        </p>
      )}
      {refusal && (
        <p className="state bad fl-refusal" role="alert">
          {refusal.text} <small>(rule: {refusal.rule})</small>
        </p>
      )}
      {remedies.length === 0 && (
        <div className="empty-state left">
          <h3>No fixes proposed yet</h3>
          <p>
            {can('createRemedy')
              ? 'Propose a fix below. Each fix is checked against every recorded way to the water.'
              : 'A park manager or engineer proposes the fixes to compare.'}
          </p>
          {can('createRemedy') && sampleFits && (
            <div className="fl-sample">
              <button className="btn" type="button" disabled={sampling} onClick={sampleFixes}>
                Use the two sample fixes
              </button>
              <p className="fl-muted">Sample fixes for the playground fence; prices are not quoted.</p>
              {sampleError !== null && (
                <p className="state bad" role="alert">
                  {sampleError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="fl-options" role="radiogroup" aria-label="Fixes to compare">
        {remedies.map((r, i) => {
          const c = must(lens.per[r.id], `preview of ${r.id}`)
          const stillOpen = c.routes.filter((x) => x.projectedStatus === 'open')
          const res = result(c)
          const L = letter(i)
          return (
            <div key={r.id} className={`fl-option${r.id === chosen ? ' chosen' : ''}`}>
              <label className="fl-option-head">
                <input
                  type="radio"
                  name="fix"
                  checked={r.id === chosen}
                  disabled={sent && r.id !== chosen}
                  onChange={() => setChosen(r.id)}
                  aria-describedby={failed?.remedyId === r.id ? `failed-${r.id}` : undefined}
                />
                {L} · {r.label}
              </label>
              {failed?.remedyId === r.id && (
                <p className="fl-failed" id={`failed-${r.id}`}>
                  <Prohibit size={18} weight="bold" aria-hidden="true" />
                  Failed its re-test
                </p>
              )}
              <PlanDrawing openings={openings} routes={c.routes} remedy={r} name={`fix ${L}`} />
              {/* On phones the drawing's own words are hidden, so the same facts are written out here. */}
              <p className="fl-legend">
                Dashed: proposed repair, not installed
                {stillOpen.length > 0 && ` · Still open: ${stillOpen.map((x) => x.fromFeature.label).join('; ')}`}
              </p>
              <p className={`fl-result ${res.tone}`}>
                {res.tone === 'closed' ? (
                  <CheckCircle size={22} weight="bold" aria-hidden="true" />
                ) : res.tone === 'open' ? (
                  <XCircle size={22} weight="bold" aria-hidden="true" />
                ) : (
                  <Circle size={22} weight="bold" aria-hidden="true" />
                )}
                <span>{res.text}</span>
              </p>
              <p className="fl-muted">
                {summary(r)} · {REMEDY_LABEL[r.type]}
              </p>
              {r.engineerApprovedBy ? (
                <p className="state ok">
                  <CheckCircle size={20} weight="bold" aria-hidden="true" />
                  Approved by {name(r.engineerApprovedBy)}
                </p>
              ) : can('approveRemedy') ? (
                <button
                  className="btn"
                  onClick={() => void run(() => client().approveRemedy({ params: { id: r.id } }))}
                >
                  Approve fix {L} as {plain(user.name)}
                </button>
              ) : (
                <p className="banner info fl-lock">
                  <LockSimple size={20} weight="bold" aria-hidden="true" />
                  <span>An engineer approves this fix. Not approved yet.</span>
                </p>
              )}
              {can('deleteRemedy') && (
                <button
                  className="btn small"
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      await client().deleteRemedy({ params: { id: r.id } })
                      removeProposed(finding.segmentId, r.id)
                    })
                  }
                >
                  <Trash size={18} weight="bold" aria-hidden="true" />
                  Remove fix {L}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {can('createRemedy') && <Propose finding={finding} openings={lens.base.openings} run={run} />}

      <div className="fl-bar">
        {sent ? (
          <button className="btn primary" onClick={onSent}>
            See the work order
          </button>
        ) : maySend ? (
          <>
            <label className="fl-inline">
              Installer
              <select value={installerId} onChange={(e) => setInstallerId(e.target.value)}>
                {installers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {plain(u.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fl-inline">
              Due date
              <input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <button
              className="btn primary"
              disabled={reason !== null}
              onClick={() =>
                // Step 3 opens only after the store holds the submitted order, so "No fix sent yet" never shows.
                void run(async () => {
                  const order = workOrder
                    ? await client().updateWorkOrder({ params: { id: workOrder.id }, body: { remedyId: pick!.id } })
                    : await client().createWorkOrder({ body: { findingId: finding.id, remedyId: pick!.id, notes: '' } })
                  await client().submitWorkOrder({
                    params: { id: order.id },
                    body: { installerUserId: installerId, dueAt: `${due}T09:00:00.000Z` }
                  })
                }).then((ok) => ok && onSent())
              }
            >
              Send fix{pick ? ` ${letter(index)}` : ''} to {name(installerId)}’s crew
            </button>
            {reason && <span className="fl-reason">{reason}</span>}
          </>
        ) : (
          <span className="banner info fl-lock">
            <LockSimple size={20} weight="bold" aria-hidden="true" />
            <span>The park manager sends the work order</span>
          </span>
        )}
        <span className="fl-muted">
          Dashed lines are proposed repairs, not installed. Someone who did not install the fix will re-test it.
        </span>
      </div>
    </div>
  )
}

function Propose({
  finding,
  openings,
  run
}: {
  finding: Finding
  openings: Lens['base']['openings']
  run: (call: () => Promise<unknown>) => Promise<boolean>
}) {
  const [type, setType] = useState<Remedy['type']>('panel_replacement')
  const [label, setLabel] = useState('')
  const [blocks, setBlocks] = useState<string[]>([])
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [test, setTest] = useState('')
  const [price, setPrice] = useState('')
  const hasQty = item.trim() !== '' || amount.trim() !== '' || unit.trim() !== ''
  const qtyOk = !hasQty || (item.trim() !== '' && Number(amount) > 0 && unit.trim() !== '')
  const ok = label.trim() !== '' && blocks.length > 0 && test.trim() !== '' && qtyOk
  return (
    <details className="fl-propose" open={openings.length > 0}>
      <summary>Propose a fix</summary>
      <form
        className="fl-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const remedy = await client().createRemedy({
              body: {
                segmentId: finding.segmentId,
                type,
                label: label.trim(),
                blocksOpeningIds: blocks,
                quantities: hasQty ? [{ item: item.trim(), amount: Number(amount), unit: unit.trim() }] : [],
                acceptanceTest: test.trim(),
                quote:
                  price.trim() === ''
                    ? 'quote_needed'
                    : { amount: Number(price), currency: 'MYR', date: new Date().toISOString().slice(0, 10) }
              }
            })
            addProposed(finding.segmentId, remedy.id)
            setLabel('')
            setBlocks([])
            setItem('')
            setAmount('')
            setUnit('')
            setTest('')
            setPrice('')
          })
        }}
      >
        <div className="fl-pair">
          <label>
            Kind of fix
            <select value={type} onChange={(e) => setType(RemedyType.parse(e.target.value))}>
              {RemedyType.options.map((t) => (
                <option key={t} value={t}>
                  {REMEDY_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name of the fix
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend>Openings this fix blocks</legend>
          {openings.map((o, i) => (
            <label key={o.id} className="fl-check">
              <input
                type="checkbox"
                checked={blocks.includes(o.id)}
                onChange={(e) => setBlocks(e.target.checked ? [...blocks, o.id] : blocks.filter((id) => id !== o.id))}
              />
              Opening {i + 1}, {OPENING_LABEL[o.type]}
            </label>
          ))}
        </fieldset>
        <div className="fl-triple">
          <label>
            Quantity of
            <input value={item} onChange={(e) => setItem(e.target.value)} />
          </label>
          <label>
            Amount
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>
        <label>
          Acceptance test
          <input value={test} onChange={(e) => setTest(e.target.value)} />
        </label>
        <label>
          Quote in MYR (leave empty for “quote needed”)
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={!ok}>
          Add this fix
        </button>
        {!ok && (
          <p className="fl-muted">Give the fix a name, tick the openings it blocks and write its acceptance test.</p>
        )}
      </form>
    </details>
  )
}
