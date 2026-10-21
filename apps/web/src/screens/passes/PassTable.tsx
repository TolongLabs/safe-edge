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

export function PassTable({ rows, titles }: { rows: Row[]; titles: Record<string, string> }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Every edge, worst first">
      <table>
        <thead>
          <tr>
            <th scope="col">Edge</th>
            <th scope="col">Pass</th>
            <th scope="col">Owner</th>
            <th scope="col">Open flags</th>
            <th scope="col">Overdue work</th>
            <th scope="col">Not seen on last patrol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.segment.id}>
              <th scope="row">
                {r.name} <span className="plate">{r.plate}</span>
              </th>
              <td>
                <PassBadge pass={r.pass} />
                {r.pass?.simulated && <small className="reason-line">simulated</small>}
                {r.pass?.stateReason && (r.pass.state === 'suspended' || r.pass.state === 'expired') && (
                  <small className="reason-line">{plainReason(r.pass.stateReason, titles)}</small>
                )}
              </td>
              <td data-label="Owner">{r.owner}</td>
              <td data-label="Open flags">{r.openFlags}</td>
              <td data-label="Overdue work">
                {r.overdue.length === 0
                  ? 'None'
                  : `${r.overdue.length} work order${r.overdue.length > 1 ? 's' : ''}, ${Math.max(...r.overdue.map((o) => o.days))} day${Math.max(...r.overdue.map((o) => o.days)) > 1 ? 's' : ''}`}
              </td>
              <td data-label="Not seen on last patrol">{unknownText(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Showing {rows.length} edge{rows.length === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
