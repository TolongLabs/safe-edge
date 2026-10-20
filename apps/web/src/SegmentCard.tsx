import type { PassState, SegmentView } from '@safe-edge/scene'

// Pass-state tints and inks from docs/DESIGN.md (Light).
const STATE: Record<PassState, { fg: string; bg: string }> = {
  valid: { fg: '#237446', bg: '#e3f1e8' },
  expiring: { fg: '#94500e', bg: '#fbeedd' },
  suspended: { fg: '#b02e28', bg: '#fbe9e7' },
  expired: { fg: '#5b6763', bg: '#eceeed' },
  none: { fg: '#5d6b66', bg: '#eef2ef' }
}

const day = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kuala_Lumpur'
})
const moment = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kuala_Lumpur'
})

function stateWords(segment: SegmentView): string {
  const to = segment.validTo ? day.format(new Date(segment.validTo)) : null
  switch (segment.state) {
    case 'valid':
      return to ? `Valid to ${to}` : 'Valid'
    case 'expiring':
      return to ? `Expires ${to}` : 'Expiring'
    case 'expired':
      return to ? `Expired ${to}` : 'Expired'
    case 'suspended':
      return 'Suspended'
    case 'none':
      return 'No pass yet'
  }
}

/** The pass-state shapes: filled dot, half ring, slashed ring, square, hollow ring. Colour never works alone. */
function StateMark({ state }: { state: PassState }) {
  const c = STATE[state].fg
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      {state === 'valid' && <circle cx="6" cy="6" r="6" fill={c} />}
      {state === 'expiring' && (
        <>
          <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeWidth="2" />
          <path d="M6 1 A5 5 0 0 1 6 11 Z" fill={c} />
        </>
      )}
      {state === 'expired' && (
        <>
          <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeWidth="2" />
          <path d="M2.5 9.5 L9.5 2.5" stroke={c} strokeWidth="2" />
        </>
      )}
      {state === 'suspended' && <rect width="12" height="12" fill={c} />}
      {state === 'none' && <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeWidth="2" />}
    </svg>
  )
}

/** The card a clicked segment opens: its pass state, owner and last patrol. */
export function SegmentCard({ segment, onClose }: { segment: SegmentView; onClose: () => void }) {
  const tone = STATE[segment.state]
  return (
    <section
      aria-label={`Segment: ${segment.name}`}
      data-testid="segment-card"
      style={{
        position: 'absolute',
        left: 12,
        top: 56,
        width: 'min(340px, calc(100% - 24px))',
        padding: 20,
        borderRadius: 12,
        background: '#fbfcfb',
        color: '#1c2925',
        font: '15px/22px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)',
        display: 'grid',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, font: '600 16px/22px inherit', fontFamily: 'inherit' }}>{segment.name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the segment card"
          style={{
            flex: 'none',
            width: 44,
            height: 44,
            margin: '-12px -12px 0 0',
            border: 0,
            borderRadius: 8,
            background: 'transparent',
            color: '#5d6b66',
            fontSize: 20,
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
      <p
        style={{
          margin: 0,
          justifySelf: 'start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '3px 8px',
          borderRadius: 4,
          background: tone.bg,
          color: tone.fg,
          fontWeight: 500
        }}
      >
        <StateMark state={segment.state} />
        {stateWords(segment)}
      </p>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
        <dt style={{ color: '#5d6b66' }}>Owner</dt>
        <dd style={{ margin: 0 }}>{segment.owner}</dd>
        <dt style={{ color: '#5d6b66' }}>Last patrol</dt>
        <dd style={{ margin: 0 }}>
          {segment.lastPatrolledAt ? moment.format(new Date(segment.lastPatrolledAt)) : 'No patrol yet'}
        </dd>
      </dl>
      <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>Simulated data</p>
    </section>
  )
}
