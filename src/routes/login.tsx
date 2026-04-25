import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '../features/auth/LoginPage'

export const Route = createFileRoute('/login')({ component: LoginPage })
