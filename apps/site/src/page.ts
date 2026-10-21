import './fonts.ts'
import './base.css'
import './chrome.css'
import './pages.css'

// The product pages read without JavaScript. With it, code blocks get a working Copy button and the contents list
// marks the chapter being read.

for (const block of document.querySelectorAll<HTMLElement>('.code')) {
  const button = block.querySelector<HTMLButtonElement>('.code-copy')
  const label = block.querySelector<HTMLElement>('.code-copy-label')
  const code = block.querySelector('code')
  if (!button || !label || !code)
    throw new Error('A .code block needs a .code-copy button, its label and a code element')
  let reset = 0
  button.hidden = false
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent ?? '')
    button.toggleAttribute('data-copied', true)
    label.textContent = 'Copied'
    clearTimeout(reset)
    reset = window.setTimeout(() => {
      button.toggleAttribute('data-copied', false)
      label.textContent = 'Copy'
    }, 2000)
  })
}

const links = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('.toc a')].map((link) => [link.hash.slice(1), link])
)
// A chapter counts as being read while it crosses the band just under the top bar.
const reading = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      for (const link of links.values()) link.removeAttribute('aria-current')
      links.get(entry.target.id)?.setAttribute('aria-current', 'true')
    }
  },
  { rootMargin: '-20% 0px -70% 0px' }
)
for (const id of links.keys()) {
  const chapter = document.getElementById(id)
  if (!chapter) throw new Error(`The contents list links to #${id}, which is not on the page`)
  reading.observe(chapter)
}
