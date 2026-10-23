// Stages the demo voiceover: trims each take to its speech, levels it, and times its words.
// Usage: bun scripts/voice.ts <folder with 6.wav … 12.wav> [<id>=<generated take.wav> …]
// Extra takes are generated speech (ElevenLabs); their digital silence never goes into the room tone.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HUMAN = { intro: 6, problem: 7, d1: 8, d2: 9, d3: 10, d4: 11, d5: 12 }
const HEAD = 0.12 // seconds kept before the first word, so its attack isn't clipped
const TAIL = 0.22 // seconds kept after the last word
// -17 LUFS mono plays as -14 LUFS once Remotion puts it on both channels: YouTube's reference level.
const TARGET_LUFS = -17

const [source, ...extra] = process.argv.slice(2)
if (!source) throw new Error('Usage: bun scripts/voice.ts <folder with 6.wav … 12.wav> [<id>=<take.wav> …]')
const TAKES: Record<string, { input: string; human: boolean }> = Object.fromEntries([
  ...Object.entries(HUMAN).map(([id, n]) => [id, { input: join(source, `${n}.wav`), human: true }]),
  ...extra.map((arg) => {
    const [id, path] = arg.split('=')
    if (!id || !path) throw new Error(`Extra take must be <id>=<path>, got ${arg}`)
    return [id, { input: resolve(path), human: false }]
  })
])
const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'public/voice/demo')
const whisperDir = join(root, 'src/data/whisper')
mkdirSync(outDir, { recursive: true })
mkdirSync(whisperDir, { recursive: true })

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}: ${r.stderr.slice(-2000)}`)
  return r.stdout + r.stderr
}

const probeDuration = (file: string) =>
  Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim())

// Speech runs from the end of the first silence (or 0) to the start of the last silence (or the end).
// `blip` is the longest sound at the head or tail treated as noise, not speech. Human takes start with
// breaths up to 0.3 s; generated speech has none, and its short first word ("And") must survive.
function speechSpan(file: string, blip: number) {
  const log = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'silencedetect=noise=-42dB:d=0.08',
    '-f',
    'null',
    '-'
  ])
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const duration = probeDuration(file)
  // A leading silence starts within `blip` of the top; skip any short blips between leading silences.
  let onset = 0
  for (let i = 0; i < starts.length && starts[i]! <= onset + blip; i++) onset = ends[i] ?? onset
  let offset = duration
  for (let i = starts.length - 1; i >= 0 && (ends[i] ?? duration) >= offset - blip; i--) offset = starts[i]!
  if (!(offset > onset + 1)) throw new Error(`${file}: no speech found (onset ${onset}, offset ${offset})`)
  const silences = starts.map((start, i) => ({ start, end: ends[i] ?? duration }))
  return { onset, offset, duration, silences }
}

function loudness(file: string, filter: string) {
  const log = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    `${filter},loudnorm=print_format=json`,
    '-f',
    'null',
    '-'
  ])
  const json = log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1)
  return JSON.parse(json) as { input_i: string; input_tp: string }
}

async function transcribe(file: string) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set')
  const form = new FormData()
  form.append('file', new Blob([readFileSync(file)], { type: 'audio/wav' }), 'take.wav')
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  form.append('language', 'en')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form
  })
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  return (await res.json()) as { text: string; words: { word: string; start: number; end: number }[] }
}

type Word = { word: string; startMs: number; endMs: number }
// Room tone: the silences outside each trimmed take, levelled with that take's gain, so the gaps
// between lines carry the same quiet room instead of dropping to digital silence.
const roomParts: string[] = []
const voice: Record<
  string,
  {
    src: string
    take: string
    durationMs: number
    gainDb: number
    text: string
    words: Word[]
    /** Quiet stretches in the staged file, in ms: the safe places to cut it. */
    silences: [number, number][]
  }
> = {}

for (const [id, { input, human }] of Object.entries(TAKES)) {
  const take = input.split('/').at(-1)!
  if (!existsSync(input)) throw new Error(`Missing take ${input}`)
  const { onset, offset, duration, silences } = speechSpan(input, human ? 0.3 : 0.08)
  const from = Math.max(0, onset - HEAD)
  const to = Math.min(duration, offset + TAIL)
  const length = to - from
  const shape = `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,highpass=f=70,afade=t=in:d=0.015,afade=t=out:st=${(length - 0.06).toFixed(3)}:d=0.06`
  // Every take enters the compressor at -20 LUFS, so it works the same on each.
  const preDb = -20 - Number(loudness(input, shape).input_i)
  const pre = `${shape},volume=${preDb.toFixed(2)}dB,acompressor=threshold=0.125:ratio=2:attack=5:release=100:knee=4`
  const output = join(outDir, `${id}.wav`)
  // The compressor evens the syllables, then an oversampled limiter at -1.5 dBFS catches the plosives.
  // The limiter costs a little loudness, so measure and correct the make-up gain to within 0.2 LU.
  let gainDb = TARGET_LUFS - Number(loudness(input, pre).input_i)
  for (let pass = 0; ; pass++) {
    const level = `${pre},volume=${gainDb.toFixed(2)}dB,aresample=192000,alimiter=limit=0.841:attack=2:release=50:level=disabled,aresample=48000`
    run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      input,
      '-af',
      level,
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      output
    ])
    const miss = TARGET_LUFS - Number(loudness(output, 'anull').input_i)
    if (Math.abs(miss) <= 0.2) break
    if (pass === 4) throw new Error(`${id}: loudness still ${miss.toFixed(2)} LU off after 5 passes`)
    gainDb += miss
  }

  // Keep only the parts of each silence that fall outside the trimmed take.
  const outside = silences.flatMap((g) => [
    { a: g.start, b: Math.min(g.end, from) },
    { a: Math.max(g.start, to), b: g.end }
  ])
  for (const gap of human ? outside : []) {
    const a = gap.a + 0.03
    const b = gap.b - 0.03
    if (b - a < 0.25) continue
    const part = join(outDir, `.room-${id}-${roomParts.length}.wav`)
    const filter = `atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,highpass=f=70,volume=${(preDb + gainDb).toFixed(2)}dB`
    run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      input,
      '-af',
      filter,
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      part
    ])
    roomParts.push(part)
  }

  const cache = join(whisperDir, `${id}.json`)
  if (!existsSync(cache)) writeFileSync(cache, JSON.stringify(await transcribe(output), null, 2) + '\n')
  const whisper = JSON.parse(readFileSync(cache, 'utf8')) as Awaited<ReturnType<typeof transcribe>>
  const speechStart = onset - from
  const words = whisper.words.map((w, i) => ({
    word: w.word,
    // Whisper pins the first word to 0; the detected onset is more accurate.
    startMs: Math.round((i === 0 ? Math.max(w.start, speechStart) : w.start) * 1000),
    endMs: Math.round(w.end * 1000)
  }))
  // The staged take is ~8 dB louder than the raw one, so its gaps sit near -45 dBFS: detect them at -36.
  const quietLog = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    output,
    '-af',
    'silencedetect=noise=-36dB:d=0.06',
    '-f',
    'null',
    '-'
  ])
  const qs = [...quietLog.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const qe = [...quietLog.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const quiet = qs.map((a, k) => [Math.round(a * 1000), Math.round((qe[k] ?? a) * 1000)] as [number, number])
  voice[id] = {
    silences: quiet,
    src: `voice/demo/${id}.wav`,
    take,
    durationMs: Math.round(probeDuration(output) * 1000),
    gainDb: Number(gainDb.toFixed(2)),
    text: whisper.text,
    words
  }
  const check = loudness(output, 'anull')
  console.log(
    `${id} (take ${take}): ${from.toFixed(2)}–${to.toFixed(2)} s → ${length.toFixed(2)} s, ${check.input_i} LUFS, ${check.input_tp} dBTP`
  )
}

if (roomParts.length < 4) throw new Error(`Only ${roomParts.length} room-tone stretches found`)
// Join the stretches with short crossfades into one loop.
const inputs = roomParts.flatMap((p) => ['-i', p])
let chain = '[0]'
const steps: string[] = []
for (let i = 1; i < roomParts.length; i++) {
  const out = i === roomParts.length - 1 ? '[room]' : `[r${i}]`
  steps.push(`${chain}[${i}]acrossfade=d=0.08${out}`)
  chain = out
}
run('ffmpeg', [
  '-v',
  'error',
  '-y',
  ...inputs,
  '-filter_complex',
  steps.join(';'),
  '-map',
  '[room]',
  '-ac',
  '1',
  '-ar',
  '48000',
  '-c:a',
  'pcm_s16le',
  join(outDir, 'room.wav')
])
for (const p of roomParts) rmSync(p)
console.log(
  `room tone: ${probeDuration(join(outDir, 'room.wav')).toFixed(2)} s from ${roomParts.length} stretches, ${loudness(join(outDir, 'room.wav'), 'anull').input_i} LUFS`
)

writeFileSync(join(root, 'src/data/demo-voice.json'), JSON.stringify(voice, null, 2) + '\n')
console.log('Wrote src/data/demo-voice.json')
