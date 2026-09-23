import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { archivePuzzles } from './catalogue'
import type { GenerationResult } from './generation.worker'
import { puzzleReference, type PuzzleReference } from './routes'

class MockWorker {
  static instances: MockWorker[] = []
  static startupError = false
  onmessage: ((event: { data: GenerationResult }) => void) | null = null
  onerror: (() => void) | null = null
  reference!: PuzzleReference
  terminate = vi.fn()

  constructor() {
    if (MockWorker.startupError) throw new Error('Worker startup failed.')
    MockWorker.instances.push(this)
  }

  postMessage(reference: PuzzleReference) {
    this.reference = reference
  }

  complete() {
    const puzzle = { ...archivePuzzles[0], seed: this.reference.seed, size: this.reference.size }
    this.onmessage?.({ data: { puzzle } })
    return puzzle
  }
}

const reference = (seed: string): PuzzleReference => ({ seed, size: 9, version: 2 })
const a = reference('2026-09-21')
const b = reference('2026-09-22')
const c = reference('2026-09-23')
const latestWorker = () => MockWorker.instances.at(-1)!

describe('shared puzzle loader', () => {
  beforeEach(() => {
    vi.resetModules()
    MockWorker.instances = []
    MockWorker.startupError = false
    vi.stubGlobal('Worker', MockWorker)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('reuses frozen definitions without creating a worker', async () => {
    const { loadPuzzle } = await import('./loader')
    const puzzle = archivePuzzles[0]
    expect(await loadPuzzle(puzzleReference(puzzle))).toEqual(puzzle)
    expect(MockWorker.instances).toHaveLength(0)
  })

  it('deduplicates consumers and caches generated puzzles', async () => {
    const { loadPuzzle, findLoadedPuzzle } = await import('./loader')
    const first = loadPuzzle(a, { priority: 'preview' })
    const second = loadPuzzle(a)
    expect(MockWorker.instances).toHaveLength(1)
    const puzzle = latestWorker().complete()
    expect(await first).toBe(puzzle)
    expect(await second).toBe(puzzle)
    expect(await loadPuzzle(a)).toBe(puzzle)
    expect(findLoadedPuzzle(a)).toBe(puzzle)
    expect(MockWorker.instances).toHaveLength(1)
    expect(latestWorker().terminate).toHaveBeenCalledOnce()
  })

  it('runs only one worker at a time and prioritizes play and exports over previews', async () => {
    const { loadPuzzle } = await import('./loader')
    const jobs = [
      loadPuzzle(a, { priority: 'preview' }),
      loadPuzzle(b, { priority: 'preview' }),
      loadPuzzle(c),
    ]
    expect(MockWorker.instances).toHaveLength(1)
    expect(latestWorker().reference).toEqual(a)
    latestWorker().complete()
    expect(latestWorker().reference).toEqual(c)
    latestWorker().complete()
    expect(latestWorker().reference).toEqual(b)
    latestWorker().complete()
    await Promise.all(jobs)
  })

  it('promotes an already queued preview when requested for printing', async () => {
    const { loadPuzzle } = await import('./loader')
    const jobs = [
      loadPuzzle(a, { priority: 'preview' }),
      loadPuzzle(b, { priority: 'preview' }),
      loadPuzzle(c, { priority: 'preview' }),
      loadPuzzle(c),
    ]
    latestWorker().complete()
    expect(latestWorker().reference).toEqual(c)
    latestWorker().complete()
    expect(latestWorker().reference).toEqual(b)
    latestWorker().complete()
    await Promise.all(jobs)
    expect(MockWorker.instances).toHaveLength(3)
  })

  it('detaches cancelled consumers without cancelling another consumer of the same puzzle', async () => {
    const { loadPuzzle } = await import('./loader')
    const controller = new AbortController()
    const preview = loadPuzzle(a, { signal: controller.signal, priority: 'preview' })
    const cancelled = expect(preview).rejects.toMatchObject({ name: 'AbortError' })
    const play = loadPuzzle(a)
    controller.abort()
    expect(latestWorker().terminate).not.toHaveBeenCalled()
    const puzzle = latestWorker().complete()
    await cancelled
    expect(await play).toBe(puzzle)
  })

  it('drops off-page queued work and stops unused active work', async () => {
    const { loadPuzzle } = await import('./loader')
    const active = new AbortController()
    const queued = new AbortController()
    const first = loadPuzzle(a, { signal: active.signal })
    const second = loadPuzzle(b, { signal: queued.signal })
    const assertions = [
      expect(first).rejects.toMatchObject({ name: 'AbortError' }),
      expect(second).rejects.toMatchObject({ name: 'AbortError' }),
    ]
    queued.abort()
    active.abort()
    await Promise.all(assertions)
    expect(MockWorker.instances).toHaveLength(1)
    expect(latestWorker().terminate).toHaveBeenCalledOnce()
  })

  it('ignores stale replies from cancelled requests even when the same date is requested again', async () => {
    const { loadPuzzle, findLoadedPuzzle } = await import('./loader')
    const controller = new AbortController()
    const first = loadPuzzle(a, { signal: controller.signal })
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const oldWorker = latestWorker()
    controller.abort()
    const second = loadPuzzle(a)
    oldWorker.complete()
    expect(findLoadedPuzzle(a)).toBeUndefined()
    expect(latestWorker().terminate).not.toHaveBeenCalled()
    const puzzle = latestWorker().complete()
    expect(await second).toBe(puzzle)
    await cancelled
  })

  it.each(['startup', 'runtime', 'generation'])('surfaces %s errors and allows retrying', async (failure) => {
    const { loadPuzzle, findLoadedPuzzle } = await import('./loader')
    MockWorker.startupError = failure === 'startup'
    const failed = loadPuzzle(a)
    const rejected = expect(failed).rejects.toThrow()
    if (failure === 'runtime') latestWorker().onerror?.()
    if (failure === 'generation') latestWorker().onmessage?.({ data: { error: 'No valid puzzle found.' } })
    await rejected
    expect(findLoadedPuzzle(a)).toBeUndefined()
    MockWorker.startupError = false
    const retry = loadPuzzle(a)
    const puzzle = latestWorker().complete()
    expect(await retry).toBe(puzzle)
  })

  it('continues queued work after an error', async () => {
    const { loadPuzzle } = await import('./loader')
    const failed = loadPuzzle(a)
    const rejected = expect(failed).rejects.toThrow('Could not generate')
    const next = loadPuzzle(b)
    latestWorker().onerror?.()
    expect(latestWorker().reference).toEqual(b)
    const puzzle = latestWorker().complete()
    expect(await next).toBe(puzzle)
    await rejected
  })

  it('rejects already cancelled requests without starting work', async () => {
    const { loadPuzzle } = await import('./loader')
    const controller = new AbortController()
    controller.abort()
    await expect(loadPuzzle(a, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(MockWorker.instances).toHaveLength(0)
  })

  it('bounds generated cache size without evicting frozen definitions', async () => {
    const { loadPuzzle, findLoadedPuzzle } = await import('./loader')
    for (let index = 0; index < 100; index += 1) {
      const seed = new Date(Date.UTC(2027, 0, index + 1)).toISOString().slice(0, 10)
      const promise = loadPuzzle(reference(seed))
      latestWorker().complete()
      await promise
    }
    expect(findLoadedPuzzle(reference('2027-01-01'))).toBeUndefined()
    expect(findLoadedPuzzle(reference('2027-04-10'))).toBeDefined()
    expect(findLoadedPuzzle(puzzleReference(archivePuzzles[0]))).toEqual(archivePuzzles[0])
  })
})
