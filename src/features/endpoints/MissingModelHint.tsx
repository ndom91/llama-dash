import { Link } from '@tanstack/react-router'
import type { EndpointTypeInfo } from './endpointTypes'

export function MissingModelHint({ info }: { info: EndpointTypeInfo }) {
  return (
    <div className="rounded-sm border border-dashed border-border px-3.5 py-2.5 font-mono text-[11px] leading-relaxed text-fg-muted">
      No configured model reports {info.label.toLowerCase()} support, so the example uses a placeholder. Add a model for{' '}
      <code className="text-fg">{info.path}</code> in{' '}
      <Link to="/config" className="text-fg underline decoration-border-strong underline-offset-2 hover:decoration-fg">
        config.yaml
      </Link>
      , or declare it on an existing one with <code className="text-fg">{info.configHint}</code>.
    </div>
  )
}
