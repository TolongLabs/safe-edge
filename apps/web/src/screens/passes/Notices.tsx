import type { Notice } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { DownloadSimple, Info, PaperPlaneTilt } from '@phosphor-icons/react'
import { useState } from 'react'
import { can, useSignedIn } from '../../store'
import { dayTime, month, must, personName as nameOf, type Data, type Row } from './board'
import { download, reportBody, reportMarkdown } from './report'

const personName = (d: Data, id: string) => nameOf(d.users, id)
const author = (d: Data, n: Notice) =>
  n.draftedBy.type === 'agent' ? 'Safe Edge agent' : personName(d, n.draftedBy.id)

const WHO_SEES = 'The park manager and the township general manager see this.'

/** Runs a write as the signed-in person; a refusal (with its rule) or any other failure is shown as it is. */
function useAct(done: () => void) {
  const [error, setError] = useState<string | null>(null)
  const act = async (run: () => Promise<unknown>) => {
    setError(null)
    try {
      await run()
      done()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setError(e instanceof SafeEdgeDeniedError ? `${text} (rule: ${e.rule})` : text)
    }
  }
  return { error, act }
}

function Failure({ error }: { error: string | null }) {
  return error ? (
    <p className="state bad" role="alert">
      {error}
    </p>
  ) : null
}

function NoticeCard({ d, n, act }: { d: Data; n: Notice; act: (run: () => Promise<unknown>) => void }) {
  const { client } = useSignedIn()
  return (
    <article className="notice" aria-label={n.title}>
      <p className="drafted-by">
        Drafted by {author(d, n)}
        {n.status === 'sent' ? '' : ' · not sent'}
      </p>
      {n.status === 'sent' && (
        <p className="drafted-by">
          Sent by {personName(d, must(n.sentBy, `sender of ${n.id}`))} ·{' '}
          {dayTime(must(n.sentAt, `sent time of ${n.id}`))}
        </p>
      )}
      {n.simulated && <p className="hint">simulated</p>}
      <p className="notice-body">{n.body}</p>
      {n.status === 'draft' && can('sendNotice') && (
        <button className="btn" onClick={() => act(() => client.sendNotice({ params: { id: n.id } }))}>
          <PaperPlaneTilt size={20} weight="bold" aria-hidden="true" />
          Send {n.kind === 'escalation' ? 'escalation' : 'report'}
        </button>
      )}
    </article>
  )
}

/**
 * Which composer was opened last, shared by the escalation and report panels so only that one's Save draft is
 * the screen's primary button. `null` when the last-opened one has closed: any composer left open leads.
 */
export type Lead = { last: string | null; set: (key: string | null) => void }

