import {
  PDFDocument,
  StandardFonts,
  grayscale,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { KakuroPuzzle } from '../engine'
import {
  renderPuzzleGeometry,
  type VectorOperation,
  type VectorTone,
} from './geometry'
import { PACK_SIZES, type PackSize } from './pack-size'

export type PaperSize = 'letter' | 'a4'

export const PAPER_DIMENSIONS: Readonly<
  Record<PaperSize, readonly [number, number]>
> = {
  letter: [612, 792],
  a4: [595.28, 841.89],
}

interface PdfFonts {
  readonly regular: PDFFont
  readonly bold: PDFFont
}

const toneColor = (tone: VectorTone) => {
  if (tone === 'paper') return grayscale(1)
  if (tone === 'grid') return grayscale(0.72)
  if (tone === 'clue') return grayscale(0.95)
  if (tone === 'block') return grayscale(0.82)
  return grayscale(0.08)
}

const drawVectorOperations = (
  page: PDFPage,
  operations: readonly VectorOperation[],
  fonts: PdfFonts,
): void => {
  const pageHeight = page.getHeight()

  operations.forEach((operation) => {
    if (operation.kind === 'rect') {
      page.drawRectangle({
        x: operation.x,
        y: pageHeight - operation.y - operation.height,
        width: operation.width,
        height: operation.height,
        color: operation.fill ? toneColor(operation.fill) : undefined,
        borderColor: operation.stroke ? toneColor(operation.stroke) : undefined,
        borderWidth: operation.strokeWidth,
      })
      return
    }

    if (operation.kind === 'line') {
      page.drawLine({
        start: { x: operation.x1, y: pageHeight - operation.y1 },
        end: { x: operation.x2, y: pageHeight - operation.y2 },
        color: toneColor(operation.tone),
        thickness: operation.width,
      })
      return
    }

    const font = operation.weight === 'bold' ? fonts.bold : fonts.regular
    const textWidth = font.widthOfTextAtSize(operation.text, operation.size)
    const textHeight = font.heightAtSize(operation.size, { descender: false })
    const x =
      operation.align === 'center'
        ? operation.x - textWidth / 2
        : operation.align === 'right'
          ? operation.x - textWidth
          : operation.x

    page.drawText(operation.text, {
      x,
      y: pageHeight - operation.y - textHeight / 2,
      size: operation.size,
      font,
      color: toneColor(operation.tone),
    })
  })
}

const addText = (
  page: PDFPage,
  fonts: PdfFonts,
  text: string,
  x: number,
  y: number,
  size: number,
  options: {
    readonly bold?: boolean
    readonly align?: 'left' | 'center' | 'right'
  } = {},
): void => {
  drawVectorOperations(
    page,
    [
      {
        kind: 'text',
        text,
        x,
        y,
        size,
        tone: 'ink',
        weight: options.bold ? 'bold' : 'regular',
        align: options.align,
      },
    ],
    fonts,
  )
}

const createDocument = async (): Promise<{
  readonly document: PDFDocument
  readonly fonts: PdfFonts
}> => {
  const document = await PDFDocument.create()
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  }
  document.setCreator('Kakuro Zone')
  document.setProducer('Kakuro Zone')
  return { document, fonts }
}

const addPuzzleHeader = (
  page: PDFPage,
  fonts: PdfFonts,
  puzzle: KakuroPuzzle,
  label: string,
): void => {
  addText(page, fonts, 'KAKURO ZONE', 48, 39, 16, { bold: true })
  addText(page, fonts, label, 48, 62, 10, { bold: true })
  addText(
    page,
    fonts,
    `${puzzle.seed}  |  ${puzzle.size}x${puzzle.size}  |  ${puzzle.metadata.difficulty}`,
    48,
    79,
    8,
  )
}

export const buildIndividualPuzzlePdf = async (
  puzzle: KakuroPuzzle,
  paperSize: PaperSize,
): Promise<Uint8Array> => {
  const { document, fonts } = await createDocument()
  const dimensions = PAPER_DIMENSIONS[paperSize]

  ;(['Puzzle', 'Solution'] as const).forEach((label) => {
    const page = document.addPage([...dimensions])
    const boardSize = Math.min(page.getWidth() - 96, page.getHeight() - 174)
    const x = (page.getWidth() - boardSize) / 2
    const y = 100
    addPuzzleHeader(page, fonts, puzzle, label)
    drawVectorOperations(
      page,
      renderPuzzleGeometry(puzzle, {
        x,
        y,
        size: boardSize,
        solution: label === 'Solution',
      }),
      fonts,
    )
    addText(
      page,
      fonts,
      label === 'Puzzle'
        ? 'Use digits 1-9. Digits cannot repeat within a run.'
        : 'Keep this page separate until you are ready to check your work.',
      page.getWidth() / 2,
      y + boardSize + 25,
      8,
      { align: 'center' },
    )
  })

  document.setTitle(`Kakuro Zone - ${puzzle.seed}`)
  return document.save()
}

