import { passStateColours, type PassState } from '@safe-edge/scene'

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

const passStates: Array<{ state: PassState; label: string; dashed: boolean }> = [
  { state: 'valid', label: 'Valid pass', dashed: false },
  { state: 'expiring', label: 'Expiring within 30 days', dashed: false },
  { state: 'suspended', label: 'Suspended', dashed: false },
  { state: 'expired', label: 'Expired', dashed: true },
  { state: 'none', label: 'No pass yet', dashed: true }
]

// Where each layer comes from, as the TRD's scene table labels it.
const sources = [
  { layer: 'Water, parks, paths, buildings', source: 'OpenStreetMap' },
  { layer: 'Fences, ring buoys, signs', source: 'modelled' }
]

/** The scene's key: what each segment colour means and where each layer comes from. */
export function Legend() {
  return (
    <aside
      aria-label="Legend"
      style={{
        position: 'absolute',
        left: 12,
        top: 44,
        width: 'min(260px, calc(100% - 24px))',
        padding: 16,
        borderRadius: 12,
        background: '#fbfcfb',
        color: '#1c2925',
        font: '14px/20px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)',
        display: 'grid',
        gap: 12
      }}
    >
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        {passStates.map(({ state, label, dashed }) => (
          <li key={state} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="8" aria-hidden="true">
              <line
                x1="2"
                y1="4"
                x2="26"
                y2="4"
                stroke={hex(passStateColours[state])}
                strokeWidth="6"
                strokeDasharray={dashed ? '6 4' : undefined}
              />
            </svg>
            {label}
          </li>
        ))}
      </ul>
      <dl style={{ margin: 0, display: 'grid', gap: 4 }}>
        {sources.map(({ layer, source }) => (
          <div key={source} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt>{layer}</dt>
            <dd style={{ margin: 0, color: '#5d6b66' }}>{source}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
