import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PuzzleCelebration, PuzzleStatus } from './PuzzleFeedback'

describe('automatic puzzle feedback', () => {
  it('announces success without requiring a check action', () => {
    const markup = renderToStaticMarkup(
      <PuzzleStatus validation={{ complete: true, valid: true }} message="Keep going." />,
    )
    expect(markup).toContain('Solved! Every run adds up perfectly.')
    expect(markup).toContain('role="status" aria-live="polite"')
    expect(markup).not.toContain('Keep going.')
  })

  it('explains a full incorrect board without disclosing individual mistakes', () => {
    const markup = renderToStaticMarkup(
      <PuzzleStatus validation={{ complete: true, valid: false }} message="Keep going." />,
    )
    expect(markup).toContain('Everything&#x27;s filled in, but something&#x27;s not quite right...')
    expect(markup).not.toContain('Keep going.')
  })

  it('keeps action feedback for an incomplete board', () => {
    const markup = renderToStaticMarkup(
      <PuzzleStatus validation={{ complete: false, valid: false }} message="Last move undone." />,
    )
    expect(markup).toContain('Last move undone.')
    expect(markup).not.toContain('Solved!')
    expect(markup).not.toContain('filled in')
  })

  it.each([false, true])('applies the win animation on opening a solved puzzle (solved: %s)', (solved) => {
    const markup = renderToStaticMarkup(
      <PuzzleCelebration solved={solved}><span className="cell-number">9</span></PuzzleCelebration>,
    )
    expect(markup).toContain('<span class="cell-number">9</span>')
    if (solved) {
      expect(markup).toContain('class="puzzle-stage is-solved"')
      expect(markup).toContain('<div class="solved-overlay" aria-hidden="true">')
      expect(markup).toContain('Solved!')
    } else {
      expect(markup).not.toContain('is-solved')
      expect(markup).not.toContain('solved-overlay')
    }
  })
})
