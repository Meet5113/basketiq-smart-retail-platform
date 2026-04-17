import { ChevronLeft, ChevronRight } from 'lucide-react'

function DataTable({
  columns = [],
  data = [],
  rowKey,
  emptyState = 'No data available.',
  maxHeight,
  pagination,
  striped = true,
}) {
  const safeColumns = Array.isArray(columns) ? columns : []
  const safeData = Array.isArray(data) ? data : []
  const rowKeyResolver = typeof rowKey === 'function' ? rowKey : (row) => row?.[rowKey]
  const hasPagination = Boolean(pagination?.totalPages && pagination.totalPages > 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={maxHeight ? 'overflow-auto' : 'overflow-x-auto overflow-y-visible'}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {safeColumns.map((column) => (
                <th key={column.id} className={`px-4 py-3 font-semibold ${column.headerClassName || ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {safeData.length === 0 ? (
              <tr>
                <td colSpan={Math.max(safeColumns.length, 1)} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyState}
                </td>
              </tr>
            ) : (
              safeData.map((row, index) => (
                <tr
                  key={rowKeyResolver(row, index)}
                  className={`border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${
                    striped && index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                  }`}
                >
                  {safeColumns.map((column) => (
                    <td key={column.id} className={`px-4 py-3 align-middle ${column.cellClassName || ''}`}>
                      {column.cell ? column.cell(row, index) : row[column.id]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalItems > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing {pagination.startItem}-{pagination.endItem} of {pagination.totalItems}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="ds-btn ds-btn-secondary !px-3 !py-1.5 !text-xs"
            >
              <ChevronLeft size={14} className="mr-1" />
              Prev
            </button>
            <span className="text-xs font-medium text-slate-600">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={!hasPagination || pagination.page === pagination.totalPages}
              className="ds-btn ds-btn-secondary !px-3 !py-1.5 !text-xs"
            >
              Next
              <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DataTable
