import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import type { Pose, Segment } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { Screen } from '../../shell/Shell'
import { useSignedIn } from '../../store'
import { ROLE_WORDS } from '../fix-lens/lens'
import type { Shot } from './Camera'
import {
  attachReportToQueued,
  drain,
  explain,
  queueReportForObservation,
  sendReportOnline,
  useCapture,
  sentKey,
  type Sent
} from './queue'
import {
  ACTIONS,
  ACTION_LABELS,
  CAUSES,
  CAUSE_LABELS,
  ISSUE_LABELS,
  ISSUE_TYPES,
  URGENCY_DETAILS,
  URGENCIES,
  resolveInitialWhen,
  resolveInitialWhere,
  timeSourceLabel,
  whereSourceLabel,
  type Action,
  type Cause,
  type DamageReportInput,
  type IssueType,
  type Urgency,
  type WhenValue,
  type WhereValue
} from './report-metadata'

const person = (name: string) => name.replace(/\s*\([^)]*\)$/, '')

const formatWhen = (iso: string) => {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    return iso
  }
}

export function ReportForm({
  segment,
  viewpoint,
  shot,
  sent,
  queuedId,
  onClose
}: {
  segment: Segment
  viewpoint: { id: string; name: string; pose: Pose }
  shot: Shot
  sent: Sent | null
  queuedId?: number
  onClose: () => void
}) {
  const { user } = useSignedIn()
  const captures = useCapture()
  const observation = sent ?? captures.sent[sentKey(segment.id, viewpoint.id)]
  const context = `${person(user.name)} · ${ROLE_WORDS[user.role] ?? 'walk crew'}`

  const [photoUrl, setPhotoUrl] = useState<string>('')
  useEffect(() => {
    const url = URL.createObjectURL(shot.blob)
    setPhotoUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [shot.blob])

  const [where, setWhere] = useState<WhereValue>({
    lat: viewpoint.pose?.lat ?? null,
    lon: viewpoint.pose?.lon ?? null,
    accuracyM: null,
    source: viewpoint.pose ? 'viewpoint' : 'manual',
    note: null
  })

  const [when, setWhen] = useState<WhenValue>({
    observedAt: shot.source === 'camera' ? (shot.capturedAt ?? new Date().toISOString()) : '',
    timeSource: shot.source === 'camera' ? 'capture' : 'manual'
  })

  useEffect(() => {
    let live = true
    Promise.all([resolveInitialWhere(shot, viewpoint.pose), resolveInitialWhen(shot)]).then(([initWhere, initWhen]) => {
      if (live) {
        setWhere((previous) => (previous.source === 'manual' ? previous : initWhere))
        setWhen((previous) => (previous.timeSource === 'manual' && previous.observedAt !== '' ? previous : initWhen))
      }
    })
    return () => {
      live = false
    }
  }, [shot, viewpoint.pose])

  const [description, setDescription] = useState('')
  const [issueType, setIssueType] = useState<IssueType | null>(null)
  const [issueTypeOther, setIssueTypeOther] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [urgency, setUrgency] = useState<Urgency | null>(null)
  const [cause, setCause] = useState<Cause>('unknown')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<'sent' | 'queued' | null>(null)

  // Validation
  const descriptionValid = description.trim().length > 0
  const whenValid = when.observedAt.trim().length > 0 && Number.isFinite(Date.parse(when.observedAt))
  const typeValid = issueType !== null
  const otherValid = issueType !== 'other' || issueTypeOther.trim().length > 0
  const urgencyValid = urgency !== null
  const isValid = descriptionValid && whenValid && typeValid && otherValid && urgencyValid

  const missing: string[] = []
  if (!whenValid) missing.push('the time')
  if (!typeValid) missing.push('what it is')
  else if (!otherValid) missing.push('say what it is')
  if (!descriptionValid) missing.push('a description')
  if (!urgencyValid) missing.push('how urgent')

  const submit = async () => {
    if (!isValid || busy || success) return
    setBusy(true)
    setError(null)
    try {
      const report: DamageReportInput = {
        description: description.trim(),
        viewpointId: viewpoint.id,
        where:
          where.lat !== null && where.lon !== null
            ? {
                lat: Number(where.lat),
                lon: Number(where.lon),
                accuracyM: where.accuracyM !== null ? Number(where.accuracyM) : null,
                source: where.source,
                note: where.note?.trim() || null
              }
            : null,
        observedAt: new Date(when.observedAt).toISOString(),
        timeSource: when.timeSource,
        issueType: issueType!,
        issueTypeOther: issueType === 'other' ? issueTypeOther.trim() : null,
        action: action ?? null,
        actionNote: actionNote.trim() || null,
        urgency: urgency!,
        cause
      }

      if (!navigator.onLine) {
        if (queuedId !== undefined) {
          await attachReportToQueued(queuedId, report)
        } else if (observation?.observationId) {
          await queueReportForObservation({
            userId: user.id,
            userName: person(user.name),
            segmentId: segment.id,
            viewpointId: viewpoint.id,
            capturedAt: shot.capturedAt ?? new Date().toISOString(),
            pose: viewpoint.pose,
            simulated: segment.simulated,
            observationId: observation.observationId,
            report
          })
        } else {
          throw new Error('No queued photo or observation available to attach this report to')
        }
        setSuccess('queued')
      } else {
        if (observation?.observationId) {
          await sendReportOnline({
            segmentId: segment.id,
            observationId: observation.observationId,
            simulated: segment.simulated,
            report
          })
          setSuccess('sent')
        } else if (queuedId !== undefined) {
          await attachReportToQueued(queuedId, report)
          await drain(user.id)
          setSuccess('sent')
        } else {
          throw new Error('No observation available to submit report for')
        }
      }
    } catch (e: unknown) {
      setError(`Could not send the report: ${explain(e)}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Report a problem" context={context} back={{ label: 'Back to viewpoints', onClick: onClose }}>
      <main className="detail island capture report-form" aria-label="Report a problem">
        {success && (
          <div className="banner ok" role="status">
            <CheckCircle size={22} weight="bold" aria-hidden="true" />
            <div>
              {success === 'sent' ? (
                <>
                  <b>Report sent to the manager.</b> Reported {formatWhen(when.observedAt)}. Next: the manager confirms.
                </>
              ) : (
                <>
                  <b>Report saved to your phone.</b> It waits in your queue and sends when you are back online.
                </>
              )}
              <div style={{ marginTop: '8px' }}>
                <button className="btn primary" type="button" onClick={onClose}>
                  Back to viewpoints
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="banner error" role="alert">
            <WarningCircle size={22} weight="bold" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Photo Card */}
        <div className="card">
          <figure className="photo">
            {photoUrl && <img src={photoUrl} alt={`Photo taken at ${viewpoint.name}`} />}
            <figcaption>
              <span>{viewpoint.name}</span>
              {when.observedAt && <span>{formatWhen(when.observedAt)}</span>}
            </figcaption>
          </figure>
        </div>

        {/* Location & Time Card */}
        <div className="card">
          <div className="field">
            <div className="field-header">
              <span className="lab">Where</span>
              <span className="src">{whereSourceLabel(where.source)}</span>
            </div>
            <div className="auto">
              <div className="v">
                <b>{segment.name}</b>
                <span className="cap">
                  {where.lat !== null && where.lon !== null
                    ? `${where.lat.toFixed(4)}, ${where.lon.toFixed(4)}${
                        where.accuracyM !== null ? ` · within ${where.accuracyM} m` : ''
                      }`
                    : viewpoint.name}
                </span>
              </div>
            </div>
            <div className="grid2" style={{ marginTop: '8px' }}>
              <div className="field">
                <label htmlFor="where-lat">Latitude</label>
                <input
                  id="where-lat"
                  className="input"
                  type="number"
                  step="any"
                  value={where.lat ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value)
                    setWhere((prev) => ({ ...prev, lat: val, source: 'manual' }))
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="where-lon">Longitude</label>
                <input
                  id="where-lon"
                  className="input"
                  type="number"
                  step="any"
                  value={where.lon ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value)
                    setWhere((prev) => ({ ...prev, lon: val, source: 'manual' }))
                  }}
                />
              </div>
            </div>
          </div>

          <div className="field">
            <div className="field-header">
              <label htmlFor="when-input">When</label>
              {when.observedAt ? (
                <span className="src">{timeSourceLabel(when.timeSource)}</span>
              ) : (
                <span className="src none">Add it yourself</span>
              )}
            </div>
            <input
              id="when-input"
              className={`input${!whenValid ? ' err' : ''}`}
              type="text"
              placeholder="e.g. 2026-10-22T14:05:00.000Z"
              value={when.observedAt}
              onChange={(e) => {
                setWhen({
                  observedAt: e.target.value,
                  timeSource: 'manual'
                })
              }}
            />
            {!whenValid ? (
              <p className="errtxt">Add when you saw it.</p>
            ) : (
              <p className="cap">{formatWhen(when.observedAt)}</p>
            )}
          </div>
        </div>

        {/* Problem & Description Card */}
        <div className="card">
          <div className="field" role="radiogroup" aria-label="What did you see?">
            <span className="lab">
              What did you see? <span className="req">(choose one)</span>
            </span>
            <div className="opts">
              {ISSUE_TYPES.map((t) => (
                <label key={t} className="opt">
                  <input
                    type="radio"
                    name="issueType"
                    value={t}
                    checked={issueType === t}
                    onChange={() => setIssueType(t)}
                  />
                  <span>{ISSUE_LABELS[t]}</span>
                </label>
              ))}
            </div>
            {issueType === 'other' && (
              <div className="field" style={{ marginTop: '8px' }}>
                <label htmlFor="issue-other">Say what it is</label>
                <input
                  id="issue-other"
                  className={`input${!otherValid ? ' err' : ''}`}
                  value={issueTypeOther}
                  onChange={(e) => setIssueTypeOther(e.target.value)}
                />
                {!otherValid && <p className="errtxt">Say what it is.</p>}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="report-desc">
              What did you see? <span className="req">(required)</span>
            </label>
            <textarea
              id="report-desc"
              className={`input${!descriptionValid ? ' err' : ''}`}
              placeholder="Describe it in your words"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {!descriptionValid && <p className="errtxt">Describe what you saw.</p>}
          </div>
        </div>

        {/* Action, Urgency & Cause Card */}
        <div className="card">
          <div className="field" role="radiogroup" aria-label="What needs to be done">
            <span className="lab">What needs to be done</span>
            <div className="opts">
              {ACTIONS.map((a) => (
                <label key={a} className="opt">
                  <input type="radio" name="action" value={a} checked={action === a} onChange={() => setAction(a)} />
                  <span>{ACTION_LABELS[a]}</span>
                </label>
              ))}
            </div>
            <div className="field" style={{ marginTop: '8px' }}>
              <label htmlFor="action-note">
                Note <span className="req">(optional)</span>
              </label>
              <input
                id="action-note"
                className="input"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </div>

          <div className="field" role="radiogroup" aria-label="How urgent">
            <span className="lab">
              How urgent <span className="req">(required)</span>
            </span>
            <div className="opts one">
              {URGENCIES.map((u) => {
                const det = URGENCY_DETAILS[u]
                return (
                  <label key={u} className="opt urg">
                    <input
                      type="radio"
                      name="urgency"
                      value={u}
                      checked={urgency === u}
                      onChange={() => setUrgency(u)}
                    />
                    <span>
                      <b>{det.label}</b>
                      <small>{det.hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="field">
            <label htmlFor="report-cause">Possible cause</label>
            <select
              id="report-cause"
              className="input"
              value={cause}
              onChange={(e) => setCause(e.target.value as Cause)}
            >
              {CAUSES.map((c) => (
                <option key={c} value={c}>
                  {CAUSE_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pinned Action Card */}
        <div className="card pinned">
          {missing.length > 0 && (
            <div className="banner warn">
              <WarningCircle size={22} weight="bold" aria-hidden="true" />
              <span>Still needed: {missing.join(', ')}.</span>
            </div>
          )}
          <button
            className={`btn primary${!isValid || busy ? ' disabled' : ''}`}
            type="button"
            disabled={!isValid || busy || success !== null}
            onClick={submit}
          >
            {busy ? 'Sending report…' : 'Send report'}
          </button>
          <p className="cap">No connection? It waits in your queue and sends when you are back online.</p>
        </div>
      </main>
    </Screen>
  )
}
