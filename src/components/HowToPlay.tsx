import { ClueCell } from './ClueCell'

export const HowToPlay = () => (
  <main className="how-to-page">
    <header className="page-heading">
      <h1>HOW TO PLAY</h1>
      <p className="how-to-intro">
        Kakuro is a crossword with numbers. Fill every open square so the digits
        in each run add up to its clue.
      </p>
    </header>

    <section aria-labelledby="pick-a-square">
      <h2 id="pick-a-square">1. Pick a square</h2>
      <p>
        Tap an open square, then tap a number on the keypad. Use one digit
        from 1 to 9 in each square. You can also type 1–9 on a keyboard.
        Shaded squares hold clues or separate runs; you cannot enter numbers there.
      </p>
    </section>

    <section aria-labelledby="follow-the-clues">
      <h2 id="follow-the-clues">2. Follow the clues</h2>
      <p>
        A run is an unbroken line of open squares, ending at a shaded square or
        the edge of the board. The clue tells you the total for that run.
      </p>
      <ul className="clue-directions">
        <li><strong>Upper-right triangle:</strong> add the squares to the right (across).</li>
        <li><strong>Lower-left triangle:</strong> add the squares below (down).</li>
      </ul>
      <p>
        Each open square belongs to both an across run and a down run.
        Its digit must work for both clues.
      </p>
      <figure className="how-to-example">
        <div
          className="example-board"
          role="img"
          aria-label="Solved example: first row 1 and 2 totals 3; second row 3 and 4 totals 7. The columns total 4 and 6."
        >
          <div className="example-cells" aria-hidden="true">
            <ClueCell />
            <ClueCell clue={{ down: 4 }} />
            <ClueCell clue={{ down: 6 }} />
            <ClueCell clue={{ across: 3 }} />
            <span className="example-digit">1</span>
            <span className="example-digit">2</span>
            <ClueCell clue={{ across: 7 }} />
            <span className="example-digit">3</span>
            <span className="example-digit">4</span>
          </div>
        </div>
        <figcaption>
          <strong>A tiny solved grid.</strong> Across: 1 + 2 = 3 and 3 + 4 = 7.
          Down: 1 + 3 = 4 and 2 + 4 = 6. Every digit fits both directions.
        </figcaption>
      </figure>
    </section>

    <section aria-labelledby="sum-the-digits">
      <h2 id="sum-the-digits">3. Sum the digits</h2>
      <p>
        Digits cannot repeat within a run. A two-square run totaling 4 must
        contain 1 and 3, not 2 and 2. Use the crossing clues to work out their order.
        The same digit can appear elsewhere in a different run.
      </p>
      <p>
        Clue totals can have two digits, but your entries are always single digits.
        The puzzle is solved when every square is filled and every run follows
        both rules: the right total and no repeats.
      </p>
    </section>

    <section aria-labelledby="playing-tools">
      <h2 id="playing-tools">A few helpful tools</h2>
      <dl className="how-to-tools">
        <div>
          <dt>Notes</dt>
          <dd>Turn Notes on to pencil in possible digits. Tap a digit again to remove its note.</dd>
        </div>
        <div>
          <dt>Erase, Undo &amp; Redo</dt>
          <dd>Clear the selected square or step backward and forward through your entries.</dd>
        </div>
        <div>
          <dt>Check &amp; Hint</dt>
          <dd>Check my grid flags mistakes when you ask. Give me a hint reveals a digit for an empty square.</dd>
        </div>
      </dl>
      <p>
        Your progress saves automatically in this browser on this device.
        Prefer paper? The Print page offers individual puzzles and eight-puzzle packs with solutions.
      </p>
    </section>

    <a className="primary-button how-to-start" href="#">Try today’s puzzle</a>
  </main>
)
