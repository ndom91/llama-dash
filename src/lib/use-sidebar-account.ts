import { authClient } from './auth-client'
import { useColorTheme } from './use-color-theme'

export type SidebarSession = ReturnType<typeof authClient.useSession>['data']

export function useSidebarAccount(initialSession?: SidebarSession | null) {
  const { data: clientSession } = authClient.useSession()
  const session = clientSession ?? initialSession
  const colorTheme = useColorTheme()
  const activeTheme = colorTheme.themes.find((theme) => theme.id === colorTheme.themeId) ?? colorTheme.themes[0]
  const avatarColors = [
    activeTheme.accent['300'],
    activeTheme.accent['500'],
    activeTheme.accent['700'],
    activeTheme.status.info,
    activeTheme.status.warn,
  ]
  return { session, avatarColors }
}

export async function signOutToLogin() {
  await authClient.signOut()
  window.location.href = '/login'
}
