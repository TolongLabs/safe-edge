export type Scene = 'fence' | 'buoy' | 'path' | 'canopy'
export type Box = { x: number; y: number; w: number; h: number }

const W = 400
const H = 250

const names: Record<Scene, string> = {
  fence: 'fence line by the playground path',
  buoy: 'ring buoy by the playground path',
  path: 'grass slope towards the pond',
  canopy: 'fence line under tree canopy'
}

const f = (name: string) => ({ style: { fill: `var(--art-${name})` } })

function Art({ scene, variant }: { scene: Scene; variant: 'before' | 'after' }) {
  const after = variant === 'after'
  switch (scene) {
    case 'fence':
      return (
        <>
          <rect width={W} height={H} {...f('sky')} />
          <rect y="95" width={W} height="55" {...f('grass')} />
          <rect y="150" width={W} height="30" {...f('bank')} />
          <rect y="180" width={W} height="70" {...f('water')} />
          <rect x="40" y="110" width="320" height="6" {...f('post')} />
          <rect x="40" y="145" width="320" height="6" {...f('post')} />
          {Array.from({ length: 8 }, (_, i) =>
            after && i === 3 ? null : (
              <g key={i}>
                <rect x={40 + i * 40 + 4} y="100" width="32" height="55" {...f('panel')} />
                <rect x={40 + i * 40 + 18} y="90" width="5" height="75" {...f('post')} />
              </g>
            )
          )}
          <rect x="350" y="30" width="26" height="36" rx="3" {...f('buoy')} />
        </>
      )
    case 'buoy':
      return (
        <>
          <rect width={W} height={H} {...f('sky')} />
          <rect y="20" width={W} height="55" {...f('water')} />
          <rect y="75" width={W} height="90" {...f('grass')} />
          <rect y="165" width={W} height="85" {...f('bank')} />
          <rect x="196" y="95" width="8" height="85" {...f('post')} />
          {after ? (
            <ellipse
              cx="290"
              cy="195"
              rx="40"
              ry="16"
              fill="none"
              strokeWidth="12"
              style={{ stroke: 'var(--art-buoy)' }}
            />
          ) : (
            <circle cx="200" cy="125" r="28" fill="none" strokeWidth="12" style={{ stroke: 'var(--art-buoy)' }} />
          )}
        </>
      )
    case 'path':
      return (
        <>
          <rect width={W} height={H} {...f('grass')} />
          <ellipse cx="200" cy="30" rx="150" ry="28" {...f('water')} />
          {after && (
            <path d="M205 55 C 190 110, 230 150, 200 245 L 240 245 C 262 150, 232 105, 238 55 Z" {...f('path')} />
          )}
        </>
      )
    case 'canopy':
      return (
        <>
          <rect width={W} height={H} {...f(after ? 'canopy-dark' : 'canopy')} />
          <circle cx="90" cy="80" r="85" {...f(after ? 'canopy-deep' : 'canopy-dark')} />
          <circle cx="300" cy="70" r="95" {...f(after ? 'canopy-deep' : 'canopy-dark')} />
          <rect y="200" width={W} height="50" {...f('ground')} />
        </>
      )
  }
}

/** A drawn illustration with the permanent "not a site photo" label. `focus` zooms to a region (the crop). */
export function SampleImage({
  scene,
  variant,
  focus,
  name,
  tag = true
}: {
  scene: Scene
  variant: 'before' | 'after'
  focus?: Box
  name?: string
  /** False where the frame's caption bar carries the label instead. */
  tag?: boolean
}) {
  const vb = focus
    ? (() => {
        const px = focus.w * 0.4,
          py = focus.h * 0.4
        const x = Math.max(0, focus.x - px),
          y = Math.max(0, focus.y - py)
        const x2 = Math.min(100, focus.x + focus.w + px),
          y2 = Math.min(100, focus.y + focus.h + py)
        return `${(x / 100) * W} ${(y / 100) * H} ${((x2 - x) / 100) * W} ${((y2 - y) / 100) * H}`
      })()
    : `0 0 ${W} ${H}`
  return (
    <div className="sample-image">
      <svg
        viewBox={vb}
        preserveAspectRatio={focus ? 'xMidYMid slice' : undefined}
        role="img"
        aria-label={name ?? `${variant === 'after' ? 'After' : 'Before'} image: ${names[scene]}`}
      >
        <Art scene={scene} variant={variant} />
      </svg>
      {tag && <span className="sample-tag">Sample illustration, not a site photo</span>}
    </div>
  )
}
