import { describe, expect, it } from 'vitest'
import { dailyDifficulty, generateDailyPuzzle, puzzleSizeForSeed } from '../engine'
import { archiveEntryForPuzzle, archivePuzzles, findArchivedPuzzle, getArchiveEntries } from './catalogue'
import { parsePuzzleRoute, puzzlePath, referencePath } from './routes'

describe('growing daily archive', () => {
  it('keeps all 300 frozen entries at launch, without duplicating the boundary date', () => {
    const initial = archivePuzzles.map(archiveEntryForPuzzle)
    expect(getArchiveEntries('2026-09-21')).toEqual(initial)
    expect(getArchiveEntries('2026-09-20')).toEqual(initial)
    expect(getArchiveEntries('2026-09-22')).toHaveLength(301)
    expect(getArchiveEntries('2026-09-22')[0].reference.seed).toBe('2026-09-21')
  })

  it('backfills every missed day newest-first and excludes today and future dates', () => {
    const entries = getArchiveEntries('2026-09-25')
    expect(entries).toHaveLength(304)
    expect(entries.slice(0, 5).map(({ reference }) => reference.seed)).toEqual([
      '2026-09-24', '2026-09-23', '2026-09-22', '2026-09-21', '2026-09-20',
    ])
    expect(new Set(entries.map(({ key }) => key)).size).toBe(entries.length)
    expect(entries.every(({ reference }) => reference.seed < '2026-09-25')).toBe(true)
    expect(entries.slice(4)).toEqual(archivePuzzles.map(archiveEntryForPuzzle))
  })

  it.each([
    ['2027-01-02', ['2027-01-01', '2026-12-31', '2026-12-30']],
    ['2028-03-02', ['2028-03-01', '2028-02-29', '2028-02-28']],
    ['2027-03-16', ['2027-03-15', '2027-03-14', '2027-03-13']],
    ['2026-11-03', ['2026-11-02', '2026-11-01', '2026-10-31']],
  ])('enumerates calendar dates across month/year/leap/DST boundaries: %s', (today, seeds) => {
    const entries = getArchiveEntries(today)
    expect(entries.slice(0, 3).map(({ reference }) => reference.seed)).toEqual(seeds)
    expect(new Set(entries.map(({ reference }) => reference.seed)).size).toBe(entries.length)
  })

  it('reconstructs years of entries without generating boards or requiring stored visits', () => {
    const entries = getArchiveEntries('2036-09-21')
    const elapsedDays = (Date.parse('2036-09-21') - Date.parse('2026-09-21')) / 86_400_000
    expect(entries).toHaveLength(300 + elapsedDays)
    expect(entries[0].reference.seed).toBe('2036-09-20')
    expect(entries.slice(-300)).toEqual(archivePuzzles.map(archiveEntryForPuzzle))
    expect(entries).toEqual(getArchiveEntries('2036-09-21'))
  })

  it('retains daily puzzle identities, difficulty, and play/print routes when archived', () => {
    const additions = getArchiveEntries('2026-09-24').slice(0, 3)
    for (const entry of additions) {
      const puzzle = generateDailyPuzzle(entry.reference.seed)
      expect(entry).toEqual(archiveEntryForPuzzle(puzzle))
      expect(entry.difficulty).toBe(dailyDifficulty(entry.reference.seed))
      expect(entry.reference.size).toBe(puzzleSizeForSeed(entry.reference.seed))
      expect(findArchivedPuzzle(entry.reference)).toBeUndefined()
      for (const view of ['play', 'print'] as const) {
        expect(referencePath(entry.reference, view)).toBe(puzzlePath(puzzle, view))
        expect(parsePuzzleRoute(`#${referencePath(entry.reference, view)}`)).toEqual({
          view, puzzle: entry.reference,
        })
      }
      expect(puzzle.id).toBe(generateDailyPuzzle(entry.reference.seed).id)
    }
  }, 30_000)

  it.each(['not-a-date', '2026-02-30', '2027-02-29'])('rejects an invalid date: %s', (seed) => {
    expect(() => getArchiveEntries(seed)).toThrow(RangeError)
  })
})
