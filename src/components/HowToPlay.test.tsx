import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HowToPlay } from './HowToPlay'

describe('How to play', () => {
  it('keeps the introduction inside the heading above its divider', () => {
    const markup = renderToStaticMarkup(<HowToPlay />)
    expect(markup).toMatch(/<header class="page-heading"><h1>HOW TO PLAY<\/h1><p class="how-to-intro">[^<]+<\/p><\/header>/)
  })

  it('explains entry, clue directions, crossings, and the no-repeat rule', () => {
    const markup = renderToStaticMarkup(<HowToPlay />)
    for (const text of [
      '<h1>HOW TO PLAY</h1>',
      '1. Pick a square',
      '2. Follow the clues',
      '3. Sum the digits',
      'from 1 to 9',
      'Upper-right triangle:',
      'Lower-left triangle:',
      'both an across run and a down run',
      'Digits cannot repeat within a run.',
    ]) expect(markup).toContain(text)
  })

  it('includes an accessible solved example, tool guidance, and a link back to today', () => {
    const markup = renderToStaticMarkup(<HowToPlay />)
    expect(markup).toContain('role="img" aria-label="Solved example:')
    expect(markup).toContain('Clue: across 3')
    expect(markup).toContain('Clue: across 7')
    expect(markup).toContain('Clue: down 4')
    expect(markup).toContain('Clue: down 6')
    expect(markup).toContain('Turn Notes on')
    expect(markup).toContain('Check my grid flags mistakes when you ask.')
    expect(markup).toContain('href="#">Try today’s puzzle</a>')
  })

  it('explains navigation, notes restrictions, and undoable resets', () => {
    const markup = renderToStaticMarkup(<HowToPlay />)
    for (const text of [
      'arrow keys, WASD, or HJKL',
      'Navigation skips shaded squares',
      'Notes are disabled on filled squares.',
      'press Backspace or Delete',
      'previous open square',
      'Erase all button resets every number and note',
      'after confirmation.',
      'including resets.',
    ]) expect(markup).toContain(text)
  })
})
