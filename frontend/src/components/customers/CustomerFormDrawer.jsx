import { useMemo, useState } from 'react'
import { Building2, FileText, UserPlus, X } from 'lucide-react'
import {
  buildCustomerPayload,
  CUSTOMER_TYPE_OPTIONS,
  deriveCustomerType,
  getInitialCustomerForm,
} from '../../utils/customerModule'

function CustomerFormDrawer({
  open,
  mode = 'create',
  title,
  subtitle,
  initialData,
  submitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => ({
    ...getInitialCustomerForm(),
    ...initialData,
    customerType: deriveCustomerType({
      customerType: initialData?.customerType,
      gstin: initialData?.gstin,
    }),
    isActive: initialData?.isActive !== false,
  }))
  const [error, setError] = useState('')

  const heading = title || (mode === 'edit' ? 'Edit Customer' : 'Add Customer')
  const supportingText =
    subtitle ||
    (mode === 'edit'
      ? 'Update contact, GST, and retail customer information.'
      : 'Create a customer profile for retail billing, GST invoices, and repeat purchase tracking.')

  const submitLabel = submitting
    ? mode === 'edit'
      ? 'Saving...'
      : 'Creating...'
    : mode === 'edit'
      ? 'Save Changes'
      : 'Create Customer'

  const inferredType = useMemo(
    () =>
      deriveCustomerType({
        customerType: form.customerType,
        gstin: form.gstin,
      }),
    [form.customerType, form.gstin],
  )

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }

      if (field === 'gstin') {
        const normalizedGstin = String(value || '').trim().toUpperCase()
        const inferredStateCode = normalizedGstin.slice(0, 2)
        next.gstin = normalizedGstin
        next.customerType = deriveCustomerType({
          customerType: current.customerType,
          gstin: normalizedGstin,
        })

        if (inferredStateCode) {
          next.stateCode = inferredStateCode
        }
      }

      if (field === 'customerType' && value === 'walk_in' && !String(current.gstin || '').trim()) {
        next.customerType = 'walk_in'
      }

      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    let payload

    try {
      payload = buildCustomerPayload(form)
      setError('')
    } catch (validationError) {
      setError(validationError?.message || 'Please review the customer details.')
      return
    }

    const wasSuccessful = await onSubmit(payload)
    if (wasSuccessful !== false) {
      setError('')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
      <button type="button" aria-label="Close customer drawer" className="flex-1 cursor-default" onClick={onClose} />

      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                <UserPlus size={14} />
                Customer Workspace
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{heading}</h2>
              <p className="mt-1 text-sm text-slate-500">{supportingText}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

          <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Customer Profile</h3>
                <p className="mt-1 text-sm text-slate-500">Retail identity, contact information, and customer type.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <input
                  className="ds-input !rounded-2xl !bg-white"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="e.g. Neha Sharma"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Phone number</span>
                  <input
                    className="ds-input !rounded-2xl !bg-white"
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="10-digit mobile number"
                    required
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    className="ds-input !rounded-2xl !bg-white"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="Optional email"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <textarea
                  className="ds-input min-h-[96px] !rounded-2xl !bg-white"
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  placeholder="Address for billing and follow-up"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Customer type</span>
                <select
                  className="ds-select !w-full !rounded-2xl !bg-white"
                  value={inferredType}
                  onChange={(event) => updateField('customerType', event.target.value)}
                >
                  {CUSTOMER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">GST / Business Info</h3>
                <p className="mt-1 text-sm text-slate-500">Optional details for B2B invoices and inter-state billing.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">GSTIN</span>
                <input
                  className="ds-input !rounded-2xl !bg-white uppercase"
                  value={form.gstin}
                  onChange={(event) => updateField('gstin', event.target.value)}
                  placeholder="Optional GSTIN"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">State code</span>
                <input
                  className="ds-input !rounded-2xl !bg-white"
                  value={form.stateCode}
                  onChange={(event) => updateField('stateCode', event.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="Optional 2-digit code"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className="ds-input min-h-[96px] !rounded-2xl !bg-white"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Optional notes for billing staff or follow-up"
              />
            </label>

            <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive !== false}
                onChange={(event) => updateField('isActive', event.target.checked)}
              />
              Customer is active for billing
            </label>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default CustomerFormDrawer
