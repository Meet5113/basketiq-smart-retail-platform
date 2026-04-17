import InventoryAdjustmentForm from './InventoryAdjustmentForm'

function InventoryStockDialog({ open, mode, item, submitting, allowNegativeStock = false, onClose, onSubmit }) {
  if (!open || !item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Stock Adjustment</h3>
            <p className="mt-1 text-sm text-slate-500">
              {item.name} {item.sku ? `· ${item.sku}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            disabled={submitting}
          >
            Close
          </button>
        </div>

        <InventoryAdjustmentForm
          item={item}
          initialAction={mode}
          submitting={submitting}
          allowNegativeStock={allowNegativeStock}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}

export default InventoryStockDialog
