import { useId } from 'react'
import { QUESTION_MARK_SVG } from '../utils/icons'

export default function InfoTooltip({ children, direction = 'tooltip-right' }) {
  const id = useId()
  return (
    <span className={`tooltip-container ${direction}`}>
      <button type="button" className="tooltip-trigger" aria-label="Más información" aria-describedby={id}>
        {QUESTION_MARK_SVG}
      </button>
      <span id={id} role="tooltip" className="tooltip-text">{children}</span>
    </span>
  )
}
