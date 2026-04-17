import { Store } from 'lucide-react'

function BrandMark({ size = 'default', className = '' }) {
  const variants = {
    default: {
      wrapper: 'h-16 w-16 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm',
      icon: 'text-slate-700',
      iconSize: 26,
    },
    sidebar: {
      wrapper: 'h-10 w-10 rounded-2xl border border-slate-700 bg-slate-900 shadow-inner shadow-slate-950/40',
      icon: 'text-slate-100',
      iconSize: 18,
    },
  }

  const selected = variants[size] || variants.default

  return (
    <div className={`flex shrink-0 items-center justify-center ${selected.wrapper} ${className}`.trim()}>
      <Store size={selected.iconSize} className={selected.icon} />
    </div>
  )
}

export default BrandMark
