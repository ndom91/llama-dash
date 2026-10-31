import { createFileRoute } from '@tanstack/react-router'
import { CloudModelsPage } from '../features/cloud-models/CloudModelsPage'

export const Route = createFileRoute('/cloud-models')({ component: CloudModelsPage })
