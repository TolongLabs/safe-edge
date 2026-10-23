import { Check, X } from '@phosphor-icons/react'
import type { RepairJourney, User } from '@safe-edge/contracts'
import { useSignedIn } from '../../store'
import { forecastFor } from './forecast'
import { deriveStages } from './journey'
import './stage-tracker.css'

const money = (amount: number, currency: string) =>
  currency === 'MYR' ? `RM ${amount.toLocaleString('en-MY')}` : `${currency} ${amount.toLocaleString('en-MY')}`

const dateText = (stage: ReturnType<typeof deriveStages>['stages'][number]) => {
  if (stage.state === 'done' || stage.state === 'rejected') return stage.when ?? 'Date not recorded'
  if (stage.state === 'now') return stage.when ? `Since ${stage.when}` : 'In progress'
  return 'Awaiting'
}

const whoText = (stage: ReturnType<typeof deriveStages>['stages'][number]) =>
  stage.who ?? (stage.state === 'todo' ? 'Awaiting' : 'Not yet recorded')

export function StageTracker({
  journey,
  users,
  journeys
}: {
  journey: RepairJourney
  users: User[]
  journeys?: RepairJourney[]
}) {
  const { user } = useSignedIn()
  const derived = deriveStages(journey, users)
  const forecast = forecastFor(journey, journeys ?? [])
  const maySeeSpent = user.role === 'manager' || user.role === 'engineer' || user.role === 'reviewer'
  const spent = maySeeSpent ? derived.spent : null

  return (
    <section className="stage-tracker" aria-label="Repair stages">
      {derived.current && (
        <div className="nowline" role="status">
          <i className="nowmark" aria-hidden="true" />
          <span className="nm">
            <span className="over">{derived.current.label}</span>
            <b>{derived.current.detail}</b>
          </span>
        </div>
      )}

      <ol
        className={`trk roles${derived.end ? ' two' : ''}`}
        aria-label={derived.end ? derived.end.name : 'Repair stages by role'}
      >
        {derived.stages.map((stage) => (
          <li
            key={stage.key}
            className={stage.state === 'rejected' ? 'rej now' : stage.state}
            aria-current={stage.state === 'now' ? 'step' : undefined}
          >
            <details open={stage.state === 'now'}>
              <summary>
                <span className="dot">
                  {stage.state === 'done' && <Check size={16} weight="bold" aria-hidden="true" />}
                  {stage.state === 'rejected' && <X size={16} weight="bold" aria-hidden="true" />}
                </span>
                <span className="txt">
                  {stage.state === 'now' && <span className="nowtag">Now</span>}
                  <span className="nm">{stage.name}</span>
                  <span className="who">{whoText(stage)}</span>
                  <span className="dt">{dateText(stage)}</span>
                </span>
                <span className="more">Steps</span>
              </summary>
              <ul className="steps">
                {stage.steps.map((step) => (
                  <li key={step.label} className={step.state}>
                    <i className="m" aria-hidden="true" />
                    <span>
                      <b>{step.label}</b>
                      {step.detail ? ` · ${step.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>

      {derived.end && (
        <div className={`banner ${derived.end.state === 'rejected' ? 'error' : 'info'}`} role="status">
          <i aria-hidden="true" />
          <span>
            <b>{derived.end.name}</b>
            {derived.end.who ? ` by ${derived.end.who}` : ''}
            {derived.end.when ? `, ${derived.end.when}` : ''}
            {derived.end.detail ? `: ${derived.end.detail}` : '.'}
          </span>
        </div>
      )}

      {!derived.end && (derived.finish || derived.dueChanges.length > 0) && (
        <div className="nextbox" aria-label="Finish date">
          {derived.finish && (
            <div>
              <span className="over">Finish date</span>
              <b>{derived.finish}</b>
            </div>
          )}
        </div>
      )}

      {derived.dueChanges.map((change) => (
        <div className="banner warn chg" key={`${change.at}-${change.to}-${change.reason}`} role="status">
          <i aria-hidden="true" />
          <span>
            <b>
              Finish date moved {change.from ?? 'not set'} → {change.to}
            </b>{' '}
            by {change.by}, {change.at}: “{change.reason}”.
          </span>
        </div>
      ))}

      {forecast && (
        <div className="fc">
          <span>Forecast</span>
          <b>{forecast}</b>
        </div>
      )}

      {spent && (
        <div className="st-spend">
          <dl className="sp">
            <div>
              <dt>Estimate</dt>
              <dd>{spent.estimate === null ? 'No estimate' : money(spent.estimate, spent.currency)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{money(spent.spent, spent.currency)}</dd>
            </div>
            <div>
              <dt>{spent.percent !== null && spent.percent > 0 ? 'Over' : 'Difference'}</dt>
              <dd>{spent.percent === null ? 'Not comparable' : `${spent.percent > 0 ? '+' : ''}${spent.percent}%`}</dd>
            </div>
          </dl>
          {spent.reason && (
            <p className="st-reason">
              <b>Reason for spending more:</b> {spent.reason}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
