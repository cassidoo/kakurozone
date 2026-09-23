import type { KakuroPuzzle } from '../engine/types'
import { findArchivedPuzzle } from './catalogue'
import type { GenerationResult } from './generation.worker'
import { referenceKey, type PuzzleReference } from './routes'

type Priority = 'interactive' | 'preview'

interface Consumer {
  readonly priority: Priority
  readonly resolve: (puzzle: KakuroPuzzle) => void
  readonly reject: (error: Error) => void
}

interface Job {
  readonly key: string
  readonly reference: PuzzleReference
  readonly consumers: Set<Consumer>
}

const CACHE_LIMIT = 96
const cache = new Map<string, KakuroPuzzle>()
const pending = new Map<string, Job>()
let active: { job: Job; worker: Worker } | undefined

export const findLoadedPuzzle = (reference: PuzzleReference): KakuroPuzzle | undefined => {
  const frozen = findArchivedPuzzle(reference)
  if (frozen) return frozen
  const key = referenceKey(reference)
  const puzzle = cache.get(key)
  if (puzzle) {
    cache.delete(key)
    cache.set(key, puzzle)
  }
  return puzzle
}

const finish = (job: Job, result: GenerationResult): void => {
  if (pending.get(job.key) !== job) return
  if ('puzzle' in result) {
    cache.set(job.key, result.puzzle)
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  }
  active?.worker.terminate()
  active = undefined
  pending.delete(job.key)
  for (const consumer of job.consumers) {
    if ('error' in result) consumer.reject(new Error(result.error))
    else consumer.resolve(result.puzzle)
  }
  startNext()
}

const startNext = (): void => {
  if (active) return
  const jobs = [...pending.values()]
  // Explicit play and export requests take precedence over queued card previews.
  const job = jobs.find(({ consumers }) =>
    [...consumers].some(({ priority }) => priority === 'interactive'),
  ) ?? jobs[0]
  if (!job) return
  try {
    const worker = new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' })
    active = { job, worker }
    worker.onmessage = ({ data }: MessageEvent<GenerationResult>) => finish(job, data)
    worker.onerror = () => finish(job, { error: 'Could not generate this puzzle. Please try again.' })
    worker.postMessage(job.reference)
  } catch (error) {
    finish(job, { error: error instanceof Error ? error.message : 'Could not start puzzle generation.' })
  }
}

export const loadPuzzle = (
  reference: PuzzleReference,
  { signal, priority = 'interactive' }: { readonly signal?: AbortSignal; readonly priority?: Priority } = {},
): Promise<KakuroPuzzle> => {
  if (signal?.aborted) return Promise.reject(new DOMException('Puzzle request cancelled.', 'AbortError'))
  const loaded = findLoadedPuzzle(reference)
  if (loaded) return Promise.resolve(loaded)

  const key = referenceKey(reference)
  const job = pending.get(key) ?? { key, reference, consumers: new Set<Consumer>() }
  pending.set(key, job)
  return new Promise((resolve, reject) => {
    const consumer: Consumer = {
      priority,
      resolve: (puzzle) => {
        signal?.removeEventListener('abort', cancel)
        resolve(puzzle)
      },
      reject: (error) => {
        signal?.removeEventListener('abort', cancel)
        reject(error)
      },
    }
    const cancel = (): void => {
      job.consumers.delete(consumer)
      consumer.reject(new DOMException('Puzzle request cancelled.', 'AbortError'))
      if (job.consumers.size === 0) {
        pending.delete(key)
        if (active?.job === job) {
          active.worker.terminate()
          active = undefined
        }
        startNext()
      }
    }
    job.consumers.add(consumer)
    signal?.addEventListener('abort', cancel, { once: true })
    startNext()
  })
}
