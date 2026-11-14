// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

describe('site header', () => {
  it('highlights KAKURO rather than ZONE', () => {
    window.history.replaceState(null, '', '#how-to-play')
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('<span>KAKURO</span> ZONE</button>')
    expect(markup).not.toContain('<span>ZONE</span>')
  })
})

describe('navigation menu', () => {
  let container: HTMLDivElement
  let root: Root
  let toggle: HTMLButtonElement
  let nav: HTMLElement

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    window.history.replaceState(null, '', '#how-to-play')
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<App />))
    toggle = container.querySelector<HTMLButtonElement>('.nav-toggle')!
    nav = container.querySelector<HTMLElement>('nav')!
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const click = (element: HTMLElement) => act(() => element.click())

  it('starts collapsed and toggles the controlled navigation', () => {
    expect(toggle.getAttribute('aria-label')).toBe('Menu')
    expect(toggle.querySelector('[aria-hidden="true"]')?.textContent).toBe('≡')
    expect(toggle.getAttribute('aria-controls')).toBe(nav.id)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(nav.classList.contains('nav-open')).toBe(false)
    click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(nav.classList.contains('nav-open')).toBe(true)
    click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(nav.classList.contains('nav-open')).toBe(false)
  })

  it('closes on Escape and returns focus to the toggle', () => {
    click(toggle)
    act(() => nav.querySelector<HTMLButtonElement>('button')!.focus())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })

  it('closes when a pointer is pressed outside, but not inside', () => {
    click(toggle)
    act(() => nav.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when selecting the current page or the wordmark', () => {
    click(toggle)
    click(nav.querySelector<HTMLAnchorElement>('a')!)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    click(toggle)
    click(container.querySelector<HTMLButtonElement>('.wordmark')!)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when focus moves outside the header', () => {
    click(toggle)
    act(() => toggle.focus())
    act(() => container.querySelector<HTMLAnchorElement>('main a')!.focus())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
