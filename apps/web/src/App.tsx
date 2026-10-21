import { WarningCircle } from '@phosphor-icons/react'
import { SafeEdgeApiError } from '@safe-edge/sdk'
import { useEffect, useState, type ReactNode } from 'react'
import { Agent } from './screens/agent/Agent'
import { Capture } from './screens/capture/Capture'
import { Developers } from './screens/developers/Developers'
import { FixLens } from './screens/fix-lens/FixLens'
import { Inbox } from './screens/inbox/Inbox'
import { Passes } from './screens/passes/Passes'
import { PassIssued } from './screens/passes/issued/PassIssued'
import { Patrol } from './screens/patrol/Patrol'
import { Retest } from './screens/retest/Retest'
import { isPhone, parseRoute, useHash, type Route } from './shell/route'
import { ErrorBoundary, NotInSession, PageNotFound, Rail, Screen } from './shell/Shell'
import { client, start, useStore } from './store'

/** A link to a record made earlier points at nothing after a reload: check it before the screen renders. */
function Guard({ title, check, children }: { title: string; check: () => Promise<unknown>; children: ReactNode }) {
  const [found, setFound] = useState<boolean | null>(null)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  useEffect(() => {
    let live = true
    check().then(
      () => live && setFound(true),
      (error) => {
        if (!live) return
        if (
          // 400: the address holds an id that core's id pattern refuses, which is not a record either
          error instanceof SafeEdgeApiError &&
          (error.status === 404 || error.error === 'invalid_input')
        )
          setFound(false)
        else setFatal({ error })
      }
    )
    return () => {
      live = false
    }
  }, [check])
  if (fatal) throw fatal.error
  if (found === null)
    return (
      <Screen title={title}>
        <main className="detail island center" role="status">
          Looking for this record
        </main>
      </Screen>
    )
  return found ? children : <NotInSession />
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'inbox':
      return <Inbox />
    case 'fixLens': {
      const { findingId } = route
      return findingId ? (
        <Guard key={findingId} title="Fix Lens" check={() => client().getFinding({ params: { id: findingId } })}>
          <FixLens findingId={findingId} />
        </Guard>
      ) : (
        <FixLens findingId={null} />
      )
    }
    case 'passes':
      return <Passes />
    case 'passIssued': {
      const { passId } = route
      return (
        <Guard key={passId} title="Pass issued" check={() => client().getPass({ params: { id: passId } })}>
          <PassIssued passId={passId} />
        </Guard>
      )
    }
    case 'retest': {
      const { workOrderId } = route
      // A flag to clear is checked by the screen itself: the work-order guard would not find it.
      return workOrderId?.startsWith('cand_') ? (
        <Retest key={workOrderId} workOrderId={workOrderId} />
      ) : workOrderId ? (
        <Guard
          key={workOrderId}
          title="Repair check"
          check={() => client().getWorkOrder({ params: { id: workOrderId } })}
        >
          <Retest workOrderId={workOrderId} />
        </Guard>
      ) : (
        <Retest workOrderId={null} />
      )
    }
    case 'capture': {
      const { segmentId } = route
      return segmentId ? (
        <Guard key={segmentId} title="Capture" check={() => client().getSegment({ params: { id: segmentId } })}>
          <Capture segmentId={segmentId} />
        </Guard>
      ) : (
        <Capture segmentId={null} />
      )
    }
    case 'patrol':
      return <Patrol />
    case 'agent':
      return <Agent />
    case 'developers':
      return <Developers />
    case 'notFound':
      return <PageNotFound />
  }
}

export function App() {
  const { snapshot, error } = useStore()
  const hash = useHash()
  const route = parseRoute(hash)
  useEffect(() => {
    void start()
  }, [])
  if (error)
    return (
      <div className="status-page">
        <div className="banner error" role="alert">
          <WarningCircle size={20} weight="bold" aria-hidden="true" />
          <p>
            The demo could not load: {error.message}. Nothing was changed. Try again; if it keeps failing, reload the
            page, which restarts the demo.
          </p>
        </div>
        <button className="btn" onClick={() => start().catch(() => undefined)}>
          Try again
        </button>
      </div>
    )
  const phone = isPhone(route)
  return (
    <div className={`app${phone ? ' phone' : ''}`}>
      {!phone && <Rail />}
      {snapshot ? (
        <ErrorBoundary key={hash}>
          <RouteView route={route} />
        </ErrorBoundary>
      ) : (
        <div className="frame" role="status">
          <header className="topbar island">
            <div className="titles">
              <h1>Loading</h1>
              <p className="context">Loading the sample data</p>
            </div>
            <span className="simulation">Simulation</span>
          </header>
          <div className="work skeleton" aria-hidden="true">
            <div className="list island">
              <i />
              <i />
              <i />
            </div>
            <div className="detail island">
              <i className="tall" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