/** Text people edit before saving: core keeps a saved draft as written. */
function Compose({
  initial,
  label,
  primary,
  save,
  cancel
}: {
  initial: string
  label: string
  primary: boolean
  save: (text: string) => void
  cancel: () => void
}) {
  const [text, setText] = useState(initial)
  return (
    <form
      className="compose"
      onSubmit={(e) => {
        e.preventDefault()
        save(text.trim())
      }}
    >
      <label>
        {label}
        <textarea value={text} rows={5} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className="hint">
        {text.trim()
          ? 'A saved draft cannot be edited, so change the text here first.'
          : 'Write some text before saving.'}
      </p>
      <div className="row-actions">
        <button className={primary ? 'btn primary' : 'btn'} type="submit" disabled={!text.trim()}>
          Save draft
        </button>
        <button className="btn" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function Escalation({ d, rows, lead, reload }: { d: Data; rows: Row[]; lead: Lead; reload: () => void }) {
  const { client } = useSignedIn()
  const { error, act } = useAct(() => {
    close()
    reload()
  })
  const [composing, setComposing] = useState<string | null>(null)
  const key = (id: string) => `escalation:${id}`
  const close = () => {
    if (composing && lead.last === key(composing)) lead.set(null)
    setComposing(null)
  }
  const escalations = (d.notices ?? []).filter((n) => n.kind === 'escalation')
  const overdue = rows.flatMap((r) => r.overdue.map((o) => ({ r, o })))
  const open = overdue.filter(({ o }) => !escalations.some((n) => n.subjectId === o.workOrder.id))
  const gm = d.users.find((u) => u.role === 'gm')
  return (
    <section className="island panel" aria-labelledby="esc-h">
      <h2 id="esc-h">Overdue work: escalation</h2>
      {d.notices === null && <p className="hint">{WHO_SEES}</p>}
      {escalations
        .slice()
        .reverse()
        .map((n) => (
          <div key={n.id}>
            <NoticeCard d={d} n={n} act={act} />
            {n.subjectId?.startsWith('wo_') && (
              <a className="btn" href={`#/retest/${n.subjectId}`}>
                Open the work order
              </a>
            )}
          </div>
        ))}
      {open.map(({ r, o }) => (
        <div key={o.workOrder.id} className="overdue-line">
          <p>
            <b>{o.workOrder.id}</b> at {r.name} {r.plate} is {o.days} day{o.days > 1 ? 's' : ''} overdue.
          </p>
          {!can('draftNotice') ? (
            <p className="hint">The park manager or the township general manager drafts the escalation.</p>
          ) : composing === o.workOrder.id ? (
            <Compose
              primary={lead.last === null || lead.last === key(o.workOrder.id)}
              label={`Escalation for ${o.workOrder.id}`}
              initial={`To: ${gm ? personName(d, gm.id) : 'the township general manager'}. ${o.workOrder.id} at ${r.name} (${r.plate}) is ${o.days} day${o.days > 1 ? 's' : ''} overdue, due ${dayTime(o.workOrder.dueAt!)}.`}
              cancel={close}
              save={(body) =>
                act(() =>
                  client.draftNotice({
                    body: {
                      kind: 'escalation',
                      subjectId: o.workOrder.id,
                      title: `Overdue work: ${r.name} ${r.plate}`,
                      body
                    }
                  })
                )
              }
            />
          ) : (
            <button
              className="btn"
              onClick={() => {
                setComposing(o.workOrder.id)
                lead.set(key(o.workOrder.id))
              }}
            >
              Draft escalation
            </button>
          )}
        </div>
      ))}
      {overdue.length === 0 && escalations.length === 0 && (
        <p className="hint">
          No work order is past its due date. Work with no due date is not counted, so this is not an all-clear.
        </p>
      )}
      <Failure error={error} />
      <p className="hint">Escalations go to the township general manager, set by policy. A person sends them.</p>
    </section>
  )
}

export function Report({
  d,
  rows,
  now,
  lead,
  reload
}: {
  d: Data
  rows: Row[]
  now: number
  lead: Lead
  reload: () => void
}) {
  const { client } = useSignedIn()
  const { error, act } = useAct(() => {
    close()
    reload()
  })
  const [composing, setComposing] = useState(false)
  const close = () => {
    if (lead.last === 'report') lead.set(null)
    setComposing(false)
  }
  const reports = (d.notices ?? []).filter((n) => n.kind === 'monthly_report')
  const latest = reports[reports.length - 1]
  return (
    <section className="island panel" aria-labelledby="rep-h">
      <h2 id="rep-h">Monthly report · {month(now)}</h2>
      {d.notices === null && <p className="hint">{WHO_SEES}</p>}
      {latest && <NoticeCard d={d} n={latest} act={act} />}
      {d.notices !== null && !latest && !composing && <p className="hint">No report has been drafted yet.</p>}
      <p className="state neutral">
        <Info size={20} weight="bold" aria-hidden="true" />
        The agent&apos;s draft needs the live API.
      </p>
      {composing ? (
        <Compose
          primary={lead.last === null || lead.last === 'report'}
          label="Monthly report"
          initial={reportBody(rows, now)}
          cancel={close}
          save={(body) =>
            act(() =>
              client.draftNotice({
                body: { kind: 'monthly_report', subjectId: null, title: `Monthly report · ${month(now)}`, body }
              })
            )
          }
        />
      ) : (
        can('draftNotice') && (
          <button
            className="btn"
            onClick={() => {
              setComposing(true)
              lead.set('report')
            }}
          >
            Draft the report
          </button>
        )
      )}
      {latest && (
        <div className="row-actions">
          <button className="btn" onClick={() => window.print()}>
            <DownloadSimple size={20} weight="bold" aria-hidden="true" />
            Export printable page
          </button>
          <button
            className="btn"
            onClick={() => download('monthly-report.md', 'text/markdown', reportMarkdown(latest, author(d, latest)))}
          >
            Markdown
          </button>
          <button
            className="btn"
            onClick={() => download('monthly-report.json', 'application/json', JSON.stringify(latest, null, 2))}
          >
            JSON
          </button>
        </div>
      )}
      <Failure error={error} />
      {latest && (
        <div className="print-sheet" aria-hidden="true">
          <h1>{latest.title}</h1>
          <p>
            Drafted by {author(d, latest)} · {latest.status === 'sent' ? 'sent' : 'not sent'}
          </p>
          <p className="notice-body">{latest.body}</p>
          {latest.simulated && <p>Simulated sample data.</p>}
        </div>
      )}
    </section>
  )
}
