import type { CellValues, Coordinate, KakuroPuzzle, Run } from './types'
import { coordinateKey } from './types'

const sameCoordinate = (left: Coordinate, right: Coordinate): boolean =>
  left.row === right.row && left.col === right.col

export const validatePuzzleStructure = (puzzle: KakuroPuzzle): readonly string[] => {
  const errors: string[] = []
  if (puzzle.cells.length !== puzzle.size) errors.push('Grid height does not match size.')
  if (puzzle.cells.some((row) => row.length !== puzzle.size)) {
    errors.push('Grid width does not match size.')
  }

  const runIds = new Set<string>()
  const memberships = new Map<string, number>()
  for (const run of puzzle.runs) {
    if (runIds.has(run.id)) errors.push(`Duplicate run id ${run.id}.`)
    runIds.add(run.id)
    if (run.direction !== 'across' && run.direction !== 'down') {
      errors.push(`Run ${run.id} has an invalid direction.`)
      continue
    }
    if (!Number.isInteger(run.sum) || run.sum < 3 || run.sum > 45) {
      errors.push(`Run ${run.id} has an invalid sum.`)
    }
    if (run.cells.length < 2 || run.cells.length > 9) {
      errors.push(`Run ${run.id} must contain 2–9 cells.`)
    }
    const keys = run.cells.map(coordinateKey)
    if (new Set(keys).size !== keys.length) errors.push(`Run ${run.id} repeats a cell.`)

    const digits: number[] = []
    for (const [index, coordinate] of run.cells.entries()) {
      if (!Number.isInteger(coordinate.row) || !Number.isInteger(coordinate.col) ||
        coordinate.row < 0 || coordinate.col < 0 ||
        coordinate.row >= puzzle.size || coordinate.col >= puzzle.size) {
        errors.push(`Run ${run.id} has an invalid coordinate.`)
      }
      const previous = run.cells[index - 1]
      if (previous && (
        coordinate.row !== previous.row + (run.direction === 'down' ? 1 : 0) ||
        coordinate.col !== previous.col + (run.direction === 'across' ? 1 : 0)
      )) errors.push(`Run ${run.id} is not contiguous and ordered.`)
      const membership = `${run.direction}:${coordinateKey(coordinate)}`
      memberships.set(membership, (memberships.get(membership) ?? 0) + 1)
      const cell = puzzle.cells[coordinate.row]?.[coordinate.col]
      if (!cell || cell.kind !== 'play') {
        errors.push(`Run ${run.id} references a non-playable cell.`)
        continue
      }
      const expectedId =
        run.direction === 'across' ? cell.acrossRunId : cell.downRunId
      if (expectedId !== run.id) errors.push(`Cell link for ${run.id} is incorrect.`)
      digits.push(cell.solution)
    }
    if (new Set(digits).size !== digits.length) {
      errors.push(`Solution repeats a digit in ${run.id}.`)
    }
    if (digits.reduce((sum, digit) => sum + digit, 0) !== run.sum) {
      errors.push(`Solution does not match the sum for ${run.id}.`)
    }

    const first = run.cells[0]
    if (first) {
      const clueRow = first.row - (run.direction === 'down' ? 1 : 0)
      const clueCol = first.col - (run.direction === 'across' ? 1 : 0)
      const clueCell = puzzle.cells[clueRow]?.[clueCol]
      const clue =
        clueCell?.kind === 'block' ? clueCell.clue?.[run.direction] : undefined
      if (clue !== run.sum) errors.push(`Clue is missing or incorrect for ${run.id}.`)
    }
    const last = run.cells.at(-1)
    if (last && puzzle.cells[last.row + (run.direction === 'down' ? 1 : 0)]
      ?.[last.col + (run.direction === 'across' ? 1 : 0)]?.kind === 'play') {
      errors.push(`Run ${run.id} is not maximal.`)
    }
  }

  const playableKeys = new Set<string>()
  puzzle.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.kind !== 'play') {
        for (const direction of ['across', 'down'] as const) {
          const clue = cell.clue?.[direction]
          if (clue === undefined) continue
          const matches = puzzle.runs.filter((run) => {
            const first = run.cells[0]
            return run.direction === direction && first &&
              first.row === rowIndex + (direction === 'down' ? 1 : 0) &&
              first.col === colIndex + (direction === 'across' ? 1 : 0) &&
              run.sum === clue
          })
          if (matches.length !== 1) errors.push(`Orphan or ambiguous ${direction} clue at ${rowIndex}:${colIndex}.`)
        }
        return
      }
      const key = `${rowIndex}:${colIndex}`
      playableKeys.add(key)
      if (rowIndex === 0 || colIndex === 0) errors.push(`Playable border cell at ${key} lacks clue space.`)
      if (!Number.isInteger(cell.solution) || cell.solution < 1 || cell.solution > 9) {
        errors.push(`Invalid solution digit at ${rowIndex}:${colIndex}.`)
      }
      for (const direction of ['across', 'down'] as const) {
        if (memberships.get(`${direction}:${key}`) !== 1) {
          errors.push(`Playable cell ${key} must belong to exactly one ${direction} run.`)
        }
        const runId = direction === 'across' ? cell.acrossRunId : cell.downRunId
        const run = puzzle.runs.find((candidate) => candidate.id === runId)
        if (
          !run ||
          run.direction !== direction ||
          !run.cells.some((coordinate) =>
            sameCoordinate(coordinate, { row: rowIndex, col: colIndex }),
          )
        ) {
          errors.push(`Playable cell ${rowIndex}:${colIndex} lacks a ${direction} run.`)
        }
      }
    })
  })

  if (!playableKeys.size) errors.push('Puzzle has no playable cells.')
  if (puzzle.metadata.playableCells !== playableKeys.size) errors.push('Playable cell metadata is incorrect.')
  if (puzzle.metadata.generator === 'seeded-connected-v2' && playableKeys.size) {
    const visited = new Set([playableKeys.values().next().value!])
    for (const key of visited) {
      const [row, col] = key.split(':').map(Number) as [number, number]
      for (const adjacent of [`${row - 1}:${col}`, `${row + 1}:${col}`, `${row}:${col - 1}`, `${row}:${col + 1}`]) {
        if (playableKeys.has(adjacent)) visited.add(adjacent)
      }
    }
    if (visited.size !== playableKeys.size) errors.push('Connected-v2 playable cells must form one connected component.')
    if (!puzzle.runs.some((run) => run.cells.length >= 4)) errors.push('Connected-v2 puzzles must include a run of at least four cells.')
  }

  return errors
}

