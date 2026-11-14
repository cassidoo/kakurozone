import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import {
  coordinateKey,
  puzzleSizeForSeed,
  validateSolution,
  type KakuroPuzzle,
  type Difficulty,
} from './engine'
import type { PaperSize } from './print/pdf'
import { PACK_SIZES, type PackSize } from './print/pack-size'
import { CLUE_TEXT_RATIO } from './clue-layout'
import { ClueCell } from './components/ClueCell'
import { PuzzleCelebration, PuzzleStatus } from './components/PuzzleFeedback'
import { SolvedActions } from './components/SolvedActions'
import { HowToPlay } from './components/HowToPlay'
import { Colophon } from './components/Colophon'
import { archiveEntryForPuzzle, getArchiveEntries, type ArchiveEntry } from './puzzles/catalogue'
import { parsePuzzleRoute, puzzlePath, referencePath, type PuzzleRoute } from './puzzles/routes'
import { loadPuzzle } from './puzzles/loader'
import { useLocalDate } from './puzzles/useLocalDate'
import { usePuzzle } from './puzzles/usePuzzle'
import { useSolveStats } from './useSolveStats'

type View = PuzzleRoute['view']
type Notes = Readonly<Record<string, readonly number[]>>

interface BoardState {
  readonly values: Readonly<Record<string, number>>
  readonly notes: Notes
}

interface StoredProgress extends BoardState {
  readonly completed: boolean
}

const EMPTY_BOARD: BoardState = { values: {}, notes: {} }

const KEY_DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  arrowleft: [0, -1], h: [0, -1], a: [0, -1],
  arrowdown: [1, 0], j: [1, 0], s: [1, 0],
  arrowup: [-1, 0], k: [-1, 0], w: [-1, 0],
  arrowright: [0, 1], l: [0, 1], d: [0, 1],
}

const dateFromSeed = (seed: string): Date => {
  const [year = 2026, month = 1, day = 1] = seed.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const formatDate = (seed: string, long = false): string =>
  new Intl.DateTimeFormat(undefined, {
    weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: long ? undefined : 'numeric',
  }).format(dateFromSeed(seed))

const progressKey = (puzzle: KakuroPuzzle): string => `kakuro-zone:${puzzle.id}`

const loadProgress = (puzzle: KakuroPuzzle): StoredProgress => {
  try {
    const stored = localStorage.getItem(progressKey(puzzle))
    if (!stored) return { ...EMPTY_BOARD, completed: false }
    const parsed = JSON.parse(stored) as Partial<StoredProgress>
    return {
      values: parsed.values ?? {},
      notes: parsed.notes ?? {},
      completed: parsed.completed === true,
    }
  } catch {
    return { ...EMPTY_BOARD, completed: false }
  }
}

const getHashRoute = (): PuzzleRoute => parsePuzzleRoute(window.location.hash)

const navigate = (path: string): void => {
  window.location.hash = path
}

const AppHeader = ({ view }: { readonly view: View }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <header
      className="site-header"
      ref={headerRef}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false)
        }
      }}
    >
      <button className="wordmark" type="button" onClick={() => {
        setMenuOpen(false)
        navigate('')
      }}>
        <span>KAKURO</span> ZONE
      </button>
      <button
        className="nav-toggle"
        type="button"
        ref={toggleRef}
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">≡</span>
      </button>
      <nav
        id="primary-navigation"
        aria-label="Primary navigation"
        className={menuOpen ? 'nav-open' : ''}
        onClick={() => setMenuOpen(false)}
      >
        <button
          type="button"
          className={view === 'home' ? 'nav-active' : ''}
          onClick={() => navigate('')}
        >
          Today
        </button>
        <button
          type="button"
          className={view === 'archive' ? 'nav-active' : ''}
          onClick={() => navigate('archive')}
        >
          Archive
        </button>
        <button
          type="button"
          className={view === 'print' ? 'nav-active' : ''}
          onClick={() => navigate('print')}
        >
          Print
        </button>
        <a
          href="#how-to-play"
          className={view === 'how-to-play' ? 'nav-active' : ''}
          aria-current={view === 'how-to-play' ? 'page' : undefined}
        >
          How to play
        </a>
      </nav>
    </header>
  )
}

const DifficultyBadge = ({ difficulty }: { readonly difficulty: Difficulty }) => (
  <span className={`difficulty difficulty-${{ Easy: 1, Medium: 2, Hard: 3 }[difficulty]}`}>
    {difficulty}
  </span>
)

