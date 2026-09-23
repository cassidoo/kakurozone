import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
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
import { archivePuzzles } from './puzzles/catalogue'
import { localDateSeed, parsePuzzleRoute, puzzlePath, type PuzzleRoute } from './puzzles/routes'
import { usePuzzle } from './puzzles/usePuzzle'

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

const dateFromSeed = (seed: string): Date => {
  const [year = 2026, month = 1, day = 1] = seed.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const formatDate = (seed: string, long = false): string =>
  new Intl.DateTimeFormat(undefined, {
    weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short',
    day: 'numeric',
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

const AppHeader = ({ view }: { readonly view: View }) => (
  <header className="site-header">
    <button className="wordmark" type="button" onClick={() => navigate('')}>
      KAKURO <span>ZONE</span>
    </button>
    <nav aria-label="Primary navigation">
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

const DifficultyBadge = ({ puzzle }: { readonly puzzle: KakuroPuzzle }) => (
  <span className={`difficulty difficulty-${puzzle.metadata.score}`}>
    {puzzle.metadata.difficulty}
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
        <DifficultyBadge puzzle={today} />
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

const Archive = () => {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All')
  const puzzles = archivePuzzles.filter((puzzle) =>
    difficulty === 'All' || puzzle.metadata.difficulty === difficulty,
  )

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
      <DifficultyPicker id="archive-difficulty" value={difficulty} onChange={setDifficulty} />
      <div className="archive-grid">
        {puzzles.map((puzzle) => (
          <button
            className="archive-card"
            type="button"
            key={puzzle.id}
            onClick={() => navigate(puzzlePath(puzzle))}
          >
            <span className="archive-date">
              {formatDate(puzzle.seed)}
            </span>
            <MiniBoard puzzle={puzzle} />
            <span className="archive-meta">
              <strong>{puzzle.size}×{puzzle.size}</strong>
              <DifficultyBadge puzzle={puzzle} />
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
  initialPuzzle,
}: {
  readonly initialPuzzle?: KakuroPuzzle
}) => {
  const puzzles = useMemo(() => {
    if (!initialPuzzle || archivePuzzles.some((puzzle) => puzzle.id === initialPuzzle.id)) {
      return archivePuzzles
    }
    return [initialPuzzle, ...archivePuzzles]
  }, [initialPuzzle])
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All')
  const [paperSize, setPaperSize] = useState<PaperSize>('letter')
  const [packSize, setPackSize] = useState<PackSize>(8)
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(() =>
    initialPuzzle ? [initialPuzzle.id] : puzzles.slice(0, 8).map(({ id }) => id),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState(
    initialPuzzle
      ? 'This puzzle is selected. Add seven more to make a pack.'
      : 'The latest eight puzzles are selected.',
  )
  const [error, setError] = useState(false)
  const selectedPuzzles = puzzles.filter(({ id }) => selectedIds.includes(id))

  const changePackSize = (size: PackSize): void => {
    setPackSize(size)
    setError(false)
    setSelectedIds(selectedIds.slice(0, size))
    setMessage(`${Math.min(selectedIds.length, size)} of ${size} puzzles selected.`)
  }

  const togglePuzzle = (puzzle: KakuroPuzzle): void => {
    setError(false)
    if (selectedIds.includes(puzzle.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== puzzle.id))
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
    setSelectedIds([...selectedIds, puzzle.id])
    setMessage(`${selectedIds.length + 1} of ${packSize} puzzles selected.`)
  }

  const exportIndividual = async (puzzle: KakuroPuzzle): Promise<void> => {
    setBusy(puzzle.id)
    setError(false)
    setMessage(`Building ${puzzle.seed}…`)
    try {
      const { buildIndividualPuzzlePdf } = await import('./print/pdf')
      const bytes = await buildIndividualPuzzlePdf(puzzle, paperSize)
      downloadPdf(bytes, `kakuro-${puzzle.seed}-${paperSize}.pdf`)
      setMessage(`Downloaded ${puzzle.seed} with its solution page.`)
    } catch {
      setError(true)
      setMessage('The PDF could not be built. Please try again.')
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
      const { buildPuzzlePackPdf } = await import('./print/pdf')
      const bytes = await buildPuzzlePackPdf(selectedPuzzles, paperSize)
      downloadPdf(bytes, `kakuro-${packSize}-pack-${paperSize}.pdf`)
      const puzzlePages = Math.ceil(packSize / 4)
      setMessage(
        `Downloaded ${puzzlePages} puzzle page${puzzlePages === 1 ? '' : 's'} and one solutions page.`,
      )
    } catch {
      setError(true)
      setMessage('The PDF could not be built. Please try again.')
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

      <DifficultyPicker id="print-difficulty" value={difficulty} onChange={setDifficulty} />
      <section className="print-grid" aria-label="Archive puzzles">
        {puzzles.filter((puzzle) => difficulty === 'All' || puzzle.metadata.difficulty === difficulty).map((puzzle) => {
          const selected = selectedIds.includes(puzzle.id)
          return (
            <article className={`print-card ${selected ? 'print-card-selected' : ''}`} key={puzzle.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => togglePuzzle(puzzle)}
                />
                <span className="print-card-date">
                  {formatDate(puzzle.seed)}
                </span>
                <MiniBoard puzzle={puzzle} />
                <span className="archive-meta">
                  <strong>{puzzle.size}×{puzzle.size}</strong>
                  <DifficultyBadge puzzle={puzzle} />
                </span>
              </label>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportIndividual(puzzle)}
              >
                {busy === puzzle.id ? 'Building…' : 'Download single PDF'}
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
}: {
  readonly puzzle: KakuroPuzzle
  readonly board: BoardState
  readonly selected: string | null
  readonly incorrect: ReadonlySet<string>
  readonly readOnly: boolean
  readonly onSelect: (key: string) => void
}) => (
  <div
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
            aria-selected={selected === key}
            aria-invalid={incorrect.has(key)}
            aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}${value ? `, ${value}` : ', empty'}${notes.length ? `, notes ${notes.join(', ')}` : ''}`}
            className={`play-cell ${selected === key ? 'selected' : ''} ${incorrect.has(key) ? 'incorrect' : ''}`}
            onClick={() => onSelect(key)}
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
  const validation = useMemo(
    () => validateSolution(puzzle, board.values),
    [puzzle, board.values],
  )

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

  const enterDigit = (digit: number): void => {
    if (validation.valid || !selected) return
    if (noteMode) {
      if (board.values[selected] !== undefined) return
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
    if (nextEmpty) setSelected(nextEmpty)
  }

  const erase = (): void => {
    if (!selected) return
    const values = { ...board.values }
    const notes = { ...board.notes }
    delete values[selected]
    delete notes[selected]
    commit({ values, notes })
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
    setSelected(target)
    setMessage(`Hint: row ${row + 1}, column ${col + 1} can be ${cell.solution}.`)
  }

  useEffect(() => {
    if (validation.valid) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (/^[1-9]$/.test(event.key)) {
        enterDigit(Number(event.key))
        event.preventDefault()
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        erase()
        event.preventDefault()
      } else if (event.key.toLowerCase() === 'n') {
        setNoteMode((active) => !active)
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
        <DifficultyBadge puzzle={puzzle} />
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
              onPrint={() => navigate(puzzlePath(puzzle, 'print'))}
            />
          ) : (
            <>
              <div className="control-toprow">
                <button type="button" onClick={undo} disabled={past.length === 0} aria-label="Undo">
                  <span aria-hidden="true">↶</span> Undo
                </button>
                <button type="button" onClick={redo} disabled={future.length === 0} aria-label="Redo">
                  <span aria-hidden="true">↷</span> Redo
                </button>
              </div>
              <div className="keypad" aria-label="Number keypad">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
                  <button type="button" key={digit} onClick={() => enterDigit(digit)}>
                    {digit}
                  </button>
                ))}
              </div>
              <div className="control-actions">
                <button
                  type="button"
                  className={noteMode ? 'active-control' : ''}
                  aria-pressed={noteMode}
                  onClick={() => setNoteMode((active) => !active)}
                >
                  <span aria-hidden="true">✎</span> Notes {noteMode ? 'on' : 'off'}
                </button>
                <button type="button" onClick={erase}>
                  <span aria-hidden="true">⌫</span> Erase
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
              <p className="keyboard-tip">Keyboard: 1–9 · N for notes · Delete to erase</p>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}

export default function App() {
  const [route, setRoute] = useState(getHashRoute)
  const todaySeed = localDateSeed()
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
        <Archive />
      ) : route.view === 'how-to-play' ? (
        <HowToPlay />
      ) : route.view === 'not-found' ? (
        <main className="puzzle-loading">
          <h1>Puzzle not found</h1>
          <p>This puzzle link has an invalid date, size, or version.</p>
          <button className="primary-button" type="button" onClick={() => navigate('archive')}>Browse the archive</button>
        </main>
      ) : route.view === 'print' && !route.puzzle ? (
        <PrintCenter />
      ) : puzzleState.status === 'ready' && route.view === 'print' ? (
        <PrintCenter
          key={puzzleState.puzzle.id}
          initialPuzzle={puzzleState.puzzle}
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
        <strong>KAKURO ZONE</strong>
        <span>Deterministic daily number puzzles. Progress stays on this device.</span>
      </footer>
    </>
  )
}
