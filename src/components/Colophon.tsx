export const Colophon = () => (
  <main className="colophon-page">
    <header className="page-heading">
      <h1>COLOPHON</h1>
      <p>
        The tools, libraries, and references behind Kakuro Zone.
      </p>
    </header>

    <section aria-labelledby="site-stack">
      <h2 id="site-stack">Made with</h2>
      <ul className="colophon-list">
        <li><strong>React</strong> for the app interface and puzzle interactions.</li>
        <li><strong>TypeScript</strong> for the puzzle engine, routing, and PDF builders.</li>
        <li><strong>Vite</strong> for the development server, production build, and PWA asset pipeline.</li>
        <li><strong>Neobrutalism.dev</strong> as the visual styling reference.</li>
        <li><strong>pdf-lib</strong> for printable puzzle and solution PDFs.</li>
        <li><strong>Vitest</strong> and <strong>Oxlint</strong> for tests and code checks.</li>
        <li><strong>GitHub Copilot</strong> for implementation help along the way.</li>
        <li><strong>LocalStorage</strong> for saving puzzle progress on this device.</li>
      </ul>
    </section>

    <section aria-labelledby="puzzle-stack">
      <h2 id="puzzle-stack">Puzzle system</h2>
      <p>
        Daily puzzles are generated from the local calendar date. Archive puzzles
        are pre-generated from deterministic seeds, with logical uniqueness checks
        and printable answer pages.
      </p>
    </section>
  </main>
)
