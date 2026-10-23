import { Audio, Video } from '@remotion/media'
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Freeze, Img, Sequence, staticFile, useCurrentFrame } from 'remotion'
import {
  PARTS,
  partLength,
  type Callout as CalloutData,
  type Clip,
  type Framing,
  type Panel,
  type Part,
  type Ring
} from './edit'
import { FPS, easeInOut, pauses, ramp, sec, shot, voiceClip } from './lib'
import { C, FONT } from './theme'

// The app window sits under the chapter bar; the phone sits left of centre with room for a callout.
const WIN = { x: 117, y: 112, w: 1686, h: 948 }
const PHONE = { cx: 700, areaTop: 104, screenH: 900, bezel: 14 }

export const placed = (() => {
  let cursor = 0
  return PARTS.map((part) => {
    const frames = sec(partLength(part))
    const p = { part, from: cursor, frames }
    cursor += frames
    return p
  })
})()
export const DEMO_FRAMES = placed.reduce((n, p) => n + p.frames, 0)

/** A take played in pieces, split at its held beats: source range and its start in the part. */
function voicePieces(part: Part) {
  const cuts = pauses(part.voice)
  const total = voiceClip(part.voice).durationMs / 1000
  const bounds = [0, ...cuts.map((c) => c.at), total]
  return bounds.slice(0, -1).map((a, k) => ({
    a,
    b: bounds[k + 1]!,
    at: part.lead + a + cuts.slice(0, k).reduce((n, c) => n + c.seconds, 0)
  }))
}

// Each voice piece's span in demo frames. The room tone fills everything between them.
const voiceSpans = placed.flatMap(({ part, from }) =>
  voicePieces(part).map((v) => ({ start: from + sec(v.at), end: from + sec(v.at + v.b - v.a) }))
)
const ROOM_RAMP = 3 // frames
const roomVolume = (f: number) =>
  Math.min(
    1,
    ...voiceSpans.map(({ start, end }) =>
      f <= start || f >= end
        ? 1
        : Math.min(1, Math.max(0, Math.max(start + ROOM_RAMP - f, f - (end - ROOM_RAMP)) / ROOM_RAMP))
    )
  )

export const Demo = () => (
  <AbsoluteFill style={{ background: C.rail, fontFamily: FONT }}>
    {placed.map(({ part, from, frames }) => (
      <Sequence key={part.id} name={part.id} from={from} durationInFrames={frames}>
        <PartView part={part} frames={frames} />
        {voicePieces(part).map((v, k) => (
          <Audio
            key={k}
            src={staticFile(voiceClip(part.voice).src)}
            from={sec(v.at)}
            trimBefore={sec(v.a)}
            trimAfter={sec(v.b)}
          />
        ))}
      </Sequence>
    ))}
    <ChapterBar />
    <Audio src={staticFile('voice/demo/room.wav')} loop loopVolumeCurveBehavior="extend" volume={roomVolume} />
  </AbsoluteFill>
)

function PartView({ part, frames }: { part: Part; frames: number }) {
  return (
    <>
      {part.clips.map((clip, i) => {
        const next = part.clips[i + 1]
        const from = sec(clip.from)
        // A clip that dissolves in keeps the one before it running underneath until it is opaque.
        const to = next ? sec(next.from + (next.fadeIn ?? 0)) : frames
        return (
          <Sequence key={i} name={`${part.id} · ${clip.shot}`} from={from} durationInFrames={to - from}>
            <FadeIn seconds={clip.fadeIn ?? 0}>
              {shot(clip.shot).height > shot(clip.shot).width ? <PhoneView clip={clip} /> : <WindowView clip={clip} />}
            </FadeIn>
          </Sequence>
        )
      })}
      {part.callouts.map((c, i) => (
        <Callout key={i} data={c} />
      ))}
      {part.board ? <Storyboard panels={part.board} /> : null}
      {part.checklist ? <Checklist {...part.checklist} /> : null}
      {part.slide ? <OpeningSlide src={part.slide.src} shrinkAt={part.slide.shrinkAt} /> : null}
    </>
  )
}

