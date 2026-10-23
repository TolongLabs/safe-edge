import { Easing, interpolate } from 'remotion'
import footage from './data/footage.json'
import voice from './data/demo-voice.json'

export const FPS = 30
export const sec = (seconds: number) => Math.round(seconds * FPS)

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1)
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const ramp = (t: number, from: number, to: number, easing = easeOut) =>
  interpolate(t, [from, to], [0, 1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

export type Box = { x: number; y: number; width: number; height: number }
export type ShotId = keyof typeof footage.shots
export type VoiceId = keyof typeof voice

export function shot(id: ShotId) {
  return footage.shots[id]
}

/** Source seconds of a cue in a take. Fails loudly if the take lacks it. */
export function cue(id: ShotId, cueId: string): number {
  const c = (footage.shots[id].cues as Record<string, { t: number } | undefined>)[cueId]
  if (!c) throw new Error(`${id} has no cue ${cueId}`)
  return c.t
}

export function voiceClip(id: VoiceId) {
  return voice[id]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function findWord(id: VoiceId, text: string, nth: number) {
  const words = voice[id].words
  const hits = words.flatMap((w, i) => (norm(w.word) === norm(text) ? [i] : []))
  const i = hits[nth - 1]
  if (i === undefined) throw new Error(`Voice ${id} has no word "${text}" (#${nth})`)
  return { words, i }
}

/**
 * Held beats inside a take: after the named word, the voice stops for `seconds` so the picture can land.
 * The take is cut in the first quiet stretch after that word, so no syllable is clipped.
 */
const PAUSES: Partial<Record<VoiceId, { after: string; nth?: number; seconds: number }[]>> = {
  d3: [
    { after: 'end', seconds: 0.4 },
    { after: 'open', seconds: 0.7 },
    { after: 'both', nth: 2, seconds: 0.5 }
  ],
  d4: [{ after: 'work', seconds: 0.3 }],
  // Room for "Approved by Lim Wei Jie" to read before the send button.
  engineer: [{ after: 'B', seconds: 0.8 }],
  d5: [
    { after: 'truth', seconds: 0.5 },
    { after: 'it', seconds: 0.4 }
  ]
}

/** Where each held beat cuts the take (source seconds) and how long it holds, in order. */
export function pauses(id: VoiceId) {
  return (PAUSES[id] ?? [])
    .map((p) => {
      const { words, i } = findWord(id, p.after, p.nth ?? 1)
      const next = words[i + 1]
      if (!next) throw new Error(`Voice ${id}: no word after "${p.after}" to pause before`)
      // Cut in the first quiet stretch after this word, so no sound is split. Whisper often starts the
      // next word up to 0.3 s early, inside the pause before it, so look that far past its start.
      const gaps = (voice[id].silences as number[][])
        .map(([a, b]) => [Math.max(a!, words[i]!.endMs), Math.min(b!, next.startMs + 300)] as const)
        .filter(([a, b]) => b - a >= 40)
        .sort((x, y) => x[0] - y[0])
      const gap = gaps[0]
      if (!gap) throw new Error(`Voice ${id}: no quiet gap after "${p.after}" to hold in`)
      return { at: (gap[0] + gap[1]) / 2000, seconds: p.seconds }
    })
    .sort((a, b) => a.at - b.at)
}

/** The take's played length: its own length plus its held beats. */
export function voiceLength(id: VoiceId) {
  return voice[id].durationMs / 1000 + pauses(id).reduce((n, p) => n + p.seconds, 0)
}

/** Seconds into a played take (held beats included) where the nth occurrence of a word starts. */
export function word(id: VoiceId, text: string, nth = 1): number {
  const { words, i } = findWord(id, text, nth)
  const start = words[i]!.startMs / 1000
  return start + pauses(id).reduce((n, p) => n + (p.at < start ? p.seconds : 0), 0)
}
