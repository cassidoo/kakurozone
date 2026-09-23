import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDateSeed } from './routes'
import { subscribeToLocalDate } from './useLocalDate'

describe('local calendar subscription', () => {
  let unsubscribe: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('document', new EventTarget())
  })

  afterEach(() => {
    unsubscribe?.()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('updates at local midnight and schedules the following midnight', () => {
    vi.setSystemTime(new Date(2026, 8, 23, 23, 59, 59))
    const dates: string[] = []
    unsubscribe = subscribeToLocalDate(() => dates.push(localDateSeed()))
    expect(dates).toEqual(['2026-09-23'])
    vi.advanceTimersByTime(1000)
    expect(dates).toEqual(['2026-09-23', '2026-09-24'])
    vi.advanceTimersByTime(86_400_000)
    expect(dates.at(-1)).toBe('2026-09-25')
  })

  it.each([
    new Date(2027, 2, 14),
    new Date(2026, 10, 1),
  ])('uses the next local midnight even when a day is not 24 hours: %s', (start) => {
    vi.setSystemTime(start)
    const onChange = vi.fn()
    unsubscribe = subscribeToLocalDate(onChange)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    vi.advanceTimersByTime(end.getTime() - start.getTime() - 1)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(localDateSeed()).toBe(localDateSeed(end))
  })

  it.each(['focus', 'pageshow', 'visibilitychange'])('catches up after sleeping via %s', (event) => {
    vi.setSystemTime(new Date(2026, 8, 23, 12))
    const dates: string[] = []
    unsubscribe = subscribeToLocalDate(() => dates.push(localDateSeed()))
    vi.setSystemTime(new Date(2026, 9, 3, 12))
    const target = event === 'visibilitychange' ? document : window
    target.dispatchEvent(new Event(event))
    expect(dates.at(-1)).toBe('2026-10-03')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(12 * 60 * 60 * 1000)
    expect(dates.at(-1)).toBe('2026-10-04')
  })

  it('removes its timer and resume listeners on cleanup', () => {
    const onChange = vi.fn()
    unsubscribe = subscribeToLocalDate(onChange)
    unsubscribe()
    expect(vi.getTimerCount()).toBe(0)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
