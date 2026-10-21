import { button } from './button.ts'

export type LoadState =
  { kind: 'loading'; loaded: number; total: number } | { kind: 'error'; message: string; onRetry: () => void }

/** The scene's own loading and error screen: a card on the canvas colour, with the logo, in place of bare text. */
export function LoadingCard({ state }: { state: LoadState }) {
  const failed = state.kind === 'error'
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: '#e7ebe8',
        font: '16px/24px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        color: '#1c2925'
      }}
    >
      <div
        role={failed ? 'alert' : 'status'}
        style={{
          display: 'grid',
          justifyItems: 'start',
          gap: 16,
          width: 'min(360px, 100%)',
          padding: 24,
          borderRadius: 16,
          background: '#fbfcfb',
          boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, letterSpacing: '0.06em' }}>
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={32}
            height={32}
            style={{ padding: 6, borderRadius: 8, background: '#17302a' }}
          />
          SAFE EDGE
        </span>
        {failed ? (
          <>
            <p style={{ margin: 0 }}>The Elmina simulation did not load: {state.message}</p>
            <button type="button" onClick={state.onRetry} className={button(true)}>
              Retry
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontWeight: 600 }}>Loading the Elmina simulation</p>
            <progress
              max={state.total}
              value={state.loaded}
              aria-label="Loading the map and the simulated data"
              style={{ width: '100%', height: 8, accentColor: '#17302a' }}
            />
          </>
        )}
      </div>
    </div>
  )
}
