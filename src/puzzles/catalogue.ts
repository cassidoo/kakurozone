import { archivePuzzles } from '../data/archive'
import { referenceKey, type PuzzleReference } from './routes'

export { archivePuzzles }

const archiveByReference = new Map(
  archivePuzzles.map((puzzle) => [
    referenceKey({ version: 2, seed: puzzle.seed, size: puzzle.size }),
    puzzle,
  ]),
)

export const findArchivedPuzzle = (reference: PuzzleReference) =>
  archiveByReference.get(referenceKey(reference))
