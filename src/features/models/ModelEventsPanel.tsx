import { StatusDot } from '../../components/StatusDot'

type Props = {
  events: Array<{ id: string; event: string; timestamp: string }>
}

export function ModelEventsPanel({ events }: Props) {
  const recentEvents = events.slice(0, 12)

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">History</span>
        <span className="panel-sub">· latest 12 load/unload events</span>
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th style={{ width: 18 }} aria-label="type" />
            <th style={{ width: 160 }}>time</th>
            <th>event</th>
          </tr>
        </thead>
        <tbody>
          {recentEvents.map((e) => (
            <tr key={e.id}>
              <td>
                <StatusDot tone={e.event === 'load' ? 'ok' : 'idle'} />
              </td>
              <td className="mono dim">{new Date(e.timestamp).toLocaleString([], { hour12: false })}</td>
              <td>{e.event}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
