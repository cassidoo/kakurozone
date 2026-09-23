export type PuzzleSize = 7 | 9
export type Direction = 'across' | 'down'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface Coordinate {
  readonly row: number
  readonly col: number
}

export interface Clue {
  readonly across?: number
  readonly down?: number
}

export interface BlockCell {
  readonly kind: 'block'
  readonly clue?: Clue
}

export interface PlayCell {
  readonly kind: 'play'
  readonly solution: number
  readonly acrossRunId: string
  readonly downRunId: string
}

export type PuzzleCell = BlockCell | PlayCell

export interface Run {
  readonly id: string
  readonly direction: Direction
  readonly sum: number
  readonly cells: readonly Coordinate[]
}

export interface PuzzleMetadata {
  readonly difficulty: Difficulty
  readonly score: number
  readonly playableCells: number
  readonly unique: true
  readonly generator: 'seeded-tile-family-v1' | 'seeded-connected-v2'
  readonly grading?: LogicalGrade
}

export interface LogicalGrade {
  readonly difficulty: Difficulty
  readonly minimumLevel: 1 | 2 | 3
  readonly rounds: number
  readonly eliminations: number
  readonly basicUnsolved: number
  readonly intermediateUnsolved: number
  /** Cell-domain reductions after intermediate logic has stalled. */
  readonly advancedSteps: number
}

export interface KakuroPuzzle {
  readonly id: string
  readonly seed: string
  readonly size: PuzzleSize
  readonly cells: readonly (readonly PuzzleCell[])[]
  readonly runs: readonly Run[]
  readonly metadata: PuzzleMetadata
}

export type CellValues = Readonly<Record<string, number>>

export const coordinateKey = ({ row, col }: Coordinate): string => `${row}:${col}`
