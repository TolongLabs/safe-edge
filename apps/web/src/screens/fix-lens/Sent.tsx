import type { Finding, WorkOrder } from '@safe-edge/contracts'
import { useStore } from '../../store'
import type { Scene } from '../../scenes'
import { Photo } from './Photo'
import { OPENING_LABEL, ROLE_WORDS, day, letter, must, plain, quoteWords, type Lens } from './lens'

/** Step 3: the submitted work order, filled from the chosen fix. */
export function Sent({
  finding,
  workOrder,
  scene,
  lens,
  when
}: {
  finding: Finding
  workOrder: WorkOrder
  scene: Scene
  lens: Lens
  when: string
}) {
  const s = useStore().snapshot!
  const who = (id: string) =>
    must(
      s.users.find((u) => u.id === id),
      `user ${id}`
    )
  const remedyId = must(workOrder.remedyId ?? undefined, 'the remedy of a sent work order')
  const closure = must(lens.per[remedyId], `preview of ${remedyId}`)
  const remedy = must(closure.remedies[0], `remedy ${remedyId}`)
  const index = lens.base.remedies.findIndex((r) => r.id === remedy.id)
  const owner = who(finding.custodianUserId)
  const installer = who(must(workOrder.installerUserId ?? undefined, 'the installer of a sent work order'))
  const approver = remedy.engineerApprovedBy === null ? null : who(remedy.engineerApprovedBy)
  const number = (id: string) => closure.openings.findIndex((o) => o.id === id) + 1
  return (
    <div className="fl-sent">
      <h2 className="fl-question">
        Fix {letter(index)} sent to {plain(installer.name)}’s crew
      </h2>
      <p className="fl-muted">
        <span translate="no">{workOrder.id}</span> · submitted by{' '}
        {plain(who(must(workOrder.submittedBy ?? undefined, 'who submitted the work order')).name)}
        {workOrder.dueAt && ` · due ${day(workOrder.dueAt)}`}
        {approver && ` · engineer approved by ${plain(approver.name)}`}
      </p>
      <div className="fl-three">
        <section className="fl-card" aria-label="Marked photo">
          <h3>Marked photo</h3>
          <Photo
            scene={scene}
            caption={{ when, simulated: finding.simulated }}
            plates={closure.openings.flatMap((o) => {
              const mark = o.photoMarks[0]
              const blocked = remedy.blocksOpeningIds.includes(o.id)
              return mark
                ? [
                    {
                      key: o.id,
                      text: `${number(o.id)} ${OPENING_LABEL[o.type]}`,
                      x: mark.x,
                      y: mark.y,
                      name: `${blocked ? 'Proposed work at' : 'Not blocked by this fix:'} opening ${number(o.id)}, ${OPENING_LABEL[o.type]}`,
                      dashed: blocked
                    }
                  ]
                : []
            })}
          />
        </section>
        <section className="fl-card" aria-label="Quantities">
          <h3>Quantities</h3>
          <table className="fl-table">
            <tbody>
              {remedy.quantities.map((q) => (
                <tr key={q.item}>
                  <th scope="row">{q.item}</th>
                  <td>
                    <b>
                      {q.amount} {q.unit}
                    </b>
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row">Price</th>
                <td>
                  <b>{quoteWords(remedy.quote)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="fl-card" aria-label="Acceptance test and owner">
          <h3>Acceptance test and owner</h3>
          <p>{remedy.acceptanceTest}</p>
          <dl className="fl-facts">
            <dt>Owner</dt>
            <dd>
              {plain(owner.name)}, {ROLE_WORDS[owner.role]}
            </dd>
            <dt>Installer</dt>
            <dd>{plain(installer.name)}’s crew</dd>
            <dt>Re-test by</dt>
            <dd>Someone who did not install it</dd>
          </dl>
        </section>
      </div>
      <div className="fl-bar">
        <a className="btn primary" href={`#/retest/${workOrder.id}`}>
          Open the repair check
        </a>
        <span className="fl-muted">
          Dashed lines are proposed repairs, not installed. Someone who did not install the fix will re-test it.
        </span>
      </div>
    </div>
  )
}
