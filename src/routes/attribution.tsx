import { createFileRoute } from '@tanstack/react-router'
import { AttributionPage } from '../features/attribution/AttributionPage'

export const Route = createFileRoute('/attribution')({ component: AttributionPage })
