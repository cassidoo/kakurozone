import { useEffect, useState } from 'react'
import type { KakuroPuzzle } from '../engine/types'
import { findArchivedPuzzle } from './catalogue'
import type { GenerationResult } from './generation.worker'
import { referenceKey, type PuzzleReference } from './routes'

type PuzzleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly puzzle: KakuroPuzzle }
  | { readonly status: 'error'; readonly message: string }

export const usePuzzle = (reference: PuzzleReference | null): PuzzleState => {
  const key = reference ? referenceKey(reference) : null
  const archived = reference ? findArchivedPuzzle(reference) : undefined
  const [result, setResult] = useState<{ key: string; state: PuzzleState } | null>(null)
  const seed = reference?.seed
  const size = reference?.size
  const version = reference?.version

  useEffect(() => {
    if (!key || !seed || !size || !version || archived) return
    let worker: Worker
    try {
      worker = new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' })
    } catch (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Worker startup failures need the same visible error state as asynchronous failures.
      setResult({
        key,
        state: { status: 'error', message: error instanceof Error ? error.message : 'Could not start puzzle generation.' },
      })
      return
    }
    worker.onmessage = ({ data }: MessageEvent<GenerationResult>) => {
      setResult({
        key,
        state: 'error' in data
          ? { status: 'error', message: data.error }
          : { status: 'ready', puzzle: data.puzzle },
      })
      worker.terminate()
    }
    worker.onerror = () => {
      setResult({ key, state: { status: 'error', message: 'Could not generate this puzzle. Please reload to retry.' } })
      worker.terminate()
    }
    worker.postMessage({ seed, size, version } satisfies PuzzleReference)
    return () => worker.terminate()
  }, [key, seed, size, version, archived])

  if (archived) return { status: 'ready', puzzle: archived }
  if (key && result?.key === key) return result.state
  return { status: 'loading' }
}