const drawPackSlot = (
  page: PDFPage,
  fonts: PdfFonts,
  puzzle: KakuroPuzzle,
  index: number,
  x: number,
  y: number,
  boardSize: number,
  solution: boolean,
): void => {
  const labelSize = solution ? 7 : 9
  addText(
    page,
    fonts,
    `${index + 1}. ${puzzle.seed} - ${puzzle.size}x${puzzle.size}`,
    x,
    y,
    labelSize,
    { bold: true },
  )
  drawVectorOperations(
    page,
    renderPuzzleGeometry(puzzle, {
      x,
      y: y + (solution ? 10 : 15),
      size: boardSize,
      solution,
    }),
    fonts,
  )
}

// Solutions are laid out in fewer, wider columns for small packs (better legibility
// per grid) and the full 4 columns once there are enough puzzles to need the density.
const solutionColumnsFor = (count: number): number => {
  if (count <= 4) return 2
  return 4
}

export const buildPuzzlePackPdf = async (
  puzzles: readonly KakuroPuzzle[],
  paperSize: PaperSize,
): Promise<Uint8Array> => {
  if (!PACK_SIZES.includes(puzzles.length as PackSize)) {
    throw new Error('A print pack must contain 4, 8, or 16 puzzles.')
  }

  const { document, fonts } = await createDocument()
  const dimensions = PAPER_DIMENSIONS[paperSize]
  const [pageWidth, pageHeight] = dimensions
  const margin = 34
  const gapX = 24
  const gapY = 26
  const contentTop = 62
  const contentBottom = 28
  const slotWidth = (pageWidth - margin * 2 - gapX) / 2
  const slotHeight =
    (pageHeight - contentTop - contentBottom - gapY) / 2
  const boardSize = Math.min(slotWidth, slotHeight - 20)
  const packLabel = `${puzzles.length} PUZZLE PACK`
  const puzzlePages = Math.ceil(puzzles.length / 4)

  for (let pageIndex = 0; pageIndex < puzzlePages; pageIndex += 1) {
    const page = document.addPage([...dimensions])
    const pagePuzzles = puzzles.slice(pageIndex * 4, pageIndex * 4 + 4)
    addText(page, fonts, `KAKURO ZONE - ${packLabel}`, margin, 31, 15, {
      bold: true,
    })
    addText(
      page,
      fonts,
      `Puzzles ${pageIndex * 4 + 1}-${pageIndex * 4 + pagePuzzles.length}`,
      pageWidth - margin,
      31,
      9,
      { align: 'right' },
    )

    pagePuzzles.forEach((puzzle, slot) => {
      const col = slot % 2
      const row = Math.floor(slot / 2)
      drawPackSlot(
        page,
        fonts,
        puzzle,
        pageIndex * 4 + slot,
        margin + col * (slotWidth + gapX) + (slotWidth - boardSize) / 2,
        contentTop + row * (slotHeight + gapY),
        boardSize,
        false,
      )
    })
  }

  const solutionPage = document.addPage([...dimensions])
  addText(solutionPage, fonts, 'SOLUTIONS', margin, 31, 15, { bold: true })
  addText(
    solutionPage,
    fonts,
    `Kakuro Zone ${packLabel.toLowerCase()}`,
    pageWidth - margin,
    31,
    9,
    { align: 'right' },
  )
  const solutionColumns = solutionColumnsFor(puzzles.length)
  const solutionGap = 12
  const solutionSlotWidth =
    (pageWidth - margin * 2 - solutionGap * (solutionColumns - 1)) /
    solutionColumns
  const solutionRows = Math.ceil(puzzles.length / solutionColumns)
  const solutionLabelHeight = 16
  const solutionRowGap = 16
  const solutionContentTop = 58
  let solutionBoardSize = solutionSlotWidth
  const neededHeight =
    solutionRows * (solutionLabelHeight + solutionBoardSize) +
    (solutionRows - 1) * solutionRowGap
  const availableHeight = pageHeight - solutionContentTop - contentBottom
  if (neededHeight > availableHeight) {
    // Extremely tall stacks (many rows on a small paper size) shrink to fit rather
    // than overflow the page; width-driven sizing above stays untouched otherwise.
    const perRowBudget = availableHeight / solutionRows - solutionRowGap
    solutionBoardSize = Math.max(perRowBudget - solutionLabelHeight, 40)
  }
  const solutionRowHeight =
    solutionLabelHeight + solutionBoardSize + solutionRowGap

  puzzles.forEach((puzzle, index) => {
    const col = index % solutionColumns
    const row = Math.floor(index / solutionColumns)
    drawPackSlot(
      solutionPage,
      fonts,
      puzzle,
      index,
      margin + col * (solutionSlotWidth + solutionGap),
      solutionContentTop + row * solutionRowHeight,
      solutionBoardSize,
      true,
    )
  })

  document.setTitle(`Kakuro Zone - ${packLabel}`)
  return document.save()
}
