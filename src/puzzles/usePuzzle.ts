import { useEffect, useState } from 'react'
import type { KakuroPuzzle } from '../engine/types'
import { findLoadedPuzzle, loadPuzzle } from './loader'
import { referenceKey, type PuzzleReference } from './routes'

type PuzzleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly puzzle: KakuroPuzzle }
  | { readonly status: 'error'; readonly message: string }

export const usePuzzle = (
  reference: PuzzleReference | null,
  priority: 'interactive' | 'preview' = 'interactive',
): PuzzleState => {
  const key = reference ? referenceKey(reference) : null
  const loaded = reference ? findLoadedPuzzle(reference) : undefined
  const [result, setResult] = useState<{ key: string; state: PuzzleState } | null>(null)
  const seed = reference?.seed
  const size = reference?.size
  const version = reference?.version

  useEffect(() => {
    if (!key || !seed || !size || !version || loaded) return
    const controller = new AbortController()
    void loadPuzzle({ seed, size, version }, { signal: controller.signal, priority }).then(
      (puzzle) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'ready', puzzle } })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            key,
            state: { status: 'error', message: error instanceof Error ? error.message : 'Could not generate this puzzle.' },
          })
        }
      },
    )
    return () => controller.abort()
  }, [key, seed, size, version, loaded, priority])

  if (loaded) return { status: 'ready', puzzle: loaded }
  if (key && result?.key === key) return result.state
  return { status: 'loading' }
}
