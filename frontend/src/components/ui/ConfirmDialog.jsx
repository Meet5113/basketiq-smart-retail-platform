import { AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

const toneClasses = {
  danger: {
    badge: 'bg-red-100 text-red-700',
    button: 'bg-red-600 text-white hover:bg-red-500',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  },
  info: {
    badge: 'bg-sky-100 text-sky-700',
    button: 'bg-sky-600 text-white hover:bg-sky-500',
  },
}

function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const selectedTone = toneClasses[tone] || toneClasses.danger

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        aria-label="Close dialog"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-950/10">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${selectedTone.badge}`}>
          <AlertTriangle size={20} />
        </div>

        <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="ds-btn ds-btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`ds-btn ${selectedTone.button}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
