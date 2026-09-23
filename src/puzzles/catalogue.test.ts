import { describe, expect, it } from 'vitest'
import { countSolutions, dailyDifficulty, generateDailyPuzzle, gradePuzzle, validatePuzzleStructure } from '../engine'
import { archivePuzzles, findArchivedPuzzle } from './catalogue'
import { parsePuzzleRoute, puzzlePath } from './routes'

describe('published connected puzzle archive', () => {
  it('contains 300 stable, distinct puzzles, evenly split by difficulty', () => {
    expect(archivePuzzles).toHaveLength(300)
    expect(new Set(archivePuzzles.map((puzzle) => puzzle.id)).size).toBe(300)
    expect(new Set(archivePuzzles.map((puzzle) => puzzle.seed)).size).toBe(300)
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
      expect(archivePuzzles.filter((puzzle) => puzzle.metadata.difficulty === difficulty)).toHaveLength(100)
    }
    const signatures = archivePuzzles.map((puzzle) => JSON.stringify(
      puzzle.cells.map((row) => row.map((cell) => cell.kind === 'play' ? '.' : cell.clue ?? '#')),
    ))
    expect(new Set(signatures).size).toBe(300)
  })

  it('has varied layouts and run lengths rather than repeated pair blocks', () => {
    const layouts = new Set(archivePuzzles.map((puzzle) =>
      puzzle.cells.map((row) => row.map((cell) => cell.kind === 'play' ? '.' : '#').join('')).join('/'),
    ))
    expect(layouts.size).toBeGreaterThanOrEqual(30)
    const lengths = new Set(archivePuzzles.flatMap((puzzle) => puzzle.runs.map((run) => run.cells.length)))
    expect(lengths.has(2)).toBe(true)
    expect(lengths.has(3)).toBe(true)
    expect(lengths.has(4)).toBe(true)
    expect([...lengths].some((length) => length >= 5)).toBe(true)

    for (const puzzle of archivePuzzles) {
      expect(puzzle.metadata.generator).toBe('seeded-connected-v2')
      expect(puzzle.runs.some((run) => run.cells.length >= 4)).toBe(true)
      const white = new Set(puzzle.cells.flatMap((row, r) =>
        row.flatMap((cell, c) => cell.kind === 'play' ? [`${r}:${c}`] : []),
      ))
      const reached = new Set<string>()
      const queue = [white.values().next().value!]
      for (let index = 0; index < queue.length; index += 1) {
        const key = queue[index]
        if (reached.has(key)) continue
        reached.add(key)
        const [row, col] = key.split(':').map(Number)
        for (const neighbor of [`${row - 1}:${col}`, `${row + 1}:${col}`, `${row}:${col - 1}`, `${row}:${col + 1}`]) {
          if (white.has(neighbor) && !reached.has(neighbor)) queue.push(neighbor)
        }
      }
      expect(reached.size, puzzle.seed).toBe(white.size)
    }
  })

  it('verifies every published puzzle has exactly one valid solution', () => {
    for (const puzzle of archivePuzzles) {
      expect(validatePuzzleStructure(puzzle), puzzle.seed).toEqual([])
      expect(countSolutions(puzzle), puzzle.seed).toBe(1)
    }
  }, 30_000)

  it('rates all puzzles by the logical deductions needed to solve them', () => {
    for (const puzzle of archivePuzzles) {
      const grade = gradePuzzle(puzzle)
      expect(grade, puzzle.seed).toEqual(puzzle.metadata.grading)
      expect(grade?.difficulty, puzzle.seed).toBe(puzzle.metadata.difficulty)
      expect(grade?.difficulty, puzzle.seed).toBe(dailyDifficulty(puzzle.seed))
      if (puzzle.metadata.difficulty === 'Hard') {
        expect(grade?.minimumLevel).toBe(3)
        expect(grade?.intermediateUnsolved).toBeGreaterThanOrEqual(Math.ceil(puzzle.metadata.playableCells / 3))
        expect(grade?.advancedSteps).toBeGreaterThan(0)
      }
    }
  }, 30_000)

  it('keeps frozen definitions identical to date-seeded generation', () => {
    for (const index of [0, 1, 2, 147, 148, 149, 297, 298, 299]) {
      const puzzle = archivePuzzles[index]
      expect(generateDailyPuzzle(puzzle.seed)).toEqual(puzzle)
    }
  })

  it('uses the same definitions for archive play, printing, and shared URLs', () => {
    for (const puzzle of archivePuzzles) {
      for (const view of ['play', 'print'] as const) {
        const route = parsePuzzleRoute(`#${puzzlePath(puzzle, view)}`)
        if ((route.view !== 'play' && route.view !== 'print') || !route.puzzle) {
          throw new Error(`Invalid published ${view} link for ${puzzle.seed}`)
        }
        expect(findArchivedPuzzle(route.puzzle)).toBe(puzzle)
        expect(findArchivedPuzzle({ ...route.puzzle, version: 1 })).toBeUndefined()
      }
    }
  })
})
