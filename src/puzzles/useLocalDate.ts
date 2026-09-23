import { useSyncExternalStore } from 'react'
import { localDateSeed } from './routes'

export const subscribeToLocalDate = (onChange: () => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout>
  const refresh = (): void => {
    clearTimeout(timer)
    onChange()
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(refresh, midnight.getTime() - now.getTime())
  }
  refresh()
  window.addEventListener('focus', refresh)
  window.addEventListener('pageshow', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('pageshow', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}

export const useLocalDate = (): string =>
  useSyncExternalStore(subscribeToLocalDate, localDateSeed, localDateSeed)
