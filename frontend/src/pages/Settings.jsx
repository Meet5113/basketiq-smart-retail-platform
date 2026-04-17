import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CreditCard, Settings2, ShieldCheck } from 'lucide-react'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { useToast } from '../context/ToastContext'

const GST_OPTIONS = [0, 5, 12, 18, 28]

const getInitialSettingsForm = () => ({
  business: {
    storeName: '',
    gstin: '',
    address: '',
    phone: '',
  },
  billing: {
    defaultGstRate: 5,
    currency: '₹',
  },
  pos: {
    allowNegativeStock: false,
    defaultWalkInCustomerId: '',
  },
})

function Settings() {
  const { showToast } = useToast()
  const [form, setForm] = useState(getInitialSettingsForm())
  const [walkInCustomers, setWalkInCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateSectionField = (section, field, value) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }))
  }

  const loadSettings = useCallback(async () => {
    setLoading(true)

    try {
      const [settingsResponse, customersResponse] = await Promise.all([
        api.get('/settings'),
        api.get('/customers', {
          params: {
            customerType: 'walk_in',
            status: 'active',
            sort: 'recent',
          },
        }),
      ])

      const settings = getApiResponseData(settingsResponse)
      const customerOptions = getApiArrayData(customersResponse)

      setWalkInCustomers(customerOptions)
      setForm({
        business: {
          storeName: settings?.business?.storeName || '',
          gstin: settings?.business?.gstin || '',
          address: settings?.business?.address || '',
          phone: settings?.business?.phone || '',
        },
        billing: {
          defaultGstRate: Number(settings?.billing?.defaultGstRate || 5),
          currency: settings?.billing?.currency || '₹',
        },
        pos: {
          allowNegativeStock: Boolean(settings?.pos?.allowNegativeStock),
          defaultWalkInCustomerId: String(settings?.pos?.defaultWalkInCustomerId || ''),
        },
      })
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load settings')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const selectedWalkInCustomer = useMemo(
    () => walkInCustomers.find((customer) => customer._id === form.pos.defaultWalkInCustomerId) || null,
    [form.pos.defaultWalkInCustomerId, walkInCustomers],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')

    try {
      const response = await api.put('/settings', {
        business: {
          storeName: form.business.storeName,
          gstin: form.business.gstin,
          address: form.business.address,
          phone: form.business.phone,
        },
        billing: {
          defaultGstRate: Number(form.billing.defaultGstRate || 0),
          currency: '₹',
        },
        pos: {
          allowNegativeStock: form.pos.allowNegativeStock,
          defaultWalkInCustomerId: form.pos.defaultWalkInCustomerId || null,
        },
      })

      const updatedSettings = getApiResponseData(response)
      setForm({
        business: {
          storeName: updatedSettings?.business?.storeName || '',
          gstin: updatedSettings?.business?.gstin || '',
          address: updatedSettings?.business?.address || '',
          phone: updatedSettings?.business?.phone || '',
        },
        billing: {
          defaultGstRate: Number(updatedSettings?.billing?.defaultGstRate || 5),
          currency: updatedSettings?.billing?.currency || '₹',
        },
        pos: {
          allowNegativeStock: Boolean(updatedSettings?.pos?.allowNegativeStock),
          defaultWalkInCustomerId: String(updatedSettings?.pos?.defaultWalkInCustomerId || ''),
        },
      })
      showToast('Settings updated successfully', 'success')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to update settings')
      setError(message)
      showToast(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Loading settings...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
              <Settings2 size={14} />
              Retail System Controls
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Settings</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep store identity, billing defaults, and POS behavior cleanly configured without turning BasketIQ into a heavy admin console.
            </p>
          </div>

          <button type="submit" form="settings-form" disabled={saving} className="ds-btn ds-btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

      <form id="settings-form" onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                <Building2 size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Business Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Store identity shown in billing, GST paperwork, and business records.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Store name</span>
                <input
                  value={form.business.storeName}
                  onChange={(event) => updateSectionField('business', 'storeName', event.target.value)}
                  className="ds-input !rounded-2xl"
                  placeholder="BasketIQ Store"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">GSTIN</span>
                  <input
                    value={form.business.gstin}
                    onChange={(event) => updateSectionField('business', 'gstin', event.target.value.toUpperCase())}
                    className="ds-input !rounded-2xl uppercase"
                    placeholder="Optional GSTIN"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Phone number</span>
                  <input
                    value={form.business.phone}
                    onChange={(event) => updateSectionField('business', 'phone', event.target.value)}
                    className="ds-input !rounded-2xl"
                    placeholder="Store contact number"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <textarea
                  value={form.business.address}
                  onChange={(event) => updateSectionField('business', 'address', event.target.value)}
                  className="ds-input min-h-[110px] !rounded-2xl"
                  placeholder="Store billing address"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Billing Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Keep currency and default tax handling simple and consistent for retail billing.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Default GST rate</span>
                <select
                  value={form.billing.defaultGstRate}
                  onChange={(event) => updateSectionField('billing', 'defaultGstRate', Number(event.target.value))}
                  className="ds-select !w-full !rounded-2xl"
                >
                  {GST_OPTIONS.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}%
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Currency</span>
                <input value="₹ (INR)" readOnly className="ds-input !rounded-2xl !bg-slate-50 text-slate-500" />
              </label>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">POS Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Control checkout behavior for stock risk and walk-in billing flow.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Allow negative stock</p>
                  <p className="mt-1 text-sm text-slate-500">If enabled, POS warns but still allows checkout when stock is short.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.pos.allowNegativeStock}
                  onChange={(event) => updateSectionField('pos', 'allowNegativeStock', event.target.checked)}
                  className="h-4 w-4"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Default walk-in customer</span>
                <select
                  value={form.pos.defaultWalkInCustomerId}
                  onChange={(event) => updateSectionField('pos', 'defaultWalkInCustomerId', event.target.value)}
                  className="ds-select !w-full !rounded-2xl"
                >
                  <option value="">No default walk-in customer</option>
                  {walkInCustomers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name} • {customer.phone}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current walk-in setup</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{selectedWalkInCustomer?.name || 'No default walk-in customer selected'}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedWalkInCustomer?.phone || 'Select an active walk-in customer from the list above.'}</p>
              </div>
            </div>
          </section>
      </form>
    </div>
  )
}

export default Settings
