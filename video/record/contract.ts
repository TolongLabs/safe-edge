import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

export type Cue = {
  id: string
  tMs: number
  box: { x: number; y: number; width: number; height: number } | null
}

export type Take = {
  shot: string
  take: number
  status: 'ok' | 'failed'
  method: 'screencast' | 'frame-stepped'
  file: string
  viewport: { width: number; height: number }
  durationMs: number
  fps: number
  labelled: boolean
  cues: Cue[]
  error?: string
}

export type Manifest = {
  commit: string
  runId: string
  takes: Take[]
}

const repoRoot = resolve(import.meta.dirname, '../../')

export const RECORD_DIR: string = process.env.SAFE_EDGE_RECORD_DIR
  ? resolve(process.env.SAFE_EDGE_RECORD_DIR)
  : resolve(repoRoot, 'video/public/footage')

export const manifestPath: string = join(RECORD_DIR, 'manifest.json')

export async function commit(): Promise<string> {
  const child = spawn('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  const code = await new Promise<number | null>((res, rej) => {
    child.on('error', rej)
    child.on('close', res)
  })
  if (code !== 0 || !stdout.trim()) {
    throw new Error(`git rev-parse HEAD failed with exit code ${code}: ${stderr.trim()}`)
  }
  return stdout.trim()
}
