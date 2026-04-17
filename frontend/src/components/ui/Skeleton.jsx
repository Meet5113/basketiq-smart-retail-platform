function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} aria-hidden="true" />
}

export function TableSkeleton({ columns = 5, rows = 6, withFooter = true }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div
            className="grid border-b border-slate-200 bg-slate-50 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={`head-${index}`} className="h-3.5 w-20" />
            ))}
          </div>

          <div className="space-y-4 px-4 py-4">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="grid items-center gap-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))` }}
              >
                {Array.from({ length: columns }).map((__, columnIndex) => (
                  <Skeleton key={`cell-${rowIndex}-${columnIndex}`} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {withFooter ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <Skeleton className="h-3.5 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CardSkeleton({ rows = 3 }) {
  return (
    <div className="ds-card space-y-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  )
}

export function StatsSkeleton({ cards = 5 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <Skeleton className="mt-6 h-8 w-28" />
          <Skeleton className="mt-3 h-3.5 w-20" />
          <Skeleton className="mt-6 h-8 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
