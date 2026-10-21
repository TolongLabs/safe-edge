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

const f = (name: string, opacity?: number) => ({ opacity, style: { fill: `var(--art-${name})` } })
const s = (name: string, width: number) =>
  ({ fill: 'none', strokeWidth: width, strokeLinecap: 'round', style: { stroke: `var(--art-${name})` } }) as const

/** A repeatable 0 to 1 value per index, so scattered details sit in the same place on every render. */
const rnd = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}
const r1 = (v: number) => Math.round(v * 10) / 10

type Crown = [cx: number, cy: number, r: number]

/** Leafy crowns: each a shaded disc with a lit cluster up and to its left. */
function Crowns({ crowns, shade = 'tree-dark', lit = 'tree' }: { crowns: Crown[]; shade?: string; lit?: string }) {
  return (
    <>
      {crowns.map(([cx, cy, r], i) => (
        <circle key={i} cx={r1(cx)} cy={r1(cy)} r={r1(r)} {...f(shade)} />
      ))}
      {crowns.map(([cx, cy, r], i) => (
        <circle key={`lit${i}`} cx={r1(cx - r * 0.3)} cy={r1(cy - r * 0.35)} r={r1(r * 0.5)} {...f(lit)} />
      ))}
    </>
  )
}

/** A row of crowns along `y`, for a tree line; the ground drawn after it hides their feet. */
const treeLine = (y: number, size: number, seed: number): Crown[] =>
  Array.from({ length: Math.ceil(W / (size * 0.8)) + 2 }, (_, i) => [
    (i - 0.5) * size * 0.8 + (rnd(seed + i) - 0.5) * size * 0.4,
    y - size * 0.35 - rnd(seed + i + 50) * size * 0.3,
    size * (0.45 + rnd(seed + i + 100) * 0.25)
  ])

/** A bush of three crowns, `r` either side of `x`, sitting on `y`. */
const shrub = (x: number, y: number, r: number): Crown[] => [
  [x - r * 0.5, y - r * 0.45, r * 0.55],
  [x + r * 0.45, y - r * 0.5, r * 0.6],
  [x, y - r * 0.8, r * 0.62]
]

/** Crowns scattered over a region, for a tree canopy. */
const foliage = (x: number, y: number, w: number, h: number, n: number, seed: number): Crown[] =>
  Array.from({ length: n }, (_, i) => [
    x + rnd(seed + i) * w,
    y + rnd(seed + i + 300) * h,
    22 + rnd(seed + i + 600) * 22
  ])

/** Grass tufts scattered over a band, growing towards its near (lower) edge. */
function Tufts({ x, y, w, h, n, seed }: { x: number; y: number; w: number; h: number; n: number; seed: number }) {
  const d = Array.from({ length: n }, (_, i) => {
    const tx = r1(x + rnd(seed + i) * w)
    const ty = r1(y + rnd(seed + i + 500) * h)
    const k = 0.6 + ((ty - y) / h) * 0.8
    return `M${r1(tx - 2 * k)} ${r1(ty - 3 * k)}L${tx} ${ty}L${r1(tx + 2 * k)} ${r1(ty - 3 * k)}M${tx} ${ty}V${r1(ty - 4.5 * k)}`
  }).join('')
  return <path d={d} {...s('grass-dark', 0.9)} />
}

/** Short light strokes over a band of water. */
function Ripples({ x, y, w, h, n, seed }: { x: number; y: number; w: number; h: number; n: number; seed: number }) {
  const d = Array.from(
    { length: n },
    (_, i) => `M${r1(x + rnd(seed + i) * w)} ${r1(y + rnd(seed + i + 200) * h)}h${r1(6 + rnd(seed + i + 400) * 16)}`
  ).join('')
  return <path d={d} {...s('water-light', 1.2)} />
}

/** A clump of reeds rising from the water's edge at `x`, `y`. */
const Reeds = ({ x, y }: { x: number; y: number }) => (
  <path
    d={`M${x} ${y}q-3 -8 -7 -14M${x + 2} ${y}q0 -9 1 -18M${x + 4} ${y}q3 -7 8 -12M${x + 6} ${y}q1 -6 3 -10`}
    {...s('reed', 1.3)}
  />
)

const Cloud = ({ x, y, k }: { x: number; y: number; k: number }) => (
  <g {...f('cloud')}>
    <ellipse cx={x} cy={y} rx={26 * k} ry={7 * k} />
    <ellipse cx={x - 8 * k} cy={y - 5 * k} rx={12 * k} ry={8 * k} />
    <ellipse cx={x + 9 * k} cy={y - 6 * k} rx={14 * k} ry={9 * k} />
  </g>
)

