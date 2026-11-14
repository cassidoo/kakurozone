// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { generateLegacyPuzzle } from './engine'

const puzzle = generateLegacyPuzzle('2026-09-21', 7)
const storageKey = `kakuro-zone:${puzzle.id}`

vi.mock('./puzzles/usePuzzle', () => ({
  usePuzzle: () => ({ status: 'ready', puzzle }),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  window.history.replaceState(null, '', '#play/2026-09-21/7')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const renderPlayer = (values: Record<string, number> = {}, notes: Record<string, number[]> = {}) => {
  localStorage.setItem(storageKey, JSON.stringify({ values, notes, completed: false }))
  act(() => root.render(<App />))
}

const cell = (key: string): HTMLButtonElement => {
  const result = container.querySelector<HTMLButtonElement>(`[data-cell-key="${key}"]`)
  if (!result) throw new Error(`Missing cell ${key}`)
  return result
}

const control = (label: string): HTMLButtonElement => {
  const result = Array.from(container.querySelectorAll<HTMLButtonElement>('.controls-panel button'))
    .find((button) => button.getAttribute('aria-label') === label || button.textContent?.trim().endsWith(label))
  if (!result) throw new Error(`Missing control ${label}`)
  return result
}

const click = (element: HTMLElement) => act(() => element.click())
const select = (key: string) => act(() => cell(key).focus())
const progress = () => JSON.parse(localStorage.getItem(storageKey)!)

const press = (key: string, options: KeyboardEventInit = {}, target: EventTarget = document.activeElement ?? window) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  act(() => { target.dispatchEvent(event) })
  return event
}

const expectSelection = (key: string) => {
  expect(cell(key).getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(cell(key))
  expect(cell(key).tabIndex).toBe(0)
  expect(container.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1)
}

describe('board navigation', () => {
  it.each([0, 1])('shares a frozen solve time with %i hints after the solved badge appears', async (hintCount) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const copy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: copy } })
    const solution = Object.fromEntries(puzzle.cells.flatMap((row, rowIndex) =>
      row.flatMap((square, colIndex) => square.kind === 'play' ? [[`${rowIndex}:${colIndex}`, square.solution]] : []),
    ))
    const last = Object.keys(solution).at(-1)!
    const digit = solution[last]
    delete solution[last]
    renderPlayer(solution)
    expect(container.textContent).not.toContain('Solve time:')
    if (hintCount) click(control('Give me a hint'))
    act(() => vi.advanceTimersByTime(988000))
    select(last)
    press(String(digit))
    expect(container.textContent).toContain('Solved!')
    expect(container.textContent).toContain('Solve time: 16:28')
    act(() => vi.advanceTimersByTime(60000))
    expect(container.textContent).toContain('Solve time: 16:28')
    await act(async () => control('Share').click())
    expect(copy).toHaveBeenCalledExactlyOnceWith(
      `Kakuro Zone\n⏱ 16:28 · ${hintCount ? '1 hint' : 'no hints'}\n${window.location.href}`,
    )
    expect(progress().completed).toBe(true)
  })

  it.each([
    ['ArrowLeft', '2:1'], ['h', '2:1'], ['A', '2:1'],
    ['ArrowRight', '2:4'], ['l', '2:4'], ['d', '2:4'],
    ['ArrowUp', '1:2'], ['K', '1:2'], ['w', '1:2'],
    ['ArrowDown', '4:2'], ['j', '4:2'], ['s', '4:2'],
  ])('moves with %s and skips shaded squares', (key, destination) => {
    renderPlayer()
    select('2:2')
    expect(press(key).defaultPrevented).toBe(true)
    expectSelection(destination)
  })

  it.each([
    ['ArrowLeft', '1:1'], ['ArrowUp', '1:1'],
    ['ArrowRight', '5:5'], ['ArrowDown', '5:5'],
  ])('stops at the edge for %s without scrolling', (key, start) => {
    renderPlayer()
    select(start)
    expect(press(key).defaultPrevented).toBe(true)
    expectSelection(start)
  })

  it('moves onto filled squares and keeps focus aligned after entering a digit', () => {
    renderPlayer({ '1:2': 4 })
    select('1:1')
    press('d')
    expectSelection('1:2')
    press('5')
    expect(progress().values['1:2']).toBe(5)
    expectSelection('1:4')
  })

  it('keeps focus aligned when a hint selects another square', () => {
    renderPlayer({ '1:1': 3 })
    select('2:2')
    click(control('Give me a hint'))
    expectSelection('1:2')
    press('d')
    expectSelection('1:4')
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])('ignores modified shortcuts %j', (modifier) => {
    renderPlayer({ '1:1': 3 })
    select('1:1')
    for (const key of ['a', 'ArrowRight', '1', 'Delete', 'n']) {
      expect(press(key, modifier).defaultPrevented).toBe(false)
    }
    expectSelection('1:1')
    expect(progress().values).toEqual({ '1:1': 3 })
    expect(control('Notes off').getAttribute('aria-pressed')).toBe('false')
  })

  it.each(['input', 'textarea', 'select', 'div'])('ignores shortcuts inside %s editors', (tag) => {
    renderPlayer({ '1:1': 3 })
    const editor = document.createElement(tag)
    if (tag === 'div') editor.setAttribute('contenteditable', 'true')
    container.append(editor)
    for (const key of ['d', '1', 'Delete', 'n']) {
      expect(press(key, {}, editor).defaultPrevented).toBe(false)
    }
    expect(cell('1:1').getAttribute('aria-selected')).toBe('true')
    expect(progress().values).toEqual({ '1:1': 3 })
  })
})

