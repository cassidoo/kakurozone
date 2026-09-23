import { ALL_DIGITS, bitCount, puzzleConstraints } from './constraints'
import type { CellValues, KakuroPuzzle } from './types'

/**
 * Independent CSP search. Only assigned digits constrain a run's combinations;
 * the logical grader's positional matching and its result are never consulted.
 * A budget exhaustion is reported as undefined, never mistaken for uniqueness.
 */
export const searchSolutions = (
  puzzle: KakuroPuzzle,
  limit = 2,
  initial: CellValues = {},
  nodeBudget = Number.POSITIVE_INFINITY,
): number | undefined => {
  if (!Number.isInteger(limit) || limit < 1) return 0
  const constraints = puzzleConstraints(puzzle)
  if (!constraints) return 0
  const { keys, runs, memberships } = constraints
  const indices = new Map(keys.map((key, index) => [key, index]))
  const values = new Int16Array(keys.length)
  for (const [key, digit] of Object.entries(initial)) {
    const index = indices.get(key)
    if (index === undefined || !Number.isInteger(digit) || digit < 1 || digit > 9) return 0
    values[index] = 1 << (digit - 1)
  }
  let solutions = 0
  let nodes = 0
  let exhausted = false
  const search = (): void => {
    nodes += 1
    if (nodes > nodeBudget) {
      exhausted = true
      return
    }
    const allowed = new Int16Array(runs.length)
    for (let r = 0; r < runs.length; r += 1) {
      const run = runs[r]!
      let fixed = 0
      for (const index of run.cells) {
        const value = values[index]!
        if (value & fixed) return
        fixed |= value
      }
      let union = 0
      for (const combination of run.combinations) {
        if ((combination & fixed) === fixed) union |= combination
      }
      if (!union) return
      allowed[r] = union & ~fixed
    }
    let next = -1
    let candidates = 0
    let minimum = 10
    for (let index = 0; index < values.length; index += 1) {
      if (values[index]) continue
      let mask = ALL_DIGITS
      for (const runIndex of memberships[index]!) mask &= allowed[runIndex]!
      const count = bitCount(mask)
      if (!count) return
      if (count < minimum) {
        next = index
        candidates = mask
        minimum = count
      }
    }
    if (next < 0) {
      solutions += 1
      return
    }
    while (candidates && solutions < limit && !exhausted) {
      const bit = candidates & -candidates
      candidates ^= bit
      values[next] = bit
      search()
    }
    values[next] = 0
  }
  search()
  return exhausted ? undefined : solutions
}

export const countSolutions = (
  puzzle: KakuroPuzzle,
  limit = 2,
  initial: CellValues = {},
): number => searchSolutions(puzzle, limit, initial)!
