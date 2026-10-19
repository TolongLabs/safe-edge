import './style.css'

// Drownings and near-drownings in Selangor and Kuala Lumpur township water since January 2023, from
// docs/research/niche-problems/drowning/drowning-incidents.md. `people` is everyone who went into the water.
type Incident = { date: string; place: string; water: string; people: number; drain: boolean }

const incidents: Incident[] = [
  { date: '2 Jan 2023', place: 'Tasik Puteri, Rawang', water: 'retention pond', people: 1, drain: false },
  { date: '11 Feb 2023', place: 'Ukay Perdana, Ampang', water: 'monsoon drain', people: 2, drain: true },
  { date: '19 Feb 2023', place: 'Taman Pelangi, Rawang', water: 'drain', people: 1, drain: true },
  { date: '28 Dec 2023', place: 'Tasik Biru Kundang, Rawang', water: 'mining lake', people: 1, drain: false },
  { date: '11 Feb 2024', place: 'Pandan Perdana, Ampang', water: 'urban lake', people: 1, drain: false },
  { date: '27 Feb 2024', place: 'Taman Aman, Petaling Jaya', water: 'park pond', people: 1, drain: false },
  { date: '17 Mar 2024', place: 'Kota Kemuning, Shah Alam', water: 'township lake', people: 1, drain: false },
  { date: '30 Mar 2024', place: 'Kota Perdana, Seri Kembangan', water: 'monsoon drain', people: 5, drain: true },
  { date: '2 Aug 2024', place: 'Tasik Biru, Batu Arang', water: 'mining lake', people: 1, drain: false },
  { date: '24 Nov 2024', place: 'Sinar Alam, Puncak Alam', water: 'retention lake', people: 6, drain: false },
  { date: '19 May 2025', place: 'Kampung Cheras Baru, Ampang', water: 'open drain', people: 2, drain: true },
  { date: '18 Jul 2025', place: 'Section 24, Shah Alam', water: 'river buffer pit', people: 2, drain: false },
  { date: '4 Dec 2025', place: 'Taman Prima Saujana, Kajang', water: 'large drain', people: 2, drain: true },
  { date: '25 Feb 2026', place: 'Tasik Biru Kundang, Rawang', water: 'mining lake', people: 3, drain: false },
  { date: '9 Mar 2026', place: 'Bandar Tun Hussein Onn, Cheras', water: 'township lake', people: 1, drain: false },
  { date: '28 Apr 2026', place: 'Bandar Puncak Alam', water: 'drain', people: 1, drain: true },
  { date: '1 May 2026', place: 'Bandar Mahkota Cheras', water: 'drain', people: 1, drain: true },
  { date: '6 May 2026', place: 'Sungai Keruh, Kepong', water: 'river', people: 1, drain: false },
  { date: '27 May 2026', place: 'Sungai Kerayong, Kuala Lumpur', water: 'urban river', people: 1, drain: false },
  { date: '24 Jun 2026', place: 'Bangi', water: 'drain', people: 1, drain: true },
  { date: '1 Oct 2026', place: 'Bandar Botanik, Klang', water: 'artificial lake', people: 1, drain: false }
]

const need = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}

document.documentElement.classList.add('js')

// The bars: one per incident, as tall as the number of people in the water.
const most = Math.max(...incidents.map((i) => i.people))
const labelled = new Set([...incidents].sort((a, b) => b.people - a.people).slice(0, 3))
const bars = need<HTMLOListElement>('.bars')
incidents.forEach((incident, index) => {
  const item = document.createElement('li')
  item.className = incident.drain ? 'bar bar--drain' : 'bar'
  item.style.setProperty('--h', `${(incident.people / most) * 100}%`)
  item.style.setProperty('--w', `${(incident.people / most) * 80}%`)
  item.style.setProperty('--i', String(index))
  const people = incident.people === 1 ? '1 person' : `${incident.people} people`
  const text = `${incident.date}, ${incident.place}: ${incident.water}, ${people} in the water`
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', text)
  const tip = document.createElement('span')
  tip.className = 'bar-tip'
  tip.setAttribute('aria-hidden', 'true')
  tip.textContent = text
  item.append(button, tip)
  if (labelled.has(incident)) {
    const value = document.createElement('span')
    value.className = 'bar-value'
    value.setAttribute('aria-hidden', 'true')
    value.textContent = String(incident.people)
    item.append(value)
  }
  bars.append(item)
})

// The band: every stretch of edge around Central Park Lake.
const track = need<HTMLDivElement>('.marquee-track')
const codes = Array.from({ length: 21 }, (_, i) => `LK·S${i + 1}`)
for (const code of [...codes, ...codes]) {
  const span = document.createElement('span')
  span.textContent = code
  track.append(span)
}

// The fix check: the fence must reach past the route that walks around its end (5.5 m out).
const slider = need<HTMLInputElement>('#extend')
const output = need<HTMLOutputElement>('#extend-out')
const plan = need<HTMLElement>('.plan')
const extension = need<SVGPathElement>('#ext')
const verdict = need<HTMLElement>('#verdict-text')
const ROUTE_AT_METRES = 5.5
const render = () => {
  const metres = Number(slider.value)
  output.value = `${metres} m`
  extension.setAttribute('d', `M402 262 H${402 + metres * 10}`)
  const closed = metres > ROUTE_AT_METRES
  plan.toggleAttribute('data-closed', closed)
  verdict.textContent = closed
    ? `Closes all 3 ways to the water with ${metres} m more fence`
    : 'Leaves 1 way to the water open, around the fence end'
}
slider.addEventListener('input', render)
render()

// The rules: pointing at a line shows the screen it belongs to and dims the others.
const list = need<HTMLUListElement>('.rule-list')
const frame = need<HTMLImageElement>('[data-frame]')
let showing = 'inbox'
const show = (rule: HTMLElement | null) => {
  for (const row of list.querySelectorAll('.rule')) row.toggleAttribute('data-on', row === rule)
  list.toggleAttribute('data-active', rule !== null)
  const shot = rule?.dataset.shot
  if (!shot || shot === showing) return
  showing = shot
  frame.setAttribute('data-fading', '')
  window.setTimeout(() => {
    frame.src = `/shots/${shot}.webp`
    frame.removeAttribute('data-fading')
  }, 120)
}
for (const rule of list.querySelectorAll<HTMLElement>('.rule')) {
  rule.addEventListener('pointerenter', () => show(rule))
}
list.addEventListener('pointerleave', () => show(null))

// Entrances: each part of a section rises in once, a beat after the one before it.
for (const group of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
  Array.from(group.children).forEach((child, index) => (child as HTMLElement).style.setProperty('--i', String(index)))
}
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('in')
      observer.unobserve(entry.target)
    }
  },
  { rootMargin: '0px 0px -10% 0px' }
)
for (const element of document.querySelectorAll('[data-reveal], .bars')) observer.observe(element)
