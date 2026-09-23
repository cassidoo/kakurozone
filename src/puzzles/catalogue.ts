import { archivePuzzles } from '../data/archive'
import { dailyDifficulty, puzzleSizeForSeed } from '../engine'
import type { Difficulty, KakuroPuzzle } from '../engine/types'
import { isDateSeed, localDateSeed, puzzleReference, referenceKey, type PuzzleReference } from './routes'

export { archivePuzzles }

const archiveByReference = new Map(
  archivePuzzles.map((puzzle) => [
    referenceKey({ version: 2, seed: puzzle.seed, size: puzzle.size }),
    puzzle,
  ]),
)

export const findArchivedPuzzle = (reference: PuzzleReference) =>
  archiveByReference.get(referenceKey(reference))

export interface ArchiveEntry {
  readonly key: string
  readonly reference: PuzzleReference
  readonly difficulty: Difficulty
}

export const archiveEntryForPuzzle = (puzzle: KakuroPuzzle): ArchiveEntry => {
  const reference = puzzleReference(puzzle)
  return { key: referenceKey(reference), reference, difficulty: puzzle.metadata.difficulty }
}

const initialEntries = archivePuzzles.map(archiveEntryForPuzzle)
  .sort((a, b) => b.reference.seed.localeCompare(a.reference.seed))
const newestFrozenSeed = initialEntries[0].reference.seed

export const getArchiveEntries = (today = localDateSeed()): readonly ArchiveEntry[] => {
  if (!isDateSeed(today)) throw new RangeError('Expected a valid calendar date for the archive.')

  const additions: ArchiveEntry[] = []
  // UTC arithmetic enumerates calendar labels, not elapsed local days (which vary with DST).
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  for (let seed = date.toISOString().slice(0, 10); seed > newestFrozenSeed; seed = date.toISOString().slice(0, 10)) {
    const reference: PuzzleReference = { version: 2, seed, size: puzzleSizeForSeed(seed) }
    additions.push({ key: referenceKey(reference), reference, difficulty: dailyDifficulty(seed) })
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return [...additions, ...initialEntries]
}
