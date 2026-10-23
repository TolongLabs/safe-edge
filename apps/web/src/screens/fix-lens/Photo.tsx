import type { EvidenceRef } from '@safe-edge/contracts'
import { EvidencePhoto } from '../shared/EvidencePhoto'
import type { Scene } from '../../scenes'
import { SampleImage } from '../../scenes'

export type Plate = { key: string; text: string; x: number; y: number; name: string; dashed?: boolean }
const W = 0.09
const H = 0.32

/** The finding's sample photo with opening boxes laid over it in 0 to 1 photo coordinates (the same as PhotoMark). */
export function Photo({
  scene,
  image,
  plates,
  onPlace,
  when
}: {
  scene: Scene | null
  image?: EvidenceRef | null
  plates: Plate[]
  /** Click on the photo, as 0 to 1 photo coordinates; omitted where the role may not mark. */
  onPlace?: (x: number, y: number) => void
  when: string
}) {
  return (
    <figure className="fl-photo">
      {/* A mouse shortcut only: the form beside the photo does the same by keyboard. */}
      <div
        className={`fl-frame${onPlace ? ' markable' : ''}`}
        onClick={(e) => {
          if (!onPlace) return
          const r = e.currentTarget.getBoundingClientRect()
          onPlace((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
        }}
      >
        {scene ? (
          <SampleImage scene={scene} variant="after" name="Sample illustration of the finding" />
        ) : image ? (
          <EvidencePhoto image={image} alt="Reported finding" />
        ) : (
          <p role="status">The reported photo is unavailable.</p>
        )}
        {plates.map((p) => (
          <div
            key={p.key}
            role="img"
            aria-label={p.name}
            className={`fl-box${p.dashed ? ' dashed' : ''}${p.x > 0.7 ? ' right' : ''}`}
            style={{
              left: `${Math.min(Math.max(p.x - W / 2, 0), 1 - W) * 100}%`,
              top: `${Math.min(Math.max(p.y - H / 2, 0), 1 - H) * 100}%`,
              width: `${W * 100}%`,
              height: `${H * 100}%`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="fl-plate">
              {p.text.split(' ')[0]}
              <span className="fl-plate-word">{p.text.slice(p.text.indexOf(' '))}</span>
            </span>
          </div>
        ))}
      </div>
      <figcaption>
        <b>{when}</b>
      </figcaption>
    </figure>
  )
}
