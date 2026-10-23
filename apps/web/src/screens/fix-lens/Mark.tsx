import { OpeningType, type EvidenceRef, type Finding } from '@safe-edge/contracts'
import { CheckCircle, Trash, Warning, WarningCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { can, client, useStore } from '../../store'
import type { Scene } from '../../scenes'
import { Photo } from './Photo'
import { FEATURE_BOX, FROM_LABEL, OPENING_LABEL, must, plain, recordNames, useRun, type Lens } from './lens'

type Kind = keyof typeof FROM_LABEL

/** Step 1: mark openings on the photo (click or form) and record the ways to the water through them. */
export function Mark({
  finding,
  scene,
  image,
  lens,
  reload,
  when,
  onNext
}: {
  finding: Finding
  scene: Scene | null
  image?: EvidenceRef | null
  lens: Lens
  reload: () => void
  when: string
  onNext: () => void
}) {
  const { openings, routes } = lens.base
  const users = useStore().snapshot!.users
  const names = recordNames(lens, users)
  const { run, refusal } = useRun(reload, names)
  const engineerName = (id: string) =>
    plain(
      must(
        users.find((u) => u.id === id),
        `user ${id}`
      ).name
    )
  const confirmedOpenings = openings.filter((o) => o.engineerConfirmedBy !== null).length
  const confirmedWays = routes.filter((r) => r.engineerConfirmedBy !== null).length
  const mayMark = can('createOpening') && can('createRoute')
  const [type, setType] = useState<OpeningType>('fence_gap')
  const [across, setAcross] = useState('')
  const [down, setDown] = useState('')
  const [cm, setCm] = useState('')
  const [kind, setKind] = useState<Kind>('play_area')
  const [label, setLabel] = useState('')
  const [through, setThrough] = useState<string[]>([])
  const [unsure, setUnsure] = useState(false)
  const number = (id: string) => openings.findIndex((o) => o.id === id) + 1
  const openingName = (id: string) =>
    `Opening ${number(id)}, ${
      OPENING_LABEL[
        must(
          openings.find((x) => x.id === id),
          id
        ).type
      ]
    }`

  const addOpening = async (type: OpeningType, x: number, y: number, measuredMm: number | null) => {
    // The sample photo has no stored evidence, so its marks point at evd_sample_<observationId> (the image id when it has one).
    const observation = (await client().getCandidate({ params: { id: finding.candidateId } })).observations[0]!
    return client().createOpening({
      body: {
        segmentId: finding.segmentId,
        type,
        photoMarks: [{ evidenceId: observation.image?.id ?? `evd_sample_${observation.id}`, x, y }],
        measuredMm
      }
    })
  }

  const place = (x: number, y: number) => run(() => addOpening(type, x, y, cm.trim() === '' ? null : Number(cm) * 10))
  const percent = (v: string) => v.trim() !== '' && Number(v) >= 0 && Number(v) <= 100
  const acrossOk = percent(across)
  const downOk = percent(down)
  const sizeOk = cm.trim() === '' || (Number.isFinite(Number(cm)) && Number(cm) >= 0)
  const formOk = acrossOk && downOk && sizeOk
  const routeOk = label.trim() !== '' && (through.length > 0 || unsure)
  const [sampling, setSampling] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const sample = () => {
    setSampling(true)
    setSampleError(null)
    void run(async () => {
      const gap = await addOpening('fence_gap', 0.45, 0.6, 1200)
      const end = await addOpening('fence_end', 0.9, 0.6, 450)
      await client().createRoute({
        body: {
          segmentId: finding.segmentId,
          fromFeature: { kind: 'play_area', label: 'Playground path, through the panel gap' },
          openingIds: [gap.id],
          status: 'open'
        }
      })
      await client().createRoute({
        body: {
          segmentId: finding.segmentId,
          fromFeature: { kind: 'play_area', label: 'Playground path, around the fence end' },
          openingIds: [end.id],
          status: 'open'
        }
      })
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

  return (
    <div className="fl-mark">
      <div className="fl-left">
        <Photo
          scene={scene}
          image={image}
          when={when}
          onPlace={mayMark && sizeOk ? (x, y) => void place(x, y) : undefined}
          plates={openings.flatMap((o, i) => {
            const mark = o.photoMarks[0]
            // An opening with no mark on this photo is listed beside it, not drawn.
            return mark
              ? [
                  {
                    key: o.id,
                    text: `${i + 1} ${OPENING_LABEL[o.type]}`,
                    x: mark.x,
                    y: mark.y,
                    name: `${openingName(o.id)}${o.measuredMm === null ? '' : `, ${o.measuredMm / 10} cm`}`
                  }
                ]
              : []
          })}
        />
        <p className="fl-help">
          {mayMark
            ? 'Click the photo to place an opening, or fill in the Openings form. Each opening has a name a screen reader can read.'
            : 'A park manager or engineer marks the openings on this photo.'}
        </p>
      </div>
      <div className="fl-right">
        {refusal && (
          <p className="banner error fl-refusal" role="alert">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            <span>
              {refusal.text} <small>(rule: {refusal.rule})</small>
            </span>
          </p>
        )}
        <section className="fl-card" aria-label="Openings">
          <h2>Openings</h2>
          <p className="fl-muted fl-confirm-line">
            {confirmedOpenings} of {openings.length} {openings.length === 1 ? 'opening' : 'openings'} and{' '}
            {confirmedWays} of {routes.length} {routes.length === 1 ? 'way' : 'ways'} confirmed by an engineer
          </p>
          {(confirmedOpenings < openings.length || confirmedWays < routes.length) && (
            <p className="fl-muted">An engineer confirms the markings; it is not yet required to approve a fix.</p>
          )}
          {openings.length === 0 && <p className="fl-muted">No openings marked yet.</p>}
          {mayMark && openings.length === 0 && (
            <div className="fl-sample">
              <button className="btn" type="button" disabled={sampling} onClick={sample}>
                {sampling ? 'Use the S2 sample markings…' : 'Use the S2 sample markings'}
              </button>
              <p className="fl-muted">The panel gap and fence end from scenario S2.</p>
              {sampleError !== null && (
                <p className="state bad" role="alert">
                  {sampleError}
                </p>
              )}
            </div>
          )}
          <ul className="fl-list">
            {openings.map((o, i) => (
              <li key={o.id}>
                <span className="fl-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="fl-row-text">
                  <b>{OPENING_LABEL[o.type]}</b>
                  <br />
                  <span className="fl-muted">
                    {o.photoMarks[0]
                      ? `${Math.round(o.photoMarks[0].x * 100)}% across, ${Math.round(o.photoMarks[0].y * 100)}% down the photo`
                      : 'not marked on this photo'}
                    {' · '}
                    {o.measuredMm === null ? 'size not measured' : `${o.measuredMm / 10} cm`}
                  </span>
                  {o.engineerConfirmedBy !== null && (
                    <span className="fl-tag">
                      <CheckCircle size={18} weight="bold" aria-hidden="true" />
                      Confirmed by {engineerName(o.engineerConfirmedBy)}
                    </span>
                  )}
                </span>
                <span className="fl-row-actions">
                  {can('confirmOpening') && o.engineerConfirmedBy === null && (
                    <button
                      className="btn small"
                      type="button"
                      aria-label={`Confirm ${openingName(o.id)}`}
                      onClick={() => void run(() => client().confirmOpening({ params: { id: o.id } }))}
                    >
                      <CheckCircle size={18} weight="bold" aria-hidden="true" />
                      Confirm
                    </button>
                  )}
                  {can('deleteOpening') && (
                    <button
                      className="btn small danger"
                      type="button"
                      aria-label={`Remove ${openingName(o.id)}`}
                      onClick={() => void run(() => client().deleteOpening({ params: { id: o.id } }))}
                    >
                      <Trash size={18} weight="bold" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {mayMark && (
            <form
              className="fl-form"
              onSubmit={(e) => {
                e.preventDefault()
                void place(Number(across) / 100, Number(down) / 100).then(
                  (ok) => ok && (setAcross(''), setDown(''), setCm(''))
                )
              }}
            >
              <label>
                Add an opening: type
                <select value={type} onChange={(e) => setType(OpeningType.parse(e.target.value))}>
                  {OpeningType.options.map((t) => (
                    <option key={t} value={t}>
                      {OPENING_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="fl-pair">
                <label>
                  Across the photo
                  <span className="fl-unit">
                    <input type="text" inputMode="decimal" value={across} onChange={(e) => setAcross(e.target.value)} />
                    <span aria-hidden="true">%</span>
                  </span>
                </label>
                <label>
                  Down the photo
                  <span className="fl-unit">
                    <input type="text" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} />
                    <span aria-hidden="true">%</span>
                  </span>
                </label>
              </div>
              <label>
                Size
                <span className="fl-unit">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-invalid={!sizeOk}
                    value={cm}
                    onChange={(e) => setCm(e.target.value)}
                  />
                  <span aria-hidden="true">cm</span>
                </span>
              </label>
              {!sizeOk && (
                <p className="fl-error" role="alert">
                  <Warning size={20} weight="bold" aria-hidden="true" />
                  <span>
                    Size must be a number of centimetres, 0 or more, for example 120. Leave it empty if unknown.
                  </span>
                </p>
              )}
              <button className="btn" type="submit" disabled={!formOk}>
                Add opening
              </button>
              {!formOk && (
                <p className="fl-muted">
                  Enter a position across and down the photo from 0 to 100 percent, and a size in cm if you know it.
                </p>
              )}
            </form>
          )}
        </section>
        <section className="fl-card" aria-label="Ways to the water">
          <h2>Ways to the water</h2>
          {routes.length === 0 && <p className="fl-muted">No ways to the water recorded yet.</p>}
          <ul className="fl-list">
            {routes.map((r) => (
              <li key={r.id} className="fl-route-row">
                <span className="fl-row-text">
                  <b>{r.fromFeature.label}</b>
                  <br />
                  <span className="fl-muted">
                    From {FROM_LABEL[r.fromFeature.kind]} ·{' '}
                    {r.openingIds.length > 0
                      ? `through opening ${r.openingIds.map(number).join(', ')}`
                      : 'opening not known'}
                    {r.status === 'unknown' && ' · unknown'}
                  </span>
                  {r.engineerConfirmedBy !== null && (
                    <span className="fl-tag">
                      <CheckCircle size={18} weight="bold" aria-hidden="true" />
                      Confirmed by {engineerName(r.engineerConfirmedBy)}
                    </span>
                  )}
                </span>
                <span className="fl-row-actions">
                  {can('confirmRoute') && r.engineerConfirmedBy === null && (
                    <button
                      className="btn small"
                      type="button"
                      aria-label={`Confirm ${r.fromFeature.label}`}
                      onClick={() => void run(() => client().confirmRoute({ params: { id: r.id } }))}
                    >
                      <CheckCircle size={18} weight="bold" aria-hidden="true" />
                      Confirm
                    </button>
                  )}
                  {can('deleteRoute') && (
                    <button
                      className="btn small danger"
                      type="button"
                      aria-label={`Remove ${r.fromFeature.label}`}
                      onClick={() => void run(() => client().deleteRoute({ params: { id: r.id } }))}
                    >
                      <Trash size={18} weight="bold" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {mayMark && openings.length > 0 && (
            <form
              className="fl-form"
              onSubmit={(e) => {
                e.preventDefault()
                void run(() =>
                  client().createRoute({
                    body: {
                      segmentId: finding.segmentId,
                      fromFeature: { kind, label: label.trim() },
                      openingIds: through,
                      status: unsure ? 'unknown' : 'open'
                    }
                  })
                ).then((ok) => ok && (setLabel(''), setThrough([]), setUnsure(false)))
              }}
            >
              <div className="fl-pair">
                <label>
                  Starts at
                  <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                    {(Object.keys(FROM_LABEL) as Kind[]).map((k) => (
                      <option key={k} value={k}>
                        {FEATURE_BOX[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Name of the way
                  <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
                </label>
              </div>
              <fieldset>
                <legend>Goes through</legend>
                {openings.map((o) => (
                  <label key={o.id} className="fl-check">
                    <input
                      type="checkbox"
                      checked={through.includes(o.id)}
                      onChange={(e) =>
                        setThrough(e.target.checked ? [...through, o.id] : through.filter((id) => id !== o.id))
                      }
                    />
                    {openingName(o.id)}
                  </label>
                ))}
                <label className="fl-check">
                  <input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} />I am not sure
                  which opening it uses (it stays unknown)
                </label>
              </fieldset>
              <button className="btn" type="submit" disabled={!routeOk}>
                Add way to the water
              </button>
              {!routeOk && <p className="fl-muted">Name the way and tick an opening, or say you are not sure.</p>}
            </form>
          )}
          <p className="fl-muted">
            A way stays open until one of its openings is blocked. If you are not sure which opening it uses, it stays
            unknown.
          </p>
        </section>
      </div>
      <div className="fl-bar">
        <button className="btn primary" disabled={openings.length === 0} onClick={onNext}>
          Next: compare fixes
        </button>
        <span className="fl-muted">
          {openings.length} {openings.length === 1 ? 'opening' : 'openings'} and {routes.length}{' '}
          {routes.length === 1 ? 'way' : 'ways'} recorded.
          {openings.length === 0 && ' Mark at least one opening first.'}
        </span>
      </div>
    </div>
  )
}
