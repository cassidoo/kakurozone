import { describe, expect, it, vi } from 'vitest'
import { getPuzzleShareData, sharePuzzleLink } from './share'

const data = getPuzzleShareData(
  { seed: '2026-09-21', size: 9, metadata: { generator: 'seeded-connected-v2' } },
  'https://example.com/kakuro/?source=app#archive',
)

describe('puzzle sharing', () => {
  it('links to the played date and size, preserving the hosting path but not query state', () => {
    expect(data).toEqual({
      title: 'Kakuro Zone - 2026-09-21',
      text: 'Try this Kakuro puzzle for 2026-09-21.',
      url: 'https://example.com/kakuro/#play/v2/2026-09-21/9',
    })
    expect(getPuzzleShareData(
      { seed: '2025-01-01', size: 7, metadata: { generator: 'seeded-tile-family-v1' } },
      'https://example.com/#play/2026-09-21/9',
    ).url).toBe('https://example.com/#play/2025-01-01/7')
  })

  it('invokes native sharing immediately with only puzzle metadata and the link', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const copy = vi.fn()
    const pending = sharePuzzleLink(data, { share, copy })
    expect(share).toHaveBeenCalledExactlyOnceWith(data)
    expect(await pending).toMatchObject({ outcome: 'shared' })
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies the link when native sharing is unavailable', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    const pending = sharePuzzleLink(data, { copy })
    expect(copy).toHaveBeenCalledExactlyOnceWith(data.url)
    expect(await pending).toMatchObject({ outcome: 'copied' })
  })

  it('does not claim success or copy anything when native sharing is canceled', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError'))
    const copy = vi.fn()
    expect(await sharePuzzleLink(data, { share, copy })).toEqual({
      outcome: 'cancelled',
      message: 'Sharing canceled.',
    })
    expect(copy).not.toHaveBeenCalled()
  })

  it('surfaces native share failures with a manual-copy fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    expect(await sharePuzzleLink(data, { share })).toEqual({
      outcome: 'manual',
      message: "Couldn't open sharing. Select and copy the puzzle link below.",
    })
  })

  it('surfaces clipboard failures with a manual-copy fallback', async () => {
    const copy = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    expect(await sharePuzzleLink(data, { copy })).toEqual({
      outcome: 'manual',
      message: "Couldn't copy the link. Select and copy it below.",
    })
  })

  it('provides a manual-copy fallback when neither API is available', async () => {
    expect(await sharePuzzleLink(data, {})).toEqual({
      outcome: 'manual',
      message: 'Sharing is unavailable here. Select and copy the puzzle link below.',
    })
  })
})
