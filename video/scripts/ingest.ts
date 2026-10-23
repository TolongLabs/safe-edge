// Converts recording runs into edit-ready footage and writes src/data/footage.json. With several
// runs, each shot comes from the last run that recorded it successfully (a partial re-record wins).
// Usage: bun scripts/ingest.ts <run directory> [<later run directory> …]
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Manifest } from '../record/contract'

const root = resolve(import.meta.dirname, '..')
const runDirs = process.argv.slice(2).map((d) => resolve(d))
if (runDirs.length === 0) throw new Error('Usage: bun scripts/ingest.ts <run directory> [<later run directory> …]')
const runs = runDirs.map((dir) => ({
  dir,
  manifest: JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest
}))

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}: ${r.stderr.slice(-2000)}`)
}

const SHOTS = [
  'H1',
  'D1',
  'D2',
  'D3',
  'D3b-approve',
  'D3b-send',
  'D4',
  'D5-pass',
  'D5-board',
  'D6',
  'R1-phone',
  'R1-inbox'
]
type Shot = {
  take: number
  src: string
  width: number
  height: number
  seconds: number
  cues: Record<string, { t: number; box: { x: number; y: number; width: number; height: number } | null }>
}
const footage: { shots: Record<string, Shot & { run: string; commit: string }> } = { shots: {} }

for (const shot of SHOTS) {
  const found = runs
    .map((r) => ({ ...r, take: r.manifest.takes.filter((t) => t.shot === shot && t.status === 'ok').at(-1) }))
    .filter((r) => r.take)
    .at(-1)
  if (!found?.take) throw new Error(`No successful take for ${shot} in ${runDirs.join(', ')}`)
  const { dir: runDir, manifest, take } = found
  const editDir = join(runDir, 'edit')
  mkdirSync(editDir, { recursive: true })
  // The phone take has a Lanczos-scaled MP4 next to its native WebM; use the MP4.
  const file = shot === 'D4' ? take.file.replace(/\.webm$/, '.mp4') : take.file
  const source = join(runDir, file)
  if (!existsSync(source)) throw new Error(`Missing ${source}`)
  const target = join(editDir, `${shot}.mp4`)
  const seconds = take.durationMs / 1000
  // Constant 30 fps, with the last frame held for 4 s past the take's end so the edit can hold on a
  // result, and a keyframe every 10 frames so the edit can seek anywhere quickly.
  run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-fflags',
    '+igndts',
    '-i',
    source,
    '-vf',
    'fps=30,tpad=stop_mode=clone:stop_duration=5,format=yuv420p',
    '-t',
    (seconds + 4).toFixed(3),
    '-c:v',
    'libx264',
    '-crf',
    '14',
    '-preset',
    'medium',
    '-g',
    '10',
    '-an',
    target
  ])
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', target],
    { encoding: 'utf8' }
  )
  const [width, height] = probe.stdout.trim().split(',').map(Number) as [number, number]
  footage.shots[shot] = {
    run: manifest.runId,
    commit: manifest.commit,
    take: take.take,
    src: relative(join(root, 'public'), target),
    width,
    height,
    seconds,
    cues: Object.fromEntries(take.cues.map((c) => [c.id, { t: c.tMs / 1000, box: c.box }]))
  }
  console.log(`${shot}: ${manifest.runId} take ${take.take}, ${seconds.toFixed(2)} s, ${width}×${height}`)
}

const fonts = resolve(root, '../apps/web/node_modules/@fontsource/atkinson-hyperlegible-next/files')
mkdirSync(join(root, 'public/fonts'), { recursive: true })
for (const weight of [400, 600, 700]) {
  const name = `atkinson-hyperlegible-next-latin-${weight}-normal.woff2`
  copyFileSync(join(fonts, name), join(root, 'public/fonts', name))
}

writeFileSync(join(root, 'src/data/footage.json'), JSON.stringify(footage, null, 2) + '\n')
console.log('Wrote src/data/footage.json')
