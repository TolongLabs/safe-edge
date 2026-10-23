import { spawn } from 'node:child_process'
import { readFile, mkdir, writeFile, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { RECORD_DIR, manifestPath, type Manifest, type Take } from './contract'

async function run(command: string, args: string[]): Promise<string> {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let errors = ''
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    errors = (errors + chunk.toString()).slice(-8000)
  })
  const code = await new Promise<number | null>((done, fail) => {
    child.on('error', fail)
    child.on('close', done)
  })
  if (code !== 0) throw new Error(`${command} exited ${code}: ${errors}`)
  return output
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
const current = (shot: string): Take => {
  const take = manifest.takes.filter((item) => item.shot === shot && item.status === 'ok').at(-1)
  if (!take) throw new Error(`Cannot assemble: no successful take for ${shot}; see ${manifestPath}`)
  return take
}
const cue = (take: Take, id: string): number => {
  const found = take.cues.find((item) => item.id === id)
  if (!found) throw new Error(`Cannot assemble: missing ${id} in ${take.shot}`)
  return found.tMs / 1000
}

type Window = { shot: string; start: number; seconds: number; chapter: string }
const d1 = current('D1')
const d3 = current('D3')
const d4 = current('D4')
const windows: Window[] = [
  { shot: 'H1', start: 0, seconds: 12, chapter: '1 Problem' },
  { shot: 'D1', start: cue(d1, 'd1-takeoff'), seconds: 4, chapter: '2 Solution / Find' },
  { shot: 'D1', start: cue(d1, 'd1-flag'), seconds: 6, chapter: '2 Solution / Find' },
  { shot: 'D2', start: 0, seconds: 10, chapter: '2 Solution / Confirm' },
  { shot: 'D3', start: cue(d3, 'd3-lens'), seconds: 2, chapter: '2 Solution / Fix' },
  { shot: 'D3', start: cue(d3, 'd3-marked'), seconds: 3, chapter: '2 Solution / Fix' },
  { shot: 'D3', start: cue(d3, 'd3-fix-a-open'), seconds: 7, chapter: '2 Solution / Fix' },
  { shot: 'D3', start: cue(d3, 'd3-fix-b-closed'), seconds: 7, chapter: '2 Solution / Fix' },
  { shot: 'D3', start: Math.max(0, cue(d3, 'd3-pick-b') - 1), seconds: 5, chapter: '2 Solution / Fix' },
  { shot: 'D4', start: cue(d4, 'd4-heading'), seconds: 2, chapter: '2 Solution / Prove' },
  { shot: 'D4', start: Math.max(0, cue(d4, 'd4-first') - 1), seconds: 5, chapter: '2 Solution / Prove' },
  { shot: 'D4', start: cue(d4, 'd4-photo'), seconds: 2, chapter: '2 Solution / Prove' },
  { shot: 'D4', start: Math.max(0, cue(d4, 'd4-sign') - 1), seconds: 3, chapter: '2 Solution / Prove' },
  { shot: 'D5-pass', start: 0, seconds: 11, chapter: '3 Outcome' },
  { shot: 'D5-board', start: 0, seconds: 4, chapter: '3 Outcome' }
]
if (windows.reduce((total, item) => total + item.seconds, 0) !== 83)
  throw new Error('Demo windows must total 83 seconds')
const clips = join(RECORD_DIR, 'clips')
await mkdir(clips, { recursive: true })
const font = resolve(
  import.meta.dirname,
  '../../apps/web/node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-600-normal.woff2'
)
await access(font)
const textFilter = (text: string, y: number, size: number) =>
  `drawtext=fontfile='${font.replaceAll("'", "\\'")}':text='${text}':x=64:y=${y}:fontsize=${size}:fontcolor=0x17302a`
const paths: string[] = []
for (const [index, window] of windows.entries()) {
  const take = current(window.shot)
  const source = join(RECORD_DIR, take.file)
  await access(source)
  if (window.start * 1000 > take.durationMs) throw new Error(`Window starts past the end of ${take.shot}`)
  const target = join(clips, `clip-${String(index + 1).padStart(2, '0')}.mp4`)
  const filters = [
    'setpts=PTS-STARTPTS',
    'fps=30',
    'scale=1650:928:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xe7ebe8',
    'tpad=stop_mode=clone:stop_duration=30',
    textFilter(window.chapter, 24, 32),
    textFilter('Simulation / sample data', 1034, 22),
    'format=yuv420p'
  ]
  await run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    String(window.start),
    '-i',
    source,
    '-vf',
    filters.join(','),
    '-frames:v',
    String(window.seconds * 30),
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '16',
    '-preset',
    'veryfast',
    target
  ])
  paths.push(target)
}
const list = join(clips, 'concat.txt')
await writeFile(list, paths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n') + '\n')
const target = join(RECORD_DIR, 'demo-preview.mp4')
await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', target])
const probe = JSON.parse(
  await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,r_frame_rate:format=duration',
    '-of',
    'json',
    target
  ])
)
if (
  probe.streams[0]?.width !== 1920 ||
  probe.streams[0]?.height !== 1080 ||
  Math.abs(Number(probe.format.duration) - 83) > 0.1
) {
  throw new Error(`Assembled preview has unexpected format: ${JSON.stringify(probe)}`)
}
await writeFile(
  join(RECORD_DIR, 'edit-windows.json'),
  JSON.stringify({ commit: manifest.commit, durationSeconds: 83, windows }, null, 2) + '\n'
)
console.log(`83-second silent demo preview: ${target}`)
console.log('Narration is added by the video edit; no speech service was called.')