const MiniBoard = ({ puzzle }: { readonly puzzle: KakuroPuzzle }) => (
  <div
    className="mini-board"
    aria-hidden="true"
    style={{ '--board-size': puzzle.size } as CSSProperties}
  >
    {puzzle.cells.flatMap((row, rowIndex) =>
      row.map((cell, colIndex) => (
        <span
          className={cell.kind === 'play' ? 'mini-play' : cell.clue ? 'mini-clue' : 'mini-block'}
          key={`${rowIndex}:${colIndex}`}
        />
      )),
    )}
  </div>
)

const Home = ({ today }: { readonly today: KakuroPuzzle }) => (
  <main className="home-page">
    <header className="page-heading">
      <h1>DAILY KAKURO<br />PUZZLES</h1>
      <section className="home-copy">
        <ol className="rule-strip" aria-label="How to play" role="list">
          <li><strong aria-hidden="true">1</strong> Pick a square</li>
          <li><strong aria-hidden="true">2</strong> Follow the clues</li>
          <li><strong aria-hidden="true">3</strong> Sum the digits</li>
        </ol>
        <a className="home-help-link" href="#how-to-play">
          How to play <span aria-hidden="true">→</span>
        </a>
      </section>
    </header>

    <section className="daily-ticket" aria-labelledby="daily-title">
      <div className="ticket-topline">
        <span>{formatDate(today.seed, true)}</span>
        <DifficultyBadge difficulty={today.metadata.difficulty} />
      </div>
      <div className="daily-preview">
        <MiniBoard puzzle={today} />
        <div>
          <h2 id="daily-title">Today’s grid</h2>
          <p>{today.size}×{today.size} · {today.metadata.playableCells} open squares</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => navigate(puzzlePath(today))}
          >
            Play today <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  </main>
)

type DifficultyFilter = Difficulty | 'All'

const DifficultyPicker = ({
  value, onChange, id,
}: {
  readonly value: DifficultyFilter
  readonly onChange: (value: DifficultyFilter) => void
  readonly id: string
}) => (
  <div className="difficulty-picker">
    <label htmlFor={id}>Difficulty</label>
    <select
      id={id}
      value={value}
      onChange={(event) => {
        const value = event.target.value
        if (value === 'All' || value === 'Easy' || value === 'Medium' || value === 'Hard') onChange(value)
      }}
    >
      <option value="All">All levels</option>
      <option value="Easy">Easy</option>
      <option value="Medium">Medium</option>
      <option value="Hard">Hard</option>
    </select>
  </div>
)

const CATALOGUE_PAGE_SIZE = 24

const useCataloguePage = (entries: readonly ArchiveEntry[], initialKey?: string) => {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All')
  const [requestedPage, setPage] = useState(() =>
    Math.floor(Math.max(0, entries.findIndex(({ key }) => key === initialKey)) / CATALOGUE_PAGE_SIZE),
  )
  const filtered = entries.filter((entry) =>
    difficulty === 'All' || entry.difficulty === difficulty,
  )
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(filtered.length / CATALOGUE_PAGE_SIZE) - 1))
  return {
    difficulty,
    changeDifficulty: (value: DifficultyFilter) => {
      setDifficulty(value)
      setPage(0)
    },
    page,
    setPage,
    total: filtered.length,
    visible: filtered.slice(page * CATALOGUE_PAGE_SIZE, (page + 1) * CATALOGUE_PAGE_SIZE),
  }
}

const CataloguePagination = ({ page, total, setPage }: {
  readonly page: number
  readonly total: number
  readonly setPage: (page: number) => void
}) => (
  <nav className="catalogue-pagination" aria-label="Puzzle pages">
    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
    <span role="status">
      {page * CATALOGUE_PAGE_SIZE + 1}-{Math.min((page + 1) * CATALOGUE_PAGE_SIZE, total)} of {total} puzzles
    </span>
    <button
      type="button"
      disabled={(page + 1) * CATALOGUE_PAGE_SIZE >= total}
      onClick={() => setPage(page + 1)}
    >
      Older
    </button>
  </nav>
)

