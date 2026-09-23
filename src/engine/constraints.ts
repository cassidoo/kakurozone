import type { KakuroPuzzle } from './types'

export const ALL_DIGITS = 511
export const bitCount = (mask: number): number => {
  let count = 0
  while (mask) {
    mask &= mask - 1
    count += 1
  }
  return count
}

const combinations: number[][][] = Array.from({ length: 10 }, () =>
  Array.from({ length: 46 }, () => []),
)
for (let mask = 1; mask <= ALL_DIGITS; mask += 1) {
  let sum = 0
  for (let digit = 1; digit <= 9; digit += 1) {
    if (mask & (1 << (digit - 1))) sum += digit
  }
  combinations[bitCount(mask)]![sum]!.push(mask)
}

export const digitCombinations = (length: number, sum: number): readonly number[] =>
  combinations[length]?.[sum] ?? []

export interface ConstraintRun {
  readonly cells: readonly number[]
  readonly combinations: readonly number[]
  readonly sum: number
}

export interface Constraints {
  readonly keys: readonly string[]
  readonly runs: readonly ConstraintRun[]
  readonly memberships: readonly (readonly number[])[]
}

export const puzzleConstraints = (puzzle: KakuroPuzzle): Constraints | undefined => {
  const keys: string[] = []
  puzzle.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.kind === 'play') keys.push(`${r}:${c}`)
  }))
  const indices = new Map(keys.map((key, index) => [key, index]))
  const memberships: number[][] = keys.map(() => [])
  const ids = new Set<string>()
  const runs: ConstraintRun[] = []
  for (const run of puzzle.runs) {
    if (ids.has(run.id) || run.cells.length < 2 || run.cells.length > 9) return
    ids.add(run.id)
    const cells: number[] = []
    for (const coordinate of run.cells) {
      const index = indices.get(`${coordinate.row}:${coordinate.col}`)
      const cell = puzzle.cells[coordinate.row]?.[coordinate.col]
      if (index === undefined || cells.includes(index) || cell?.kind !== 'play') return
      if ((run.direction === 'across' ? cell.acrossRunId : cell.downRunId) !== run.id) return
      cells.push(index)
      memberships[index]!.push(runs.length)
    }
    const masks = digitCombinations(cells.length, run.sum)
    if (!masks.length) return
    runs.push({ cells, sum: run.sum, combinations: masks })
  }
  if (!keys.length || memberships.some((member) =>
    member.length !== 2 ||
    puzzle.runs[member[0]!]!.direction === puzzle.runs[member[1]!]!.direction
  )) return
  return { keys, runs, memberships }
}
