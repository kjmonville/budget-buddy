export type Theme = 'light' | 'dark' | 'auto'

export function getStoredTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? 'auto'
}

export function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const useDark = theme === 'dark' || (theme === 'auto' && prefersDark)
  document.documentElement.classList.toggle('dark', useDark)
  localStorage.setItem('theme', theme)
}
