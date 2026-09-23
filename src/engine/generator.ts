import { bitCount } from './constraints'
import { gradePuzzle } from './grading'
import { searchSolutions } from './solver'
import type { Coordinate, Difficulty, KakuroPuzzle, PuzzleCell, PuzzleSize, Run } from './types'

const hash = (value: string): number => {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return result >>> 0
}

const randomFor = (seed: string): (() => number) => {
  let state = hash(seed)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export const dailyDifficulty = (seed: string): Difficulty => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(seed) ? Date.parse(`${seed}T00:00:00Z`) : NaN
  const validDate = Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === seed
  const ordinal = validDate ? Math.floor(date / 86_400_000) : hash(seed)
  return (['Easy', 'Medium', 'Hard'] as const)[((ordinal % 3) + 3) % 3]!
}

export const puzzleSizeForSeed = (seed: string): PuzzleSize =>
  dailyDifficulty(seed) === 'Easy' ? 7 : 9

interface Layout {
  readonly mask: readonly boolean[]
  readonly runs: readonly (readonly number[])[]
  readonly memberships: readonly (readonly number[])[]
}

const makeLayout = (size: PuzzleSize, difficulty: Difficulty, random: () => number): Layout | undefined => {
  const mask = Array<boolean>(size * size).fill(false)
  const rectangles = 4 + Math.floor(random() * (size === 7 ? 5 : 9))
  for (let rectangle = 0; rectangle < rectangles; rectangle += 1) {
    const height = random() < 0.8 ? 2 : 3
    const width = random() < 0.8 ? 2 : 3
    const top = 1 + Math.floor(random() * (size - height))
    const left = 1 + Math.floor(random() * (size - width))
    for (let r = top; r < top + height; r += 1) {
      for (let c = left; c < left + width; c += 1) mask[r * size + c] = true
    }
  }
  // Seeded holes and pruning produce arbitrary masks, not a fixed board catalog.
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] && random() < 0.12) mask[index] = false
  }
  let changed = true
  while (changed) {
    changed = false
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue
      const col = index % size
      if ((!mask[index - size] && !mask[index + size]) ||
        (!(col > 0 && mask[index - 1]) && !(col < size - 1 && mask[index + 1]))) {
        mask[index] = false
        changed = true
      }
    }
  }
  const indices = mask.flatMap((play, index) => play ? [index] : [])
  if (indices.length < (size === 7 ? 18 : 28) || indices.length > (size === 7 ? 30 : 48)) return
  const seen = new Set([indices[0]!])
  for (const index of seen) {
    for (const next of [index - size, index + size, index - 1, index + 1]) {
      if (mask[next] && !seen.has(next)) seen.add(next)
    }
  }
  if (seen.size !== indices.length) return
  const runs: number[][] = []
  const memberships: number[][] = mask.map(() => [])
  for (const step of [1, size]) {
    for (const index of indices) {
      if (mask[index - step]) continue
      const cells: number[] = []
      for (let next = index; mask[next]; next += step) cells.push(next)
      if (cells.length < 2 || cells.length > 9) return
      for (const cell of cells) memberships[cell]!.push(runs.length)
      runs.push(cells)
    }
  }
  const lengths = runs.map((run) => run.length)
  if (Math.max(...lengths) < 4 || new Set(lengths).size < 3) return
  if (indices.length * 2 / runs.length > 3.2) return
  if (!mask.some((play, index) => !play && mask[index + 1] && mask[index + size])) return
  if (difficulty === 'Hard' && (
    lengths.filter((length) => length >= 4).length < (size === 7 ? 3 : 4) ||
    !indices.some((index) => memberships[index]!.every((run) => lengths[run]! >= 4))
  )) return
  return { mask, runs, memberships }
}

