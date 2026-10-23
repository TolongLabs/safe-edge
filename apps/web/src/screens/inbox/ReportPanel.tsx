import type { CandidateEvidence, DamageReport, PreventionStep, Quote } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { can, client, refresh, type Snapshot } from '../../store'
import { EvidencePhoto } from '../shared/EvidencePhoto'
import { ACTION_LABELS, CAUSE_LABELS, ISSUE_LABELS, PREVENTION_STEP_LABELS } from '../shared/reports'
import './report.css'

export type ReportPanelProps = {
  report: DamageReport
  evidence: CandidateEvidence
  s: Snapshot
}

const KL = 'Asia/Kuala_Lumpur'
const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: KL })
const fmt = (iso: string) => intl({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) + ' MYT'

const segmentCode = (name: string) => {
  const n = /segment (\d+)/i.exec(name)?.[1]
  return n ? `S${n}` : null
}

const whereSourceText = (src: 'photo' | 'phone' | 'viewpoint' | 'manual') => {
  switch (src) {
    case 'photo':
      return 'From the photo'
    case 'phone':
      return 'From your phone'
    case 'viewpoint':
      return 'From the viewpoint'
    case 'manual':
      return 'Manually entered'
  }
}

const timeSourceText = (src: 'photo' | 'capture' | 'manual') => {
  switch (src) {
    case 'photo':
      return 'From the photo'
    case 'capture':
      return 'From the camera'
    case 'manual':
      return 'Manually entered'
  }
}

const urgencyText = (u: DamageReport['urgency']) => {
  switch (u) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    default:
      return 'Not specified'
  }
}

const PREVENTION_STEPS: PreventionStep[] = ['cctv', 'guard', 'patrols', 'material', 'other']

