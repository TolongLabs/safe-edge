import { expect, test, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { RECORD_DIR, type Cue, type Take } from './contract'
import { nextTake, saveTake, takeFile } from './take'

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })

const HEADLINE =
  'Last night’s storm knocked out a fence panel. The edge still shows a valid pass: nobody has checked yet.'
const CAPTIONS: [string, string][] = [
  ['d1-rain', 'Overnight storm:'],
  ['d1-takeoff', 'A dry morning. The drone takes off'],
  ['d1-jogger', 'A jogger walks into a photo'],
  ['d1-glare', 'Glare hides a ring buoy'],
  ['d1-flag', "The drone's photo shows panel 4 is gone"],
  ['story-confirm', 'The park manager compares the photos'],
  ['story-barrier', 'The crew puts up a temporary barrier'],
  ['story-fix-a', 'Fix A would replace panel 4'],
  ['story-fix-b', 'Fix B replaces the panel'],
  ['story-approve', 'The engineer approves fix B'],
  ['story-installer', 'The installer finishes the repair'],
  ['story-prove', 'Priya Nair, who did not install it'],
  ['story-end', 'Safety pass issued, valid to']
]

async function prepare(page: Page) {
  await page.clock.install({ time: new Date('2026-10-22T08:00:00+08:00') })
  await page.goto('demo/scene.html')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 120_000 })
  const story = page.getByRole('region', { name: 'Story' })
  await expect(story.getByRole('button', { name: /^Play the story/ })).toBeEnabled({ timeout: 120_000 })
  return story
}

async function capture(page: Page, shot: string, seconds: number, cues: Cue[], story: boolean) {
  const fps = Number(process.env.SAFE_EDGE_RECORD_SCENE_FPS ?? '30')
  if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error('Scene fps must be an integer from 1 to 30')
  const take = await nextTake(shot)
  const file = takeFile(shot, take, 'mp4')
  const path = join(RECORD_DIR, file)
  await mkdir(dirname(path), { recursive: true })
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-v',
      'error',
      '-n',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-i',
      '-',
      '-an',
      '-c:v',
      'libx264',
      '-crf',
      '16',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      path
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  )
  let errorText = ''
  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    errorText = (errorText + chunk.toString()).slice(-4000)
  })
  const closed = new Promise<number | null>((resolve, reject) => {
    ffmpeg.on('error', reject)
    ffmpeg.on('close', resolve)
  })
  // Handle a pipe error through the same failed-take path as an encoder error.
  let pipeError: Error | null = null
  ffmpeg.stdin.on('error', (error) => {
    pipeError = error
  })
  const result: Take = {
    shot,
    take,
    status: 'ok',
    method: 'frame-stepped',
    file,
    viewport: { width: 1920, height: 1080 },
    durationMs: seconds * 1000,
    fps,
    labelled: true,
    cues
  }
  let framesCaptured = 0
  let endFrame: number | null = null
  try {
    for (let frame = 0; frame < seconds * fps; frame++) {
      const tickMs = Math.round(((frame + 1) * 1000) / fps) - Math.round((frame * 1000) / fps)
      if (fps < 30) await page.clock.fastForward(tickMs)
      else await page.clock.runFor(tickMs)
      if (frame % (fps * 10) === 0) console.log(`${shot}: captured ${frame / fps} / ${seconds} seconds`)
      if (story) {
        const text = await page.evaluate(() => {
          const caption = document.querySelector('[data-testid="caption"]')
          return caption?.textContent ?? document.querySelector('[aria-label="Story"]')?.textContent ?? ''
        })
        for (const [id, prefix] of CAPTIONS) {
          if (text.includes(prefix) && !cues.some((cue) => cue.id === id)) {
            const target =
              id === 'story-end' ? page.getByText(/^Safety pass issued, valid to/).first() : page.getByTestId('caption')
            cues.push({ id, tMs: (frame * 1000) / fps, box: await target.boundingBox() })
          }
        }
      }
      if (cues.some((cue) => cue.id === 'story-end')) endFrame ??= frame
      if (pipeError) throw pipeError
      if (!ffmpeg.stdin.write(await page.screenshot({ type: 'jpeg', quality: 95 }))) {
        await once(ffmpeg.stdin, 'drain')
      }
      framesCaptured = frame + 1
      if (story && endFrame !== null && frame - endFrame >= 2 * fps) break
    }
    result.durationMs = Math.round((framesCaptured * 1000) / fps)
    ffmpeg.stdin.end()
    const code = await closed
    if (code !== 0) throw new Error(`ffmpeg exited ${code}: ${errorText}`)
    if (story) {
      for (const id of ['d1-takeoff', 'd1-flag', 'story-end']) {
        if (!cues.some((cue) => cue.id === id)) throw new Error(`The story never reached required cue ${id}`)
      }
    }
    await saveTake(result)
  } catch (error) {
    ffmpeg.stdin.destroy()
    ffmpeg.kill('SIGTERM')
    await closed.catch(() => undefined)
    await saveTake({ ...result, status: 'failed', error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

test('@scene H1 the problem on the map', async ({ page }) => {
  await prepare(page)
  await expect(page.getByRole('heading', { name: HEADLINE })).toBeVisible()
  await expect(page.getByText('Simulation · every flight, photo, flag and repair here')).toBeVisible()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3000)
  const cues: Cue[] = [
    { id: 'h1-card', tMs: 0, box: await page.getByRole('heading', { name: HEADLINE }).boundingBox() }
  ]
  await capture(page, 'H1', 22, cues, false)
})

test('@scene D1 patrol through the proven pass', async ({ page }) => {
  const story = await prepare(page)
  await story.getByRole('button', { name: /^Play the story/ }).click()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3000)
  await capture(page, 'D1', 150, [], true)
})
