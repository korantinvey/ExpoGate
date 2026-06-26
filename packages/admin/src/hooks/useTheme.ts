import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void }
export const ThemeContext = createContext<ThemeCtx>({ theme: 'light', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeProvider(): ThemeCtx {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) ?? 'light')

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  return { theme, setTheme }
}
