import { ALL_DIGITS, bitCount, puzzleConstraints } from './constraints'
import type { Constraints } from './constraints'
import type { KakuroPuzzle, LogicalGrade } from './types'

export interface LogicalSolve {
  readonly solved: boolean
  readonly contradiction: boolean
  readonly unsolved: number
  readonly rounds: number
  readonly eliminations: number
  readonly advancedSteps: number
}

// Level 1: fixed-digit run combinations and crossing singles.
// Level 2: position coverage of combinations and mandatory-digit hidden singles.
// Level 3: exact positional support (including Hall/all-different subsets).
// Each stronger level starts only after the previous level reaches a fixed point.

// Forward/backward subset reachability finds every supported digit in every
// position, without guessing a puzzle cell or consulting stored solution digits.
const matchingSupports = (domains: readonly number[], combination: number): number[] | undefined => {
  const forward: Set<number>[] = [new Set([0])]
  for (const domain of domains) {
    const next = new Set<number>()
    for (const used of forward[forward.length - 1]!) {
      let choices = domain & combination & ~used
      while (choices) {
        const bit = choices & -choices
        choices ^= bit
        next.add(used | bit)
      }
    }
    if (!next.size) return
    forward.push(next)
  }
  if (!forward[domains.length]!.has(combination)) return
  const supports = domains.map(() => 0)
  let reachable = new Set([combination])
  for (let index = domains.length - 1; index >= 0; index -= 1) {
    const previous = new Set<number>()
    for (const used of forward[index]!) {
      let choices = domains[index]! & combination & ~used
      while (choices) {
        const bit = choices & -choices
        choices ^= bit
        if (reachable.has(used | bit)) {
          supports[index]! |= bit
          previous.add(used)
        }
      }
    }
    reachable = previous
  }
  return supports
}

interface PropagationState extends LogicalSolve {
  readonly domains: number[]
}

const solve = (
  constraints: Constraints, level: 1 | 2 | 3,
  domains = constraints.keys.map(() => ALL_DIGITS),
): PropagationState => {
  let rounds = 0
  let eliminations = 0
  let advancedSteps = 0
  let contradiction = false
  let changed = true
  while (changed && !contradiction) {
    changed = false
    rounds += 1
    for (const run of constraints.runs) {
      const current = run.cells.map((index) => domains[index]!)
      let fixed = 0
      for (const domain of current) {
        if (bitCount(domain) !== 1) continue
        if (fixed & domain) contradiction = true
        fixed |= domain
      }
      if (contradiction) break
      const supports = current.map(() => 0)
      let mandatory = ALL_DIGITS
      let validCombinations = 0
      for (const combination of run.combinations) {
        if ((combination & fixed) !== fixed) continue
        const possible = current.map((domain) =>
          bitCount(domain) === 1 ? domain : domain & combination & ~fixed)
        if (level >= 2) {
          if (possible.some((domain) => !domain) ||
            possible.reduce((union, domain) => union | domain, 0) !== combination) continue
        }
        if (level === 3) {
          const matched = matchingSupports(possible, combination)
          if (!matched) continue
          matched.forEach((domain, index) => { supports[index]! |= domain })
        } else {
          current.forEach((domain, index) => {
            supports[index]! |= bitCount(domain) === 1 ? domain : combination & ~fixed
          })
        }
        mandatory &= combination
        validCombinations += 1
      }
      if (!validCombinations) {
        contradiction = true
        break
      }
      if (level >= 2) {
        for (let bit = 1; bit <= 256; bit <<= 1) {
          if (!(mandatory & bit)) continue
          const positions = current.flatMap((domain, index) =>
            domain & supports[index]! & bit ? [index] : [])
          if (positions.length === 1) supports[positions[0]!] = bit
        }
      }
      for (let position = 0; position < run.cells.length; position += 1) {
        const index = run.cells[position]!
        const before = domains[index]!
        const after = before & supports[position]!
        if (!after) contradiction = true
        if (after !== before) {
          domains[index] = after
          eliminations += bitCount(before) - bitCount(after)
          changed = true
          if (level === 3) advancedSteps += 1
        }
      }
    }
  }
  const unsolved = domains.filter((domain) => bitCount(domain) !== 1).length
  return { solved: !contradiction && unsolved === 0, contradiction, unsolved, rounds, eliminations, advancedSteps, domains }
}

export const solveLogically = (puzzle: KakuroPuzzle, level: 1 | 2 | 3): LogicalSolve => {
  const constraints = puzzleConstraints(puzzle)
  if (!constraints) return {
    solved: false, contradiction: true, unsolved: 0, rounds: 0, eliminations: 0, advancedSteps: 0,
  }
  let result = solve(constraints, 1)
  let rounds = result.rounds
  let eliminations = result.eliminations
  for (const next of [2, 3] as const) {
    if (next > level || result.solved || result.contradiction) break
    result = solve(constraints, next, result.domains)
    rounds += result.rounds
    eliminations += result.eliminations
  }
  return {
    solved: result.solved, contradiction: result.contradiction, unsolved: result.unsolved,
    rounds, eliminations, advancedSteps: result.advancedSteps,
  }
}

export const gradePuzzle = (puzzle: KakuroPuzzle): LogicalGrade | undefined => {
  const constraints = puzzleConstraints(puzzle)
  if (!constraints) return
  const basic = solve(constraints, 1)
  if (basic.contradiction) return
  if (basic.solved) return {
    difficulty: 'Easy', minimumLevel: 1,
    rounds: basic.rounds, eliminations: basic.eliminations, advancedSteps: 0,
    basicUnsolved: 0, intermediateUnsolved: 0,
  }
  const intermediate = solve(constraints, 2, basic.domains)
  if (intermediate.contradiction) return
  if (intermediate.solved) return {
    difficulty: 'Medium', minimumLevel: 2,
    rounds: basic.rounds + intermediate.rounds,
    eliminations: basic.eliminations + intermediate.eliminations, advancedSteps: 0,
    basicUnsolved: basic.unsolved, intermediateUnsolved: 0,
  }
  const advanced = solve(constraints, 3, intermediate.domains)
  if (!advanced.solved) return
  return {
    difficulty: 'Hard', minimumLevel: 3,
    rounds: basic.rounds + intermediate.rounds + advanced.rounds,
    eliminations: basic.eliminations + intermediate.eliminations + advanced.eliminations,
    advancedSteps: advanced.advancedSteps,
    basicUnsolved: basic.unsolved, intermediateUnsolved: intermediate.unsolved,
  }
}
