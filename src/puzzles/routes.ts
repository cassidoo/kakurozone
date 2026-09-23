import type { KakuroPuzzle, PuzzleSize } from '../engine/types'

export interface PuzzleReference {
  readonly seed: string
  readonly size: PuzzleSize
  readonly version: 1 | 2
}

export type PuzzleRoute =
  | { readonly view: 'home' | 'archive' | 'how-to-play' }
  | { readonly view: 'print'; readonly puzzle?: PuzzleReference }
  | { readonly view: 'play'; readonly puzzle: PuzzleReference }
  | { readonly view: 'not-found' }

export const localDateSeed = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const isDateSeed = (seed: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(seed) &&
  Number.isFinite(Date.parse(`${seed}T00:00:00Z`)) &&
  new Date(`${seed}T00:00:00Z`).toISOString().slice(0, 10) === seed

export const parsePuzzleRoute = (hash: string): PuzzleRoute => {
  const path = hash.replace(/^#/, '')
  if (!path) return { view: 'home' }
  if (path === 'archive') return { view: 'archive' }
  if (path === 'how-to-play') return { view: 'how-to-play' }
  if (path === 'print') return { view: 'print' }
  const match = /^(play|print)\/(?:(v2)\/)?(\d{4}-\d{2}-\d{2})\/(7|9)$/.exec(path)
  if (!match || !isDateSeed(match[3])) return { view: 'not-found' }
  return {
    view: match[1] === 'play' ? 'play' : 'print',
    puzzle: {
      version: match[2] ? 2 : 1,
      seed: match[3],
      size: match[4] === '7' ? 7 : 9,
    },
  }
}

export const puzzlePath = (
  puzzle: Pick<KakuroPuzzle, 'seed' | 'size'> & { readonly metadata: Pick<KakuroPuzzle['metadata'], 'generator'> },
  view: 'play' | 'print' = 'play',
): string =>
  `${view}/${puzzle.metadata.generator === 'seeded-tile-family-v1' ? '' : 'v2/'}${encodeURIComponent(puzzle.seed)}/${puzzle.size}`

export const referenceKey = ({ version, seed, size }: PuzzleReference): string =>
  `${version}:${seed}:${size}`
