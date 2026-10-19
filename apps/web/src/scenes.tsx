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

function Art({ scene, variant }: { scene: Scene; variant: 'before' | 'after' }) {
  const after = variant === 'after'
  switch (scene) {
    case 'fence':
      return (
        <>
          <rect width={W} height={H} fill="#cfe3c4" />
          <rect y="175" width={W} height="75" fill="#b9a98a" />
          <rect y="20" width={W} height="60" fill="#dfeef7" />
          <rect x="40" y="110" width="320" height="6" fill="#4c5a63" />
          <rect x="40" y="150" width="320" height="6" fill="#4c5a63" />
          {Array.from({ length: 8 }, (_, i) =>
            after && i === 3 ? null : (
              <g key={i}>
                <rect x={40 + i * 40 + 4} y="95" width="32" height="75" fill="#6f7f8a" />
                <rect x={40 + i * 40 + 18} y="85" width="4" height="95" fill="#4c5a63" />
              </g>
            )
          )}
          <ellipse cx="330" cy="215" rx="55" ry="14" fill="#8fb5d1" />
        </>
      )
    case 'buoy':
      return (
        <>
          <rect width={W} height={H} fill="#cfe3c4" />
          <rect y="20" width={W} height="55" fill="#8fb5d1" />
          <rect y="165" width={W} height="85" fill="#b7b0a2" />
          <rect x="196" y="95" width="8" height="85" fill="#4c5a63" />
          {after ? (
            <ellipse cx="290" cy="195" rx="40" ry="16" fill="none" stroke="#e8590c" strokeWidth="12" />
          ) : (
            <circle cx="200" cy="125" r="28" fill="none" stroke="#e8590c" strokeWidth="12" />
          )}
        </>
      )
    case 'path':
      return (
        <>
          <rect width={W} height={H} fill="#bcd9ab" />
          <ellipse cx="200" cy="30" rx="150" ry="28" fill="#8fb5d1" />
          {after && (
            <path d="M205 55 C 190 110, 230 150, 200 245 L 240 245 C 262 150, 232 105, 238 55 Z" fill="#c9b48a" />
          )}
        </>
      )
    case 'canopy':
      return (
        <>
          <rect width={W} height={H} fill={after ? '#25402a' : '#3c5e3a'} />
          <circle cx="90" cy="80" r="85" fill={after ? '#1b3320' : '#2f4f31'} />
          <circle cx="300" cy="70" r="95" fill={after ? '#1b3320' : '#2f4f31'} />
          <rect y="200" width={W} height="50" fill="#1f2d1f" />
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
  tagRight
}: {
  scene: Scene
  variant: 'before' | 'after'
  focus?: Box
  name?: string
  /** In the slider the after image's tag sits right, clear of the divider. */
  tagRight?: boolean
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
      <span className={`sample-tag${tagRight ? ' right' : ''}`}>Sample image, not a site photo</span>
    </div>
  )
}
