import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SolvedActions } from './SolvedActions'

describe('solved puzzle actions', () => {
  it('renders only Print and Share buttons without needing browser APIs during render', () => {
    const markup = renderToStaticMarkup(
      <SolvedActions puzzle={{ seed: '2026-09-21', size: 9, metadata: { generator: 'seeded-connected-v2' } }} onPrint={() => {}} />,
    )
    expect(markup.match(/<button /g)).toHaveLength(2)
    expect(markup).toContain('Print this puzzle')
    expect(markup).toContain('Share')
    expect(markup).toContain('role="status" aria-live="polite"')
    expect(markup).not.toContain('<input')
  })
})
