import { describe, expect, it } from 'vitest'
import {
  coordinateKey, countSolutions, dailyDifficulty, generateDailyPuzzle,
  generateLegacyPuzzle, generatePuzzle, gradePuzzle, puzzleSizeForSeed,
  solveLogically, validatePuzzleStructure, validateSolution,
} from '.'
import type { KakuroPuzzle } from '.'
import { searchSolutions } from './solver'

const solutionValues = (puzzle: KakuroPuzzle): Record<string, number> =>
  Object.fromEntries(puzzle.cells.flatMap((row, r) => row.flatMap((cell, c) =>
    cell.kind === 'play' ? [[`${r}:${c}`, cell.solution]] : [])))

describe('connected seeded Kakuro', () => {
  it.each(['Easy', 'Medium', 'Hard'] as const)('keeps the frozen v2 %s seed output', (difficulty) => {
    const puzzle = generatePuzzle('audit-0', difficulty === 'Easy' ? 7 : 9, difficulty)
    expect({
      id: puzzle.id,
      rows: puzzle.cells.map((row) => row.map((cell) => cell.kind === 'play' ? cell.solution : '.').join('')),
      runs: puzzle.runs.map((run) => `${run.id}=${run.sum}`),
      metadata: puzzle.metadata,
    }).toMatchSnapshot()
  })

  it('is deterministic and keeps difficulty and size variants distinct', () => {
    const puzzle = generatePuzzle('2026-09-21', 7, 'Easy')
    expect(generatePuzzle('2026-09-21', 7, 'Easy')).toEqual(puzzle)
    const medium = generatePuzzle('2026-09-21', 7, 'Medium')
    const hard = generatePuzzle('2026-09-21', 7, 'Hard')
    const larger = generatePuzzle('2026-09-21', 9, 'Easy')
    expect(new Set([puzzle.id, medium.id, hard.id, larger.id]).size).toBe(4)
    expect(medium.metadata.difficulty).toBe('Medium')
    expect(hard.metadata.difficulty).toBe('Hard')
    expect(hard.id).toMatch(/^kz2-7-hard-/)
    expect(generatePuzzle('alpha', 9)).not.toEqual(generatePuzzle('beta', 9))
  })

  it('uses date ordinals for daily targets and consistent size/default generation', () => {
    for (const seed of ['2026-09-21', '2026-09-22', '2026-09-23']) {
      const ordinal = Math.floor(Date.parse(`${seed}T00:00:00Z`) / 86_400_000)
      const difficulty = (['Easy', 'Medium', 'Hard'] as const)[ordinal % 3]
      expect(dailyDifficulty(seed)).toBe(difficulty)
      expect(puzzleSizeForSeed(seed)).toBe(difficulty === 'Easy' ? 7 : 9)
      const daily = generateDailyPuzzle(seed)
      expect(daily.metadata.difficulty).toBe(difficulty)
      expect(daily).toEqual(generatePuzzle(seed, puzzleSizeForSeed(seed)))
    }
    for (const seed of ['1969-12-31', '0001-01-01', 'not-a-date', '2026-02-30']) {
      expect(['Easy', 'Medium', 'Hard']).toContain(dailyDifficulty(seed))
      expect(dailyDifficulty(seed)).toBe(dailyDifficulty(seed))
    }
  })

  it('grades only sum constraints, never stored solution digits', () => {
    const puzzle = generatePuzzle('solution-blind', 9, 'Hard')
    const withoutAnswers: KakuroPuzzle = {
      ...puzzle,
      cells: puzzle.cells.map((row) => row.map((cell) =>
        cell.kind === 'play' ? { ...cell, solution: 1 } : cell)),
    }
    expect(gradePuzzle(withoutAnswers)).toEqual(puzzle.metadata.grading)
    expect(countSolutions(withoutAnswers)).toBe(1)
    expect(solveLogically(withoutAnswers, 1).solved).toBe(false)
    expect(solveLogically(withoutAnswers, 2).solved).toBe(false)
    expect(solveLogically(withoutAnswers, 3).solved).toBe(true)
  })

  it('validates the canonical solution and preserves player validation behavior', () => {
    const puzzle = generatePuzzle('validation', 7, 'Easy')
    const solved = solutionValues(puzzle)
    expect(validateSolution(puzzle, solved)).toEqual({
      complete: true, valid: true, incorrectCells: [],
    })
    const first = Object.keys(solved)[0]!
    const wrong = { ...solved, [first]: solved[first] === 9 ? 8 : 9 }
    expect(validateSolution(puzzle, wrong).valid).toBe(false)
    expect(validateSolution(puzzle, {}).complete).toBe(false)
  })
})

