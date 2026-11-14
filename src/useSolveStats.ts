import { useCallback, useEffect, useRef, useState } from 'react'

export interface SolveStats {
  readonly elapsedMs: number
  readonly hintCount: number
}

export const formatSolveTime = (elapsedMs: number): string => {
  const seconds = Math.floor(elapsedMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const loadStats = (key: string, solved: boolean): SolveStats | null => {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<SolveStats>
      if (typeof parsed.elapsedMs === 'number' && Number.isFinite(parsed.elapsedMs) &&
        parsed.elapsedMs >= 0 && typeof parsed.hintCount === 'number' &&
        Number.isSafeInteger(parsed.hintCount) && parsed.hintCount >= 0) {
        return { elapsedMs: parsed.elapsedMs, hintCount: parsed.hintCount }
      }
      console.error('Invalid puzzle solve stats.')
    } catch (error) {
      console.error('Could not read puzzle solve stats.', error)
    }
  }
  return solved ? null : { elapsedMs: 0, hintCount: 0 }
}

export const useSolveStats = (progressKey: string, solved: boolean) => {
  const key = `${progressKey}:stats`
  const [stats, setStats] = useState(() => loadStats(key, solved))
  const current = useRef(stats)
  const segmentStart = useRef<number | null>(null)

  const checkpoint = useCallback((): void => {
    if (!current.current) return
    const now = Date.now()
    if (segmentStart.current !== null) {
      current.current = {
        ...current.current,
        elapsedMs: current.current.elapsedMs + Math.max(0, now - segmentStart.current),
      }
      segmentStart.current = now
    }
    localStorage.setItem(key, JSON.stringify(current.current))
  }, [key])

  useEffect(() => {
    const pause = (): void => {
      checkpoint()
      segmentStart.current = null
    }
    const resume = (): void => {
      if (document.visibilityState === 'visible' && segmentStart.current === null) {
        segmentStart.current = Date.now()
      }
    }
    const visibilityChanged = (): void => {
      if (document.visibilityState === 'visible') resume()
      else pause()
    }

    if (solved) {
      setStats(current.current)
      return
    }

    resume()
    const interval = window.setInterval(checkpoint, 1000)
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('pagehide', pause)
    window.addEventListener('pageshow', resume)
    return () => {
      pause()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('pageshow', resume)
    }
  }, [checkpoint, solved])

  const recordHint = (): void => {
    if (solved || !current.current) return
    current.current = { ...current.current, hintCount: current.current.hintCount + 1 }
    checkpoint()
    setStats(current.current)
  }

  return { stats, recordHint }
}
