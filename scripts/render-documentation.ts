import { chromium, type Browser } from '@playwright/test'
import { $ } from 'bun'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const dir = resolve(root, 'docs/demo/documentation')
const template = resolve(dir, 'documentation.html')
const output = resolve(dir, 'safe-edge-documentation.pdf')
const draft = resolve(dir, 'safe-edge-documentation.draft.pdf')

const sections = await readFile(resolve(dir, 'sections.html'), 'utf8')
const slugs = [...sections.matchAll(/data-diagram="([a-z0-9-]+)"/g)].map((m) => m[1])
if (new Set(slugs).size !== slugs.length) throw new Error(`Diagram used twice: ${slugs.join(', ')}`)

/**
 * Archify's "SVG · Light" export, made transparent: drop the canvas fill and the grid, and paint the masks behind
 * nodes white, the page colour, so edges still stop at node borders.
 */
async function exportDiagram(browser: Browser, slug: string) {
  const html = resolve(dir, `diagrams/${slug}/${slug}.html`)
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true })
  await page.goto(`file://${html}`)
  await page.getByRole('button', { name: 'Export diagram' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-format="svg-light"]').click()
  ])
  const raw = await readFile(await download.path(), 'utf8')
  await page.close()

  const viewBox = raw.match(/<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!viewBox) throw new Error(`${slug}: no viewBox in the exported SVG`)
  const canvas = new RegExp(
    `<rect x="0" y="0" width="${viewBox[1]}" height="${viewBox[2]}" fill="#[0-9a-fA-F]{3,8}"\\s*/>`
  )
  if (!canvas.test(raw)) throw new Error(`${slug}: no canvas rect to remove`)
  const svg = raw
    .replace(canvas, '')
    .replace(/<rect width="100%" height="100%" fill="url\(#grid\)"\s*\/>/, '')
    .replace(/<\/svg>\s*$/, '<style>.c-mask { fill: #ffffff !important; }</style></svg>')
  const file = resolve(dir, `diagrams/${slug}/${slug}.svg`)
  await writeFile(file, svg)
  return file
}

const browser = await chromium.launch()
for (const slug of slugs) console.log(`diagram: ${await exportDiagram(browser, slug)}`)

const page = await browser.newPage()
await page.goto(`file://${template}`, { waitUntil: 'networkidle' })
const contents = await page.evaluate((body) => {
  document.getElementById('content')!.innerHTML = body
  for (const figure of document.querySelectorAll<HTMLElement>('figure.diagram')) {
    const slug = figure.dataset.diagram!
    const img = document.createElement('img')
    img.src = `diagrams/${slug}/${slug}.svg`
    img.alt = figure.querySelector('figcaption')?.textContent?.trim() ?? ''
    figure.prepend(img)
  }
  const chapters = Array.from(document.querySelectorAll<HTMLElement>('#content > section.chapter'))
  const list = document.getElementById('contents')!
  for (const chapter of chapters) {
    const title = chapter.querySelector('h2')!.textContent!.trim()
    const li = document.createElement('li')
    li.innerHTML = `<a href="#${chapter.id}"></a><span class="dots"></span><span class="pg" data-for="${chapter.id}"></span>`
    li.querySelector('a')!.textContent = title
    list.append(li)
  }
  return chapters.map((c) => ({ id: c.id, title: c.querySelector('h2')!.textContent!.trim() }))
}, sections)

await page.evaluate(async () => {
  await document.fonts.ready
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
const problems = await page.evaluate(() => {
  const missingWeights = [400, 500, 600, 700].filter(
    (w) => !document.fonts.check(`${w} 16px "Atkinson Hyperlegible Next"`)
  )
  const brokenImages = Array.from(document.images)
    .filter((img) => img.naturalWidth === 0)
    .map((img) => img.getAttribute('src'))
  const deadLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
    .map((a) => a.getAttribute('href')!.slice(1))
    .filter((id) => !document.getElementById(id))
  return { missingWeights, brokenImages, deadLinks: [...new Set(deadLinks)] }
})
if (problems.missingWeights.length || problems.brokenImages.length || problems.deadLinks.length) {
  throw new Error(`Document problems: ${JSON.stringify(problems)}`)
}

// Chromium has no target-counter(), so print once, read where each chapter landed, fill the contents page, print again.
const pdf = { preferCSSPageSize: true, printBackground: true }
await page.pdf({ ...pdf, path: draft })
const pages = (await $`pdftotext -layout ${draft} -`.text()).split('\f')
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
const numbers: Record<string, number> = {}
for (const { id, title } of contents) {
  // Pages 1 and 2 are the cover and the contents list; a chapter title prints on a line of its own.
  const index = pages.findIndex((text, i) => i >= 2 && text.split('\n').some((line) => flat(line) === flat(title)))
  if (index === -1) throw new Error(`Chapter "${title}" not found on any page`)
  numbers[id] = index + 1
}
await page.evaluate((n) => {
  for (const span of document.querySelectorAll<HTMLElement>('.pg')) span.textContent = String(n[span.dataset.for!])
}, numbers)
await page.pdf({ ...pdf, path: output })
await browser.close()
await $`rm ${draft}`

console.log(`chapters: ${contents.length}`)
console.log(`diagrams: ${slugs.length}`)
console.log(`pages: ${pages.length - 1}`)
console.log(`pdf: ${output}`)
