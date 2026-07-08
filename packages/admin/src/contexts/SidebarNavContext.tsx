import { createContext, useContext, useState, useCallback } from 'react'

export interface NavItem { key: string; label: string }

interface SidebarNavCtx {
  navItems: NavItem[]
  activeNav: string
  setNavItems: (items: NavItem[]) => void
  setActiveNav: (key: string) => void
}

const Ctx = createContext<SidebarNavCtx>({
  navItems: [], activeNav: '',
  setNavItems: () => {}, setActiveNav: () => {},
})

export function SidebarNavProvider({ children }: { children: React.ReactNode }) {
  const [navItems, setNavItemsState] = useState<NavItem[]>([])
  const [activeNav, setActiveNav] = useState('')
  const setNavItems = useCallback((items: NavItem[]) => setNavItemsState(items), [])
  return (
    <Ctx.Provider value={{ navItems, activeNav, setNavItems, setActiveNav }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebarNav = () => useContext(Ctx)
