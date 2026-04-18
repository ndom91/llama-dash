import { createContext, useContext } from 'react'

type MobileMenuCtx = {
  open: boolean
  toggle: () => void
  close: () => void
}

export const MobileMenuContext = createContext<MobileMenuCtx>({
  open: false,
  toggle: () => {},
  close: () => {},
})

export const useMobileMenu = () => useContext(MobileMenuContext)
