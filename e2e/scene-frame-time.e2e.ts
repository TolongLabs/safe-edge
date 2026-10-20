import { expect, test, type Page } from '@playwright/test'

// SIM-9 (TRD "Performance and recording"): ten seconds of S1 in flight stay inside the frame budget, 30 fps at 1080p
// on a laptop and 24 fps on a phone. Frame times need a GPU: under software GL (SwiftShader, llvmpipe) the CPU stands
// in for one and the numbers mean nothing, so the test skips there. On WSL, `GALLIUM_DRIVER=d3d12` reaches the GPU.

/** Just before S1's patrol takes off from the roof dock. */
const TAKEOFF = '2026-10-21T22:36:00.000Z'
const MEASURE_MS = 10_000

/** Every frame interval, in ms, over ten seconds of S1's flight. */
async function flightFrameTimes(page: Page): Promise<number[]> {
  // A scene that failed to compile its shaders draws nothing, and nothing is quick to draw.
  const glErrors: string[] = []
  page.on('console', (m) => {
    if (/WebGLProgram: Shader Error|WebGL context could not be created/.test(m.text())) glErrors.push(m.text())
  })
  await page.goto('demo/scene.html?scenario=s1')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled({ timeout: 90_000 })
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  })
  test.skip(/SwiftShader|llvmpipe|softpipe/i.test(renderer), `software GL (${renderer}) cannot measure the GPU budget`)
  test.info().annotations.push({ type: 'renderer', description: renderer })

  await page.getByRole('slider', { name: 'Scenario time' }).fill(String(Date.parse(TAKEOFF)))
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByText(/Drone: Taking off|Drone: Flying|Drone: Photographing/)).toBeVisible({ timeout: 10_000 })
  const times = await page.evaluate(
    (ms) =>
      new Promise<number[]>((done) => {
        const times: number[] = []
        let last = performance.now()
        const end = last + ms
        const frame = (now: number) => {
          times.push(now - last)
          last = now
          if (now < end) requestAnimationFrame(frame)
          else done(times)
        }
        requestAnimationFrame(frame)
      }),
    MEASURE_MS
  )
  expect(glErrors).toEqual([])
  test.info().annotations.push({
    type: 'pixel ratio',
    description: String(await page.locator('canvas[data-pixel-ratio]').getAttribute('data-pixel-ratio'))
  })
  return times
}

/** Mean and 95th-percentile frame time, in ms. */
function summarise(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b)
  return { mean: MEASURE_MS / times.length, p95: sorted[Math.floor(0.95 * (sorted.length - 1))]! }
}

test('S1 flies at 30 fps or better at 1080p on a laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const { mean, p95 } = summarise(await flightFrameTimes(page))
  test
    .info()
    .annotations.push({ type: 'frame time', description: `mean ${mean.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms` })
  expect(mean).toBeLessThanOrEqual(1000 / 30)
  expect(p95).toBeLessThanOrEqual(1500 / 30)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })

  // A mid-range phone's CPU, as Chrome's 4× throttle; its GPU is not emulated.
  test('S1 flies at 24 fps or better', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const { mean, p95 } = summarise(await flightFrameTimes(page))
    test
      .info()
      .annotations.push({ type: 'frame time', description: `mean ${mean.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms` })
    expect(mean).toBeLessThanOrEqual(1000 / 24)
    expect(p95).toBeLessThanOrEqual(1500 / 24)
  })
})
