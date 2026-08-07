import { useEffect, useState } from 'react'

// useTheme - single source of truth for light/dark.
// mode is what the USER picked: 'system' | 'light' | 'dark'
// isDark is what actually gets applied.
// 'system' follows the OS setting and updates live when the user
// flips their phone/Mac between light and dark.

const KEY = 'medrota-theme'
const QUERY = '(prefers-color-scheme: dark)'

export function useTheme() {
  const [mode, setMode] = useState(() => localStorage.getItem(KEY) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(QUERY).matches)

  // Listen for OS appearance changes
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = mode === 'system' ? systemDark : mode === 'dark'

  // Apply to <html> and remember the choice
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    localStorage.setItem(KEY, mode)
  }, [mode, isDark])

  return { mode, setMode, isDark }
}
