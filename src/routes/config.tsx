import { createFileRoute } from '@tanstack/react-router'
import { ConfigPage } from '../features/config/ConfigPage'

export const Route = createFileRoute('/config')({ ssr: false, component: ConfigPage })
