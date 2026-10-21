import type { Opening, Remedy, RouteClosure } from '@safe-edge/contracts'
import { FEATURE_BOX, must } from './lens'

const W = 520
const H = 360
const FENCE = 240
const X0 = 40
const SPAN = 440

type PlanRoute = RouteClosure['routes'][number]

// Breaks a name at the space nearest its middle when it is longer than n, so no real name is cut.
const wrap = (s: string, n: number): string[] => {
  if (s.length <= n) return [s]
  const mid = s.length / 2
  const at = [...s.matchAll(/ /g)].map((m) => m.index!).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]
  return at === undefined ? [s] : [s.slice(0, at), s.slice(at + 1)]
}

/**
 * Top-down plan drawn from core's data: the feature each route starts at, the fence line with its openings, and each
 * route as a line to its first opening. Closed: grey dashed ending in a stop bar. Open: solid red arrow into the water.
 * Unknown: dotted grey ending in a ring.
 */
export function PlanDrawing({
  openings,
  routes,
  remedy,
  name
}: {
  openings: Opening[]
  routes: PlanRoute[]
  remedy: Remedy
  name: string
}) {
  // A schematic, not a map: an opening is drawn at its photo position, or evenly spaced along the fence when it has none.
  const xOf = (id: string) => {
    const i = openings.findIndex((o) => o.id === id)
    return X0 + (must(openings[i], id).photoMarks[0]?.x ?? (i + 1) / (openings.length + 1)) * SPAN
  }
  const features = [...new Set(routes.map((r) => r.fromFeature.kind))]
  const boxX = (f: (typeof features)[number]) => X0 + ((features.indexOf(f) + 0.5) * SPAN) / features.length
  // Routes from the same box leave it side by side, so their lines and labels do not run on top of each other.
  const startX = (r: PlanRoute) => {
    const same = routes.filter((o) => o.fromFeature.kind === r.fromFeature.kind)
    return boxX(r.fromFeature.kind) + (same.indexOf(r) - (same.length - 1) / 2) * 28
  }
  const gaps = openings.map((o) => ({ id: o.id, x: xOf(o.id) })).sort((a, b) => a.x - b.x)
  const fenceParts: [number, number][] = []
  let from = X0 - 10
  for (const g of gaps) {
    fenceParts.push([from, g.x - 16])
    from = g.x + 16
  }
  fenceParts.push([from, X0 + SPAN + 10])
  const blocked = gaps.filter((g) => remedy.blocksOpeningIds.includes(g.id))
  const labelX = blocked.length
    ? Math.min(Math.max(blocked.reduce((s, g) => s + g.x, 0) / blocked.length, 110), W - 110)
    : W / 2
  const summary = routes.map((r) => `${r.fromFeature.label}: ${r.projectedStatus}`).join('; ')
  return (
    <svg
      className="fl-plan"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Plan for ${name}. ${summary || 'No ways to the water recorded'}`}
    >
      <defs>
        <marker
          id={`arrow-${remedy.id}`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 Z" className="fl-open-fill" />
        </marker>
      </defs>
      <rect width={W} height={H} className="fl-ground" />
      <path d={`M0 262 Q 130 248 260 262 T ${W} 262 V ${H} H 0 Z`} className="fl-lake" />
      <text x="16" y="305" className="fl-text">
        Lake
      </text>
      {fenceParts.map(([a, b], i) => (
        <line key={i} x1={a} x2={b} y1={FENCE} y2={FENCE} className="fl-fence" />
      ))}
      {blocked.map((g) => (
        <line key={g.id} x1={g.x - 16} x2={g.x + 16} y1={FENCE} y2={FENCE} className="fl-fence proposed" />
      ))}
      {features.map((f) => (
        <g key={f}>
          <rect x={boxX(f) - 60} y="26" width="120" height="44" rx="8" className="fl-feature" />
          <text x={boxX(f)} y="53" textAnchor="middle" className="fl-text">
            {FEATURE_BOX[f]}
          </text>
        </g>
      ))}
      {routes.map((r) => {
        const x1 = startX(r)
        const [first, ...more] = r.openingIds
        const x = first === undefined ? x1 : xOf(first)
        if (r.projectedStatus === 'open')
          return (
            <g key={r.id}>
              <line x1={x1} y1="70" x2={x} y2="326" className="fl-route open" markerEnd={`url(#arrow-${remedy.id})`} />
              {more.map((id) => (
                <line key={id} x1={xOf(id)} x2={xOf(id)} y1={FENCE - 16} y2={FENCE} className="fl-tick" />
              ))}
              <text x={(x1 + x) / 2 + 8} y="160" className="fl-text open">
                Still open
              </text>
            </g>
          )
        const isClosed = r.projectedStatus === 'closed'
        return (
          <g key={r.id}>
            <line x1={x1} y1="70" x2={x} y2={FENCE - 8} className={`fl-route ${isClosed ? 'closed' : 'unknown'}`} />
            {more.map((id) => (
              <line key={id} x1={xOf(id)} x2={xOf(id)} y1={FENCE - 16} y2={FENCE} className="fl-tick" />
            ))}
            {isClosed ? (
              <line x1={x - 9} x2={x + 9} y1={FENCE - 8} y2={FENCE - 8} className="fl-stop" />
            ) : (
              <>
                <circle cx={x} cy={FENCE - 8} r="6" className="fl-ring" />
                <text
                  x={x1 + (x - x1) * ((FENCE - 24 - 70) / (FENCE - 8 - 70)) - 8}
                  y={FENCE - 24}
                  textAnchor="end"
                  className="fl-text muted"
                >
                  Not known
                </text>
              </>
            )}
          </g>
        )
      })}
      {blocked.length > 0 && (
        <text
          x={labelX}
          y={wrap(remedy.label, 30).length > 1 ? 310 : 325}
          textAnchor="middle"
          className="fl-text small"
        >
          {wrap(remedy.label, 30).map((l, i) => (
            <tspan key={i} x={labelX} dy={i ? 15 : 0}>
              {l}
            </tspan>
          ))}
          <tspan x={labelX} dy="15">
            proposed repair, not installed
          </tspan>
        </text>
      )}
    </svg>
  )
}
