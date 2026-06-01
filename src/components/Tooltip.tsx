import { useState, useRef, type ReactNode } from 'react'

interface TooltipProps {
  text: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const posStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => { clearTimeout(timeout.current); timeout.current = setTimeout(() => setShow(true), 400) }}
      onMouseLeave={() => { clearTimeout(timeout.current); setShow(false) }}
    >
      {children}
      {show && (
        <span
          className="absolute z-[100] px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-lg"
          style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            ...posStyles[position],
            animation: 'tooltipFadeIn 0.15s ease-out',
          }}
        >
          {text}
          <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
        </span>
      )}
    </span>
  )
}
