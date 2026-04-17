export const CUSTOMER_TYPE_OPTIONS = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'regular', label: 'Regular' },
  { value: 'business', label: 'Business / GST' },
]

export const CUSTOMER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export const GST_FILTER_OPTIONS = [
  { value: '', label: 'All GST statuses' },
  { value: 'gst', label: 'GST Customers' },
  { value: 'non_gst', label: 'Non-GST' },
]

export const CUSTOMER_SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'highest_spend', label: 'Highest Spend' },
  { value: 'most_orders', label: 'Most Orders' },
]

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PHONE_REGEX = /^(?:\+?91)?[6-9]\d{9}$/
export const STATE_CODE_REGEX = /^[0-9]{2}$/

export const getInitialCustomerForm = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  stateCode: '',
  customerType: 'walk_in',
  notes: '',
  isActive: true,
})

export const normalizeOptionalText = (value) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

export const normalizePhone = (value) => {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(-10) : digits
}

export const formatPhoneDisplay = (value) => {
  const normalized = normalizePhone(value)
  if (normalized.length !== 10) {
    return value || 'N/A'
  }

  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`
}

export const getCustomerTypeLabel = (value) => {
  const option = CUSTOMER_TYPE_OPTIONS.find((item) => item.value === value)
  return option?.label || 'Regular'
}

export const getCustomerTypeClass = (value) => {
  if (value === 'walk_in') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (value === 'business') return 'border-violet-200 bg-violet-50 text-violet-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export const getCustomerStatusClass = (isActive) =>
  isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'

export const getGstStatusClass = (hasGstin) =>
  hasGstin ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'

export const getRepeatBuyerClass = (isRepeatCustomer) =>
  isRepeatCustomer ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600'

export const deriveCustomerType = ({ customerType, gstin }) => {
  if (String(gstin || '').trim()) {
    return 'business'
  }

  if (customerType === 'walk_in' || customerType === 'business') {
    return customerType
  }

  return 'regular'
}

export const buildCustomerPayload = (form) => {
  const name = String(form.name || '').trim()
  const phoneRaw = String(form.phone || '').trim()
  const phone = normalizePhone(phoneRaw)
  const email = normalizeOptionalText(form.email)?.toLowerCase() || null
  const address = normalizeOptionalText(form.address)
  const gstin = String(form.gstin || '').trim().toUpperCase()
  const inferredStateCode = gstin ? gstin.slice(0, 2) : ''
  const stateCodeInput = String(form.stateCode || '').trim().replace(/\D/g, '').slice(0, 2)
  const stateCode = stateCodeInput || inferredStateCode || null
  const notes = normalizeOptionalText(form.notes)
  const customerType = deriveCustomerType({
    customerType: String(form.customerType || '').trim().toLowerCase(),
    gstin,
  })

  if (!name) {
    throw new Error('Full name is required.')
  }

  if (!PHONE_REGEX.test(phoneRaw) && !PHONE_REGEX.test(phone)) {
    throw new Error('Phone number must be a valid 10-digit Indian mobile number.')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.')
  }

  if (gstin && !GSTIN_REGEX.test(gstin)) {
    throw new Error('GSTIN must be in a valid 15-character format.')
  }

  if (stateCode && !STATE_CODE_REGEX.test(stateCode)) {
    throw new Error('State code must be a valid two-digit value.')
  }

  return {
    name,
    phone,
    email,
    address,
    gstin,
    stateCode,
    customerType,
    notes,
    isActive: form.isActive !== false,
  }
}

export const formatCustomerCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

export const formatCustomerDate = (value) => {
  if (!value) return 'N/A'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
