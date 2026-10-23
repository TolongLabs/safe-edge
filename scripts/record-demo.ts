import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { commit, type Manifest } from '../video/record/contract'

const args = process.argv.slice(2)
let isCheck = false
let isDraft = false
let grep: string | undefined

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!
  if (arg === '--check') {
    isCheck = true
  } else if (arg === '--draft') {
    isDraft = true
  } else if (arg === '--grep' || arg === '-g') {
    grep = args[++i]
    if (!grep || grep.startsWith('-')) throw new Error('--grep needs a test name or tag')
  } else if (arg.startsWith('--grep=')) {
    grep = arg.slice(7)
  } else if (arg.startsWith('-g=')) {
    grep = arg.slice(3)
  } else {
    throw new Error(`Unknown option: ${arg}. Use --check, --draft or --grep <pattern>.`)
  }
}

if (isCheck && isDraft) throw new Error('Choose either --check or --draft')
if (grep !== undefined && grep.trim() === '') throw new Error('--grep needs a nonempty pattern')

const sceneFps = isCheck ? '1' : isDraft ? '3' : '30'
process.env.SAFE_EDGE_RECORD_SCENE_FPS = sceneFps
if (isCheck) {
  process.env.SAFE_EDGE_RECORD_CHECK = '1'
}

async function verifyBinary(name: string): Promise<void> {
  const child = spawn(name, ['-version'], { stdio: ['ignore', 'ignore', 'pipe'] })
  let err = ''
  child.stderr?.on('data', (c: Buffer) => {
    err += c.toString()
  })
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  if (code !== 0) {
    throw new Error(`${name} is missing or not functioning properly (exit code ${code}): ${err}`)
  }
}

await verifyBinary('ffmpeg')
await verifyBinary('ffprobe')

const browserExecutable = chromium.executablePath()
if (!existsSync(browserExecutable)) {
  console.log(`Chromium not found at ${browserExecutable}. Installing root-pinned Chromium...`)
  const child = spawn('bunx', ['playwright', 'install', 'chromium'], {
    stdio: 'inherit'
  })
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  if (code !== 0) {
    throw new Error(`Failed to install root-pinned Chromium (exit code ${code})`)
  }
}

const head = await commit()
const commitPrefix = head.slice(0, 7)
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const repoRoot = resolve(import.meta.dirname, '..')
const runsDir = join(repoRoot, 'video/public/footage/runs')
await mkdir(runsDir, { recursive: true })
const runDir = await mkdtemp(join(runsDir, `${commitPrefix}-${timestamp}-`))
const runId = basename(runDir)

process.env.SAFE_EDGE_RECORD_DIR = runDir
process.env.SAFE_EDGE_RECORD_RUN_ID = runId

await mkdir(join(runDir, 'raw'), { recursive: true })

const initialManifest: Manifest = {
  commit: head,
  runId,
  takes: []
}
const manifestFile = join(runDir, 'manifest.json')
await writeFile(manifestFile, JSON.stringify(initialManifest, null, 2) + '\n', 'utf8')

const testArgs = ['playwright', 'test', '-c', 'video/record/playwright.config.ts']
if (grep) {
  testArgs.push('--grep', grep)
}

const pwChild = spawn('bunx', testArgs, {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit'
})

const pwExitCode = await new Promise<number | null>((resolve, reject) => {
  pwChild.on('error', reject)
  pwChild.on('close', resolve)
})

if (pwExitCode !== 0) {
  console.error(`Recording tests failed with exit code ${pwExitCode}`)
  console.error(`Test output: ${resolve(repoRoot, 'output/recording-tests')}`)
  process.exit(pwExitCode ?? 1)
}

if (!isCheck && !grep) {
  const assembleChild = spawn('bun', ['video/record/assemble.ts'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  })
  const assembleCode = await new Promise<number | null>((resolve, reject) => {
    assembleChild.on('error', reject)
    assembleChild.on('close', resolve)
  })
  if (assembleCode !== 0) {
    console.error(`Assembly failed with exit code ${assembleCode}`)
    process.exit(assembleCode ?? 1)
  }
}

console.log(`Manifest: ${manifestFile}`)
console.log(`Run directory: ${runDir}`)
if (!isCheck && !grep) {
  console.log(`Output preview: ${join(runDir, 'demo-preview.mp4')}`)
}
