import {
  CaretLeft,
  CaretLineLeft,
  CaretLineRight,
  Code,
  DotsThree,
  Drone,
  Info,
  MapTrifold,
  Robot,
  ShieldCheck,
  Tray,
  WarningCircle,
  type Icon
} from '@phosphor-icons/react'
import type { Role } from '@safe-edge/contracts'
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { can, resetAll, signIn, useSignedIn, useStore } from '../store'
import { isPhone, parseRoute, useHash, type Route } from './route'
import { getTheme, setTheme, type Theme } from './theme'
import './shell.css'

// People who are not signed in as: the agent, the system and the simulated drone are not people at a desk.
const NOT_PEOPLE = new Set(['usr_agent', 'usr_system', 'usr_drone_sim', 'usr_integrator'])
// The order the S1 to S3 story is walked in.
const WALK: Role[] = ['manager', 'crew', 'engineer', 'installer', 'reviewer', 'gm', 'pilot']
const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' }
]

// Display words only; what a role may do always comes from the contracts.
const ROLE_LABEL: Record<Role, string> = {
  manager: 'Park manager',
  engineer: 'Engineer',
  reviewer: 'Reviewer',
  installer: 'Installer',
  crew: 'Walk crew',
  gm: 'Township general manager',
  pilot: 'Pilot',
  agent: 'Agent',
  provider: 'Provider',
  system: 'System',
  integrator: 'Integrator'
}
const roleLabel = (role: Role) => ROLE_LABEL[role]

