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

// Shapes the after image changes, shared by the drawing and by a close-up's outline of the baseline.
const bay = (i: number) => ({
  panel: { x: 40 + i * 40 + 4, y: 100, width: 32, height: 55 },
  post: { x: 40 + i * 40 + 18, y: 90, width: 5, height: 75 }
})
const MISSING_BAY = 3
const RING = { cx: 200, cy: 125, r: 28, width: 12 }

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
            after && i === MISSING_BAY ? null : (
              <g key={i}>
                <rect {...bay(i).panel} {...f('panel')} />
                <rect {...bay(i).post} {...f('post')} />
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
            <circle {...RING} fill="none" strokeWidth={RING.width} style={{ stroke: 'var(--art-buoy)' }} />
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

/** A drawn illustration with the permanent "not a site photo" label. `focus` zooms to a region, filling the frame. */
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

/** Whether the baseline has an item at the flagged spot for a close-up to outline (a path that appeared has none). */
export const outlinesBaseline = (scene: Scene) => scene === 'fence' || scene === 'buoy'

/** The baseline's item at the flagged spot, faint with a dotted outline, over the after image. */
function BaselineOutline({ scene }: { scene: Scene }) {
  // A screen-sized line however far the close-up zooms; art-post stays dark in both themes, as the drawing does.
  const line = {
    fill: 'none',
    strokeWidth: 2,
    strokeDasharray: '2 3',
    vectorEffect: 'non-scaling-stroke',
    style: { stroke: 'var(--art-post)' }
  } as const
  switch (scene) {
    case 'fence': {
      const { panel, post } = bay(MISSING_BAY)
      return (
        <>
          <g opacity={0.35}>
            <rect {...panel} {...f('panel')} />
            <rect {...post} {...f('post')} />
          </g>
          <rect {...panel} {...line} />
        </>
      )
    }
    case 'buoy':
      return (
        <>
          <circle {...RING} fill="none" strokeWidth={RING.width} opacity={0.35} style={{ stroke: 'var(--art-buoy)' }} />
          <circle cx={RING.cx} cy={RING.cy} r={RING.r - RING.width / 2} {...line} />
          <circle cx={RING.cx} cy={RING.cy} r={RING.r + RING.width / 2} {...line} />
        </>
      )
    case 'path':
    case 'canopy':
      return null
  }
}

const CLOSE_UP = 4 / 3

/**
 * Where a close-up of a flagged region looks: 4:3, half as large again as the region, so the items beside it and the
 * ground under it stay in view, moved inwards (never cut) at the drawing's edges. `region` is the flagged box in percent
 * of the close-up, for its outline.
 */
export function closeUp(box: Box) {
  const [bx, by, bw, bh] = [(box.x / 100) * W, (box.y / 100) * H, (box.w / 100) * W, (box.h / 100) * H]
  const w = Math.min(Math.max(bw * 1.5, bh * 1.5 * CLOSE_UP), H * CLOSE_UP)
  const h = w / CLOSE_UP
  const within = (start: number, size: number, max: number) => Math.min(Math.max(start, 0), max - size)
  const x = within(bx + bw / 2 - w / 2, w, W)
  const y = within(by + bh / 2 - h / 2, h, H)
  return {
    viewBox: `${x} ${y} ${w} ${h}`,
    region: { x: ((bx - x) / w) * 100, y: ((by - y) / h) * 100, w: (bw / w) * 100, h: (bh / h) * 100 }
  }
}

/** The after image close up on a flagged region, with the baseline's item outlined where `baseline` is set. */
export function CloseUp({ scene, box, baseline, name }: { scene: Scene; box: Box; baseline: boolean; name: string }) {
  return (
    <svg className="close-up" viewBox={closeUp(box).viewBox} role="img" aria-label={name}>
      <Art scene={scene} variant="after" />
      {baseline && <BaselineOutline scene={scene} />}
    </svg>
  )
}
