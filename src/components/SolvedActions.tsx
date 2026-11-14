import { useEffect, useRef, useState } from 'react'
import type { KakuroPuzzle } from '../engine'
import { getPuzzleShareData, sharePuzzleLink, type ShareResult } from '../share'
import { formatSolveTime, type SolveStats } from '../useSolveStats'

export const SolvedActions = ({
  puzzle,
  stats,
  onPrint,
}: {
  readonly puzzle: Pick<KakuroPuzzle, 'seed' | 'size'> & { readonly metadata: Pick<KakuroPuzzle['metadata'], 'generator'> }
  readonly onPrint: () => void
  readonly stats?: SolveStats | null
}) => {
  const printButton = useRef<HTMLButtonElement>(null)
  const [sharing, setSharing] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [shareText, setShareText] = useState('')

  useEffect(() => {
    printButton.current?.focus({ preventScroll: true })
  }, [])

  const share = async (): Promise<void> => {
    if (sharing) return
    const data = getPuzzleShareData(puzzle, window.location.href, stats)
    setSharing(true)
    setResult(null)
    setShareUrl(data.url)
    setShareText(data.clipboardText ?? '')
    const outcome = await sharePuzzleLink(data, {
      share: navigator.share?.bind(navigator),
      copy: navigator.clipboard?.writeText?.bind(navigator.clipboard),
    })
    setResult(outcome)
    setSharing(false)
  }

  return (
    <>
      {stats && <p className="solve-time">Solve time: {formatSolveTime(stats.elapsedMs)}</p>}
      <button type="button" ref={printButton} onClick={onPrint}>
        Print this puzzle
      </button>
      <button type="button" onClick={() => void share()} disabled={sharing}>
        {sharing ? 'Sharing...' : 'Share'}
      </button>
      <p className="share-message" role="status" aria-live="polite">
        {result?.message}
      </p>
      {result?.outcome === 'manual' && (
        <label className="share-link">
          {shareText ? 'Puzzle result' : 'Puzzle link'}
          {shareText ? (
            <textarea
              readOnly
              rows={3}
              value={shareText}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            <input
              type="url"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </label>
      )}
    </>
  )
}
