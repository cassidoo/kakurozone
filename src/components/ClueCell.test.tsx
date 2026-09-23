import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClueCell } from './ClueCell'

describe('Kakuro clue cells', () => {
  it('places across above the diagonal and down below it', () => {
    const markup = renderToStaticMarkup(<ClueCell clue={{ across: 17, down: 23 }} />)
    expect(markup).toContain('aria-label="Clue: across 17, down 23"')
    expect(markup).toContain('class="clue-number clue-across" style="left:74%;top:26%" aria-hidden="true"><span class="clue-digit">17</span></span>')
    expect(markup).toContain('class="clue-number clue-down" style="left:26%;top:74%" aria-hidden="true"><span class="clue-digit">23</span></span>')
    expect(markup).toContain('x1="0" y1="0" x2="100" y2="100"')
    expect(markup).toContain('vector-effect="non-scaling-stroke"')
  })

  it.each(['across', 'down'] as const)('shows only the %s clue when the other half is unused', (direction) => {
    const markup = renderToStaticMarkup(<ClueCell clue={{ [direction]: 12 }} />)
    expect(markup).toContain(`has-${direction}`)
    expect(markup).toContain(`aria-label="Clue: ${direction} 12"`)
    expect(markup.match(/class="clue-number /g)).toHaveLength(1)
  })

  it('leaves blocked cells without a divider or numbers', () => {
    const markup = renderToStaticMarkup(<ClueCell />)
    expect(markup).toContain('aria-label="Blocked square"')
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('<span')
  })
})
