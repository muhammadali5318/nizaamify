import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedMode = 'light' | 'dark'

const STORAGE_KEY = 'nizaamify.theme.mode'

type ThemeModeContextValue = {
  /** What the user picked: system, light, or dark. */
  mode: ThemeMode
  /** What we actually render (system → resolves to current OS preference). */
  resolved: ResolvedMode
  setMode: (mode: ThemeMode) => void
  /** Convenience for the toggle button — flips light↔dark; system → opposite of current OS. */
  toggle: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function getSystemPref(): ResolvedMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyDom(resolved: ResolvedMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolved
  document.body.dataset.theme = resolved
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored())
  const [systemPref, setSystemPref] = useState<ResolvedMode>(() =>
    getSystemPref()
  )

  // Keep systemPref in sync with the OS so mode='system' updates live.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handle = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handle)
    return () => mql.removeEventListener('change', handle)
  }, [])

  const resolved: ResolvedMode = mode === 'system' ? systemPref : mode

  // Apply to <html> and <body> so CSS [data-theme="dark"] selectors hit.
  useEffect(() => {
    applyDom(resolved)
  }, [resolved])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
    try {
      if (typeof window !== 'undefined')
        window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage may be disabled (private mode); honor the choice in-memory.
    }
  }

  const toggle = () => {
    // Sticky behavior: explicit pick beats system. If user is on system, we flip
    // to the opposite of what they currently see — so the click does what they
    // expect ("make it dark / make it light").
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved]
  )

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext)
  if (!ctx)
    throw new Error('useThemeMode must be used inside ThemeModeProvider')
  return ctx
}
