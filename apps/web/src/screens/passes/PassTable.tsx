import type { EdgePass } from '@safe-edge/contracts'
import { actionOf, day, groups, type Row } from './board'

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

const titleOf = (id: string, titles: Record<string, string>) => titles[id] ?? 'another flag'

/** Core's reason names records by id; the board names a flag by its title and never shows a raw id or a tier. */
function plainReason(reason: string, titles: Record<string, string>) {
  return reason
    .replace(
      /Tier\s+2\s+candidate\s+((?:cand|fnd)_\w+)\s+awaiting review/gi,
      (_, id: string) => `Flag "${titleOf(id, titles)}" awaiting review`
    )
    .replace(/Tier\s+\d+\s+candidate\s+((?:cand|fnd)_\w+)/gi, (_, id: string) => `Flag "${titleOf(id, titles)}"`)
    .replace(/validTo reached/gi, 'Past its valid-to date')
    .replace(/(?:cand|fnd)_\w+/g, (id) => `"${titleOf(id, titles)}"`)
    .replace(/\bseg_\w+/g, 'this edge')
    .replace(/\b(?:rt|wo|pass)_\w+/g, 'this record')
    .replace(/Tier\s+\d+\s+candidate/gi, 'Flag')
    .replace(/candidate/gi, 'flag')
}

/** Overdue work orders on the edge and the longest overdue, in days. */
function overdueText(r: Row) {
  if (r.overdue.length === 0) return ''
  const days = Math.max(...r.overdue.map((o) => o.days))
  return `${r.overdue.length} work order${r.overdue.length > 1 ? 's' : ''}, ${days} day${days > 1 ? 's' : ''}`
}

/** Always a real link: an explicit pass record, or the segment when the edge has no pass record at all. */
const passHref = (r: Row) => `#/passes/${r.pass?.id ?? r.segment.id}`

function Card({ row, titles }: { row: Row; titles: Record<string, string> }) {
  const action = actionOf(row, titles)
  if (action === null) return null
  const state = row.pass?.state ?? 'none'
  const facts = [
    row.openFlags > 0 ? `${row.openFlags} open flag${row.openFlags === 1 ? '' : 's'}` : '',
    overdueText(row),
    row.unknown.kind === 'never' || row.unknown.kind === 'unrecorded' || row.unknown.share > 0
      ? `Not seen on last patrol: ${unknownText(row)}`
      : ''
  ].filter(Boolean)
  return (
    <article className={`pass-card ${state}`} aria-label={`${row.name} ${row.plate}`}>
      <span className="plate" translate="no">
        {row.plate}
      </span>
      <h3>
        <a href={passHref(row)} aria-label={`${row.name} ${row.plate}`}>
          {row.name}
        </a>
        <PassBadge pass={row.pass} />
      </h3>
      <span className="pass-go" aria-hidden="true">
        ›
      </span>
      {row.pass?.state === 'suspended' && row.pass.stateReason && (
        <p className="pass-reason">{plainReason(row.pass.stateReason, titles)}</p>
      )}
      <p className="pass-next">
        <b>Next:</b> {action.next}
      </p>
      <p className="pass-owner">Owner: {row.owner}</p>
      {facts.length > 0 && <p className="pass-facts">{facts.join(' · ')}</p>}
    </article>
  )
}

function Fold({ label, rows }: { label: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <details className="pass-fold">
      <summary>
        <span>{label}</span>
        <span className="fold-count">· {rows.length}</span>
      </summary>
      <ul>
        {rows.map((r) => (
          <li key={r.segment.id}>
            <a href={passHref(r)}>
              <span className="plate" translate="no">
                {r.plate}
              </span>
              <span className="fold-name">{r.name}</span>
              <PassBadge pass={r.pass} />
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function PassBoard({ rows, titles }: { rows: Row[]; titles: Record<string, string> }) {
  const split = groups(rows, titles)
  const rest = split.valid.length + split.none.length
  return (
    <>
      <section className="action-needed" aria-labelledby="edges-h">
        {split.action.length === 0 ? (
          <p className="banner info">
            <span>
              <b>No edge needs action right now.</b> The edges below are grouped by pass state. No pass yet is unknown,
              never safe.
            </span>
          </p>
        ) : (
          <div className="pass-cards">
            {split.action.map((r) => (
              <Card key={r.segment.id} row={r} titles={titles} />
            ))}
          </div>
        )}
      </section>
      {rest > 0 && (
        <section className="pass-rest" aria-label="Other edges">
          <h3>The rest · {rest}</h3>
          <div className="pass-folds">
            <Fold label="Valid" rows={split.valid} />
            <Fold label="No pass yet" rows={split.none} />
          </div>
        </section>
      )}
    </>
  )
}