const CataloguePreview = ({ entry }: { readonly entry: ArchiveEntry }) => {
  const state = usePuzzle(entry.reference, 'preview')
  return state.status === 'ready' ? <MiniBoard puzzle={state.puzzle} /> : (
    <span className="catalogue-preview-placeholder" aria-hidden="true">
      {state.status === 'error' ? 'Preview unavailable' : 'Loading preview...'}
    </span>
  )
}

const Archive = ({ entries }: { readonly entries: readonly ArchiveEntry[] }) => {
  const catalogue = useCataloguePage(entries)

  return (
    <main className="archive-page">
      <div className="page-heading">
        <h1>THE ARCHIVE</h1>
        <div className="archive-heading-copy">
          <p>Play puzzles on puzzles to your heart's content.</p>
          <button className="text-button" type="button" onClick={() => navigate('print')}>
            Make a print pack <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <DifficultyPicker id="archive-difficulty" value={catalogue.difficulty} onChange={catalogue.changeDifficulty} />
      <CataloguePagination {...catalogue} />
      <div className="archive-grid">
        {catalogue.visible.map((entry) => (
          <button
            className="archive-card"
            type="button"
            key={entry.key}
            onClick={() => navigate(referencePath(entry.reference))}
          >
            <span className="archive-date">
              {formatDate(entry.reference.seed)}
            </span>
            <CataloguePreview entry={entry} />
            <span className="archive-meta">
              <strong>{entry.reference.size}×{entry.reference.size}</strong>
              <DifficultyBadge difficulty={entry.difficulty} />
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}

const downloadPdf = (bytes: Uint8Array, fileName: string): void => {
  const blob = new Blob([new Uint8Array(bytes).buffer], {
    type: 'application/pdf',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const PrintCenter = ({
  initialPuzzle, entries,
}: {
  readonly initialPuzzle?: KakuroPuzzle
  readonly entries: readonly ArchiveEntry[]
}) => {
  const puzzles = useMemo(() => {
    const initialEntry = initialPuzzle ? archiveEntryForPuzzle(initialPuzzle) : undefined
    if (!initialEntry || entries.some((entry) => entry.key === initialEntry.key)) {
      return entries
    }
    return [initialEntry, ...entries]
  }, [initialPuzzle, entries])
  const catalogue = useCataloguePage(puzzles, initialPuzzle ? archiveEntryForPuzzle(initialPuzzle).key : undefined)
  const [paperSize, setPaperSize] = useState<PaperSize>('letter')
  const [packSize, setPackSize] = useState<PackSize>(8)
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(() =>
    initialPuzzle ? [archiveEntryForPuzzle(initialPuzzle).key] : puzzles.slice(0, 8).map(({ key }) => key),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState(
    initialPuzzle
      ? 'This puzzle is selected. Add seven more to make a pack.'
      : 'The latest eight puzzles are selected.',
  )
  const [error, setError] = useState(false)
  const selectedPuzzles = puzzles.filter(({ key }) => selectedIds.includes(key))

  const changePackSize = (size: PackSize): void => {
    setPackSize(size)
    setError(false)
    setSelectedIds(selectedIds.slice(0, size))
    setMessage(`${Math.min(selectedIds.length, size)} of ${size} puzzles selected.`)
  }

  const togglePuzzle = (entry: ArchiveEntry): void => {
    setError(false)
    if (selectedIds.includes(entry.key)) {
      setSelectedIds(selectedIds.filter((id) => id !== entry.key))
      setMessage(`${selectedIds.length - 1} of ${packSize} puzzles selected.`)
      return
    }
    if (selectedIds.length === packSize) {
      setError(true)
      setMessage(
        `A pack holds ${packSize} puzzles. Remove one before adding another.`,
      )
      return
    }
    setSelectedIds([...selectedIds, entry.key])
    setMessage(`${selectedIds.length + 1} of ${packSize} puzzles selected.`)
  }

  const exportIndividual = async (entry: ArchiveEntry): Promise<void> => {
    setBusy(entry.key)
    setError(false)
    setMessage(`Building ${entry.reference.seed}…`)
    try {
      const puzzle = await loadPuzzle(entry.reference)
      const { buildIndividualPuzzlePdf } = await import('./print/pdf')
      const bytes = await buildIndividualPuzzlePdf(puzzle, paperSize)
      downloadPdf(bytes, `kakuro-${puzzle.seed}-${paperSize}.pdf`)
      setMessage(`Downloaded ${puzzle.seed} with its solution page.`)
    } catch (error) {
      setError(true)
      setMessage(`The PDF could not be built. ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setBusy(null)
    }
  }

  const exportPack = async (): Promise<void> => {
    if (selectedPuzzles.length !== packSize) return
    setBusy('pack')
    setError(false)
    setMessage(`Building your ${packSize}-puzzle pack…`)
    try {
      const generated = await Promise.all(selectedPuzzles.map((entry) => loadPuzzle(entry.reference)))
      const { buildPuzzlePackPdf } = await import('./print/pdf')
      const bytes = await buildPuzzlePackPdf(generated, paperSize)
      downloadPdf(bytes, `kakuro-${packSize}-pack-${paperSize}.pdf`)
      const puzzlePages = Math.ceil(packSize / 4)
      setMessage(
        `Downloaded ${puzzlePages} puzzle page${puzzlePages === 1 ? '' : 's'} and one solutions page.`,
      )
    } catch (error) {
      setError(true)
      setMessage(`The PDF could not be built. ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="print-page">
      <div className="print-heading">
        <h1>PUZZLES ON PAPER</h1>
        <div className="print-heading-copy">
          <p>
            Pick archive grids for a compact pack, or download any puzzle on
            its own. Every PDF includes answers.
          </p>
          <div className="print-controls">
            <div className="paper-control">
              <label htmlFor="pack-size">Pack size</label>
              <select
                id="pack-size"
                value={packSize}
                disabled={busy !== null}
                onChange={(event) =>
                  changePackSize(Number(event.target.value) as PackSize)
                }
              >
                {PACK_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} puzzles
                  </option>
                ))}
              </select>
            </div>
            <div className="paper-control">
              <label htmlFor="paper-size">Paper size</label>
              <select
                id="paper-size"
                value={paperSize}
                disabled={busy !== null}
                onChange={(event) => setPaperSize(event.target.value as PaperSize)}
              >
                <option value="letter">US Letter</option>
                <option value="a4">A4</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <section className="pack-toolbar" aria-label="Print pack">
        <div>
          <strong>{selectedPuzzles.length} / {packSize} selected</strong>
          <span>Four puzzles per page · solutions on the last page</span>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={selectedPuzzles.length !== packSize || busy !== null}
          onClick={() => void exportPack()}
        >
          {busy === 'pack' ? 'Building pack…' : `Download ${packSize}-puzzle pack`}
        </button>
      </section>

      <p
        className={`export-message ${error ? 'export-error' : ''}`}
        role={error ? 'alert' : 'status'}
        aria-live="polite"
      >
        {message}
      </p>

      <DifficultyPicker id="print-difficulty" value={catalogue.difficulty} onChange={catalogue.changeDifficulty} />
      <CataloguePagination {...catalogue} />
      <section className="print-grid" aria-label="Archive puzzles">
        {catalogue.visible.map((entry) => {
          const selected = selectedIds.includes(entry.key)
          return (
            <article className={`print-card ${selected ? 'print-card-selected' : ''}`} key={entry.key}>
              <label>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={busy !== null}
                  onChange={() => togglePuzzle(entry)}
                />
                <span className="print-card-date">
                  {formatDate(entry.reference.seed)}
                </span>
                <CataloguePreview entry={entry} />
                <span className="archive-meta">
                  <strong>{entry.reference.size}×{entry.reference.size}</strong>
                  <DifficultyBadge difficulty={entry.difficulty} />
                </span>
              </label>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportIndividual(entry)}
              >
                {busy === entry.key ? 'Building…' : 'Download single PDF'}
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}

const PuzzleBoard = ({
  puzzle,
  board,
  selected,
  incorrect,
  readOnly,
  onSelect,
  ref,
}: {
  readonly puzzle: KakuroPuzzle
  readonly board: BoardState
  readonly selected: string | null
  readonly incorrect: ReadonlySet<string>
  readonly readOnly: boolean
  readonly onSelect: (key: string) => void
  readonly ref: Ref<HTMLDivElement>
}) => (
  <div
    ref={ref}
    className="puzzle-board"
    role="grid"
    aria-readonly={readOnly}
    aria-label={`${puzzle.size} by ${puzzle.size} Kakuro board`}
    aria-describedby="clue-legend"
    style={{
      '--board-size': puzzle.size,
      '--clue-text-ratio': CLUE_TEXT_RATIO,
    } as CSSProperties}
  >
    {puzzle.cells.flatMap((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const key = `${rowIndex}:${colIndex}`
        if (cell.kind === 'block') {
          return <ClueCell key={key} clue={cell.clue} />
        }
        const value = board.values[key]
        const notes = board.notes[key] ?? []
        return (
          <button
            key={key}
            type="button"
            role="gridcell"
            disabled={readOnly}
            tabIndex={selected === key ? 0 : -1}
            data-cell-key={key}
            aria-selected={selected === key}
            aria-invalid={incorrect.has(key)}
            aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}${value ? `, ${value}` : ', empty'}${notes.length ? `, notes ${notes.join(', ')}` : ''}`}
            className={`play-cell ${selected === key ? 'selected' : ''} ${incorrect.has(key) ? 'incorrect' : ''}`}
            onClick={() => onSelect(key)}
            onFocus={() => onSelect(key)}
          >
            {value !== undefined ? (
              <span className="cell-number">{value}</span>
            ) : (
              <span className="note-grid" aria-hidden="true">
                {Array.from({ length: 9 }, (_, noteIndex) => (
                  <span key={noteIndex}>{notes.includes(noteIndex + 1) ? noteIndex + 1 : ''}</span>
                ))}
              </span>
            )}
          </button>
        )
      }),
    )}
  </div>
)

const PuzzlePlayer = ({ puzzle }: { readonly puzzle: KakuroPuzzle }) => {
  const boardRef = useRef<HTMLDivElement>(null)
  const initial = useMemo(() => loadProgress(puzzle), [puzzle])
  const [board, setBoard] = useState<BoardState>(initial)
  const [past, setPast] = useState<readonly BoardState[]>([])
  const [future, setFuture] = useState<readonly BoardState[]>([])
  const [selected, setSelected] = useState<string | null>(() => {
    const first = puzzle.runs[0]?.cells[0]
    return first ? coordinateKey(first) : null
  })
  const [noteMode, setNoteMode] = useState(false)
  const [incorrect, setIncorrect] = useState<ReadonlySet<string>>(new Set())
  const [message, setMessage] = useState('Pick a square to begin.')
  const selectedHasValue = selected !== null && board.values[selected] !== undefined
  const selectedHasContent = selected !== null &&
    (selectedHasValue || (board.notes[selected]?.length ?? 0) > 0)
  const notesActive = noteMode && !selectedHasValue
  const hasProgress = Object.keys(board.values).length > 0 ||
    Object.values(board.notes).some((notes) => notes.length > 0)
  const validation = useMemo(
    () => validateSolution(puzzle, board.values),
    [puzzle, board.values],
  )
  const { stats, recordHint } = useSolveStats(progressKey(puzzle), validation.valid)

  const playableKeys = useMemo(
    () =>
      puzzle.cells.flatMap((row, rowIndex) =>
        row.flatMap((cell, colIndex) => cell.kind === 'play' ? [`${rowIndex}:${colIndex}`] : []),
      ),
    [puzzle],
  )

  useEffect(() => {
    localStorage.setItem(
      progressKey(puzzle),
      JSON.stringify({ ...board, completed: validation.valid }),
    )
  }, [board, puzzle, validation.valid])

  const commit = (next: BoardState): void => {
    if (validation.valid) return
    setPast((items) => [...items, board])
    setBoard(next)
    setFuture([])
    setIncorrect(new Set())
    setMessage('Keep going—every run needs unique digits.')
  }

  const selectCell = (key: string): void => {
    setSelected(key)
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-cell-key="${key}"]`)?.focus()
  }

  const moveSelection = ([rowStep, colStep]: readonly [number, number]): void => {
    if (!selected) return
    let [row, col] = selected.split(':').map(Number)
    row += rowStep
    col += colStep
    while (row >= 0 && row < puzzle.size && col >= 0 && col < puzzle.size) {
      if (puzzle.cells[row]?.[col]?.kind === 'play') {
        selectCell(`${row}:${col}`)
        return
      }
      row += rowStep
      col += colStep
    }
  }

  const enterDigit = (digit: number): void => {
    if (validation.valid || !selected) return
    if (notesActive) {
      const existing = board.notes[selected] ?? []
      const nextNotes = existing.includes(digit)
        ? existing.filter((value) => value !== digit)
        : [...existing, digit].sort()
      commit({ ...board, notes: { ...board.notes, [selected]: nextNotes } })
      return
    }
    commit({
      values: { ...board.values, [selected]: digit },
      notes: { ...board.notes, [selected]: [] },
    })
    const currentIndex = playableKeys.indexOf(selected)
    const nextEmpty = playableKeys
      .slice(currentIndex + 1)
      .find((key) => board.values[key] === undefined)
    if (nextEmpty) selectCell(nextEmpty)
  }

  const erase = (): void => {
    if (validation.valid || !selected || !selectedHasContent) return
    const values = { ...board.values }
    const notes = { ...board.notes }
    delete values[selected]
    delete notes[selected]
    commit({ values, notes })
    const previous = playableKeys[playableKeys.indexOf(selected) - 1]
    selectCell(previous ?? selected)
  }

  const eraseAll = (): void => {
    if (validation.valid || !hasProgress) return
    if (!window.confirm('Erase all numbers and notes from this puzzle? You can undo this reset.')) return
    commit(EMPTY_BOARD)
    setMessage('All numbers and notes erased. You can undo this reset.')
  }

  const undo = (): void => {
    const previous = past.at(-1)
    if (!previous) return
    setFuture((items) => [board, ...items])
    setBoard(previous)
    setPast((items) => items.slice(0, -1))
    setIncorrect(new Set())
    setMessage('Last move undone.')
  }

  const redo = (): void => {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, board])
    setBoard(next)
    setFuture((items) => items.slice(1))
    setIncorrect(new Set())
    setMessage('Move restored.')
  }

  const check = (): void => {
    setIncorrect(new Set(validation.incorrectCells))
    if (validation.valid) setMessage('Solved! Every run adds up perfectly.')
    else if (validation.incorrectCells.length > 0) {
      setMessage(`${validation.incorrectCells.length} square${validation.incorrectCells.length === 1 ? '' : 's'} need another look.`)
    } else setMessage('So far, so good. Fill the remaining squares.')
  }

  const hint = (): void => {
    const target = playableKeys.find((key) => board.values[key] === undefined)
    if (!target) {
      setMessage('This grid is already filled. Check it to see how you did.')
      return
    }
    const [row, col] = target.split(':').map(Number)
    const cell = puzzle.cells[row]?.[col]
    if (cell?.kind !== 'play') return
    recordHint()
    selectCell(target)
    setMessage(`Hint: row ${row + 1}, column ${col + 1} can be ${cell.solution}.`)
  }

  useEffect(() => {
    if (validation.valid) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return
      const direction = KEY_DIRECTIONS[event.key.toLowerCase()]
      if (direction) {
        moveSelection(direction)
        event.preventDefault()
      } else if (/^[1-9]$/.test(event.key)) {
        enterDigit(Number(event.key))
        event.preventDefault()
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        erase()
        event.preventDefault()
      } else if (event.key.toLowerCase() === 'n' && !selectedHasValue) {
        setNoteMode((active) => !active)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const completedCount = Object.keys(board.values).length

  return (
    <main className="player-page">
      <div className="player-heading">
        <button className="back-button" type="button" onClick={() => navigate('archive')}>
          <span aria-hidden="true">←</span> Archive
        </button>
        <div>
          <h1>{formatDate(puzzle.seed, true)}</h1>
          <p>{puzzle.size}×{puzzle.size} · {completedCount}/{puzzle.metadata.playableCells} filled</p>
        </div>
        <DifficultyBadge difficulty={puzzle.metadata.difficulty} />
      </div>
      {puzzle.metadata.generator === 'seeded-tile-family-v1' && (
        <p className="classic-notice">
          Classic puzzle — your original progress is preserved.{' '}
          <a href="#">Try today’s connected grid.</a>
        </p>
      )}

      <div className="game-layout">
        <section className="board-panel" aria-label="Puzzle">
          <PuzzleCelebration solved={validation.valid}>
            <PuzzleBoard
              ref={boardRef}
              puzzle={puzzle}
              board={board}
              selected={validation.valid ? null : selected}
              incorrect={incorrect}
              readOnly={validation.valid}
              onSelect={setSelected}
            />
          </PuzzleCelebration>
          <p className="clue-legend" id="clue-legend">
            <span className="legend-across">Upper right: across <span aria-hidden="true">→</span></span>
            <span className="legend-down">Lower left: down <span aria-hidden="true">↓</span></span>
          </p>
          <PuzzleStatus validation={validation} message={message} />
        </section>

        <aside className="controls-panel" aria-label={validation.valid ? 'Solved puzzle actions' : 'Puzzle controls'}>
          {validation.valid ? (
            <SolvedActions
              puzzle={puzzle}
              stats={stats}
              onPrint={() => navigate(puzzlePath(puzzle, 'print'))}
            />
          ) : (
            <>
              <div className="keypad" aria-label="Number keypad">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
                  <button type="button" key={digit} onClick={() => enterDigit(digit)}>
                    {digit}
                  </button>
                ))}
              </div>
              <div className="control-toprow">
                <button type="button" onClick={undo} disabled={past.length === 0} aria-label="Undo">
                  <span aria-hidden="true">↶</span> Undo
                </button>
                <button type="button" onClick={redo} disabled={future.length === 0} aria-label="Redo">
                  <span aria-hidden="true">↷</span> Redo
                </button>
              </div>
              <div className="control-actions">
                <button
                  type="button"
                  className={notesActive ? 'active-control' : ''}
                  aria-pressed={notesActive}
                  disabled={!selected || selectedHasValue}
                  onClick={() => setNoteMode((active) => !active)}
                >
                  <span aria-hidden="true">✎</span> Notes {notesActive ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  onClick={selectedHasContent ? erase : eraseAll}
                  disabled={!selected || !hasProgress}
                >
                  <span aria-hidden="true">⌫</span> {selectedHasContent ? 'Erase' : 'Erase all'}
                </button>
              </div>
              <button className="check-button" type="button" onClick={check}>
                Check my grid
              </button>
              <button type="button" onClick={hint}>
                <span aria-hidden="true">?</span> Give me a hint
              </button>
              <button
                type="button"
                onClick={() => navigate(puzzlePath(puzzle, 'print'))}
              >
                <span aria-hidden="true">⇩</span> Print this puzzle
              </button>
              <p className="keyboard-tip">Keyboard: arrows / HJKL / WASD to move · 1–9 · N for notes · Delete to erase</p>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}

export default function App() {
  const [route, setRoute] = useState(getHashRoute)
  const todaySeed = useLocalDate()
  const entries = useMemo(() => getArchiveEntries(todaySeed), [todaySeed])
  const reference = route.view === 'home'
    ? { version: 2 as const, seed: todaySeed, size: puzzleSizeForSeed(todaySeed) }
    : route.view === 'play' || route.view === 'print' ? route.puzzle ?? null : null
  const puzzleState = usePuzzle(reference)

  useEffect(() => {
    const onHashChange = (): void => setRoute(getHashRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <>
      <AppHeader view={route.view} />
      {route.view === 'archive' ? (
        <Archive entries={entries} />
      ) : route.view === 'how-to-play' ? (
        <HowToPlay />
      ) : route.view === 'colophon' ? (
        <Colophon />
      ) : route.view === 'not-found' ? (
        <main className="puzzle-loading">
          <h1>Puzzle not found</h1>
          <p>This puzzle link has an invalid date, size, or version.</p>
          <button className="primary-button" type="button" onClick={() => navigate('archive')}>Browse the archive</button>
        </main>
      ) : route.view === 'print' && !route.puzzle ? (
        <PrintCenter entries={entries} />
      ) : puzzleState.status === 'ready' && route.view === 'print' ? (
        <PrintCenter
          key={puzzleState.puzzle.id}
          initialPuzzle={puzzleState.puzzle}
          entries={entries}
        />
      ) : puzzleState.status === 'ready' && route.view === 'play' ? (
        <PuzzlePlayer key={puzzleState.puzzle.id} puzzle={puzzleState.puzzle} />
      ) : puzzleState.status === 'ready' ? (
        <Home today={puzzleState.puzzle} />
      ) : puzzleState.status === 'error' ? (
        <main className="puzzle-loading">
          <h1>Couldn't build this puzzle</h1>
          <p role="alert">{puzzleState.message}</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>Try again</button>
        </main>
      ) : (
        <main className="puzzle-loading" aria-busy="true">
          <h1>Building your puzzle</h1>
          <p role="status">Connecting the clues and checking the solution...</p>
        </main>
      )}
      <footer>
        <a href="https://cassidoo.co" target="_blank" rel="noreferrer">
          Built by cassidoo
        </a>
        <a
          href="#colophon"
          aria-current={route.view === 'colophon' ? 'page' : undefined}
        >
          Colophon
        </a>
      </footer>
    </>
  )
}
