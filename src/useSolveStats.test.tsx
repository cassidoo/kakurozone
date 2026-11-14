// @vitest-environment jsdom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSolveStats } from './useSolveStats'

let container: HTMLDivElement
let root: Root
let result: ReturnType<typeof useSolveStats>
let visibility: DocumentVisibilityState
const key = 'kakuro-zone:test'
const saved = () => JSON.parse(localStorage.getItem(`${key}:stats`)!)

const Player = ({ solved }: { solved: boolean }) => {
  const value = useSolveStats(key, solved)
  useLayoutEffect(() => { result = value })
  return null
}
const render = (solved = false) => act(() => root.render(<Player solved={solved} />))
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const visible = (state: DocumentVisibilityState) => act(() => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
})

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
  localStorage.clear()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('solve stats', () => {
  it('counts visible time, saves partial seconds on leaving, resumes visits, and freezes at completion', () => {
    render()
    advance(1250)
    visible('hidden')
    advance(60000)
    visible('visible')
    advance(2250)
    act(() => root.unmount())
    expect(saved()).toEqual({ elapsedMs: 3500, hintCount: 0 })
    advance(60000)
    root = createRoot(container)
    render()
    advance(1000)
    render(true)
    expect(result.stats).toEqual({ elapsedMs: 4500, hintCount: 0 })
    advance(60000)
    visible('hidden')
    visible('visible')
    expect(saved()).toEqual({ elapsedMs: 4500, hintCount: 0 })
    act(() => root.unmount())
    root = createRoot(container)
    render(true)
    expect(result.stats).toEqual({ elapsedMs: 4500, hintCount: 0 })
  })

  it('does not count a background-opened page and resumes after a pagehide/pageshow cycle', () => {
    visibility = 'hidden'
    render()
    advance(5000)
    visible('visible')
    advance(1500)
    act(() => window.dispatchEvent(new Event('pagehide')))
    advance(5000)
    act(() => window.dispatchEvent(new Event('pageshow')))
    advance(500)
    render(true)
    expect(result.stats?.elapsedMs).toBe(2000)
  })

  it('persists each revealed hint immediately and never clears hints on subsequent visits', () => {
    render()
    advance(250)
    act(() => result.recordHint())
    act(() => result.recordHint())
    expect(saved()).toEqual({ elapsedMs: 250, hintCount: 2 })
    act(() => root.unmount())
    root = createRoot(container)
    render()
    render(true)
    expect(result.stats?.hintCount).toBe(2)
    act(() => result.recordHint())
    expect(saved().hintCount).toBe(2)
  })

  it('does not invent time or hint usage for previously completed puzzles', () => {
    render(true)
    advance(10000)
    expect(result.stats).toBeNull()
    expect(localStorage.getItem(`${key}:stats`)).toBeNull()
  })
})