/** A ring buoy, red with four white bands and its grab line: upright where `ry` is `rx`, lying flat where it is less. */
function Ring({ cx, cy, rx, ry, width }: { cx: number; cy: number; rx: number; ry: number; width: number }) {
  const grab = width / 2 + 2
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx + grab} ry={ry + grab * (ry / rx)} {...s('rope', 1.2)} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...s('buoy', width)} />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        {...s('white', width)}
        strokeLinecap="butt"
        pathLength={100}
        strokeDasharray="7 18"
        strokeDashoffset={3.5}
      />
    </>
  )
}

/** One railing panel: top and bottom rails with seven upright bars. */
function Panel({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <>
      <rect x={x} y={y} width={width} height={3} {...f('post')} />
      <rect x={x} y={y + height - 3} width={width} height={3} {...f('post')} />
      {Array.from({ length: 7 }, (_, j) => (
        <rect key={j} x={r1(x + ((j + 1) * width) / 8 - 0.8)} y={y} width={1.6} height={height} {...f('post')} />
      ))}
    </>
  )
}

const BAY = 40

/** Posts `BAY` apart from `x` with a panel between each pair, leaving out panel `skip`. */
function Railing({
  x,
  bays,
  top,
  bottom,
  skip
}: {
  x: number
  bays: number
  top: number
  bottom: number
  skip?: number
}) {
  return (
    <>
      {Array.from({ length: bays }, (_, i) =>
        i === skip ? null : <Panel key={i} x={x + i * BAY + 3} y={top} width={BAY - 6} height={bottom - top} />
      )}
      {Array.from({ length: bays + 1 }, (_, i) => (
        <g key={`post${i}`}>
          <rect x={x + i * BAY - 3} y={top - 8} width={6} height={bottom - top + 16} {...f('post')} />
          <rect x={x + i * BAY - 4} y={top - 10} width={8} height={3} rx={1} {...f('post')} />
        </g>
      ))}
    </>
  )
}

// The fence scene's railing, and the shapes the after images change, shared with a close-up's outline of the baseline.
const FENCE = { x: 40, bays: 8, top: 100, bottom: 156 }
const bay = (i: number) => ({
  x: FENCE.x + i * BAY + 3,
  y: FENCE.top,
  width: BAY - 6,
  height: FENCE.bottom - FENCE.top
})
const MISSING_BAY = 3
const RING = { cx: 200, cy: 125, r: 28, width: 12 }

