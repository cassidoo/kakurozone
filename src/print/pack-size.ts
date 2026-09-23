// Kept separate from pdf.ts (which pulls in pdf-lib) so the UI can reference
// valid pack sizes without dragging the PDF builder into the main bundle.
// 1 is intentionally excluded: individual puzzle downloads already cover that case.
export const PACK_SIZES = [4, 8, 16] as const
export type PackSize = (typeof PACK_SIZES)[number]