export function ReportPanel({ report, evidence, s }: ReportPanelProps) {
  const reporter = s.users.find((u) => u.id === report.reportedBy)
  const reporterName = reporter ? reporter.name : `Unknown reporter (${report.reportedBy})`
  const code = segmentCode(evidence.segment.name)
  const obs = evidence.observations.find((o) => report.observationIds.includes(o.id))
  if (report.observationIds.length > 0 && !obs)
    throw new Error(`Damage report ${report.id} is missing its observation evidence`)

  const isManager = can('setReportPrevention')
  const [steps, setSteps] = useState<PreventionStep[]>(report.prevention?.steps ?? [])
  const [otherText, setOtherText] = useState(report.prevention?.other ?? '')
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [preventionError, setPreventionError] = useState<string | null>(null)

  useEffect(() => {
    setSteps(report.prevention?.steps ?? [])
    setOtherText(report.prevention?.other ?? '')
    setPreventionError(null)
    setStatusMessage(null)
  }, [report.id, report.prevention])

  const toggleStep = (step: PreventionStep) => {
    if (!isManager || saving) return
    setSteps((prev) => (prev.includes(step) ? prev.filter((x) => x !== step) : [...prev, step]))
  }

  const isOtherSelected = steps.includes('other')
  const isOtherValid = !isOtherSelected || otherText.trim().length > 0
  const saveDisabled = !isManager || saving || !isOtherValid

  const handleSavePrevention = async () => {
    if (saveDisabled) return
    setSaving(true)
    setPreventionError(null)
    setStatusMessage(null)
    try {
      await client().setReportPrevention({
        params: { id: report.id },
        body: {
          steps,
          other: isOtherSelected ? otherText.trim() : null
        }
      })
      await refresh()
      setStatusMessage('Saved')
    } catch (err) {
      setPreventionError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Cost estimate lookup: report.costEstimate -> associated remedy quote -> fallback issue #227 link
  const finding = s.findings.find((f) => f.candidateId === evidence.candidate.id)
  const workOrder = finding ? s.workOrders.find((w) => w.findingId === finding.id) : undefined

  const [remedyQuote, setRemedyQuote] = useState<Quote | null>(null)
  const [remedyLoading, setRemedyLoading] = useState(false)
  const [remedyError, setRemedyError] = useState<string | null>(null)

  useEffect(() => {
    setRemedyQuote(null)
    setRemedyLoading(false)
    setRemedyError(null)
    if (report.costEstimate) {
      setRemedyQuote(null)
      return
    }
    if (!workOrder?.remedyId) {
      setRemedyQuote(null)
      return
    }

    let live = true
    setRemedyLoading(true)
    setRemedyError(null)

    client()
      .previewRouteClosure({
        params: { id: evidence.segment.id },
        body: { remedyIds: [workOrder.remedyId] }
      })
      .then((closure) => {
        if (!live) return
        const remedy = closure.remedies.find((r) => r.id === workOrder.remedyId)
        if (remedy && remedy.quote !== 'quote_needed') {
          setRemedyQuote(remedy.quote)
        } else {
          setRemedyQuote(null)
        }
        setRemedyLoading(false)
      })
      .catch((err) => {
        if (!live) return
        setRemedyError(err instanceof Error ? err.message : String(err))
        setRemedyLoading(false)
      })

    return () => {
      live = false
    }
  }, [report.id, evidence.segment.id, workOrder?.remedyId, report.costEstimate])

  return (
    <article className="report-panel" aria-label={`Damage report ${report.id}`}>
      <header className="report-head">
        <h2>{evidence.segment.name}</h2>
        <div className="sub">
          <span>{evidence.segment.name}</span>
          {code && (
            <span className="plate">
              <span aria-hidden="true">{code}</span>
              <span className="sr">Segment {evidence.segment.id}</span>
            </span>
          )}
          <span className="chip">Damage report</span>
          <span className="chip">Source: {report.source}</span>
        </div>
      </header>

      <div className="report-main-grid">
        <figure className="report-photo-card">
          <EvidencePhoto image={obs?.image} alt={report.description || 'Damage report evidence photo'} />
          <figcaption>
            <b>Evidence photo</b>
            <span>Observation {obs?.id ?? 'recorded'}</span>
          </figcaption>
        </figure>

        <div className="report-content">
          <section className="report-card" aria-label="Report details">
            <h3>Description</h3>
            <p className="report-desc">{report.description}</p>

            <dl className="report-facts">
              <dt>Reporter</dt>
              <dd>
                <span>{reporterName}</span>
              </dd>

              <dt>Reported at</dt>
              <dd>
                <span>{fmt(report.reportedAt)}</span>
              </dd>

              <dt>Where</dt>
              <dd>
                {report.where ? (
                  <>
                    <span>
                      {report.where.lat.toFixed(5)}, {report.where.lon.toFixed(5)}
                      {report.where.accuracyM !== null ? ` (±${Math.round(report.where.accuracyM)} m)` : ''}
                    </span>
                    <span className="chip">{whereSourceText(report.where.source)}</span>
                    {report.where.note && <span>· {report.where.note}</span>}
                  </>
                ) : (
                  <span>Location unknown</span>
                )}
              </dd>

              <dt>When</dt>
              <dd>
                {report.observedAt ? (
                  <>
                    <span>{fmt(report.observedAt)}</span>
                    {report.timeSource && <span className="chip">{timeSourceText(report.timeSource)}</span>}
                  </>
                ) : (
                  <span>Observed time unknown</span>
                )}
              </dd>

              <dt>Issue</dt>
              <dd>
                <span>{report.issueType ? ISSUE_LABELS[report.issueType] : 'Unspecified'}</span>
                {report.issueType === 'other' && report.issueTypeOther && <span>({report.issueTypeOther})</span>}
              </dd>

              <dt>Suggested action</dt>
              <dd>
                <span>{report.action ? ACTION_LABELS[report.action] : 'None'}</span>
                {report.actionNote && <span>· {report.actionNote}</span>}
              </dd>

              <dt>Possible cause</dt>
              <dd>
                <span>{report.cause ? CAUSE_LABELS[report.cause] : 'Unknown'}</span>
              </dd>

              <dt>How urgent</dt>
              <dd>
                <span>{urgencyText(report.urgency)}</span>
                <span className="chip">From the reporter</span>
              </dd>
            </dl>
          </section>

          <fieldset role="group" className="prevention-fieldset">
            <legend>Prevention</legend>
            <div className="prevention-options">
              {PREVENTION_STEPS.map((step) => (
                <label key={step} className="prevention-option">
                  <input
                    type="checkbox"
                    checked={steps.includes(step)}
                    disabled={!isManager || saving}
                    onChange={() => toggleStep(step)}
                  />
                  <span>{PREVENTION_STEP_LABELS[step]}</span>
                </label>
              ))}
            </div>

            {isOtherSelected && (
              <div className="prevention-other-wrap">
                <label htmlFor={`prevention-other-${report.id}`}>Specify other prevention measure</label>
                <input
                  id={`prevention-other-${report.id}`}
                  type="text"
                  value={otherText}
                  disabled={!isManager || saving}
                  placeholder="Describe other measures"
                  onChange={(e) => setOtherText(e.target.value)}
                />
              </div>
            )}

            {isManager && (
              <div className="prevention-actions">
                <button
                  type="button"
                  className="prevention-save-btn"
                  disabled={saveDisabled}
                  onClick={handleSavePrevention}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {statusMessage && (
                  <span role="status" className="prevention-status">
                    {statusMessage}
                  </span>
                )}
                {preventionError && (
                  <span role="alert" className="prevention-err">
                    {preventionError}
                  </span>
                )}
              </div>
            )}

            {!isManager && (
              <p style={{ margin: 0, fontSize: 'var(--fs-small)', color: 'var(--text-secondary)' }}>
                Prevention measures are managed by the park manager.
              </p>
            )}
          </fieldset>

          <section className="cost-card" aria-label="Cost estimate">
            <h3>Estimated cost</h3>
            {report.costEstimate ? (
              <div className="cost-row">
                <span className="cost-amount">
                  {report.costEstimate.currency} {report.costEstimate.amount.toLocaleString()}
                </span>
                <span className="chip">estimate</span>
              </div>
            ) : remedyQuote ? (
              <div className="cost-row">
                <span className="cost-amount">
                  {remedyQuote.currency} {remedyQuote.amount.toLocaleString()}
                </span>
                <span className="chip">estimate, from repair quote</span>
              </div>
            ) : remedyLoading ? (
              <p className="cost-fallback" aria-busy="true">
                Loading estimate…
              </p>
            ) : (
              <p className="cost-fallback">
                <span>No estimate yet</span> ·{' '}
                <a href="https://github.com/TolongLabs/safe-edge/issues/227" target="_blank" rel="noopener noreferrer">
                  Track in issue #227
                </a>
              </p>
            )}
            {remedyError && (
              <p className="prevention-err" role="alert">
                {remedyError}
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  )
}