describe('independent solution counting', () => {
  const puzzle = generateLegacyPuzzle('counter', 7)
  const solved = solutionValues(puzzle)
  const first = puzzle.runs[0]!.cells[0]!
  const second = puzzle.runs[0]!.cells[1]!
  const key = coordinateKey(first)

  it('counts unique, ambiguous, impossible, and partially filled puzzles', () => {
    expect(countSolutions(puzzle)).toBe(1)
    expect(countSolutions(puzzle, 2, solved)).toBe(1)
    expect(countSolutions(puzzle, 2, { [key]: solved[key]! })).toBe(1)
    const ambiguous = { ...puzzle, runs: puzzle.runs.map((run) => ({ ...run, sum: 3 })) }
    expect(countSolutions(ambiguous, 2)).toBe(2)
    expect(countSolutions(ambiguous, 1)).toBe(1)
    expect(gradePuzzle(ambiguous)).toBeUndefined()
    expect(countSolutions({ ...puzzle, runs: [{ ...puzzle.runs[0]!, sum: 46 }, ...puzzle.runs.slice(1)] })).toBe(0)
    expect(searchSolutions(puzzle, 2, {}, 0)).toBeUndefined()
  })

  it('rejects invalid initial entries, including otherwise fully filled states', () => {
    for (const invalid of [0, -1, 10, 1.5, NaN, Infinity]) {
      expect(countSolutions(puzzle, 2, { [key]: invalid })).toBe(0)
      expect(countSolutions(puzzle, 2, { ...solved, [key]: invalid })).toBe(0)
    }
    expect(countSolutions(puzzle, 2, { '0:0': 1 })).toBe(0)
    expect(countSolutions(puzzle, 2, { '99:99': 1 })).toBe(0)
    expect(countSolutions(puzzle, 2, { [key]: 1, [coordinateKey(second)]: 1 })).toBe(0)
    expect(countSolutions(puzzle, 2, { ...solved, [key]: solved[coordinateKey(second)]! })).toBe(0)
    expect(countSolutions(puzzle, 2, { ...solved, [key]: solved[key] === 9 ? 1 : solved[key]! + 1 })).toBe(0)
    expect(countSolutions({ ...puzzle, runs: puzzle.runs.slice(1) })).toBe(0)
  })
})

describe('structural validation', () => {
  const puzzle = generatePuzzle('structure', 9, 'Medium')

  it('validates crossing links, contiguous maximal runs, sums, and clues', () => {
    expect(validatePuzzleStructure(puzzle)).toEqual([])
    expect(validatePuzzleStructure({ ...puzzle, runs: puzzle.runs.slice(1) }).length).toBeGreaterThan(0)
    const longIndex = puzzle.runs.findIndex((run) => run.cells.length >= 4)
    const long = puzzle.runs[longIndex]!
    for (const cells of [
      [...long.cells].reverse(),
      long.cells.slice(0, -1),
      [long.cells[0]!, ...long.cells.slice(2)],
    ]) {
      const runs = puzzle.runs.map((run, index) => index === longIndex ? { ...run, cells } : run)
      expect(validatePuzzleStructure({ ...puzzle, runs }).length).toBeGreaterThan(0)
    }
    const orphan = {
      ...puzzle,
      cells: puzzle.cells.map((row, r) => row.map((cell, c) =>
        r === 0 && c === 0 ? { kind: 'block' as const, clue: { across: 3 } } : cell)),
    }
    expect(validatePuzzleStructure(orphan).some((error) => error.includes('Orphan'))).toBe(true)
    const duplicate = { ...puzzle, runs: [...puzzle.runs, puzzle.runs[0]!] }
    expect(validatePuzzleStructure(duplicate).some((error) => error.includes('exactly one'))).toBe(true)
  })

  it('requires connectivity for v2 while preserving valid disconnected v1 boards', () => {
    const legacy = generateLegacyPuzzle('structure', 7)
    expect(validatePuzzleStructure(legacy)).toEqual([])
    expect(validatePuzzleStructure({
      ...legacy, metadata: { ...legacy.metadata, generator: 'seeded-connected-v2' },
    }).some((error) => error.includes('connected component'))).toBe(true)
  })
})

describe('legacy byte-compatible generation', () => {
  it.each([
    {
      size: 7 as const, id: 'kz-7-b28n51', count: 16,
      rows: ['.......', '.83.95.', '.61.76.', '.......', '.13.75.', '.29.12.', '.......'],
    },
    {
      size: 9 as const, id: 'kz-9-8a915r', count: 36,
      rows: ['.........', '.26.95.71', '.13.61.94', '.........', '.31.16.79',
        '.86.89.16', '.........', '.19.15.86', '.35.34.42'],
    },
  ])('preserves the $size×$size 2026-09-21 seed and progress identity', ({ size, id, count, rows }) => {
    const puzzle = generateLegacyPuzzle('2026-09-21', size)
    expect(puzzle.id).toBe(id)
    expect(puzzle.cells.map((row) => row.map((cell) => cell.kind === 'play' ? cell.solution : '.').join(''))).toEqual(rows)
    expect(puzzle.metadata).toEqual({
      difficulty: 'Hard', score: 3, playableCells: count, unique: true, generator: 'seeded-tile-family-v1',
    })
    expect(countSolutions(puzzle)).toBe(1)
    expect(validatePuzzleStructure(puzzle)).toEqual([])
  })
})
