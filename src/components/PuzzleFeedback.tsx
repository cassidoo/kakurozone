import type { ReactNode } from 'react'
import type { SolutionValidation } from '../engine/validation'

export const PuzzleCelebration = ({
  solved,
  children,
}: {
  readonly solved: boolean
  readonly children: ReactNode
}) => (
  <div className={`puzzle-stage${solved ? ' is-solved' : ''}`}>
    {children}
    {solved && (
      <div className="solved-overlay" aria-hidden="true">
        <span className="solved-badge">Solved!</span>
      </div>
    )}
  </div>
)

export const PuzzleStatus = ({
  validation,
  message,
}: {
  readonly validation: Pick<SolutionValidation, 'complete' | 'valid'>
  readonly message: string
}) => (
  <p className="game-message" role="status" aria-live="polite">
    {validation.valid
      ? 'Solved! Every run adds up perfectly.'
      : validation.complete
        ? "Everything's filled in, but something's not quite right..."
        : message}
  </p>
)
