import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Colophon } from './Colophon'

describe('Colophon', () => {
  it('lists the core tools behind the site', () => {
    const markup = renderToStaticMarkup(<Colophon />)
    for (const text of [
      '<h1>COLOPHON</h1>',
      'React',
      'TypeScript',
      'Vite',
      'Neobrutalism.dev',
      'pdf-lib',
      'Vitest',
      'Oxlint',
      'GitHub Copilot',
      'LocalStorage',
    ]) expect(markup).toContain(text)
  })

  it('explains how past daily puzzles join the initial archive without rebuilds', () => {
    const markup = renderToStaticMarkup(<Colophon />)
    expect(markup).toContain('300 pre-generated puzzles')
    expect(markup).toContain('grows each day')
    expect(markup).toContain('missed days remain available')
  })
})
