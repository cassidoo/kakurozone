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
})