describe('notes on filled squares', () => {
  it('disables the button and N shortcut on a filled square', () => {
    renderPlayer({ '1:1': 3 })
    select('1:1')
    expect(control('Notes off').disabled).toBe(true)
    press('n')
    click(control('Notes off'))
    select('1:2')
    expect(control('Notes off').disabled).toBe(false)
    press('N')
    expect(control('Notes on').getAttribute('aria-pressed')).toBe('true')
    press('2')
    expect(progress().notes['1:2']).toEqual([2])
    expectSelection('1:2')
  })

  it('allows replacing filled digits while remembering notes mode for empty squares', () => {
    renderPlayer({ '1:1': 3 })
    select('1:2')
    click(control('Notes off'))
    select('1:1')
    expect(control('Notes off').disabled).toBe(true)
    expect(control('Notes off').getAttribute('aria-pressed')).toBe('false')
    press('n')
    press('7')
    expect(progress().values['1:1']).toBe(7)
    expectSelection('1:2')
    expect(control('Notes on').disabled).toBe(false)
    press('2')
    press('2')
    expect(progress().notes['1:2']).toEqual([])
  })
})

describe('erasing and resetting', () => {
  it.each(['button', 'Backspace', 'Delete'])('erases a digit and moves left using %s', (method) => {
    renderPlayer({ '1:1': 2, '1:2': 3, '1:4': 4 })
    select('1:4')
    if (method === 'button') click(control('Erase'))
    else press(method)
    expect(progress().values).toEqual({ '1:1': 2, '1:2': 3 })
    expectSelection('1:2')
    click(control('Undo'))
    expect(progress().values['1:4']).toBe(4)
    click(control('Redo'))
    expect(progress().values['1:4']).toBeUndefined()
  })

  it.each([['2:1', '1:5'], ['4:1', '2:5']])('wraps from %s to the previous playable row', (start, previous) => {
    renderPlayer({ [start]: 3 })
    select(start)
    press('Delete')
    expectSelection(previous)
  })

  it('keeps selection on the first playable square when erasing it', () => {
    renderPlayer({ '1:1': 3 })
    select('1:1')
    click(control('Erase'))
    expectSelection('1:1')
    expect(progress().values).toEqual({})
  })

  it('erases notes individually rather than resetting other entries', () => {
    renderPlayer({ '2:1': 4 }, { '1:2': [1, 3] })
    select('1:2')
    click(control('Erase'))
    expect(progress()).toMatchObject({ values: { '2:1': 4 }, notes: {} })
    expectSelection('1:1')
    expect(control('Erase all').disabled).toBe(false)
  })

  it('disables Erase all on a pristine board, including empty note arrays', () => {
    renderPlayer({}, { '1:1': [] })
    expect(control('Erase all').disabled).toBe(true)
  })

  it('does not erase all or move when Delete or Backspace is used on an empty square', () => {
    renderPlayer({ '1:2': 4 })
    const confirm = vi.spyOn(window, 'confirm')
    select('1:1')
    press('Backspace')
    press('Delete')
    expect(progress().values).toEqual({ '1:2': 4 })
    expectSelection('1:1')
    expect(confirm).not.toHaveBeenCalled()
    expect(control('Undo').disabled).toBe(true)
  })

  it('leaves progress and history intact when resetting is cancelled', () => {
    renderPlayer({ '1:2': 4 }, { '2:1': [1, 3] })
    const before = progress()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    click(control('Erase all'))
    expect(confirm).toHaveBeenCalledOnce()
    expect(progress()).toEqual(before)
    expect(control('Undo').disabled).toBe(true)
  })

  it('confirms, persists, and supports undo and redo for a full reset', () => {
    const values = { '1:2': 4 }
    const notes = { '2:1': [1, 3] }
    renderPlayer(values, notes)
    select('1:1')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    click(control('Erase all'))
    expect(confirm).toHaveBeenCalledWith(
      'Erase all numbers and notes from this puzzle? You can undo this reset.',
    )
    expect(progress()).toMatchObject({ values: {}, notes: {}, completed: false })
    expect(cell('1:1').getAttribute('aria-selected')).toBe('true')
    expect(control('Erase all').disabled).toBe(true)
    click(control('Undo'))
    expect(progress()).toMatchObject({ values, notes })
    click(control('Redo'))
    expect(progress()).toMatchObject({ values: {}, notes: {} })
  })

  it('can reset a board containing only notes', () => {
    renderPlayer({}, { '1:2': [2, 4] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    click(control('Erase all'))
    expect(progress().notes).toEqual({})
  })

  it('leaves solved boards read-only', () => {
    const values = Object.fromEntries(puzzle.cells.flatMap((row, r) =>
      row.flatMap((square, c) => square.kind === 'play' ? [[`${r}:${c}`, square.solution]] : [])))
    renderPlayer(values)
    const before = progress()
    for (const button of container.querySelectorAll<HTMLButtonElement>('button[role="gridcell"]')) {
      expect(button.disabled).toBe(true)
    }
    for (const key of ['ArrowRight', 'd', '1', 'n', 'Delete']) press(key)
    expect(progress()).toEqual(before)
    expect(container.querySelector('[aria-selected="true"]')).toBeNull()
  })
})