function Art({ scene, variant }: { scene: Scene; variant: 'before' | 'after' }) {
  const after = variant === 'after'
  switch (scene) {
    // From over the water: the bank, the railing on it, the playground path and the playground beyond.
    case 'fence':
      return (
        <>
          <rect width={W} height={H} {...f('sky')} />
          <Cloud x={70} y={22} k={1} />
          <Cloud x={310} y={16} k={0.8} />
          <Crowns crowns={treeLine(62, 26, 1)} />
          <rect y="60" width={W} height="104" {...f('grass')} />
          <Tufts x={0} y={64} w={W} h={92} n={60} seed={7} />
          <ellipse cx="121" cy="84" rx="58" ry="3.5" {...f('play-surface')} />
          <path d="M74 85L86 56L98 85M144 85L156 56L168 85M86 56H156" {...s('post', 2)} />
          <path d="M106 56V77M114 56V77M128 56V77M136 56V77" {...s('post', 0.8)} />
          <rect x="104" y="76" width="12" height="2.5" {...f('play')} />
          <rect x="126" y="76" width="12" height="2.5" {...f('play')} />
          <path d="M205 86V40H211" {...s('post', 1.6)} />
          <rect x="208" y="39" width="8" height="3" rx="1" {...f('post')} />
          <ellipse cx="270" cy="84" rx="40" ry="3.5" {...f('play-surface')} />
          <path d="M233 59L245 47L257 59Z" {...f('roof')} />
          <path d="M237 59V85M245 59V85M237 64H245M237 69H245M237 74H245M237 79H245M255 59V85" {...s('post', 1.4)} />
          <rect x="235" y="58" width="22" height="3" {...f('post')} />
          <path d="M257 61C271 63 282 80 302 82" {...s('play', 5)} />
          <rect y="86" width={W} height="8" {...f('paving')} />
          <rect y="93" width={W} height="1.5" {...f('paving-edge')} />
          {/* The way trodden around the fence end */}
          <path d="M366 95C372 118 368 140 376 168" {...s('path', 7)} />
          <Crowns crowns={[...shrub(14, 164, 30), ...shrub(400, 160, 20)]} />
          <rect y="176" width={W} height="74" {...f('water')} />
          {Array.from({ length: FENCE.bays + 1 }, (_, i) => (
            <rect key={i} x={FENCE.x + i * BAY - 3} y="192" width="6" height="22" {...f('post', 0.12)} />
          ))}
          <Ripples x={0} y={194} w={W} h={52} n={26} seed={20} />
          <path
            d="M0 160C60 156 120 165 200 160S330 157 400 161V186C330 190 260 182 200 187S70 182 0 188Z"
            {...f('bank')}
          />
          <path
            d="M0 181C70 186 140 179 200 184S330 180 400 183V186C330 190 260 182 200 187S70 182 0 188Z"
            {...f('bank-dark')}
          />
          {(
            [
              [30, 186, 6, 3],
              [88, 185, 4, 2.5],
              [150, 188, 7, 3.5],
              [214, 186, 5, 3],
              [290, 187, 6, 3],
              [352, 185, 4, 2.5]
            ] as const
          ).map(([cx, cy, rx, ry]) => (
            <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} {...f('stone')} />
          ))}
          {[20, 126, 262, 338].map((x) => (
            <Reeds key={x} x={x} y={187} />
          ))}
          <rect x={FENCE.x} y="158" width={FENCE.bays * BAY} height="4" {...f('post', 0.15)} />
          <Railing {...FENCE} skip={after ? MISSING_BAY : undefined} />
        </>
      )
    // From the path: the ring buoy post on the grass, the lake behind it.
    case 'buoy':
      return (
        <>
          <rect width={W} height={H} {...f('sky')} />
          <Cloud x={320} y={10} k={0.7} />
          <Crowns crowns={treeLine(26, 14, 30)} />
          <rect y="24" width={W} height="4" {...f('grass-dark')} />
          <rect y="28" width={W} height="52" {...f('water')} />
          <Ripples x={0} y={32} w={W} h={42} n={24} seed={40} />
          <path d="M0 78C80 74 160 81 240 77S350 75 400 78V86H0Z" {...f('bank')} />
          {[30, 150, 270, 360].map((x) => (
            <Reeds key={x} x={x} y={82} />
          ))}
          <rect y="84" width={W} height="78" {...f('grass')} />
          <Tufts x={0} y={88} w={W} h={68} n={50} seed={50} />
          <path d="M44 152V126M108 152V126M48 152V138M104 152V138" {...s('post', 2)} />
          <rect x="40" y="118" width="72" height="4" rx="1" {...f('trunk')} />
          <rect x="40" y="125" width="72" height="4" rx="1" {...f('trunk')} />
          <rect x="36" y="134" width="80" height="5" rx="1" {...f('trunk')} />
          <rect x="134" y="130" width="14" height="22" rx="2" {...f('post')} />
          <rect x="132" y="127" width="18" height="4" rx="1" {...f('roof')} />
          <rect y="160" width={W} height="90" {...f('paving')} />
          <rect y="158" width={W} height="4" {...f('paving-edge')} />
          <path
            d="M0 192H400M0 226H400M60 162V192M180 162V192M300 162V192M120 192V226M240 192V226M360 192V226M60 226V250M180 226V250M300 226V250"
            {...s('paving-edge', 1)}
          />
          <path d="M380 160V40H371" {...s('post', 2)} />
          <rect x="364" y="38" width="10" height="4" rx="1" {...f('post')} />
          <ellipse cx="200" cy="162" rx="10" ry="3" {...f('stone')} />
          <rect x="196" y="64" width="8" height="98" {...f('post')} />
          <rect x="182" y="62" width="36" height="26" rx="2" {...f('white')} />
          <rect x="182" y="62" width="36" height="26" rx="2" {...s('post', 1.5)} />
          <circle cx="192" cy="75" r="5" {...s('buoy', 2.5)} />
          <path d="M201 70H213M201 75H213M201 80H210" {...s('post', 1.6)} />
          <rect x="196" y="99" width="12" height="3" rx="1" {...f('post')} />
          {after ? (
            <>
              <ellipse cx="294" cy="203" rx="48" ry="13" {...f('post', 0.18)} />
              <path d="M252 196C236 190 222 176 206 166" {...s('rope', 1.4)} />
              <Ring cx={290} cy={195} rx={40} ry={16} width={12} />
            </>
          ) : (
            <Ring cx={RING.cx} cy={RING.cy} rx={RING.r} ry={RING.r} width={RING.width} />
          )}
        </>
      )
    // Down the grass slope from the playground path to the pond.
    case 'path':
      return (
        <>
          <rect width={W} height={H} {...f('grass')} />
          <rect width={W} height="16" {...f('sky')} />
          <Crowns crowns={treeLine(20, 16, 60)} />
          <path d="M0 14H400V84C300 92 100 78 0 88Z" {...f('grass-light')} />
          <ellipse cx="200" cy="36" rx="168" ry="31" {...f('bank')} />
          <ellipse cx="200" cy="35" rx="160" ry="26" {...f('water')} />
          <Ripples x={90} y={18} w={210} h={32} n={16} seed={65} />
          <circle cx="120" cy="45" r="4" {...f('reed')} />
          <circle cx="129" cy="48" r="3" {...f('reed')} />
          <circle cx="292" cy="41" r="4" {...f('reed')} />
          {[64, 112, 300, 340].map((x) => (
            <Reeds key={x} x={x} y={x < 200 ? 64 : 63} />
          ))}
          <Tufts x={0} y={74} w={W} h={150} n={90} seed={70} />
          <Crowns
            crowns={[...shrub(46, 140, 30), ...shrub(362, 130, 32), ...shrub(334, 206, 20), ...shrub(70, 214, 18)]}
          />
          {after && (
            <>
              <path d="M197 60C178 110 222 150 188 230L254 230C272 150 238 104 247 60Z" {...f('grass-light')} />
              <path d="M205 60C190 110 230 150 200 230L240 230C262 150 232 105 238 60Z" {...f('path')} />
              <path d="M221 62C212 110 247 150 220 230" {...s('bank-dark', 4)} opacity={0.45} />
              {(
                [
                  [216, 90],
                  [224, 106],
                  [230, 126],
                  [236, 148],
                  [232, 172],
                  [226, 196],
                  [220, 216]
                ] as const
              ).map(([cx, cy], i) => (
                <ellipse key={cy} cx={cx + (i % 2 ? 4 : -4)} cy={cy} rx="2" ry="3.2" {...f('bank-dark', 0.6)} />
              ))}
            </>
          )}
          <rect y="228" width={W} height="22" {...f('paving')} />
          <rect y="226" width={W} height="3" {...f('paving-edge')} />
        </>
      )
    // Along the fence under the trees, the lake behind; in the after image the foliage hangs down over the panels.
    case 'canopy':
      return (
        <>
          <rect width={W} height={H} {...f('sky')} />
          <Crowns crowns={treeLine(100, 14, 90)} />
          <rect y="98" width={W} height="54" {...f('water')} />
          <Ripples x={0} y={104} w={W} h={40} n={18} seed={95} />
          <rect y="150" width={W} height="100" {...f(after ? 'canopy' : 'grass-dark')} />
          {Array.from({ length: after ? 4 : 10 }, (_, i) => (
            <ellipse
              key={i}
              cx={r1(rnd(110 + i) * W)}
              cy={r1(196 + rnd(130 + i) * 50)}
              rx={r1(10 + rnd(150 + i) * 14)}
              ry={r1(2 + rnd(170 + i) * 2)}
              {...f(after ? 'tree-dark' : 'grass-light', 0.7)}
            />
          ))}
          <rect x="20" y="186" width="360" height="4" {...f('post', 0.15)} />
          <Railing x={20} bays={9} top={142} bottom={184} />
          <path d="M64 214C67 170 66 80 69 30H81C83 80 82 170 88 214Z" {...f('trunk')} />
          <path d="M296 208C300 160 299 70 302 20H315C317 70 316 160 322 208Z" {...f('trunk')} />
          <path d="M75 70L40 40M78 90L120 56M308 60L350 30M305 84L262 54" {...s('trunk', 4)} />
          {after ? (
            <Crowns
              crowns={[
                ...foliage(-20, -10, 440, 100, 30, 200),
                [100, 120, 32],
                [140, 150, 30],
                [110, 176, 24],
                [180, 128, 30],
                [214, 160, 28],
                [160, 186, 20],
                [246, 130, 24],
                [76, 150, 22]
              ]}
              shade="canopy-deep"
              lit="canopy-dark"
            />
          ) : (
            <Crowns crowns={foliage(-20, -14, 440, 74, 26, 200)} shade="canopy" lit="tree-dark" />
          )}
        </>
      )
  }
}

/** A drawn illustration of a viewpoint. `focus` zooms to a region, filling the frame. */
export function SampleImage({
  scene,
  variant,
  focus,
  name
}: {
  scene: Scene
  variant: 'before' | 'after'
  focus?: Box
  name?: string
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
      const panel = bay(MISSING_BAY)
      return (
        <>
          <g opacity={0.35}>
            <Panel {...panel} />
          </g>
          <rect {...panel} {...line} />
        </>
      )
    }
    case 'buoy':
      return (
        <>
          <g opacity={0.35}>
            <Ring cx={RING.cx} cy={RING.cy} rx={RING.r} ry={RING.r} width={RING.width} />
          </g>
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
