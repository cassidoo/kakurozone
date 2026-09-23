import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { archivePuzzles } from '../puzzles/catalogue'
import {
  buildIndividualPuzzlePdf,
  buildPuzzlePackPdf,
  PAPER_DIMENSIONS,
  type PaperSize,
} from './pdf'

const puzzle = archivePuzzles[0]

const expectPageSize = (
  document: PDFDocument,
  paperSize: PaperSize,
): void => {
  const [expectedWidth, expectedHeight] = PAPER_DIMENSIONS[paperSize]
  document.getPages().forEach((page) => {
    expect(page.getWidth()).toBeCloseTo(expectedWidth, 1)
    expect(page.getHeight()).toBeCloseTo(expectedHeight, 1)
  })
}

describe('print PDFs', () => {
  it.each(['letter', 'a4'] as const)(
    'creates a two-page %s individual puzzle with the requested page size',
    async (paperSize) => {
      const document = await PDFDocument.load(
        await buildIndividualPuzzlePdf(puzzle, paperSize),
      )
      expect(document.getPageCount()).toBe(2)
      expectPageSize(document, paperSize)
    },
  )

  it.each([4, 8, 16] as const)(
    'creates a pack of %i puzzles with four per puzzle page and one solutions page',
    async (packSize) => {
      const pack = archivePuzzles.slice(0, packSize)
      const document = await PDFDocument.load(
        await buildPuzzlePackPdf(pack, 'letter'),
      )
      expect(document.getPageCount()).toBe(Math.ceil(packSize / 4) + 1)
      expectPageSize(document, 'letter')
    },
  )

  it('rejects pack sizes outside 4, 8, or 16', async () => {
    await expect(
      buildPuzzlePackPdf(archivePuzzles.slice(0, 7), 'letter'),
    ).rejects.toThrow('4, 8, or 16')
    await expect(
      buildPuzzlePackPdf(archivePuzzles.slice(0, 1), 'letter'),
    ).rejects.toThrow('4, 8, or 16')
  })
})
