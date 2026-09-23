import type { KakuroPuzzle } from './engine'
import { puzzlePath } from './puzzles/routes'

export interface PuzzleShareData {
  readonly title: string
  readonly text: string
  readonly url: string
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
): PuzzleShareData => {
  const url = new URL(pageUrl)
  url.search = ''
  url.hash = puzzlePath(puzzle)
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
      await capabilities.share(data)
      return { outcome: 'shared', message: 'Puzzle link shared!' }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { outcome: 'cancelled', message: 'Sharing canceled.' }
      }
      return {
        outcome: 'manual',
        message: "Couldn't open sharing. Select and copy the puzzle link below.",
      }
    }
  }

  if (capabilities.copy) {
    try {
      await capabilities.copy(data.url)
      return { outcome: 'copied', message: 'Puzzle link copied!' }
    } catch {
      return {
        outcome: 'manual',
        message: "Couldn't copy the link. Select and copy it below.",
      }
    }
  }

  return {
    outcome: 'manual',
    message: 'Sharing is unavailable here. Select and copy the puzzle link below.',
  }
}
