import { WarningCircle } from '@phosphor-icons/react'
import type { DamageReport, RepairJourney } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { client, useSignedIn, useStore } from '../../store'
import { StageTracker } from '../shared/StageTracker'
import { ISSUE_LABELS } from '../shared/reports'
import { journeyDate } from '../shared/journey'

type Row = { report: DamageReport; journey: RepairJourney }
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; rows: Row[] }

const placeWords = (report: DamageReport) => {
  const where = report.where
  if (!where) return 'Place not recorded'
  if (where.note?.trim()) return where.note.trim()
  return `${where.lat.toFixed(4)}, ${where.lon.toFixed(4)}`
}

/** The walk crew's own sent reports, each with the same tracker every role reads (#230). */
export function MyReports() {
  const { user } = useSignedIn()
  const snapshot = useStore().snapshot!
  const users = snapshot.users
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true
    setState({ kind: 'loading' })
    client()
      .listDamageReports({ query: { reportedBy: user.id } })
      .then(async (reports) => {
        const rows = await Promise.all(
          reports.map(async (report) => ({
            report,
            journey: await client().getRepairJourney({ params: { id: report.candidateId } })
          }))
        )
        return rows
      })
      .then(
        (rows) => live && setState({ kind: 'ready', rows }),
        (error: unknown) =>
          live &&
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error)
          })
      )
    return () => {
      live = false
    }
  }, [user.id, version, snapshot])

  return (
    <section className="my-reports" aria-label="My reports">
      <h2>My reports</h2>
      <p className="meta">Reports you sent. The manager confirms each one.</p>

      {state.kind === 'loading' && (
        <div className="skeleton-rows" role="status">
          <p>Loading your reports…</p>
          <i />
          <i />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="banner error" role="alert">
          <WarningCircle size={20} weight="bold" aria-hidden="true" />
          <span>
            <b>Could not load your reports.</b> {state.message}. Nothing was changed.{' '}
            <button className="btn small" onClick={() => setVersion((n) => n + 1)}>
              Try again
            </button>
          </span>
        </div>
      )}

      {state.kind === 'ready' && state.rows.length === 0 && (
        <p>You have not sent a report yet. A report you send appears here with its progress.</p>
      )}

      {state.kind === 'ready' && state.rows.length > 0 && (
        <ul className="my-reports-list">
          {state.rows.map(({ report, journey }) => (
            <li key={report.id} className="my-report">
              <div>
                <h3>{report.issueType ? ISSUE_LABELS[report.issueType] : 'Problem not classified'}</h3>
                <p className="meta">
                  Reported {journeyDate(report.reportedAt) ?? 'date not recorded'} · {placeWords(report)}
                </p>
              </div>
              <p>{report.description}</p>
              <StageTracker journey={journey} journeys={state.rows.map((row) => row.journey)} users={users} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
