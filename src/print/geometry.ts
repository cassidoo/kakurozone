import type { KakuroPuzzle } from '../engine'
import { CLUE_POSITIONS, CLUE_TEXT_RATIO } from '../clue-layout'

export type VectorTone = 'ink' | 'paper' | 'grid' | 'clue' | 'block'

export type VectorOperation =
  | {
      readonly kind: 'rect'
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly fill?: VectorTone
      readonly stroke?: VectorTone
      readonly strokeWidth?: number
    }
  | {
      readonly kind: 'line'
      readonly x1: number
      readonly y1: number
      readonly x2: number
      readonly y2: number
      readonly tone: VectorTone
      readonly width: number
    }
  | {
      readonly kind: 'text'
      readonly text: string
      readonly x: number
      readonly y: number
      readonly size: number
      readonly tone: VectorTone
      readonly weight?: 'regular' | 'bold'
      readonly align?: 'left' | 'center' | 'right'
    }

export interface PuzzleGeometryOptions {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly solution?: boolean
}

export const renderPuzzleGeometry = (
  puzzle: KakuroPuzzle,
  options: PuzzleGeometryOptions,
): readonly VectorOperation[] => {
  const operations: VectorOperation[] = []
  const cellSize = options.size / puzzle.size
  const gridWidth = Math.max(0.35, cellSize * 0.025)

  puzzle.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = options.x + colIndex * cellSize
      const y = options.y + rowIndex * cellSize

      if (cell.kind === 'play') {
        operations.push({
          kind: 'rect',
          x,
          y,
          width: cellSize,
          height: cellSize,
          fill: 'paper',
          stroke: 'grid',
          strokeWidth: gridWidth,
        })
        if (options.solution) {
          operations.push({
            kind: 'text',
            text: String(cell.solution),
            x: x + cellSize / 2,
            y: y + cellSize / 2,
            size: Math.max(5, cellSize * 0.44),
            tone: 'ink',
            weight: 'bold',
            align: 'center',
          })
        }
        return
      }

      operations.push({
        kind: 'rect',
        x,
        y,
        width: cellSize,
        height: cellSize,
        fill: cell.clue ? 'clue' : 'block',
        stroke: 'ink',
        strokeWidth: gridWidth,
      })
      if (!cell.clue) return

      operations.push({
        kind: 'line',
        x1: x,
        y1: y,
        x2: x + cellSize,
        y2: y + cellSize,
        tone: 'ink',
        width: Math.max(0.4, cellSize * 0.025),
      })
      const clueSize = Math.max(5, cellSize * CLUE_TEXT_RATIO)
      for (const direction of ['across', 'down'] as const) {
        const sum = cell.clue[direction]
        if (sum === undefined) continue
        operations.push({
          kind: 'text',
          text: String(sum),
          x: x + cellSize * CLUE_POSITIONS[direction].x,
          y: y + cellSize * CLUE_POSITIONS[direction].y,
          size: clueSize,
          tone: 'ink',
          weight: 'bold',
          align: 'center',
        })
      }
    })
  })

  operations.push({
    kind: 'rect',
    x: options.x,
    y: options.y,
    width: options.size,
    height: options.size,
    stroke: 'ink',
    strokeWidth: Math.max(1, cellSize * 0.06),
  })

  return operations
}