const valuesForRun = (run: Run, values: CellValues): readonly (number | undefined)[] =>
  run.cells.map((coordinate) => values[coordinateKey(coordinate)])

export interface SolutionValidation {
  readonly complete: boolean
  readonly valid: boolean
  readonly incorrectCells: readonly string[]
}

export const validateSolution = (
  puzzle: KakuroPuzzle,
  values: CellValues,
): SolutionValidation => {
  const incorrect = new Set<string>()
  let complete = true

  puzzle.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.kind !== 'play') return
      const key = coordinateKey({ row: rowIndex, col: colIndex })
      const value = values[key]
      if (value === undefined) complete = false
      else if (value !== cell.solution) incorrect.add(key)
    })
  })

  for (const run of puzzle.runs) {
    const runValues = valuesForRun(run, values)
    const filled = runValues.filter((value): value is number => value !== undefined)
    if (new Set(filled).size !== filled.length) {
      run.cells.forEach((coordinate) => {
        if (values[coordinateKey(coordinate)] !== undefined) {
          incorrect.add(coordinateKey(coordinate))
        }
      })
    }
    if (
      filled.length === run.cells.length &&
      filled.reduce((sum, value) => sum + value, 0) !== run.sum
    ) {
      run.cells.forEach((coordinate) => incorrect.add(coordinateKey(coordinate)))
    }
  }

  return { complete, valid: complete && incorrect.size === 0, incorrectCells: [...incorrect] }
}
