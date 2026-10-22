import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const source = resolve(root, 'docs/design/submission/design-system.html')
const output = resolve(root, 'docs/design/submission/safe-edge-design-system.pdf')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
await page.goto(`file://${source}`, { waitUntil: 'networkidle' })

const missingWeights = await page.evaluate(async () => {
  await document.fonts.ready
  return [400, 500, 600, 700].filter((weight) => !document.fonts.check(`${weight} 16px "Atkinson Hyperlegible Next"`))
})
if (missingWeights.length) {
  throw new Error(`Atkinson Hyperlegible Next weights did not load: ${missingWeights.join(', ')}`)
}

await page.evaluate(async () => {
  await Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? null
        : new Promise((done) => {
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
          })
    )
  )
})

const report = await page.evaluate(() =>
  Array.from(document.querySelectorAll<HTMLElement>('.page')).map((plate, index) => ({
    plate: index + 1,
    overflowsX: plate.scrollWidth > plate.clientWidth,
    overflowsY: plate.scrollHeight > plate.clientHeight,
    scrollWidth: plate.scrollWidth,
    clientWidth: plate.clientWidth,
    scrollHeight: plate.scrollHeight,
    clientHeight: plate.clientHeight
  }))
)

const broken = report.filter((p) => p.overflowsX || p.overflowsY)
if (broken.length) throw new Error(`Plates overflow: ${JSON.stringify(broken)}`)

const bodies = await page.evaluate(() =>
  Array.from(document.querySelectorAll<HTMLElement>('.page')).flatMap((plate, index) => {
    const body = plate.querySelector<HTMLElement>('.body')
    if (!body || body.scrollHeight <= body.clientHeight + 1) return []
    return [{ plate: index + 1, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight }]
  })
)
if (bodies.length) throw new Error(`Plate bodies overflow into the footer: ${JSON.stringify(bodies)}`)

const images = await page.evaluate(() =>
  Array.from(document.images).map((img) => ({ src: img.getAttribute('src'), ok: img.naturalWidth > 0 }))
)
const missing = images.filter((img) => !img.ok)
if (missing.length) throw new Error(`Images failed: ${JSON.stringify(missing)}`)

await page.pdf({
  path: output,
  preferCSSPageSize: true,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
})
await browser.close()

console.log(`plates: ${report.length}`)
console.log(`images: ${images.length}`)
console.log(`pdf: ${output}`)
