import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

describe('site header', () => {
  it('highlights KAKURO rather than ZONE', () => {
    vi.stubGlobal('window', { location: { hash: '#how-to-play' } })
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('<span>KAKURO</span> ZONE</button>')
    expect(markup).not.toContain('<span>ZONE</span>')
  })
})
