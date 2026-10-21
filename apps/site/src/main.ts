import './fonts.ts'
import 'lenis/dist/lenis.css'
import './base.css'
import './chrome.css'
import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { HERO_WORDS_IN, arrivesFresh, liftHeroWords, liftOffFooter, riseNightArt } from './motion.ts'

gsap.registerPlugin(ScrollTrigger)

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

const root = document.documentElement

// The bars: one per incident, as tall as the number of people in the water.
const most = Math.max(...incidents.map((i) => i.people))
const labelled = new Set([...incidents].sort((a, b) => b.people - a.people).slice(0, 3))
const bars = need<HTMLOListElement>('.bars')
for (const incident of incidents) {
  const item = document.createElement('li')
  item.className = incident.drain ? 'bar bar--drain' : 'bar'
  item.style.setProperty('--h', `${(incident.people / most) * 100}%`)
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
}

// The statement: one span per word, so scrolling can bring the words up in reading order.
const statement = need<HTMLParagraphElement>('.statement')
const words = (statement.textContent ?? '').trim().split(/\s+/)
statement.textContent = ''
words.forEach((word, index) => {
  const span = document.createElement('span')
  span.className = 'word'
  span.textContent = word
  statement.append(span, index < words.length - 1 ? ' ' : '')
})

// The fix check: the fence must reach past the route that walks around its end (5.5 m out).
const slider = need<HTMLInputElement>('#extend')
const output = need<HTMLOutputElement>('#extend-out')
const plan = need<HTMLElement>('.plan')
const extension = need<SVGPathElement>('#ext')
const verdict = need<HTMLElement>('#verdict-text')
const ROUTE_AT_METRES = 5.5
const renderFix = () => {
  const metres = Number(slider.value)
  output.value = `${metres} m`
  extension.setAttribute('d', `M402 262 H${402 + metres * 10}`)
  const closed = metres > ROUTE_AT_METRES
  plan.toggleAttribute('data-closed', closed)
  verdict.textContent = closed
    ? `Closes all 3 ways to the water with ${metres} m more fence`
    : 'Leaves 1 way to the water open, around the fence end'
}
slider.addEventListener('input', renderFix)
renderFix()

// The clock plate in the top bar keeps the time of day for whatever is on screen.
const clock = need<HTMLElement>('.clock')
const clockTime = need<HTMLElement>('.clock-time')
const clockWhat = need<HTMLElement>('.clock-what')
const setClock = (time = '', what = '') => {
  clock.toggleAttribute('data-empty', time === '')
  if (time === '') return
  clockTime.textContent = time
  clockWhat.textContent = what
}
for (const section of document.querySelectorAll<HTMLElement>('main > section[data-time]')) {
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    // Refreshed after the pinned sections above it, so its start allows for their pin spacing.
    refreshPriority: -1,
    onToggle: ({ isActive }) => isActive && setClock(section.dataset.time, section.dataset.what)
  })
}

const footer = liftOffFooter()

const steps = gsap.utils.toArray<HTMLElement>('.step')
let current = 0
const setStep = (active: number) => {
  current = active
  steps.forEach((step, index) => step.toggleAttribute('data-active', index === active))
  setClock(steps[active].dataset.time, steps[active].dataset.what)
}

const motion = gsap.matchMedia()
motion.add(
  {
    calm: '(prefers-reduced-motion: no-preference)',
    wide: '(prefers-reduced-motion: no-preference) and (min-width: 960px) and (min-height: 680px)'
  },
  (context) => {
    const { calm, wide } = context.conditions as { calm: boolean; wide: boolean }

    // Without motion the steps are a plain list; each takes the clock as it crosses the middle.
    if (!wide) {
      steps.forEach((step, index) =>
        ScrollTrigger.create({
          trigger: step,
          start: 'top center',
          end: 'bottom center',
          onToggle: ({ isActive }) => isActive && setStep(index)
        })
      )
    }
    if (!calm) return

    const lenis = new Lenis({ anchors: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // First light: the drone flies the patrol line and stops over the gap it found.
    if (arrivesFresh()) {
      setClock('06:30', 'Dawn patrol')
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from('.hero-words > *', HERO_WORDS_IN)
        .from('.drone', { x: -980, y: -140, duration: 2.4, ease: 'power3.out' }, 0.15)
        .from('.beam', { opacity: 0, duration: 0.6 }, 2.2)
        .from('.flag-box', { opacity: 0, scale: 1.3, transformOrigin: '50% 50%', duration: 0.7 }, 2.4)
        .from('.flag-lead, .flag-tag', { opacity: 0, y: 10, duration: 0.7 }, 2.55)
        .call(() => setClock('06:42', 'Panel 4 missing'), [], 2.5)
    }
    gsap.to('.drone', { y: 4, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.6 })

    // Leaving the hero: far layers drift slower than near ones.
    for (const layer of gsap.utils.toArray<SVGGElement>('.scene-art [data-depth]')) {
      gsap.to(layer, {
        y: (0.66 - Number(layer.dataset.depth)) * 240,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      })
    }
    liftHeroWords('.hero-words', '.hero')

    // The statement fills word by word, in reading order.
    gsap.fromTo(
      '.statement .word',
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: '.statement', start: 'top 80%', end: 'bottom 40%', scrub: true }
      }
    )
    gsap.from('.bar button', {
      scaleY: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: { trigger: '.bars', start: 'top 85%', once: true }
    })

    // The day: pinned, with each screen wiping up over the last as the route fills.
    if (wide) {
      root.classList.add('has-story', 'has-walk')
      const shots = steps.map((step) => {
        const shot = step.querySelector<HTMLElement>('.shot')
        if (!shot) throw new Error('Missing .shot in a step')
        return shot
      })
      const story = gsap.timeline({
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: {
          trigger: '.loop',
          start: 'top top',
          end: () => `+=${window.innerHeight * 3}`,
          pin: true,
          scrub: 0.6,
          onToggle: ({ isActive }) => isActive && setStep(current),
          onUpdate: ({ isActive, progress }) => isActive && setStep(Math.round(progress * (steps.length - 1)))
        }
      })
      story.fromTo('.route-fill', { scaleY: 0 }, { scaleY: 1, duration: steps.length - 1 }, 0)
      shots.slice(1).forEach((shot, index) => {
        story.fromTo(
          shot,
          { clipPath: 'inset(100% 0% 0% 0% round 16px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 16px)' },
          index
        )
        story.to(shots[index], { scale: 0.94, opacity: 0.6 }, index)
      })

      // The rules walk: the path runs sideways and each sign swings level as it arrives.
      const track = need<HTMLElement>('.walk-track')
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
      const walk = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.walk',
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      })
      for (const plate of gsap.utils.toArray<HTMLElement>('.sign .plate')) {
        gsap.from(plate, {
          rotate: -5,
          transformOrigin: '50% 100%',
          ease: 'none',
          scrollTrigger: {
            trigger: plate,
            containerAnimation: walk,
            start: 'left right',
            end: 'left 70%',
            scrub: true
          }
        })
      }
    }

    riseNightArt(footer)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      root.classList.remove('has-story', 'has-walk')
    }
  }
)

document.fonts.ready.then(() => ScrollTrigger.refresh())
