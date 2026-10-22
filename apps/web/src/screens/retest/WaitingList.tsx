import { CaretRight, Info, WarningCircle } from '@phosphor-icons/react'
import { Screen } from '../../shell/Shell'
import { can, useSignedIn, useStore } from '../../store'
import { must, plain } from '../fix-lens/lens'
import './retest.css'
import { useClearable } from './useClearable'

/** `#/retest` with no work order: the repairs and false alarms that wait for someone, with who acts next. */
export function WaitingList() {
  const s = useStore().snapshot!
  const { user } = useSignedIn()
  const { found, error, retry } = useClearable()
  const rows = s.workOrders.filter(
    (w) => w.status === 'submitted' || w.status === 'in_progress' || w.status === 'completed'
  )
  const alarms = found ?? []
  const finished = s.workOrders.some((w) => w.status === 'accepted' || w.status === 'rejected')
  const name = (id: string | null) =>
    plain(
      must(
        s.users.find((u) => u.id === id),
        `user ${id}`
      ).name
    )
  const forInstaller = user.role === 'installer'
  const heading = forInstaller
    ? 'Repairs for you'
    : can('recordRetest')
      ? 'Waiting for your check'
      : 'Repairs in progress'
  return (
    <Screen title="Repair check" context={heading}>
      <main className="detail island rt-main">
        {error && (
          <div className="banner error" role="alert">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            <span>
              <b>Could not look for false alarms to check.</b> {error.message}. Nothing was changed.
            </span>
            <button className="btn small" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {found === null && !error ? (
          <div className="skeleton-rows" role="status">
            <p className="rt-help">Looking for repairs and false alarms…</p>
            <i />
            <i />
          </div>
        ) : rows.length === 0 && alarms.length === 0 ? (
          error ? null : (
            <div className="empty-state left">
              <span className="icon-tile">
                <Info size={24} weight="bold" aria-hidden="true" />
              </span>
              <h2>No repairs are waiting</h2>
              <p>
                {finished
                  ? 'No repair is waiting for a check right now. This does not mean the lake edge is safe.'
                  : 'This does not mean the lake edge is safe: nothing has been sent for repair yet. A manager sends a fix from Fix Lens, then the installer marks it complete, then it can be checked here.'}
              </p>
              <a className="btn primary" href="#/inbox">
                Back to Inbox
              </a>
            </div>
          )
        ) : (
          <>
            <h2 className="rt-question">{heading}</h2>
            <ul className="rt-list">
              {rows.map((w) => {
                const finding = must(
                  s.findings.find((f) => f.id === w.findingId),
                  `finding ${w.findingId}`
                )
                const title = must(s.metas[finding.candidateId], `sample details for ${finding.candidateId}`).title
                const mine = forInstaller && user.id === w.installerUserId
                const action =
                  w.status === 'completed'
                    ? can('recordRetest')
                      ? 'Check this repair'
                      : null
                    : mine
                      ? w.status === 'submitted'
                        ? 'Start work'
                        : 'Mark work complete'
                      : null
                const next =
                  w.status === 'completed'
                    ? 'A reviewer checks it next'
                    : `${name(w.installerUserId)} does the repair next`
                return (
                  <li key={w.id}>
                    <a className="rt-row" href={`#/retest/${w.id}`}>
                      <span className="rt-row-text">
                        <span className="rt-row-title">{title}</span>
                        <span className="rt-help">
                          {w.status.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())}
                          {action ? '' : ` · ${next}`}
                        </span>
                        {action && <span className="rt-action">{action}</span>}
                      </span>
                      <CaretRight size={20} weight="bold" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
              {alarms.map((a) => {
                const mine = can('recordClearance')
                const body = (
                  <span className="rt-row-text">
                    <span className="rt-row-title">Check a false alarm: {a.title}</span>
                    <span className="rt-help">
                      {a.status === 'rejected' ? 'Marked not a problem' : 'Sent to look again'}
                      {mine ? '' : ' · A reviewer checks this false alarm'}
                    </span>
                    {mine && <span className="rt-action">Check a false alarm</span>}
                  </span>
                )
                return (
                  <li key={a.candidateId}>
                    <a className="rt-row" href={`#/retest/${a.candidateId}`}>
                      {body}
                      <CaretRight size={20} weight="bold" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </main>
    </Screen>
  )
}
