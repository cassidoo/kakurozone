// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SolvedActions } from './SolvedActions'

describe('solved puzzle actions', () => {
  it('provides the full result for manual copying when sharing is unavailable', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('navigator', {})
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      act(() => root.render(
        <SolvedActions
          puzzle={{ seed: '2026-09-21', size: 9, metadata: { generator: 'seeded-connected-v2' } }}
          stats={{ elapsedMs: 988000, hintCount: 0 }}
          onPrint={() => {}}
        />,
      ))
      await act(async () => container.querySelectorAll('button')[1].click())
      const textarea = container.querySelector('textarea')!
      expect(textarea.value).toBe(
        `Kakuro Zone\n⏱ 16:28 · no hints\n${window.location.origin}/#play/v2/2026-09-21/9`,
      )
      act(() => textarea.focus())
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(textarea.value.length)
      expect(container.textContent).toContain('Select and copy the puzzle result below.')
    } finally {
      act(() => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
  })

  it('renders only Print and Share buttons without needing browser APIs during render', () => {
    const markup = renderToStaticMarkup(
      <SolvedActions puzzle={{ seed: '2026-09-21', size: 9, metadata: { generator: 'seeded-connected-v2' } }} onPrint={() => {}} />,
    )
    expect(markup.match(/<button /g)).toHaveLength(2)
    expect(markup).toContain('Print this puzzle')
    expect(markup).toContain('Share')
    expect(markup).toContain('role="status" aria-live="polite"')
    expect(markup).not.toContain('<input')
    expect(markup).not.toContain('Solve time:')
  })

  it('displays the saved solve time when available', () => {
    const markup = renderToStaticMarkup(
      <SolvedActions
        puzzle={{ seed: '2026-09-21', size: 9, metadata: { generator: 'seeded-connected-v2' } }}
        stats={{ elapsedMs: 3601000, hintCount: 0 }}
        onPrint={() => {}}
      />,
    )
    expect(markup).toContain('Solve time: 60:01')
  })
})
