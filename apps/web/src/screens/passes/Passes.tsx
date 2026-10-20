import { MapTrifold, Tray, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Screen } from '../../shell/Shell'
import { can, onReset, useSignedIn, useStore } from '../../store'
import { day, rows as buildRows, type Data } from './board'
import { HandoverSlot } from './HandoverSlot'
import { Escalation, Report } from './Notices'
import { PassTable } from './PassTable'
import './passes.css'

type Load = { data: Data; now: number } | { error: Error } | null

export function Passes() {
  const { user, client } = useSignedIn()
  const { snapshot } = useStore()
  const [load, setLoad] = useState<Load>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  useEffect(() => onReset(reload), [])
  // Reads again after any change in core (the store's snapshot) and after this screen's own writes.
  useEffect(() => {
    let live = true
    Promise.all([
      client.listSegments(),
      client.listAssets(),
      client.listPasses(),
      client.listFindings(),
      client.listWorkOrders(),
      client.listTasks(),
      client.listPatrols(),
      client.listUsers(),
      can('listNotices') ? client.listNotices() : null
    ]).then(
      ([segments, assets, passes, findings, workOrders, tasks, patrols, users, notices]) =>
        live &&
        setLoad({
          now: Date.now(),
          data: { segments, assets, passes, findings, workOrders, tasks, patrols, users, notices }
        }),
      (error) => live && setLoad({ error: error instanceof Error ? error : new Error(String(error)) })
    )
    return () => {
      live = false
    }
    // `client` is a new object each render, so the signed-in person is the dependency.
  }, [user.id, snapshot, tick])

  const ok = load && 'data' in load ? load : null
  const rows = useMemo(() => (ok ? buildRows(ok.data, ok.now) : []), [ok])
  const titles = Object.fromEntries(Object.entries(snapshot?.metas ?? {}).map(([id, m]) => [id, m.title]))
  const noPass = rows.filter((r) => (r.pass?.state ?? 'none') === 'none').length
  return (
    <Screen
      title="Passes"
      context={ok ? `Elmina township · ${rows.length} edges · as of ${day(ok.now)}` : 'Elmina township'}
    >
      <main className="board">
        {load === null && (
          <section className="island panel skeleton" role="status">
            <p className="hint">Loading every edge</p>
            <i />
            <i />
            <i />
          </section>
        )}
        {load && 'error' in load && (
          <section className="island panel">
            <p className="banner error" role="alert">
              <WarningCircle className="banner-icon" size={20} weight="bold" aria-hidden="true" />
              <span>
                <b>Could not load the pass list.</b> {load.error.message} The Inbox still works. Showing nothing here
                does not mean every edge is safe.
              </span>
            </p>
            <button className="btn" onClick={() => (setLoad(null), reload())}>
              Try again
            </button>
          </section>
        )}
        {ok && (
          <>
            <section className="island panel table-island" aria-labelledby="edges-h">
              <div className="head">
                <div>
                  <h2 id="edges-h">Every edge, worst first</h2>
                  <p className="hint">
                    {noPass} edge{noPass === 1 ? ' has' : 's have'} no pass yet. Unknown is never shown as safe.
                  </p>
                </div>
                <a className="btn" href="scene.html">
                  <MapTrifold size={20} weight="bold" aria-hidden="true" />
                  Open the Map
                </a>
              </div>
              {rows.length === 0 ? (
                <div className="empty-state">
                  <Tray size={28} weight="bold" aria-hidden="true" />
                  <h3>No edges in this township yet</h3>
                  <p>
                    Edges appear after their first patrol. An edge with no pass is listed as unknown, never skipped.
                  </p>
                </div>
              ) : (
                <PassTable rows={rows} titles={titles} />
              )}
              <p className="hint">
                The Map shows the demo&apos;s starting data and the scenario player, not this session&apos;s decisions.
              </p>
            </section>
            <div className="lower">
              <Escalation d={ok.data} rows={rows} reload={reload} />
              <Report d={ok.data} rows={rows} now={ok.now} reload={reload} />
              <HandoverSlot />
            </div>
          </>
        )}
      </main>
    </Screen>
  )
}
