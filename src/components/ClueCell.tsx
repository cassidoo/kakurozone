import { CLUE_POSITIONS } from '../clue-layout'
import type { Clue } from '../engine/types'

export const ClueCell = ({ clue }: { readonly clue?: Clue }) => {
  const directions = (['across', 'down'] as const).filter(
    (direction) => clue?.[direction] !== undefined,
  )
  const label = directions.length
    ? `Clue: ${directions.map((direction) => `${direction} ${clue?.[direction]}`).join(', ')}`
    : 'Blocked square'

  return (
    <div
      className={`clue-cell ${directions.length ? 'has-clue' : ''} ${directions.map((direction) => `has-${direction}`).join(' ')}`}
      role="gridcell"
      aria-label={label}
    >
      {directions.length > 0 && (
        <svg
          className="clue-divider"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line x1="0" y1="0" x2="100" y2="100" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {directions.map((direction) => (
        <span
          className={`clue-number clue-${direction}`}
          key={direction}
          style={{
            left: `${CLUE_POSITIONS[direction].x * 100}%`,
            top: `${CLUE_POSITIONS[direction].y * 100}%`,
          }}
          aria-hidden="true"
        >
          <span className="clue-digit">{clue?.[direction]}</span>
        </span>
      ))}
    </div>
  )
}
