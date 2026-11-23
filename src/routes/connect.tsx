import { createFileRoute } from '@tanstack/react-router'
import { ConnectPage } from '../features/connect/ConnectPage'
import { validateConnectSearch } from '../features/connect/connectSearch'

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
  validateSearch: validateConnectSearch,
})