const fillLayout = (layout: Layout, random: () => number): number[] | undefined => {
  const values = layout.mask.map(() => 0)
  const used = layout.runs.map(() => 0)
  const bias = layout.runs.map(() => random() < 0.5 ? -1 : 1)
  let visits = 0
  const fill = (): boolean => {
    visits += 1
    if (visits > 500) return false
    let next = -1
    let minimum = 10
    let available = 0
    for (let index = 0; index < values.length; index += 1) {
      if (!layout.mask[index] || values[index]) continue
      let mask = 511
      for (const run of layout.memberships[index]!) mask &= ~used[run]!
      const count = bitCount(mask)
      if (!count) return false
      if (count < minimum) {
        next = index
        minimum = count
        available = mask
      }
    }
    if (next < 0) return true
    const preference = layout.memberships[next]!.reduce((sum, run) => sum + bias[run]!, 0)
    const options = Array.from({ length: 9 }, (_, i) => i + 1)
      .filter((digit) => available & (1 << (digit - 1)))
      .map((digit) => ({ digit, rank: random() * 5 + preference * digit }))
      .sort((a, b) => a.rank - b.rank)
    for (const { digit } of options) {
      const bit = 1 << (digit - 1)
      values[next] = digit
      for (const run of layout.memberships[next]!) used[run]! |= bit
      if (fill()) return true
      for (const run of layout.memberships[next]!) used[run]! ^= bit
    }
    values[next] = 0
    return false
  }
  return fill() ? values : undefined
}

const assemble = (
  seed: string, size: PuzzleSize, difficulty: Difficulty, layout: Layout, values: readonly number[],
): KakuroPuzzle => {
  const runs: Run[] = layout.runs.map((indices) => {
    const direction = indices[1]! - indices[0]! === 1 ? 'across' : 'down'
    const cells: Coordinate[] = indices.map((index) => ({ row: Math.floor(index / size), col: index % size }))
    return {
      id: `${direction === 'across' ? 'A' : 'D'}-${cells[0]!.row}-${cells[0]!.col}`,
      direction, cells, sum: indices.reduce((sum, index) => sum + values[index]!, 0),
    }
  })
  const cells: PuzzleCell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col): PuzzleCell => {
      const index = row * size + col
      if (layout.mask[index]) return {
        kind: 'play', solution: values[index]!,
        acrossRunId: runs[layout.memberships[index]![0]!]!.id,
        downRunId: runs[layout.memberships[index]![1]!]!.id,
      }
      const across = runs.find((run) => run.direction === 'across' &&
        run.cells[0]!.row === row && run.cells[0]!.col === col + 1)?.sum
      const down = runs.find((run) => run.direction === 'down' &&
        run.cells[0]!.row === row + 1 && run.cells[0]!.col === col)?.sum
      return across === undefined && down === undefined ? { kind: 'block' } :
        { kind: 'block', clue: { across, down } }
    }))
  return {
    id: `kz2-${size}-${difficulty.toLowerCase()}-${hash(`${seed}:${size}:${difficulty}:seeded-connected-v2`).toString(36)}`,
    seed, size, cells, runs,
    metadata: {
      difficulty, score: difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3,
      playableCells: values.filter(Boolean).length, unique: true, generator: 'seeded-connected-v2',
    },
  }
}

export function* generationCandidates(
  seed: string, size: PuzzleSize, difficultyOverride?: Difficulty,
): Generator<KakuroPuzzle> {
  const difficulty = difficultyOverride ?? dailyDifficulty(seed)
  if ((size !== 7 && size !== 9) || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    throw new RangeError('Expected a 7×7 or 9×9 board and Easy, Medium, or Hard difficulty.')
  }
  const random = randomFor(`${seed}:${size}:${difficulty}:seeded-connected-v2`)
  for (;;) {
    const layout = makeLayout(size, difficulty, random)
    if (!layout) continue
    for (let fill = 0; fill < 12; fill += 1) {
      const values = fillLayout(layout, random)
      if (!values) continue
      yield assemble(seed, size, difficulty, layout, values)
    }
  }
}

export const generatePuzzle = (
  seed: string, size: PuzzleSize, difficultyOverride?: Difficulty,
): KakuroPuzzle => {
  const difficulty = difficultyOverride ?? dailyDifficulty(seed)
  for (const puzzle of generationCandidates(seed, size, difficulty)) {
    // Logical screening is cheap for ambiguous fills. Publication still requires
    // a completed, independent CSP count; a search budget expiry rejects the fill.
    const grading = gradePuzzle(puzzle)
    if (!grading || grading.difficulty !== difficulty) continue
    if (difficulty === 'Hard' && grading.intermediateUnsolved < Math.ceil(puzzle.metadata.playableCells / 3)) continue
    if (searchSolutions(puzzle, 2, {}, 30_000) !== 1) continue
    return { ...puzzle, metadata: { ...puzzle.metadata, grading } }
  }
  throw new Error('Candidate stream ended unexpectedly.')
}

export const generateDailyPuzzle = (seed: string): KakuroPuzzle =>
  generatePuzzle(seed, puzzleSizeForSeed(seed))
