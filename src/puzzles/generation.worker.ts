import { generateLegacyPuzzle, generatePuzzle } from '../engine'
import type { PuzzleReference } from './routes'
import type { KakuroPuzzle } from '../engine/types'

export type GenerationResult =
  | { readonly puzzle: KakuroPuzzle }
  | { readonly error: string }

self.onmessage = (event: MessageEvent<PuzzleReference>) => {
  const { seed, size, version } = event.data
  try {
    const puzzle = version === 1
      ? generateLegacyPuzzle(seed, size)
      : generatePuzzle(seed, size)
    self.postMessage({ puzzle } satisfies GenerationResult)
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Puzzle generation failed.',
    } satisfies GenerationResult)
  }
}