function FadeIn({ seconds, children }: { seconds: number; children: ReactNode }) {
  const t = useCurrentFrame() / FPS
  const opacity = seconds > 0 ? Math.min(1, t / seconds) : 1
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

/** A deck slide fills the frame, then shrinks into the app window and fades as the app arrives under it. */
function OpeningSlide({ src, shrinkAt }: { src: string; shrinkAt: number }) {
  const t = useCurrentFrame() / FPS
  const p = ramp(t, shrinkAt, shrinkAt + 0.6, easeInOut)
  const fade = 1 - ramp(t, shrinkAt + 0.45, shrinkAt + 0.9)
  if (fade <= 0) return null
  const push = 1 + 0.025 * ramp(t, 0, shrinkAt, (x) => x)
  const lerp = (a: number, b: number) => a + (b - a) * p
  return (
    <div
      style={{
        position: 'absolute',
        left: lerp(0, WIN.x),
        top: lerp(0, WIN.y),
        width: lerp(1920, WIN.w),
        height: lerp(1080, WIN.h),
        borderRadius: lerp(0, 14),
        overflow: 'hidden',
        opacity: fade,
        boxShadow: `0 24px 60px rgba(0,0,0,${0.35 * p})`
      }}
    >
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', transform: `scale(${push})` }} />
    </div>
  )
}

/** Steps beside the phone: each ticks green as it happens; the next one waiting is shown brighter. */
function Checklist({ title, items, until }: NonNullable<Part['checklist']>) {
  const t = useCurrentFrame() / FPS
  const show = ramp(t, 0, 0.35) * (1 - ramp(t, until - 0.25, until))
  if (show <= 0) return null
  const next = items.findIndex((it) => t < it.at)
  return (
    <div
      style={{
        position: 'absolute',
        left: 1150,
        top: 300,
        opacity: show,
        transform: `translateX(${(1 - ramp(t, 0, 0.4)) * 24}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 26
      }}
    >
      <div
        style={{
          color: C.onRailMuted,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase'
        }}
      >
        {title}
      </div>
      {items.map((it, i) => {
        const done = ramp(t, it.at, it.at + 0.25)
        const pop = 0.7 + 0.3 * ramp(t, it.at, it.at + 0.3)
        const waiting = i === next
        return (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div
              style={{
                position: 'relative',
                width: 58,
                height: 58,
                borderRadius: 999,
                boxShadow: `inset 0 0 0 3px ${waiting ? C.onRail : C.onRailMuted}`,
                opacity: waiting || done > 0 ? 1 : 0.6
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: C.valid,
                  opacity: done,
                  transform: `scale(${pop})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 34,
                  fontWeight: 700
                }}
              >
                ✓
              </div>
            </div>
            <div
              style={{
                fontSize: 50,
                fontWeight: 700,
                color: done > 0.5 ? C.surface : waiting ? C.onRail : C.onRailMuted,
                opacity: done > 0.5 || waiting ? 1 : 0.7
              }}
            >
              {it.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const BOARD = { screenH: 810, bezel: 12, top: 206, gap: 150 }

/** Phones side by side, joined by arrows. Each appears when its step is spoken, plays, then holds. */
function Storyboard({ panels }: { panels: Panel[] }) {
  const t = useCurrentFrame() / FPS
  const s = shot('D4')
  const w = (BOARD.screenH * s.width) / s.height
  const outer = w + BOARD.bezel * 2
  const left0 = (1920 - (panels.length * outer + (panels.length - 1) * BOARD.gap)) / 2
  const active = panels.findLastIndex((pn) => t >= pn.from)
  return (
    <>
      {panels.map((pn, i) => {
        const x = left0 + i * (outer + BOARD.gap)
        const show = ramp(t, pn.from, pn.from + 0.4)
        const dim = i < active ? 0.55 : 1
        const arrow = i > 0 ? ramp(t, pn.from - 0.1, pn.from + 0.3) : 0
        return (
          <div key={i}>
            {i > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: x - BOARD.gap + 28,
                  top: BOARD.top + (BOARD.screenH + BOARD.bezel * 2) / 2 - 22,
                  width: (BOARD.gap - 56) * arrow,
                  height: 44,
                  overflow: 'hidden',
                  opacity: arrow
                }}
              >
                <svg width={BOARD.gap - 56} height={44} viewBox={`0 0 ${BOARD.gap - 56} 44`}>
                  <path
                    d={`M4 22 H${BOARD.gap - 70} M${BOARD.gap - 84} 8 L${BOARD.gap - 66} 22 L${BOARD.gap - 84} 36`}
                    stroke={C.onRail}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: x + outer / 2,
                top: 118,
                transform: `translate(-50%, ${(1 - show) * 14}px)`,
                opacity: show,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                whiteSpace: 'nowrap',
                height: 64,
                padding: '0 26px 0 10px',
                borderRadius: 999,
                background: i === active ? C.surface : 'transparent',
                boxShadow: i === active ? 'none' : `inset 0 0 0 2px ${C.onRailMuted}`,
                color: i === active ? C.rail : C.onRail,
                fontSize: 36,
                fontWeight: 700
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  background: i === active ? C.rail : C.railHover,
                  color: C.onRail
                }}
              >
                {i + 1}
              </span>
              {pn.label}
            </div>
            <div
              style={{
                position: 'absolute',
                left: x,
                top: BOARD.top + (1 - show) * 24,
                padding: BOARD.bezel,
                borderRadius: 44,
                background: '#0d1d19',
                boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 0 0 2px #33594d',
                opacity: show * dim
              }}
            >
              <div
                style={{ width: w, height: BOARD.screenH, borderRadius: 32, overflow: 'hidden', background: C.surface }}
              >
                {t >= pn.from ? (
                  <Sequence from={sec(pn.from)} layout="none">
                    <Freeze frame={sec(pn.holdAt - pn.from)} active={(f) => f >= sec(pn.holdAt - pn.from)}>
                      <Video
                        src={staticFile(s.src)}
                        trimBefore={Math.round(pn.srcIn * FPS)}
                        muted
                        style={{ width: w, height: BOARD.screenH }}
                      />
                    </Freeze>
                  </Sequence>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Where the camera is at part time t: holds each framing, easing into the next over its `move`. */
function framingAt(keys: Framing[], t: number) {
  let cur = keys[0]!
  for (const k of keys.slice(1)) {
    const move = k.move ?? 0.8
    if (t >= k.at) {
      cur = k
      continue
    }
    if (t > k.at - move) {
      const p = ramp(t, k.at - move, k.at, easeInOut)
      return { x: cur.x + (k.x - cur.x) * p, y: cur.y + (k.y - cur.y) * p, z: cur.z + (k.z - cur.z) * p }
    }
    break
  }
  return cur
}

function useClip(clip: Clip) {
  const frame = useCurrentFrame()
  const s = shot(clip.shot)
  const srcT = clip.freeze ? clip.srcIn : clip.srcIn + (frame / FPS) * (clip.rate ?? 1)
  // Ingest holds each take's last frame for 4 s, so a clip may rest on its final state that long.
  if (srcT > s.seconds + 4)
    throw new Error(`${clip.shot}: needs source ${srcT.toFixed(2)} s, take has ${s.seconds} s + 4 s held`)
  return { t: clip.from + frame / FPS, s }
}

function Footage({ clip, width, height }: { clip: Clip; width: number; height: number }) {
  const video = (
    <Video
      src={staticFile(shot(clip.shot).src)}
      trimBefore={Math.round(clip.srcIn * FPS)}
      playbackRate={clip.rate ?? 1}
      muted
      style={{ width, height }}
    />
  )
  return clip.freeze ? <Freeze frame={0}>{video}</Freeze> : video
}

/** Scales a take into a W × H viewport around the framing's focus, never showing past its edges. */
function cameraLayer(
  W: number,
  H: number,
  s: { width: number; height: number },
  f: { x: number; y: number; z: number }
) {
  const S = (W / s.width) * f.z
  const tx = Math.min(0, Math.max(W - s.width * S, W / 2 - f.x * S))
  const ty = Math.min(0, Math.max(H - s.height * S, H / 2 - f.y * S))
  const style: CSSProperties = {
    position: 'absolute',
    width: s.width,
    height: s.height,
    transformOrigin: '0 0',
    transform: `translate(${tx}px, ${ty}px) scale(${S})`
  }
  return { S, style }
}

function WindowView({ clip }: { clip: Clip }) {
  const { t, s } = useClip(clip)
  const { S, style: layer } = cameraLayer(WIN.w, WIN.h, s, framingAt(clip.camera, t))
  return (
    <div
      style={{
        position: 'absolute',
        left: WIN.x,
        top: WIN.y,
        width: WIN.w,
        height: WIN.h,
        overflow: 'hidden',
        borderRadius: 14,
        background: C.canvas,
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)'
      }}
    >
      <div style={layer}>
        <Footage clip={clip} width={s.width} height={s.height} />
        {clip.rings?.map((r, i) => (
          <RingView key={i} ring={r} t={t} scale={S} />
        ))}
      </div>
    </div>
  )
}

/**
 * The phone stays whole across its width. Zooming scales the whole phone, which then runs off the top
 * or bottom of the area under the chapter bar, so the text grows without losing the ends of its lines.
 */
function PhoneView({ clip }: { clip: Clip }) {
  const { t, s } = useClip(clip)
  const f = framingAt(clip.camera, t)
  const h = PHONE.screenH * f.z
  const w = (h * s.width) / s.height
  const k = h / s.height
  const areaH = 1080 - PHONE.areaTop
  const fits = h + PHONE.bezel * 2 <= areaH
  const centred = areaH / 2 - h / 2
  const top = fits ? centred : Math.min(PHONE.bezel, Math.max(areaH - h - PHONE.bezel, areaH / 2 - f.y * k))
  return (
    <div style={{ position: 'absolute', left: 0, top: PHONE.areaTop, width: 1920, height: areaH, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: PHONE.cx - w / 2 - PHONE.bezel,
          top: top - PHONE.bezel,
          padding: PHONE.bezel,
          borderRadius: 54 * f.z,
          background: '#0d1d19',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 0 0 2px #33594d'
        }}
      >
        <div style={{ width: w, height: h, borderRadius: 40 * f.z, overflow: 'hidden', background: C.surface }}>
          <Footage clip={clip} width={w} height={h} />
        </div>
      </div>
    </div>
  )
}

function RingView({ ring, t, scale }: { ring: Ring; t: number; scale: number }) {
  const show = ramp(t, ring.from, ring.from + 0.3) * (1 - ramp(t, ring.to - 0.25, ring.to))
  if (show <= 0) return null
  const pad = 10 / scale
  const grow = 1 + (1 - ramp(t, ring.from, ring.from + 0.35)) * 0.06
  return (
    <div
      style={{
        position: 'absolute',
        left: ring.box.x - pad,
        top: ring.box.y - pad,
        width: ring.box.width + pad * 2,
        height: ring.box.height + pad * 2,
        border: `${5 / scale}px solid ${C.focus}`,
        borderRadius: 12 / scale,
        opacity: show,
        transform: `scale(${grow})`,
        boxShadow: `0 0 0 ${3 / scale}px rgba(240,176,106,0.25)`
      }}
    />
  )
}

const TONE = {
  danger: { bg: C.danger, fg: '#ffffff' },
  valid: { bg: C.valid, fg: '#ffffff' },
  neutral: { bg: C.surface, fg: C.rail }
} as const

function Callout({ data }: { data: CalloutData }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const inP = ramp(t, data.from, data.from + 0.3)
  const outP = ramp(t, data.to - 0.25, data.to)
  const show = inP * (1 - outP)
  if (show <= 0) return null
  const tone = TONE[data.tone]
  return (
    <div
      style={{
        position: 'absolute',
        left: data.x,
        top: data.y,
        transform: `translate(-50%, -50%) translateY(${(1 - ramp(t, data.from, data.from + 0.35)) * 18}px)`,
        opacity: show,
        background: tone.bg,
        color: tone.fg,
        fontSize: 54,
        fontWeight: 700,
        lineHeight: 1.1,
        padding: '22px 40px',
        borderRadius: 16,
        whiteSpace: 'nowrap',
        boxShadow: '0 18px 44px rgba(0,0,0,0.35)'
      }}
    >
      {data.text}
    </div>
  )
}

const CHAPTERS = ['Problem', 'Solution', 'Outcome'] as const

/** The three-part bar across the top. In the intro it lights each part as the voice names it. */
function ChapterBar() {
  const frame = useCurrentFrame()
  const idx = placed.findIndex((p) => frame >= p.from && frame < p.from + p.frames)
  const here = placed[Math.max(0, idx)]!
  const t = (frame - here.from) / FPS
  const part = here.part
  const prev = idx > 0 ? placed[idx - 1]!.part : part
  const mix = ramp(t, 0, 0.45)

  const litFor = (p: Part, i: number, tt: number) => {
    if (p.chapter !== null) return p.chapter === i ? 1 : 0
    // Intro: as the slide shrinks away, light Problem, Solution and Outcome in turn, the order the demo follows.
    const at = (p.slide?.shrinkAt ?? 0) + 0.35 + i * 0.22
    return ramp(tt, at, at + 0.2) * (1 - ramp(tt, (p.slide?.shrinkAt ?? 0) + 1.6, (p.slide?.shrinkAt ?? 0) + 2.0))
  }
  // The bar stays hidden while a slide fills the frame.
  const barIn = part.slide ? ramp(t, part.slide.shrinkAt, part.slide.shrinkAt + 0.5) : 1
  const doneFor = (p: Part, i: number) => (p.chapter !== null && i < p.chapter ? 1 : 0)
  const step = part.step ?? ''
  const stepIn = prev.step === part.step ? 1 : ramp(t, 0.05, 0.45)

  return (
    <div
      style={{
        position: 'absolute',
        left: WIN.x,
        right: 1920 - (WIN.x + WIN.w),
        top: 22,
        opacity: barIn,
        height: 68,
        display: 'flex',
        alignItems: 'center',
        gap: 18
      }}
    >
      {CHAPTERS.map((name, i) => {
        const lit = litFor(prev, i, 99) * (1 - mix) + litFor(part, i, t) * mix
        const done = doneFor(prev, i) * (1 - mix) + doneFor(part, i) * mix
        const showStep = i === 1 && step !== '' && part.chapter === 1
        return (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {i > 0 ? (
              <div style={{ width: 44, height: 3, borderRadius: 2, background: C.onRailMuted, opacity: 0.6 }} />
            ) : null}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                height: 68,
                padding: '0 28px 0 12px',
                borderRadius: 999,
                background: `rgba(251,252,251,${lit})`,
                boxShadow: `inset 0 0 0 2px rgba(159,181,172,${0.55 * (1 - lit)})`,
                color: lit > 0.5 ? C.rail : done > 0.5 ? C.onRail : C.onRailMuted,
                fontSize: 40,
                fontWeight: 700
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  background: lit > 0.5 ? C.rail : done > 0.5 ? C.railHover : 'transparent',
                  color: lit > 0.5 ? C.onRail : done > 0.5 ? C.onRail : C.onRailMuted,
                  boxShadow: lit > 0.5 || done > 0.5 ? 'none' : `inset 0 0 0 2px ${C.onRailMuted}`
                }}
              >
                {done > 0.5 ? '✓' : i + 1}
              </div>
              {name}
              {showStep ? (
                <span style={{ fontWeight: 600, opacity: stepIn, marginLeft: -4 }}>
                  <span style={{ opacity: 0.45, margin: '0 10px 0 0' }}>·</span>
                  {step}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
      <div style={{ flex: 1 }} />
      <SimTag />
    </div>
  )
}

function SimTag() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 44,
        padding: '0 18px',
        borderRadius: 8,
        boxShadow: `inset 0 0 0 2px ${C.onRailMuted}`,
        color: C.onRail,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase'
      }}
    >
      Simulation · sample data
    </div>
  )
}
