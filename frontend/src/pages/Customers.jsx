import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, Search, Sparkles, UserPlus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useConfirmDialog } from '../context/ConfirmDialogContext'
import { useToast } from '../context/ToastContext'
import CustomerDetailDrawer from '../components/customers/CustomerDetailDrawer'
import CustomerFormDrawer from '../components/customers/CustomerFormDrawer'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { getToken } from '../utils/auth'
import {
  CUSTOMER_SORT_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  formatCustomerCurrency,
  formatCustomerDate,
  formatPhoneDisplay,
  getCustomerStatusClass,
  getCustomerTypeClass,
  getCustomerTypeLabel,
  getGstStatusClass,
  getRepeatBuyerClass,
  getInitialCustomerForm,
  GST_FILTER_OPTIONS,
} from '../utils/customerModule'

const normalizePhoneSearch = (value) =>
  String(value || '')
    .replace(/\D/g, '')
    .trim()

function Customers() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('')
  const [gstFilter, setGstFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [formDrawerState, setFormDrawerState] = useState({
    open: false,
    mode: 'create',
    customer: getInitialCustomerForm(),
  })
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const customerList = useMemo(() => (Array.isArray(customers) ? customers : []), [customers])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/customers')
      setCustomers(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load customers')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    fetchCustomers()
  }, [fetchCustomers, navigate])

  const openCreateDrawer = () => {
    setFormDrawerState({
      open: true,
      mode: 'create',
      customer: {
        ...getInitialCustomerForm(),
        customerType: 'regular',
      },
    })
  }

  const openEditDrawer = () => {
    if (!selectedCustomer) return

    setDetailDrawerOpen(false)
    setFormDrawerState({
      open: true,
      mode: 'edit',
      customer: selectedCustomer,
    })
  }

  const closeFormDrawer = () => {
    setFormDrawerState((current) => ({ ...current, open: false }))
  }

  const openCustomerDetail = useCallback(
    async (customerId) => {
      if (!customerId) return

      setDetailDrawerOpen(true)
      setDetailLoading(true)

      try {
        const response = await api.get(`/customers/${customerId}`)
        setSelectedCustomer(getApiResponseData(response))
      } catch (apiError) {
        const message = getApiErrorMessage(apiError, 'Failed to load customer details')
        setError(message)
        showToast(message)
      } finally {
        setDetailLoading(false)
      }
    },
    [showToast],
  )

  const handleSubmitCustomer = async (payload) => {
    setSavingCustomer(true)
    setError('')

    try {
      const response =
        formDrawerState.mode === 'edit' && formDrawerState.customer?._id
          ? await api.put(`/customers/${formDrawerState.customer._id}`, payload)
          : await api.post('/customers', payload)

      const savedCustomer = getApiResponseData(response)
      closeFormDrawer()
      await fetchCustomers()

      if (savedCustomer?._id) {
        await openCustomerDetail(savedCustomer._id)
      }

      showToast(
        formDrawerState.mode === 'edit' ? 'Customer updated successfully' : 'Customer created successfully',
        'success',
      )

      return true
    } catch (apiError) {
      const message = getApiErrorMessage(
        apiError,
        formDrawerState.mode === 'edit' ? 'Failed to update customer' : 'Failed to create customer',
      )
      setError(message)
      showToast(message)
      return false
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleToggleCustomerStatus = useCallback(async () => {
    if (!selectedCustomer?._id) return

    const nextActive = !selectedCustomer.isActive
    const shouldContinue = await confirm({
      title: `${nextActive ? 'Activate' : 'Mark inactive'} ${selectedCustomer.name}?`,
      description: nextActive
        ? 'This customer will become available in POS and customer selection again.'
        : 'This customer will remain in history but will be marked inactive for operational use.',
      confirmLabel: nextActive ? 'Activate customer' : 'Mark inactive',
      cancelLabel: 'Cancel',
      tone: nextActive ? 'info' : 'warning',
    })

    if (!shouldContinue) return

    try {
      const response = await api.patch(`/customers/${selectedCustomer._id}/status`, {
        isActive: nextActive,
      })
      const updatedCustomer = getApiResponseData(response)
      setSelectedCustomer((current) =>
        current
          ? {
              ...updatedCustomer,
              recentOrders: current.recentOrders,
            }
          : updatedCustomer,
      )
      await fetchCustomers()
      showToast(`Customer ${nextActive ? 'activated' : 'marked inactive'} successfully`, 'success')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to update customer status')
      setError(message)
      showToast(message)
    }
  }, [confirm, fetchCustomers, selectedCustomer, showToast])

  const handleUseInPos = useCallback(
    (customer = selectedCustomer) => {
      if (!customer?._id) return
      navigate(`/pos?customerId=${customer._id}`)
    },
    [navigate, selectedCustomer],
  )

  const handleViewOrders = useCallback(() => {
    if (!selectedCustomer?._id) {
      navigate('/orders')
      return
    }

    navigate(`/orders?customerId=${selectedCustomer._id}`)
  }, [navigate, selectedCustomer])

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()
    const normalizedPhoneQuery = normalizePhoneSearch(searchText)

    const nextCustomers = customerList.filter((customer) => {
      const textHaystack = [customer.name, customer.phone, customer.email]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
      const phoneHaystack = normalizePhoneSearch(customer.phone)

      const matchesSearch =
        !normalizedSearch ||
        textHaystack.includes(normalizedSearch) ||
        (normalizedPhoneQuery && phoneHaystack.includes(normalizedPhoneQuery))
      const matchesType = !customerTypeFilter || customer.customerType === customerTypeFilter
      const matchesGst = !gstFilter || customer.gstStatus === gstFilter
      const matchesStatus =
        !statusFilter || (statusFilter === 'active' ? customer.isActive : !customer.isActive)

      return matchesSearch && matchesType && matchesGst && matchesStatus
    })

    return [...nextCustomers].sort((left, right) => {
      if (sortBy === 'highest_spend') {
        return Number(right.totalSpend || 0) - Number(left.totalSpend || 0)
      }

      if (sortBy === 'most_orders') {
        return Number(right.orderCount || 0) - Number(left.orderCount || 0)
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    })
  }, [customerList, customerTypeFilter, gstFilter, searchText, sortBy, statusFilter])

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
              <Sparkles size={14} />
              Smart Retail Customer Workspace
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Customers</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Manage retail buyers, GST customers, repeat purchase visibility, and billing-ready profiles in one professional workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openCreateDrawer} className="ds-btn ds-btn-primary">
              <UserPlus size={16} className="mr-1.5" />
              Add Customer
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Customer Directory</h2>
                  <p className="mt-1 text-sm text-slate-500">Search, segment, and open customer profiles for billing and repeat-buyer review.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Filter size={14} />
                  {filteredCustomers.length} visible
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_180px_180px_160px_160px]">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search customer name or phone"
                    className="ds-input !rounded-2xl !py-3 !pl-9"
                  />
                </div>

                <select value={customerTypeFilter} onChange={(event) => setCustomerTypeFilter(event.target.value)} className="ds-select !w-full !rounded-2xl !py-3">
                  <option value="">All types</option>
                  {CUSTOMER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select value={gstFilter} onChange={(event) => setGstFilter(event.target.value)} className="ds-select !w-full !rounded-2xl !py-3">
                  {GST_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || 'all-gst'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ds-select !w-full !rounded-2xl !py-3">
                  {CUSTOMER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all-status'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="ds-select !w-full !rounded-2xl !py-3">
                  {CUSTOMER_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="p-5">
                <TableSkeleton columns={8} rows={8} />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                  <Users size={22} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">No customers found</h3>
                <p className="mt-2 text-sm text-slate-500">Try a different filter combination or add a new customer for POS and billing.</p>
                <button type="button" onClick={openCreateDrawer} className="ds-btn ds-btn-primary mt-5">
                  <UserPlus size={16} className="mr-1.5" />
                  Add Customer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Name</th>
                      <th className="px-3 py-3.5 font-semibold">Phone</th>
                      <th className="px-3 py-3.5 font-semibold">Customer Type</th>
                      <th className="px-3 py-3.5 font-semibold">GST Status</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Total Orders</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Total Spend</th>
                      <th className="px-3 py-3.5 font-semibold">Last Purchase</th>
                      <th className="px-3 py-3.5 font-semibold">City / State</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer, index) => (
                      <tr
                        key={customer._id}
                        onClick={() => openCustomerDetail(customer._id)}
                        className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/80 ${
                          index % 2 === 1 ? 'bg-slate-50/35' : 'bg-white'
                        }`}
                      >
                        <td className="px-5 py-4 align-middle">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{customer.name}</p>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getCustomerStatusClass(customer.isActive)}`}>
                                {customer.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {customer.isRepeatCustomer ? (
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getRepeatBuyerClass(true)}`}>
                                  Repeat Buyer
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{customer.email || 'No email'} </p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-middle text-slate-700">{formatPhoneDisplay(customer.phone)}</td>
                        <td className="px-3 py-4 align-middle">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCustomerTypeClass(customer.customerType)}`}>
                            {getCustomerTypeLabel(customer.customerType)}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGstStatusClass(Boolean(customer.gstin))}`}>
                            {customer.gstin ? 'GST Customer' : 'Non-GST'}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right align-middle font-semibold text-slate-900">{customer.orderCount || 0}</td>
                        <td className="px-3 py-4 text-right align-middle font-semibold text-slate-900">{formatCustomerCurrency(customer.totalSpend)}</td>
                        <td className="px-3 py-4 align-middle text-slate-700">{formatCustomerDate(customer.lastPurchaseDate)}</td>
                        <td className="px-3 py-4 align-middle text-slate-700">{customer.cityStateLabel || 'N/A'}</td>
                        <td className="px-5 py-4 text-right align-middle">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                openCustomerDetail(customer._id)
                              }}
                              className="ds-btn ds-btn-secondary !px-3 !py-2 !text-xs"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleUseInPos(customer)
                              }}
                              className="ds-btn ds-btn-primary !px-3 !py-2 !text-xs"
                            >
                              Use in POS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </section>

      <CustomerFormDrawer
        key={`${formDrawerState.mode}-${formDrawerState.customer?._id || 'new'}-${formDrawerState.open ? 'open' : 'closed'}`}
        open={formDrawerState.open}
        mode={formDrawerState.mode}
        initialData={formDrawerState.customer}
        submitting={savingCustomer}
        onClose={closeFormDrawer}
        onSubmit={handleSubmitCustomer}
      />

      <CustomerDetailDrawer
        open={detailDrawerOpen}
        customer={selectedCustomer}
        loading={detailLoading}
        onClose={() => setDetailDrawerOpen(false)}
        onEdit={openEditDrawer}
        onUseInPos={() => handleUseInPos(selectedCustomer)}
        onToggleActive={handleToggleCustomerStatus}
        onViewOrders={handleViewOrders}
      />
    </div>
  )
}

export default Customers
