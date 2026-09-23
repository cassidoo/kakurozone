/// <reference types="node" />
import { env, stdout } from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  countSolutions, generatePuzzle, gradePuzzle, solveLogically, validatePuzzleStructure,
} from '.'

describe('ten-seed-per-tier generation audit', () => {
  it('supports ten manual 7×7 Hard route seeds', () => {
    const timings: number[] = []
    for (let seed = 0; seed < 10; seed += 1) {
      const start = performance.now()
      const puzzle = generatePuzzle(`manual-hard-${seed}`, 7, 'Hard')
      timings.push(performance.now() - start)
      expect(validatePuzzleStructure(puzzle)).toEqual([])
      expect(countSolutions(puzzle)).toBe(1)
      expect(solveLogically(puzzle, 2).solved).toBe(false)
      expect(solveLogically(puzzle, 3).solved).toBe(true)
      expect(puzzle.metadata.difficulty).toBe('Hard')
    }
    timings.sort((a, b) => a - b)
    stdout.write(JSON.stringify({
      difficulty: 'Hard', size: 7, seeds: 10,
      medianMs: Math.round(timings[5]!), maxMs: Math.round(timings[9]!),
    }) + '\n')
  }, 30_000)

  it.each(['Easy', 'Medium', 'Hard'] as const)('audits measured %s puzzles', (difficulty) => {
    const sampleCount = Number(env.KAKURO_AUDIT_COUNT ?? 10)
    const layouts = new Set<string>()
    const timings: number[] = []
    const cellCounts: number[] = []
    const runLengths = new Set<number>()
    const stalled: number[] = []
    for (let seed = 0; seed < sampleCount; seed += 1) {
      const start = performance.now()
      const puzzle = generatePuzzle(`audit-${seed}`, difficulty === 'Easy' ? 7 : 9, difficulty)
      timings.push(performance.now() - start)
      cellCounts.push(puzzle.metadata.playableCells)
      expect(validatePuzzleStructure(puzzle)).toEqual([])
      expect(countSolutions(puzzle)).toBe(1)
      expect(gradePuzzle(puzzle)).toEqual(puzzle.metadata.grading)
      expect(puzzle.metadata.difficulty).toBe(difficulty)
      expect(puzzle.metadata.generator).toBe('seeded-connected-v2')
      expect(solveLogically(puzzle, puzzle.metadata.score as 1 | 2 | 3).solved).toBe(true)
      expect(puzzle.metadata.score).toBe(difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3)
      const lengths = puzzle.runs.map((run) => run.cells.length)
      lengths.forEach((length) => runLengths.add(length))
      expect(Math.max(...lengths)).toBeGreaterThanOrEqual(4)
      expect(new Set(lengths).size).toBeGreaterThanOrEqual(3)
      expect(new Set(puzzle.runs.map((run) => run.sum)).size).toBeGreaterThanOrEqual(5)
      expect(puzzle.cells.flat().some((cell) => cell.kind === 'block' &&
        cell.clue?.across !== undefined && cell.clue.down !== undefined)).toBe(true)
      layouts.add(puzzle.cells.map((row) => row.map((cell) => cell.kind === 'play' ? '.' : '#').join('')).join('/'))
      if (difficulty !== 'Easy') expect(solveLogically(puzzle, 1).solved).toBe(false)
      if (difficulty === 'Hard') {
        const intermediate = solveLogically(puzzle, 2)
        stalled.push(intermediate.unsolved)
        expect(intermediate.solved).toBe(false)
        expect(intermediate.unsolved).toBeGreaterThanOrEqual(Math.ceil(puzzle.metadata.playableCells / 3))
        expect(puzzle.metadata.grading!.advancedSteps).toBeGreaterThan(0)
        expect(lengths.filter((length) => length >= 4).length).toBeGreaterThanOrEqual(4)
        const longRuns = new Set(puzzle.runs.filter((run) => run.cells.length >= 4).map((run) => run.id))
        expect(puzzle.cells.flat().some((cell) => cell.kind === 'play' &&
          longRuns.has(cell.acrossRunId) && longRuns.has(cell.downRunId))).toBe(true)
      }
    }
    expect(layouts.size).toBeGreaterThanOrEqual(Math.floor(sampleCount * 0.9))
    expect(runLengths.size).toBeGreaterThanOrEqual(5)
    timings.sort((a, b) => a - b)
    stdout.write(JSON.stringify({
      difficulty, seeds: sampleCount, distinctLayouts: layouts.size,
      minMs: Math.round(timings[0]!), medianMs: Math.round(timings[Math.floor(sampleCount / 2)]!),
      p95Ms: Math.round(timings[Math.ceil(sampleCount * 0.95) - 1]!),
      maxMs: Math.round(timings.at(-1)!),
      cells: [Math.min(...cellCounts), Math.max(...cellCounts)],
      runLengths: [...runLengths].sort(),
      ...(stalled.length ? { intermediateUnsolved: [Math.min(...stalled), Math.max(...stalled)] } : {}),
    }) + '\n')
  }, 120_000)
})
