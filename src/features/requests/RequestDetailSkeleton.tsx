import { PageHeader } from '../../components/PageHeader'
import { RequestBodySkeleton } from './RequestBodySkeleton'

export function RequestDetailSkeleton() {
  return (
    <>
      <PageHeader kicker="dsh · requests · detail" title="Request detail" subtitle="loading…" variant="integrated" />

      <div className="detail-hero">
        <div className="detail-endpoint">
          <div className="detail-endpoint-kicker">endpoint</div>
          <div className="detail-endpoint-row">
            <span className="skel skel-text" style={{ width: 60, height: 24 }} />
            <span className="skel skel-text" style={{ width: 200, height: 24 }} />
          </div>
          <div className="detail-endpoint-meta">
            <span className="skel skel-text" style={{ width: 320 }} />
          </div>
        </div>
        <div className="detail-stats-strip">
          {['status', 'tok-in', 'tok-out', 'total', 'duration', 'tok/s'].map((label) => (
            <div key={label} className="detail-stat">
              <span className="detail-stat-label">{label}</span>
              <span className="skel skel-text" style={{ width: 48, height: 18 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="req-res-columns">
        <div className="request-detail-column">
          <RequestBodySkeleton title="Request" />
        </div>
        <div className="request-detail-column">
          <RequestBodySkeleton title="Response" />
        </div>
      </div>
    </>
  )
}
