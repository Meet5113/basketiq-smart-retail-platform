import { useEffect, useRef, useState } from 'react'

function DropdownMenu({ align = 'right', trigger, children, panelClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) {
        return
      }

      setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {trigger({
        isOpen,
        toggle: () => setIsOpen((prev) => !prev),
        close: () => setIsOpen(false),
      })}

      {isOpen ? (
        <div
          className={`absolute top-full z-40 mt-2 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_60px_rgba(15,23,42,0.16)] ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${panelClassName}`}
        >
          {children({
            close: () => setIsOpen(false),
          })}
        </div>
      ) : null}
    </div>
  )
}

export default DropdownMenu
