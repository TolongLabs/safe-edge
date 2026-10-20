/** What the mouse or fingers do in the scene, small and quiet, bottom left. Orbit controls' defaults. */
export function ControlsHint({ hidden }: { hidden: boolean }) {
  if (hidden) return null
  const touch = matchMedia('(pointer: coarse)').matches
  return (
    <p
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        margin: 0,
        padding: '4px 10px',
        borderRadius: 8,
        // Solid: over the night map a translucent strip drops the muted text under 4.5:1.
        background: '#fbfcfb',
        color: '#5d6b66',
        font: '12px/16px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        pointerEvents: 'none'
      }}
    >
      {touch ? 'Drag to rotate · Pinch to zoom · Two fingers to pan' : 'LMB rotate · MMB zoom · RMB pan'}
    </p>
  )
}
