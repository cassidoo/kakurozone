import { describe, expect, it } from 'vitest'
import { isDateSeed, localDateSeed, parsePuzzleRoute, puzzlePath, referenceKey } from './routes'
import type { KakuroPuzzle } from '../engine/types'

describe('versioned puzzle routing', () => {
  it.each([
    ['#', 'home'],
    ['#archive', 'archive'],
    ['#print', 'print'],
    ['#how-to-play', 'how-to-play'],
  ])('opens the top-level route %s without a puzzle reference', (hash, view) => {
    expect(parsePuzzleRoute(hash)).toEqual({ view })
  })

  it.each(['play', 'print'])('keeps unversioned %s links on the legacy generator', (view) => {
    expect(parsePuzzleRoute(`#${view}/2026-09-21/9`)).toEqual({
      view, puzzle: { seed: '2026-09-21', size: 9, version: 1 },
    })
    expect(parsePuzzleRoute(`#${view}/v2/2026-09-21/9`)).toEqual({
      view, puzzle: { seed: '2026-09-21', size: 9, version: 2 },
    })
  })

  it('preserves the version when sharing or printing', () => {
    const puzzle = {
      seed: '2026-09-21', size: 9,
      metadata: { generator: 'seeded-connected-v2', difficulty: 'Hard', score: 3, playableCells: 40, unique: true },
    } satisfies Pick<KakuroPuzzle, 'seed' | 'size' | 'metadata'>
    expect(puzzlePath(puzzle)).toBe('play/v2/2026-09-21/9')
    expect(puzzlePath(puzzle, 'print')).toBe('print/v2/2026-09-21/9')
    expect(puzzlePath({ ...puzzle, metadata: { ...puzzle.metadata, generator: 'seeded-tile-family-v1' } }))
      .toBe('play/2026-09-21/9')
    expect(referenceKey({ seed: puzzle.seed, size: 9, version: 1 }))
      .not.toBe(referenceKey({ seed: puzzle.seed, size: 9, version: 2 }))
  })

  it.each(['#play/v3/2026-09-21/9', '#play/v2/2026-02-30/9', '#play/v2/2026-09-21/8', '#play/nonsense/9'])(
    'rejects unsupported routes: %s', (hash) => {
      expect(parsePuzzleRoute(hash)).toEqual({ view: 'not-found' })
    },
  )

  it('uses local calendar dates and validates leap days', () => {
    expect(localDateSeed(new Date(2026, 8, 21, 0, 1))).toBe('2026-09-21')
    expect(isDateSeed('2024-02-29')).toBe(true)
    expect(isDateSeed('2025-02-29')).toBe(false)
    expect(isDateSeed('2026-13-01')).toBe(false)
  })
})
