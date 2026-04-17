import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const toneMap = {
  success: {
    container: 'border-emerald-200 bg-white text-emerald-950',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-200 bg-white text-red-950',
    icon: 'text-red-600',
    Icon: AlertCircle,
  },
  warning: {
    container: 'border-amber-200 bg-white text-amber-950',
    icon: 'text-amber-600',
    Icon: TriangleAlert,
  },
  info: {
    container: 'border-sky-200 bg-white text-sky-950',
    icon: 'text-sky-600',
    Icon: Info,
  },
}

function Toast() {
  const { toasts, removeToast } = useToast()

  if (!toasts.length) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(100vw-2rem,24rem)] flex-col gap-3">
      {toasts.map((toast) => {
        const tone = toneMap[toast.type] || toneMap.info
        const Icon = tone.Icon

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl ring-1 ring-slate-950/5 backdrop-blur ${tone.container}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${tone.icon}`}>
                <Icon size={18} />
              </div>

              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p className="text-sm leading-5">{toast.description}</p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-950/5 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Toast
