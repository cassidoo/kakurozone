import type {
  BlockCell,
  Coordinate,
  Direction,
  KakuroPuzzle,
  PlayCell,
  PuzzleCell,
  PuzzleSize,
  Run,
  Difficulty,
} from './types'

type Tile = readonly [number, number, number, number]

const fnv1a = (value: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const createRandom = (seed: string): (() => number) => {
  let state = fnv1a(seed)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const tileSignature = ([a, b, c, d]: Tile): string =>
  `${a + b},${c + d},${a + c},${b + d}`

const buildUniqueTiles = (): readonly Tile[] => {
  const bySignature = new Map<string, Tile[]>()

  for (let a = 1; a <= 9; a += 1) {
    for (let b = 1; b <= 9; b += 1) {
      if (a === b) continue
      for (let c = 1; c <= 9; c += 1) {
        if (a === c) continue
        for (let d = 1; d <= 9; d += 1) {
          if (c === d || b === d) continue
          const tile: Tile = [a, b, c, d]
          const signature = tileSignature(tile)
          bySignature.set(signature, [...(bySignature.get(signature) ?? []), tile])
        }
      }
    }
  }

  return [...bySignature.values()]
    .filter((tiles) => tiles.length === 1)
    .map(([tile]) => tile)
    .filter((tile): tile is Tile => tile !== undefined)
}

const UNIQUE_TILES = buildUniqueTiles()

const isPlayable = (row: number, col: number): boolean =>
  row > 0 && col > 0 && row % 3 !== 0 && col % 3 !== 0

const directionDelta: Record<Direction, Coordinate> = {
  across: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
}

const inBounds = (size: number, row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < size && col < size

const deriveRuns = (
  size: PuzzleSize,
  solutions: readonly (readonly (number | null)[])[],
): readonly Run[] => {
  const runs: Run[] = []

  for (const direction of ['across', 'down'] as const) {
    const delta = directionDelta[direction]
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!isPlayable(row, col)) continue
        const previousRow = row - delta.row
        const previousCol = col - delta.col
        if (
          inBounds(size, previousRow, previousCol) &&
          isPlayable(previousRow, previousCol)
        ) {
          continue
        }

        const cells: Coordinate[] = []
        let cursorRow = row
        let cursorCol = col
        let sum = 0
        while (
          inBounds(size, cursorRow, cursorCol) &&
          isPlayable(cursorRow, cursorCol)
        ) {
          cells.push({ row: cursorRow, col: cursorCol })
          sum += solutions[cursorRow]?.[cursorCol] ?? 0
          cursorRow += delta.row
          cursorCol += delta.col
        }

        if (cells.length >= 2) {
          runs.push({
            id: `${direction === 'across' ? 'A' : 'D'}-${row}-${col}`,
            direction,
            sum,
            cells,
          })
        }
      }
    }
  }

  return runs
}

const clueForBlock = (
  row: number,
  col: number,
  runs: readonly Run[],
): BlockCell => {
  const across = runs.find(
    (run) =>
      run.direction === 'across' &&
      run.cells[0]?.row === row &&
      run.cells[0]?.col === col + 1,
  )?.sum
  const down = runs.find(
    (run) =>
      run.direction === 'down' &&
      run.cells[0]?.row === row + 1 &&
      run.cells[0]?.col === col,
  )?.sum
  return across === undefined && down === undefined
    ? { kind: 'block' }
    : { kind: 'block', clue: { across, down } }
}

export const generateLegacyPuzzle = (
  seed: string,
  size: PuzzleSize,
  difficultyOverride?: Difficulty,
): KakuroPuzzle => {
  const random = createRandom(`${seed}:${size}:v1`)
  const solutions: (number | null)[][] = Array.from({ length: size }, () =>
    Array<number | null>(size).fill(null),
  )

  for (let row = 1; row < size; row += 3) {
    for (let col = 1; col < size; col += 3) {
      const tile = UNIQUE_TILES[Math.floor(random() * UNIQUE_TILES.length)]
      if (!tile) throw new Error('The seeded tile catalog is empty.')
      solutions[row]![col] = tile[0]
      solutions[row]![col + 1] = tile[1]
      solutions[row + 1]![col] = tile[2]
      solutions[row + 1]![col + 1] = tile[3]
    }
  }

  const runs = deriveRuns(size, solutions)
  const runFor = (row: number, col: number, direction: Direction): Run => {
    const run = runs.find(
      (candidate) =>
        candidate.direction === direction &&
        candidate.cells.some((cell) => cell.row === row && cell.col === col),
    )
    if (!run) throw new Error(`Missing ${direction} run at ${row}:${col}.`)
    return run
  }

  const cells: PuzzleCell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col): PuzzleCell => {
      const solution = solutions[row]?.[col]
      if (solution === null || solution === undefined) {
        return clueForBlock(row, col, runs)
      }
      const cell: PlayCell = {
        kind: 'play',
        solution,
        acrossRunId: runFor(row, col, 'across').id,
        downRunId: runFor(row, col, 'down').id,
      }
      return cell
    }),
  )

  const playableCells = cells.flat().filter((cell) => cell.kind === 'play').length
  const score = fnv1a(`${seed}:difficulty:v1`) % 3
  const difficulty = difficultyOverride ?? (score === 0 ? 'Easy' : score === 1 ? 'Medium' : 'Hard')
  return {
    id: `kz-${size}-${fnv1a(`${seed}:${size}:v1`).toString(36)}`,
    seed,
    size,
    cells,
    runs,
    metadata: {
      difficulty,
      score: difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3,
      playableCells,
      unique: true,
      generator: 'seeded-tile-family-v1',
    },
  }
}

export const puzzleSizeForSeed = (seed: string): PuzzleSize =>
  fnv1a(seed) % 2 === 0 ? 7 : 9

export const generateDailyPuzzle = (dateSeed: string): KakuroPuzzle => {
  const day = Math.floor(Date.parse(`${dateSeed}T00:00:00Z`) / 86_400_000)
  const difficulty = (['Easy', 'Medium', 'Hard'] as const)[((day % 3) + 3) % 3]
  return generateLegacyPuzzle(dateSeed, difficulty === 'Easy' ? 7 : 9, difficulty)
}
