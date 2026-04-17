import { useMemo, useState } from 'react'
import { getStockActionLabel, getStockActionTitle, getStockReasonOptions } from '../../utils/inventoryModule'

function InventoryAdjustmentForm({ item, initialAction = 'add', submitting, allowNegativeStock = false, onCancel, onSubmit }) {
  const [action, setAction] = useState(initialAction || 'add')
  const [quantityValue, setQuantityValue] = useState(initialAction === 'adjust' ? String(item?.stock ?? '') : '')
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [note, setNote] = useState('')

  const reasonOptions = useMemo(() => getStockReasonOptions(action), [action])
  const submitLabel = useMemo(() => getStockActionLabel(action), [action])
  const title = useMemo(() => getStockActionTitle(action), [action])
  const resolvedReason = reason === 'Other' ? customReason.trim() : reason
  const numericValue = Number(quantityValue)
  const isExactStockAction = action === 'adjust'
  const projectedStock = useMemo(() => {
    if (!Number.isFinite(numericValue)) return item?.stock ?? 0
    if (isExactStockAction) return numericValue
    return action === 'reduce' ? Number(item?.stock || 0) - numericValue : Number(item?.stock || 0) + numericValue
  }, [action, isExactStockAction, item, numericValue])
  const canSubmit =
    Number.isFinite(numericValue) &&
    (isExactStockAction ? numericValue >= 0 : numericValue > 0) &&
    (allowNegativeStock || Number(projectedStock) >= 0) &&
    Boolean(resolvedReason)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const payload = {
      action,
      reason: resolvedReason,
      note: note.trim(),
    }

    if (isExactStockAction) {
      payload.targetStock = numericValue
    } else {
      payload.quantity = numericValue
    }

    const success = await onSubmit(payload)

    if (success) {
      onCancel()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Product name</label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
            {item?.name || 'N/A'}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Current stock</label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
            {item?.stock ?? 0} {String(item?.unit || '').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="stock-action" className="mb-1 block text-sm font-medium text-slate-700">
            Action type
          </label>
          <select
            id="stock-action"
            value={action}
            onChange={(event) => {
              const nextAction = event.target.value
              setAction(nextAction)
              setQuantityValue(nextAction === 'adjust' ? String(item?.stock ?? '') : '')
              setReason('')
              setCustomReason('')
            }}
            className="ds-select"
          >
            <option value="add">Add stock</option>
            <option value="reduce">Reduce stock</option>
            <option value="adjust">Set exact stock</option>
          </select>
        </div>

        <div>
          <label htmlFor="stock-quantity" className="mb-1 block text-sm font-medium text-slate-700">
            {isExactStockAction ? 'Exact stock' : 'Quantity'}
          </label>
          <input
            id="stock-quantity"
            type="number"
            min={isExactStockAction ? '0' : '1'}
            step="1"
            value={quantityValue}
            onChange={(event) => setQuantityValue(event.target.value)}
            className="ds-input"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="stock-reason" className="mb-1 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <select
            id="stock-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              if (event.target.value !== 'Other') {
                setCustomReason('')
              }
            }}
            className="ds-select"
            required
          >
            <option value="">Select reason</option>
            {reasonOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Resulting stock</label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
            {Number.isFinite(projectedStock) ? projectedStock : item?.stock ?? 0}
          </div>
        </div>
      </div>

      {reason === 'Other' ? (
        <div>
          <label htmlFor="custom-reason" className="mb-1 block text-sm font-medium text-slate-700">
            Custom reason
          </label>
          <input
            id="custom-reason"
            type="text"
            value={customReason}
            onChange={(event) => setCustomReason(event.target.value)}
            className="ds-input"
            placeholder="Enter reason"
            required
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="stock-note" className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="stock-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="ds-input min-h-[88px]"
          placeholder="Optional note for the movement record"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {title} will create a stock movement record and update current stock immediately.
      </div>

      {Number.isFinite(projectedStock) && projectedStock < 0 ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            allowNegativeStock
              ? 'border border-amber-200 bg-amber-50 text-amber-800'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {allowNegativeStock
            ? 'This change will make stock negative, but current POS settings allow it.'
            : 'This change would make stock negative. Increase stock first or use a smaller reduction.'}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="ds-btn ds-btn-secondary" disabled={submitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="ds-btn ds-btn-primary"
          disabled={submitting || !canSubmit}
        >
          {submitting ? 'Saving...' : `${submitLabel} Stock`}
        </button>
      </div>
    </form>
  )
}

export default InventoryAdjustmentForm
