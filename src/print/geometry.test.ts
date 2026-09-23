import { describe, expect, it } from 'vitest'
import { archivePuzzles } from '../puzzles/catalogue'
import { renderPuzzleGeometry } from './geometry'

describe('printed clue geometry', () => {
  it.each([7, 9] as const)('uses readable, standard clue positions in a %s by %s grid', (size) => {
    const puzzle = archivePuzzles.find((candidate) => candidate.size === size)!
    const cellSize = 30
    const operations = renderPuzzleGeometry(puzzle, { x: 0, y: 0, size: cellSize * size })

    for (const run of puzzle.runs) {
      const first = run.cells[0]!
      const col = first.col - (run.direction === 'across' ? 1 : 0)
      const row = first.row - (run.direction === 'down' ? 1 : 0)
      const expectedX = (col + (run.direction === 'across' ? 0.74 : 0.26)) * cellSize
      const expectedY = (row + (run.direction === 'across' ? 0.26 : 0.74)) * cellSize
      const text = operations.find((operation) =>
        operation.kind === 'text' &&
        Math.abs(operation.x - expectedX) < 0.001 &&
        Math.abs(operation.y - expectedY) < 0.001,
      )
      expect(text).toMatchObject({
        kind: 'text', text: String(run.sum), tone: 'ink', align: 'center',
      })
      if (text?.kind === 'text') expect(text.size).toBeGreaterThanOrEqual(8)
      expect(operations).toContainEqual({
        kind: 'line',
        x1: col * cellSize,
        y1: row * cellSize,
        x2: (col + 1) * cellSize,
        y2: (row + 1) * cellSize,
        tone: 'ink',
        width: 0.75,
      })
    }
    expect(operations.some((operation) => operation.kind === 'rect' && operation.fill === 'ink')).toBe(false)
  })
})
