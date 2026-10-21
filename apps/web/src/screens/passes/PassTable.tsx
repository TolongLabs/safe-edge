import type { EdgePass } from '@safe-edge/contracts'
import { day, type Row } from './board'

/** The five pass shapes of DESIGN.md: filled dot, half ring, slashed ring, square, hollow ring. */
function StateMark({ state }: { state: EdgePass['state'] }) {
  const shape = {
    valid: <circle cx="9" cy="9" r="6" fill="currentColor" />,
    expiring: (
      <>
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M9 3.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </>
    ),
    suspended: <rect x="3" y="3" width="12" height="12" rx="1" fill="currentColor" />,
    expired: (
      <>
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 14L14 4" stroke="currentColor" strokeWidth="2" />
      </>
    ),
    none: <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
  }[state]
  return (
    <svg className={`mark ${state}`} viewBox="0 0 18 18" aria-hidden="true">
      {shape}
    </svg>
  )
}

function passWords(p: EdgePass | null) {
  const to = p?.validTo ? day(p.validTo) : null
  switch (p?.state ?? 'none') {
    case 'suspended':
      return `Suspended${to ? ` · valid to ${to}` : ''}`
    case 'valid':
      return `Valid to ${to}`
    case 'expiring':
      return `Expiring: valid to ${to}`
    case 'expired':
      return `Expired${to ? ` ${to}` : ''}`
    default:
      return 'No pass yet: unknown'
  }
}

export function PassBadge({ pass }: { pass: EdgePass | null }) {
  const state = pass?.state ?? 'none'
  return (
    <span className={`pass-badge ${state}`}>
      <StateMark state={state} />
      {passWords(pass)}
    </span>
  )
}

const unknownText = (r: Row) =>
  r.unknown.kind === 'never'
    ? 'Never patrolled'
    : r.unknown.kind === 'unrecorded'
      ? 'Part, length not recorded'
      : `${Math.round(r.unknown.share * 100)}% of the edge`

/** Core's reason names the flag by id; show its title, and "another flag" when this session does not know it. */
const plainReason = (reason: string, titles: Record<string, string>) =>
  reason
    .replace('validTo reached', 'Past its valid-to date')
    .replace(/\bcand_\w+/g, (id) => (titles[id] ? `"${titles[id]}"` : 'another flag'))

/** Overdue work orders on the edge and the longest overdue, in days. */
function overdueText(r: Row) {
  if (r.overdue.length === 0) return 'None'
  const days = Math.max(...r.overdue.map((o) => o.days))
  return `${r.overdue.length} work order${r.overdue.length > 1 ? 's' : ''}, ${days} day${days > 1 ? 's' : ''}`
}

export function PassTable({ rows, titles }: { rows: Row[]; titles: Record<string, string> }) {
  return (
    <div className="edge-table">
      <table aria-labelledby="edges-h">
        <thead>
          <tr>
            <th scope="col">Edge</th>
            <th scope="col">Pass</th>
            <th scope="col">Owner</th>
            <th scope="col" className="num">
              Open flags
            </th>
            <th scope="col">Overdue work</th>
            <th scope="col">Not seen on last patrol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.segment.id}>
              <th scope="row">
                {/* A no-break space keeps the plate with the last word of the name. */}
                {r.name}&nbsp;
                <span className="plate" translate="no">
                  {r.plate}
                </span>
              </th>
              <td>
                <PassBadge pass={r.pass} />
                {r.pass?.stateReason && (r.pass.state === 'suspended' || r.pass.state === 'expired') && (
                  <small className="reason-line">{plainReason(r.pass.stateReason, titles)}</small>
                )}
              </td>
              <td data-label="Owner" className="owner">
                {r.owner}
              </td>
              <td data-label="Open flags" className="num">
                {r.openFlags}
              </td>
              <td data-label="Overdue work" className="overdue">
                {overdueText(r)}
              </td>
              <td data-label="Not seen on last patrol">{unknownText(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
