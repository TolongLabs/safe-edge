// The motion every landing-site page shares with the landing page: the hero's words arriving and lifting away, and
// the night footer the page lifts off. Callers run the motion parts inside a reduced-motion check.
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const root = document.documentElement

/** First light: the hero's words come up into place, in reading order. */
export const HERO_WORDS_IN = { y: 28, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out' } as const

/** Only a fresh, visible page plays the arrival; a reload partway down or a background tab does not. */
export const arrivesFresh = () => document.visibilityState === 'visible' && window.scrollY < 40

/** Leaving the hero, its words drift up faster than the page. */
export const liftHeroWords = (words: string, hero: string) =>
  gsap.to(words, {
    y: -90,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
  })

/**
 * On wider screens the footer waits under the page, a whole screen tall, and the page lifts off it. It only shows
 * once the page starts to lift, so it never sits as hidden text under the sections above. Returns the footer.
 */
export function liftOffFooter(): HTMLElement {
  const footer = document.querySelector<HTMLElement>('.footer')
  const page = document.querySelector<HTMLElement>('main')
  if (!footer || !page) throw new Error('The page needs a main and the shared .footer')
  const fit = () => {
    root.style.setProperty('--footer-h', `${footer.offsetHeight}px`)
    root.classList.toggle('has-reveal', window.matchMedia('(min-width: 900px)').matches)
  }
  fit()
  new ResizeObserver(() => {
    fit()
    ScrollTrigger.refresh()
  }).observe(footer)
  window.addEventListener('resize', fit)
  const show = () => footer.toggleAttribute('data-shown', page.getBoundingClientRect().bottom < window.innerHeight + 1)
  window.addEventListener('scroll', show, { passive: true })
  show()
  return footer
}

/** Night: as the page lifts away, the lake rises into view under it. */
export const riseNightArt = (footer: HTMLElement) =>
  gsap.from('.night-art', {
    yPercent: 24,
    ease: 'none',
    scrollTrigger: {
      trigger: 'main',
      start: 'bottom bottom',
      end: () => `+=${footer.offsetHeight}`,
      scrub: true,
      invalidateOnRefresh: true
    }
  })
