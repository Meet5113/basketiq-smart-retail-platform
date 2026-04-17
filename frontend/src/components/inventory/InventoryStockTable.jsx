import { useEffect, useState } from 'react'
import { History, Minus, MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TableSkeleton } from '../ui/Skeleton'
import { formatDateTime, getInventoryStatusClass } from '../../utils/inventoryModule'

function InventoryStockTable({ data, loading, isAdmin, actionProductId, onAction }) {
  const [openMenuId, setOpenMenuId] = useState('')

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.target.closest('[data-stock-menu]')) {
        return
      }

      setOpenMenuId('')
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  if (loading) {
    return <TableSkeleton columns={9} rows={10} />
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto rounded-[24px]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-3 py-3 font-semibold">SKU</th>
              <th className="px-3 py-3 font-semibold">Category</th>
              <th className="px-3 py-3 text-right font-semibold">Current Stock</th>
              <th className="px-3 py-3 font-semibold">Unit</th>
              <th className="px-3 py-3 text-right font-semibold">Threshold</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Last Movement</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  No inventory rows found.
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const isBusyRow = actionProductId === item.productId

                return (
                  <tr
                    key={item.productId}
                    className={`border-t border-slate-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    } hover:bg-slate-50`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-[220px]">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-slate-700">{item.sku || 'N/A'}</td>
                    <td className="px-3 py-3 align-middle text-sm text-slate-700">{item.category || 'Uncategorized'}</td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="font-semibold tabular-nums text-slate-900">{item.stock}</span>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm uppercase text-slate-600">{item.unit || 'UNIT'}</td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="tabular-nums text-slate-700">{item.lowStockThreshold ?? item.reorderPoint ?? 0}</span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getInventoryStatusClass(item.stockStatus)}`}>
                        {item.stockStatus || 'In Stock'}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-slate-700">{formatDateTime(item.lastMovementDate)}</td>
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="relative inline-flex justify-end" data-stock-menu>
                        <button
                          type="button"
                          onClick={() => setOpenMenuId((current) => (current === item.productId ? '' : item.productId))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                          aria-label={`Manage inventory actions for ${item.name}`}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {openMenuId === item.productId ? (
                          <div className="absolute top-full right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                            {isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId('')
                                    onAction('add', item)
                                  }}
                                  disabled={isBusyRow}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Plus size={15} className="text-emerald-600" />
                                  Add stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId('')
                                    onAction('reduce', item)
                                  }}
                                  disabled={isBusyRow || Number(item.stock || 0) <= 0}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Minus size={15} className="text-red-600" />
                                  Reduce stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId('')
                                    onAction('adjust', item)
                                  }}
                                  disabled={isBusyRow}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <SlidersHorizontal size={15} className="text-sky-600" />
                                  Set exact stock
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                              </>
                            ) : null}

                            <Link
                              to={`/inventory/history?productId=${item.productId}`}
                              onClick={() => setOpenMenuId('')}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <History size={15} className="text-slate-500" />
                              View movement history
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default InventoryStockTable