// The seed names carry the role in brackets, and the menu shows the role beside the name already.
const plain = (name: string) => name.replace(/\s*\([^)]*\)$/, '')

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { snapshot } = useStore()
  const { user } = useSignedIn()
  const [open, setOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const people = (snapshot?.users ?? [])
    .filter((u) => !NOT_PEOPLE.has(u.id))
    .sort((a, b) => WALK.indexOf(a.role) - WALK.indexOf(b.role))
  return (
    <div className="profile-wrap" ref={box}>
      <button
        ref={button}
        className={compact ? 'icon-btn' : 'profile'}
        aria-label={`${plain(user.name)}, ${roleLabel(user.role)}. Open the profile menu`}
        aria-expanded={open}
        aria-controls="profile-menu"
        onClick={() => setOpen(!open)}
      >
        {compact ? (
          <DotsThree size={28} weight="bold" aria-hidden="true" />
        ) : (
          <>
            <span className="avatar" aria-hidden="true">
              {initials(plain(user.name))}
            </span>
            <span aria-hidden="true">
              <span className="name">{plain(user.name)}</span>
              <br />
              <span className="role">{roleLabel(user.role)}</span>
            </span>
          </>
        )}
      </button>
      {open && (
        <div id="profile-menu" className="menu" role="group" aria-label="Profile menu">
          <p className="menu-who">
            <b>{plain(user.name)}</b>
            <span>{roleLabel(user.role)}</span>
          </p>
          <h2>Sign in as</h2>
          <ul>
            {people.map((u) => (
              <li key={u.id}>
                <button
                  className="menu-item"
                  aria-current={u.id === user.id}
                  onClick={() => void signIn(u.id).then(() => setOpen(false))}
                >
                  <span className="avatar small" aria-hidden="true">
                    {initials(plain(u.name))}
                  </span>
                  <span>{plain(u.name)}</span>
                  <span className="role">{roleLabel(u.role)}</span>
                </button>
              </li>
            ))}
          </ul>
          <h2>Appearance</h2>
          <div className="seg" role="group" aria-label="Appearance">
            {THEMES.map((t) => (
              <button
                key={t.id}
                aria-pressed={theme === t.id}
                onClick={() => {
                  setTheme(t.id)
                  setThemeState(t.id)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="menu-item reset"
            onClick={() => {
              setOpen(false)
              void resetAll()
            }}
          >
            Reset demo
          </button>
        </div>
      )}
    </div>
  )
}

/** One screen's frame: the top bar (title, context line, SIMULATION label, profile) and its islands. */
export function Screen({
  title,
  context,
  actions,
  children
}: {
  title: string
  context?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const phone = isPhone(parseRoute(useHash()))
  useEffect(() => {
    document.title = `${title} · Safe Edge`
  }, [title])
  return (
    <div className={`frame${phone ? ' phone' : ''}`}>
      {phone ? (
        <header className="topbar phone-bar">
          <a className="icon-btn" href="#/inbox" aria-label="Back to Inbox">
            <CaretLeft size={24} weight="bold" aria-hidden="true" />
          </a>
          <div className="titles">
            <h1>{title}</h1>
            {context && <p className="context">{context}</p>}
          </div>
          <span className="simulation">Simulation</span>
          <ProfileMenu compact />
        </header>
      ) : (
        <header className="topbar island">
          <div className="titles">
            <h1>{title}</h1>
            {context && <p className="context">{context}</p>}
          </div>
          {actions}
          <span className="simulation">Simulation</span>
          <ProfileMenu />
        </header>
      )}
      {children}
    </div>
  )
}

/** One boundary for the whole shell: an unexpected render error is shown, logged and never swallowed. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Screen title="Something went wrong">
        <main className="detail island">
          <div className="banner error" role="alert">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            <p>
              This screen failed to draw: {error.message}. Nothing was changed by it, and the other screens still work.
              <a href="#/inbox"> Back to Inbox</a>
            </p>
          </div>
        </main>
      </Screen>
    )
  }
}

type NavItem = { href: string; route: string; label: string; Icon: Icon; note?: string }

// The day-to-day screens first; the agent and the developer pages sit apart, after a quiet divider.
const NAV: NavItem[][] = [
  [
    { href: '#/inbox', route: 'inbox', label: 'Inbox', Icon: Tray },
    { href: '#/patrol', route: 'patrol', label: 'Patrol', Icon: Drone },
    {
      href: 'scene.html', // relative: the demo site serves the app under /demo/
      route: 'map',
      label: 'Map',
      Icon: MapTrifold,
      note: 'Opens the team map. It shows the seed and the scenario player, not this session’s decisions.'
    },
    { href: '#/passes', route: 'passes', label: 'Passes', Icon: ShieldCheck }
  ],
  [
    { href: '#/agent', route: 'agent', label: 'Agent', Icon: Robot },
    { href: '#/developers', route: 'developers', label: 'Developers', Icon: Code }
  ]
]

/** The rail item a route belongs to; screens reached from another one (Fix Lens, the repair check) mark none. */
const railItemOf = (route: Route) => {
  switch (route.name) {
    case 'passes':
    case 'passIssued':
      return 'passes'
    case 'inbox':
    case 'patrol':
    case 'agent':
    case 'developers':
      return route.name
    default:
      return null
  }
}

export function Rail() {
  const route = parseRoute(useHash())
  const { snapshot: s } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const open = s
    ? can('listCandidates')
      ? s.evidence.filter((e) => e.candidate.status === 'candidate').length
      : s.tasks.filter((t) => t.status === 'open').length
    : null
  const current = railItemOf(route)
  const nav = useRef<HTMLElement>(null)
  // On a phone too narrow for every item the rail scrolls sideways: keep the current one in view.
  useEffect(() => {
    const el = nav.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    el.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])
  return (
    <nav ref={nav} className={`rail${collapsed ? ' collapsed' : ''}`} aria-label="Main">
      <button
        className="logo"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        onClick={() => setCollapsed(!collapsed)}
      >
        <img className="mark" src={`${import.meta.env.BASE_URL}mark-rail.svg`} alt="" width={30} height={30} />
        {collapsed ? (
          <CaretLineRight className="arrow" size={28} weight="bold" aria-hidden="true" />
        ) : (
          <CaretLineLeft className="arrow" size={28} weight="bold" aria-hidden="true" />
        )}
        <span className="label">
          <span className="brand">Safe Edge</span>
          <span className="sub">Elmina township</span>
        </span>
      </button>
      {NAV.map((group, i) => (
        <ul key={i}>
          {group.map(({ href, route: id, label, Icon, note }) => (
            <li key={id}>
              <a
                href={href}
                className="rail-item"
                aria-current={current === id ? 'page' : undefined}
                title={note}
                aria-description={note}
              >
                <span className="tile">
                  <Icon size={18} weight="bold" aria-hidden="true" />
                </span>
                <span className="label">{label}</span>
                {id === 'inbox' && open !== null && open > 0 && (
                  <span className="count">
                    {open}
                    <span className="sr"> open</span>
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ))}
    </nav>
  )
}

/** A screen not built yet, in DESIGN.md's empty-state form (eyeball D08). */
export function Placeholder({ title, context, heading }: { title: string; context?: string; heading: string }) {
  return (
    <Screen title={title} context={context ?? 'Not built yet'}>
      <main className="detail island center">
        <div className="empty-state left">
          <span className="icon-tile">
            <Info size={24} weight="bold" aria-hidden="true" />
          </span>
          <h2>{heading}</h2>
          <p>
            This page is not built yet. Nothing here is a result, a decision or a pass. Open a flag in the Inbox to see
            what will feed it.
          </p>
          <a className="btn primary" href="#/inbox">
            Back to Inbox
          </a>
        </div>
      </main>
    </Screen>
  )
}

function NotFound({ heading, line, icon }: { heading: string; line: string; icon: ReactNode }) {
  return (
    <Screen title="Not found" context="Demo data lives in this page">
      <main className="detail island center">
        <div className="empty-state left">
          <span className="icon-tile">{icon}</span>
          <h2>{heading}</h2>
          <p>{line}</p>
          <a className="btn primary" href="#/inbox">
            Back to Inbox
          </a>
          <p className="address">Address: {useHash()}</p>
        </div>
      </main>
    </Screen>
  )
}

export const NotInSession = () => (
  <NotFound
    heading="Not in this demo session"
    line="This link points at a record that is not in this session. Demo data lives in the page and resets on reload."
    icon={<Info size={24} weight="bold" aria-hidden="true" />}
  />
)

export const PageNotFound = () => (
  <NotFound
    heading="Page not found"
    line="There is no page at this address. The menu on the left lists the pages that exist."
    icon={<WarningCircle size={24} weight="bold" aria-hidden="true" />}
  />
)
