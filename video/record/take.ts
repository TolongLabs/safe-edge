import { expect, type Locator, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { RECORD_DIR, commit, manifestPath, type Cue, type Manifest, type Take } from './contract'

export function takeFile(shot: string, take: number, extension: string): string {
  const ext = extension.replace(/^\./, '')
  return `raw/${shot}-take${take}.${ext}`
}

const isMissing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT'

async function readManifest(): Promise<Manifest | null> {
  let content: string
  try {
    content = await readFile(manifestPath, 'utf8')
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  const manifest = JSON.parse(content) as Manifest
  if (!Array.isArray(manifest.takes)) throw new Error(`Invalid recording manifest: ${manifestPath}`)
  return manifest
}

export async function nextTake(shot: string): Promise<number> {
  let highest = 0
  const manifest = await readManifest()
  for (const item of manifest?.takes ?? []) {
    if (item.shot === shot && item.take > highest) highest = item.take
  }

  try {
    const files = await readdir(join(RECORD_DIR, 'raw'))
    const prefix = `${shot}-take`
    for (const name of files) {
      if (name.startsWith(prefix)) {
        const match = name.slice(prefix.length).match(/^(\d+)\./)
        if (match) highest = Math.max(highest, Number(match[1]))
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  return highest + 1
}

export async function saveTake(take: Take): Promise<void> {
  await mkdir(RECORD_DIR, { recursive: true })
  const manifest = (await readManifest()) ?? {
    commit: await commit(),
    runId: process.env.SAFE_EDGE_RECORD_RUN_ID ?? basename(RECORD_DIR),
    takes: []
  }
  manifest.takes.push(take)
  const tmpPath = `${manifestPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  await rename(tmpPath, manifestPath)
}

export async function hold(page: Page, ms: number): Promise<void> {
  const cap = process.env.SAFE_EDGE_RECORD_CHECK === '1'
  const duration = cap ? Math.min(ms, 80) : ms
  await page.waitForTimeout(duration)
}

export async function recordTake(
  page: Page,
  shot: string,
  action: (cue: (id: string, locator: Locator) => Promise<void>) => Promise<void>,
  options?: { labelled?: boolean }
): Promise<Take> {
  const labelled = options?.labelled !== false
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 }
  // Screencast size pads rather than upscales. Capture the phone at its native viewport.
  const phone = vp.width === 390
  const size = phone ? vp : { width: 1920, height: 1080 }

  const take = await nextTake(shot)
  let file = takeFile(shot, take, 'webm')
  const absolutePath = join(RECORD_DIR, file)
  await mkdir(dirname(absolutePath), { recursive: true })

  let firstFrameSeen = false
  const captureStartWallTime = Date.now()

  let resolveFirstFrame!: () => void
  let rejectFirstFrame!: (error: Error) => void
  const firstFramePromise = new Promise<void>((resolve, reject) => {
    resolveFirstFrame = resolve
    rejectFirstFrame = reject
  })

  const onFrame = () => {
    if (!firstFrameSeen) {
      firstFrameSeen = true

      resolveFirstFrame()
    }
  }

  // Cue time keeps advancing on static pages. The encoder stamps frames with wall-clock time, which can step
  // against performance.now() under WSL time sync, so cues use the wall clock too. The actual encoder origin
  // is read from the raw file below.
  const getElapsedMs = () => Math.max(0, Math.round(Date.now() - captureStartWallTime))

  const cues: Cue[] = []
  const cue = async (id: string, locator: Locator): Promise<void> => {
    await expect(locator).toBeVisible()
    if (labelled) {
      const simulationLabel = page
        .locator('.simulation, .sim-label, .sim-long, .sim-short, [class*="simulation"]')
        .or(page.getByText(/^Simulation/))
        .first()
      await expect(simulationLabel).toBeVisible()
    }
    const tMs = getElapsedMs()
    const box = await locator.boundingBox()
    cues.push({ id, tMs, box })
  }

  let status: 'ok' | 'failed' = 'ok'
  let errorToRethrow: unknown = null
  let errorMessage: string | undefined
  let screencastStarted = false

  try {
    await page.screencast.start({
      path: absolutePath,
      fps: 30,
      size,
      onFrame
    })
    screencastStarted = true

    await page.screencast.showActions({
      cursor: 'pointer',
      style: {
        title: 'display: none'
      }
    })

    const timeoutMs = 15_000
    const timer = setTimeout(() => {
      if (!firstFrameSeen) {
        rejectFirstFrame(new Error(`Timed out waiting for first screencast frame after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    try {
      await firstFramePromise
    } finally {
      clearTimeout(timer)
    }

    await action(cue)
  } catch (error) {
    status = 'failed'
    errorToRethrow = error
    errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    let durationMs = getElapsedMs()
    if (screencastStarted) {
      try {
        await page.screencast.hideActions()
      } catch {
        // page may already be closed
      }
      try {
        await page.screencast.stop()
      } catch (stopError) {
        if (status === 'ok') {
          status = 'failed'
          errorToRethrow = stopError
          errorMessage = stopError instanceof Error ? stopError.message : String(stopError)
        }
      }
    }

    if (screencastStarted && status === 'ok') {
      try {
        const probe = spawn(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format_tags=creation_time', '-of', 'json', absolutePath],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        )
        let output = ''
        let errors = ''
        probe.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString()
        })
        probe.stderr.on('data', (chunk: Buffer) => {
          errors = (errors + chunk.toString()).slice(-4000)
        })
        const code = await new Promise<number | null>((done, fail) => {
          probe.on('error', fail)
          probe.on('close', done)
        })
        if (code !== 0) throw new Error(`Recording clock probe exited ${code}: ${errors}`)
        const origin = Date.parse(JSON.parse(output).format?.tags?.creation_time)
        if (!Number.isFinite(origin)) throw new Error(`Recording has no encoder creation time: ${absolutePath}`)
        const offset = captureStartWallTime - origin
        for (const item of cues) item.tMs = Math.max(0, Math.round(item.tMs + offset))
        durationMs = Math.max(0, Math.round(durationMs + offset))
      } catch (error) {
        status = 'failed'
        errorToRethrow = error
        errorMessage = error instanceof Error ? error.message : String(error)
      }
    }

    if (phone && status === 'ok') {
      const normalized = takeFile(shot, take, 'mp4')
      const encoder = spawn(
        'ffmpeg',
        [
          '-v',
          'error',
          '-n',
          '-i',
          absolutePath,
          '-vf',
          'scale=780:1688:flags=lanczos,fps=30',
          '-an',
          '-c:v',
          'libx264',
          '-crf',
          '16',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          join(RECORD_DIR, normalized)
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      )
      let errors = ''
      encoder.stderr.on('data', (chunk: Buffer) => {
        errors = (errors + chunk.toString()).slice(-4000)
      })
      try {
        const code = await new Promise<number | null>((done, fail) => {
          encoder.on('error', fail)
          encoder.on('close', done)
        })
        if (code !== 0) throw new Error(`Phone normalization exited ${code}: ${errors}`)
        file = normalized
      } catch (error) {
        status = 'failed'
        errorToRethrow = error
        errorMessage = error instanceof Error ? error.message : String(error)
      }
    }

    const result: Take = {
      shot,
      take,
      status,
      method: 'screencast',
      file,
      viewport: { width: vp.width, height: vp.height },
      durationMs,
      fps: 30,
      labelled,
      cues,
      ...(errorMessage ? { error: errorMessage } : {})
    }

    await saveTake(result)

    if (errorToRethrow !== null) {
      throw errorToRethrow
    }

    return result
  }
}

export default recordTake
