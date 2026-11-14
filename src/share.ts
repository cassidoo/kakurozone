import type { KakuroPuzzle } from './engine'
import { puzzlePath } from './puzzles/routes'
import { formatSolveTime, type SolveStats } from './useSolveStats'

export interface PuzzleShareData {
  readonly title: string
  readonly text: string
  readonly url: string
  readonly clipboardText?: string
}

export interface ShareResult {
  readonly outcome: 'shared' | 'copied' | 'cancelled' | 'manual'
  readonly message: string
}

interface ShareCapabilities {
  readonly share?: (data: PuzzleShareData) => Promise<void>
  readonly copy?: (text: string) => Promise<void>
}

export const getPuzzleShareData = (
  puzzle: Pick<KakuroPuzzle, 'seed' | 'size'> & { readonly metadata: Pick<KakuroPuzzle['metadata'], 'generator'> },
  pageUrl: string,
  stats?: SolveStats | null,
): PuzzleShareData => {
  const url = new URL(pageUrl)
  url.search = ''
  url.hash = puzzlePath(puzzle)
  if (stats) {
    const hints = stats.hintCount === 0 ? 'no hints' : `${stats.hintCount} hint${stats.hintCount === 1 ? '' : 's'}`
    const text = `Kakuro Zone\n⏱ ${formatSolveTime(stats.elapsedMs)} · ${hints}`
    return { title: 'Kakuro Zone', text, url: url.href, clipboardText: `${text}\n${url.href}` }
  }
  return {
    title: `Kakuro Zone - ${puzzle.seed}`,
    text: `Try this Kakuro puzzle for ${puzzle.seed}.`,
    url: url.href,
  }
}

export const sharePuzzleLink = async (
  data: PuzzleShareData,
  capabilities: ShareCapabilities,
): Promise<ShareResult> => {
  if (capabilities.share) {
    try {
      await capabilities.share({ title: data.title, text: data.text, url: data.url })
      return { outcome: 'shared', message: 'Puzzle link shared!' }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { outcome: 'cancelled', message: 'Sharing canceled.' }
      }
      return {
        outcome: 'manual',
        message: `Couldn't open sharing. Select and copy the puzzle ${data.clipboardText ? 'result' : 'link'} below.`,
      }
    }
  }

  if (capabilities.copy) {
    try {
      await capabilities.copy(data.clipboardText ?? data.url)
      return { outcome: 'copied', message: `Puzzle ${data.clipboardText ? 'result' : 'link'} copied!` }
    } catch {
      return {
        outcome: 'manual',
        message: `Couldn't copy the ${data.clipboardText ? 'result' : 'link'}. Select and copy it below.`,
      }
    }
  }

  return {
    outcome: 'manual',
    message: `Sharing is unavailable here. Select and copy the puzzle ${data.clipboardText ? 'result' : 'link'} below.`,
  }
}
