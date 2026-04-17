import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ProductDiscoveryPanel from '../components/pos/ProductDiscoveryPanel'
import BillingPanel from '../components/pos/BillingPanel'
import InvoicePreviewModal from '../components/pos/InvoicePreviewModal'
import CustomerFormDrawer from '../components/customers/CustomerFormDrawer'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { getToken } from '../utils/auth'
import { useToast } from '../context/ToastContext'
import { estimateCartTotals } from '../utils/gstInvoice'
import { getInitialCustomerForm, normalizePhone } from '../utils/customerModule'

const DEFAULT_SHOP_NAME = import.meta.env.VITE_SHOP_NAME || 'BasketIQ Store'
const DEFAULT_SHOP_GST_NUMBER = import.meta.env.VITE_SHOP_GST_NUMBER || '27ABCDE1234F1Z5'
const DEFAULT_SHOP_STATE_CODE = import.meta.env.VITE_SHOP_STATE_CODE || '27'

const normalizeDiscountType = (value) => (String(value || 'flat').toLowerCase() === 'percent' ? 'percent' : 'flat')

const normalizeNumber = (value) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

const calculateDiscountAmount = ({ amount, discountType, discountValue }) => {
  const normalizedAmount = Math.max(0, Number(amount) || 0)
  const normalizedType = normalizeDiscountType(discountType)
  const normalizedValue = normalizeNumber(discountValue)

  if (normalizedAmount <= 0 || normalizedValue <= 0) {
    return 0
  }

  if (normalizedType === 'percent') {
    const safePercent = Math.min(normalizedValue, 100)
    return (normalizedAmount * safePercent) / 100
  }

  return Math.min(normalizedValue, normalizedAmount)
}

function POS() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const searchInputRef = useRef(null)
  const checkoutLockRef = useRef(false)
  const hasAppliedDefaultWalkInRef = useRef(false)

  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [splitCashInput, setSplitCashInput] = useState('0')
  const [splitUpiInput, setSplitUpiInput] = useState('0')
  const [cart, setCart] = useState({})
  const [supplyType, setSupplyType] = useState('intra')
  const [placeOfSupplyInput, setPlaceOfSupplyInput] = useState(DEFAULT_SHOP_STATE_CODE)
  const [cartDiscountType, setCartDiscountType] = useState('flat')
  const [cartDiscountValue, setCartDiscountValue] = useState('0')
  const [searchText, setSearchText] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [highlightedProductId, setHighlightedProductId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previewInvoice, setPreviewInvoice] = useState(null)
  const [insufficientStockMode, setInsufficientStockMode] = useState('block')
  const [defaultWalkInCustomerId, setDefaultWalkInCustomerId] = useState('')
  const [quickCustomerDrawerOpen, setQuickCustomerDrawerOpen] = useState(false)
  const [savingQuickCustomer, setSavingQuickCustomer] = useState(false)
  const [shopName, setShopName] = useState(DEFAULT_SHOP_NAME)
  const [shopGstNumber, setShopGstNumber] = useState(DEFAULT_SHOP_GST_NUMBER)
  const [shopStateCode, setShopStateCode] = useState(DEFAULT_SHOP_STATE_CODE)
  const [billingDefaultGstRate, setBillingDefaultGstRate] = useState(5)
  const [defaultWalkInCustomerLabel, setDefaultWalkInCustomerLabel] = useState('')

  const focusProductSearch = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/products')
      setProducts(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load products')
      setError(message)
      showToast(message)
    }
  }, [showToast])

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await api.get('/customers')
      setCustomers(getApiArrayData(response))
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to load customers'))
    }
  }, [showToast])

  const fetchPosSettings = useCallback(async () => {
    try {
      const response = await api.get('/pos/settings')
      setInsufficientStockMode(response?.insufficientStockMode === 'warn' ? 'warn' : 'block')
      setDefaultWalkInCustomerId(String(response?.defaultWalkInCustomerId || ''))
      setDefaultWalkInCustomerLabel(String(response?.defaultWalkInCustomer?.name || ''))
      setShopName(String(response?.business?.storeName || DEFAULT_SHOP_NAME))
      setShopGstNumber(String(response?.business?.gstin || DEFAULT_SHOP_GST_NUMBER))
      setShopStateCode(String(response?.business?.stateCode || DEFAULT_SHOP_STATE_CODE))
      setBillingDefaultGstRate(Number(response?.billing?.defaultGstRate || 5))
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to load POS stock settings'))
    }
  }, [showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    let isActive = true

    const loadData = async () => {
      setLoading(true)

      await Promise.all([fetchProducts(), fetchCustomers(), fetchPosSettings()])

      if (isActive) {
        setLoading(false)
      }
    }

    void loadData()

    return () => {
      isActive = false
    }
  }, [fetchCustomers, fetchPosSettings, fetchProducts, navigate])

  useEffect(() => {
    focusProductSearch()
  }, [focusProductSearch])

  const productList = useMemo(
    () =>
      (Array.isArray(products) ? products : []).map((product) => ({
        ...product,
        price: Number(product.sellingPrice ?? product.price) || 0,
        stock: Number(product.stock) || 0,
        gstRate: Number.isFinite(Number(product.gstRate)) ? Number(product.gstRate) : billingDefaultGstRate,
      })),
    [billingDefaultGstRate, products],
  )

  const customerList = useMemo(
    () =>
      (Array.isArray(customers) ? customers : [])
        .filter((customer) => customer?.isActive !== false)
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
    [customers],
  )
  const selectedCustomer = useMemo(
    () => customerList.find((customer) => customer._id === selectedCustomerId) || null,
    [customerList, selectedCustomerId],
  )

  const handleCustomerChange = useCallback((nextCustomerId) => {
    setSelectedCustomerId(String(nextCustomerId || ''))
    setError('')
    setSuccessMessage('')
  }, [])

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomerId('')
    setError('')
    setSuccessMessage('')
  }, [])

  useEffect(() => {
    if (selectedCustomerId && !selectedCustomer) {
      setSelectedCustomerId('')
      setError('')
    }
  }, [selectedCustomer, selectedCustomerId])

  useEffect(() => {
    if (!selectedCustomer) {
      setSupplyType('intra')
      setPlaceOfSupplyInput(shopStateCode)
      return
    }

    const customerStateCode = String(selectedCustomer.stateCode || '').trim()

    if (selectedCustomer.gstin || customerStateCode) {
      const nextSupplyType = customerStateCode && customerStateCode !== shopStateCode ? 'inter' : 'intra'
      setSupplyType(nextSupplyType)
      setPlaceOfSupplyInput(nextSupplyType === 'inter' ? customerStateCode || shopStateCode : shopStateCode)
      return
    }

    if (supplyType === 'intra') {
      setPlaceOfSupplyInput(shopStateCode)
    }
  }, [selectedCustomer, shopStateCode, supplyType])

  useEffect(() => {
    const preferredCustomerId = searchParams.get('customerId') || ''

    if (!preferredCustomerId) {
      return
    }

    if (customerList.some((customer) => customer._id === preferredCustomerId)) {
      setSelectedCustomerId(preferredCustomerId)
      hasAppliedDefaultWalkInRef.current = true
    }
  }, [customerList, searchParams])

  useEffect(() => {
    const preferredCustomerId = searchParams.get('customerId') || ''

    if (preferredCustomerId || hasAppliedDefaultWalkInRef.current || selectedCustomerId || !defaultWalkInCustomerId) {
      return
    }

    if (customerList.some((customer) => customer._id === defaultWalkInCustomerId)) {
      setSelectedCustomerId(defaultWalkInCustomerId)
      hasAppliedDefaultWalkInRef.current = true
    }
  }, [customerList, defaultWalkInCustomerId, searchParams, selectedCustomerId])

  const availableStockMap = useMemo(() => {
    const map = new Map()

    productList.forEach((product) => {
      map.set(product._id, Number(product.stock) || 0)
    })

    return map
  }, [productList])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()
    const sellableProducts = productList.filter((product) => {
      const isActive = String(product.status || 'active').toLowerCase() === 'active'
      const hasSellableStock = insufficientStockMode === 'warn' || Number(product.stock || 0) > 0

      return isActive && hasSellableStock
    })

    const filtered = !normalizedSearch
      ? sellableProducts
      : sellableProducts.filter((product) => {
          const haystack = [product.name, product.sku, product.barcode, product.category]
            .map((value) => String(value || '').toLowerCase())
            .join(' ')

          return haystack.includes(normalizedSearch)
        })

    return [...filtered].sort((left, right) => {
      const leftScore = Number(left.stock || 0) > 0 ? 1 : 0
      const rightScore = Number(right.stock || 0) > 0 ? 1 : 0

      if (leftScore !== rightScore) {
        return rightScore - leftScore
      }

      return String(left.name || '').localeCompare(String(right.name || ''))
    })
  }, [insufficientStockMode, productList, searchText])

  useEffect(() => {
    if (filteredProducts.length === 0) {
      setHighlightedProductId('')
      return
    }

    if (!filteredProducts.some((product) => product._id === highlightedProductId)) {
      setHighlightedProductId(filteredProducts[0]._id)
    }
  }, [filteredProducts, highlightedProductId])

  const barcodeLookupMap = useMemo(() => {
    const map = new Map()

    filteredProducts.forEach((product) => {
      ;[product.barcode, product.sku]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .forEach((value) => {
          if (!map.has(value)) {
            map.set(value, product)
          }
        })
    })

    return map
  }, [filteredProducts])

  const cartItems = useMemo(() => Object.values(cart), [cart])

  const cartLineItems = useMemo(
    () =>
      cartItems.map((item) => {
        const lineTotal = item.price * item.quantity
        const itemDiscountAmount = calculateDiscountAmount({
          amount: lineTotal,
          discountType: item.discountType,
          discountValue: item.discountValue,
        })

        return {
          ...item,
          lineTotal,
          itemDiscountAmount,
          finalLineTotal: Math.max(lineTotal - itemDiscountAmount, 0),
        }
      }),
    [cartItems],
  )

  const subtotal = useMemo(() => cartLineItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartLineItems])
  const itemDiscountTotal = useMemo(
    () => cartLineItems.reduce((sum, item) => sum + item.itemDiscountAmount, 0),
    [cartLineItems],
  )
  const subtotalAfterItemDiscount = useMemo(() => Math.max(subtotal - itemDiscountTotal, 0), [itemDiscountTotal, subtotal])
  const cartDiscountAmount = useMemo(
    () =>
      calculateDiscountAmount({
        amount: subtotalAfterItemDiscount,
        discountType: cartDiscountType,
        discountValue: cartDiscountValue,
      }),
    [cartDiscountType, cartDiscountValue, subtotalAfterItemDiscount],
  )
  const estimatedInvoiceTotals = useMemo(
    () =>
      estimateCartTotals({
        items: cartLineItems,
        cartDiscountAmount,
        supplyType,
      }),
    [cartDiscountAmount, cartLineItems, supplyType],
  )

  const summary = useMemo(
    () => ({
      subtotal,
      itemDiscountTotal,
      cartDiscountAmount,
      taxableAmount: estimatedInvoiceTotals.taxableAmount,
      cgstAmount: estimatedInvoiceTotals.cgstAmount,
      sgstAmount: estimatedInvoiceTotals.sgstAmount,
      igstAmount: estimatedInvoiceTotals.igstAmount,
      gstAmount: estimatedInvoiceTotals.totalTaxAmount,
      finalAmount: estimatedInvoiceTotals.finalAmount,
    }),
    [cartDiscountAmount, estimatedInvoiceTotals, itemDiscountTotal, subtotal],
  )

  const resetCheckoutForm = useCallback(() => {
    setCart({})
    setCartDiscountType('flat')
    setCartDiscountValue('0')
    setSelectedCustomerId('')
    setPaymentMethod('cash')
    setSplitCashInput('0')
    setSplitUpiInput('0')
    setSupplyType('intra')
    setPlaceOfSupplyInput(shopStateCode)
    setSearchText('')
    setBarcodeInput('')
    setHighlightedProductId('')
    hasAppliedDefaultWalkInRef.current = false
  }, [shopStateCode])

  const addToCart = useCallback(
    (product) => {
      const isInactive = String(product.status || 'active').toLowerCase() !== 'active'
      const availableStock = availableStockMap.get(product._id) || 0
      let addedWithWarning = false

      if (isInactive) {
        showToast('Inactive products cannot be billed')
        return
      }

      if (insufficientStockMode !== 'warn' && availableStock <= 0) {
        showToast('This product is out of stock')
        return
      }

      let wasAdded = false

      setCart((prev) => {
        const existingItem = prev[product._id]
        const currentQuantity = existingItem?.quantity || 0
        const nextQuantity = currentQuantity + 1

        if (insufficientStockMode !== 'warn' && currentQuantity >= availableStock) {
          return prev
        }

        wasAdded = true
        addedWithWarning = insufficientStockMode === 'warn' && nextQuantity > availableStock

        return {
          ...prev,
          [product._id]: {
            productId: product._id,
            name: product.name,
            sku: product.sku || '',
            barcode: product.barcode || '',
            price: Number(product.sellingPrice ?? product.price) || 0,
            gstRate: Number(product.gstRate) || 0,
            taxType: product.taxType || 'exclusive',
            hsnCode: product.hsnCode || product.hsnSacCode || '',
            unit: product.unitType || 'unit',
            quantity: nextQuantity,
            discountType: existingItem?.discountType || 'flat',
            discountValue: existingItem?.discountValue ?? 0,
          },
        }
      })

      if (!wasAdded) {
        showToast(`Only ${availableStock} unit(s) available in stock`)
        return
      }

      if (addedWithWarning) {
        showToast('Added beyond available stock because POS is in warn mode', 'warning')
      }

      setError('')
      setSuccessMessage('')
      setSearchText('')
      setBarcodeInput('')
      focusProductSearch()
    },
    [availableStockMap, focusProductSearch, insufficientStockMode, showToast],
  )

  const updateCartQuantity = useCallback(
    (productId, changeBy) => {
      const availableStock = availableStockMap.get(productId) || 0
      let exceededAvailableStock = false

      setCart((prev) => {
        const existingItem = prev[productId]

        if (!existingItem) {
          return prev
        }

        const nextQuantity =
          insufficientStockMode === 'warn'
            ? Math.max(existingItem.quantity + changeBy, 0)
            : Math.min(Math.max(existingItem.quantity + changeBy, 0), availableStock)

        if (nextQuantity === 0) {
          const nextCart = { ...prev }
          delete nextCart[productId]
          return nextCart
        }

        exceededAvailableStock = insufficientStockMode === 'warn' && nextQuantity > availableStock

        return {
          ...prev,
          [productId]: {
            ...existingItem,
            quantity: nextQuantity,
          },
        }
      })

      if (exceededAvailableStock) {
        showToast('Cart quantity exceeds available stock. Checkout will continue only in warn mode.', 'warning')
      }

      setError('')
      setSuccessMessage('')
    },
    [availableStockMap, insufficientStockMode, showToast],
  )

  const updateItemDiscount = useCallback((productId, field, value) => {
    setCart((prev) => {
      const existingItem = prev[productId]

      if (!existingItem) {
        return prev
      }

      return {
        ...prev,
        [productId]: {
          ...existingItem,
          [field]: field === 'discountType' ? normalizeDiscountType(value) : normalizeNumber(value),
        },
      }
    })
  }, [])

  const removeCartItem = useCallback((productId) => {
    setCart((prev) => {
      if (!prev[productId]) {
        return prev
      }

      const nextCart = { ...prev }
      delete nextCart[productId]
      return nextCart
    })
    setError('')
    setSuccessMessage('')
  }, [])

  const tryAddProductByBarcode = useCallback(
    (rawBarcode) => {
      const normalizedBarcode = String(rawBarcode || '').trim().toLowerCase()

      if (!normalizedBarcode) {
        return false
      }

      const matchedProduct = barcodeLookupMap.get(normalizedBarcode)

      if (!matchedProduct) {
        return false
      }

      addToCart(matchedProduct)
      setHighlightedProductId(matchedProduct._id)
      return true
    },
    [addToCart, barcodeLookupMap],
  )

  const handleSearchKeyDown = useCallback(
    (event) => {
      if (filteredProducts.length === 0) {
        return
      }

      const activeIndex = filteredProducts.findIndex((product) => product._id === highlightedProductId)
      const safeIndex = activeIndex >= 0 ? activeIndex : 0

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = Math.min(safeIndex + 1, filteredProducts.length - 1)
        setHighlightedProductId(filteredProducts[nextIndex]._id)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = Math.max(safeIndex - 1, 0)
        setHighlightedProductId(filteredProducts[nextIndex]._id)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const productToAdd = filteredProducts[safeIndex]
        if (productToAdd) {
          addToCart(productToAdd)
        }
      }
    },
    [addToCart, filteredProducts, highlightedProductId],
  )

  const handleBarcodeKeyDown = useCallback(
    (event) => {
      if (event.key !== 'Enter') {
        return
      }

      event.preventDefault()

      const wasMatched = tryAddProductByBarcode(barcodeInput)

      if (!wasMatched && barcodeInput.trim()) {
        showToast('Barcode or SKU not found')
      }

      setBarcodeInput('')
      focusProductSearch()
    },
    [barcodeInput, focusProductSearch, showToast, tryAddProductByBarcode],
  )

  const handlePaymentMethodChange = useCallback(
    (nextMethod) => {
      setPaymentMethod(nextMethod)

      if (nextMethod === 'split') {
        setSplitCashInput(summary.finalAmount.toFixed(2))
        setSplitUpiInput('0')
      }
    },
    [summary.finalAmount],
  )

  const handleGenerateBill = useCallback(async () => {
    if (checkoutLockRef.current) {
      return
    }

    checkoutLockRef.current = true

    if (cartLineItems.length === 0) {
      const message = 'Add at least one item to generate bill'
      setError(message)
      setSuccessMessage('')
      showToast(message)
      checkoutLockRef.current = false
      return
    }

    const insufficientItem = cartLineItems.find((item) => item.quantity > (availableStockMap.get(item.productId) || 0))

    if (insufficientItem && insufficientStockMode !== 'warn') {
      const message = `Insufficient stock for ${insufficientItem.name}. Refresh product stock and try again.`
      setError(message)
      setSuccessMessage('')
      showToast(message)
      checkoutLockRef.current = false
      return
    }

    if (insufficientItem && insufficientStockMode === 'warn') {
      showToast(`Proceeding with stock warning for ${insufficientItem.name}`, 'warning')
    }

    const splitPayment = {
      cashAmount: normalizeNumber(splitCashInput),
      upiAmount: normalizeNumber(splitUpiInput),
    }
    const resolvedPlaceOfSupply =
      supplyType === 'inter' ? String(placeOfSupplyInput || selectedCustomer?.stateCode || '').trim() : String(shopStateCode).trim()

    if (supplyType === 'inter' && !resolvedPlaceOfSupply) {
      const message = 'Enter place of supply for inter-state billing'
      setError(message)
      setSuccessMessage('')
      showToast(message)
      checkoutLockRef.current = false
      return
    }

    if (paymentMethod === 'split') {
      const splitTotal = splitPayment.cashAmount + splitPayment.upiAmount

      if (splitTotal <= 0) {
        const message = 'Enter cash and/or UPI amount for split payment'
        setError(message)
        setSuccessMessage('')
        showToast(message)
        checkoutLockRef.current = false
        return
      }

      if (Math.abs(splitTotal - summary.finalAmount) > 0.05) {
        const message = `Split payment total must match final amount (${summary.finalAmount.toFixed(2)})`
        setError(message)
        setSuccessMessage('')
        showToast(message)
        checkoutLockRef.current = false
        return
      }
    }

    setSubmitting(true)
    setError('')
    setSuccessMessage('')
    setPreviewInvoice(null)

    try {
      const billingPayload = {
        items: cartLineItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          discountType: item.discountType,
          discountValue: Number(Number(item.discountValue || 0).toFixed(2)),
        })),
        cartDiscountType,
        cartDiscountValue: Number(Number(cartDiscountValue || 0).toFixed(2)),
        customerId: selectedCustomerId || undefined,
        paymentMethod,
        splitPayment,
        supplyType,
        placeOfSupply: resolvedPlaceOfSupply,
      }
      const order = await api.post('/orders', billingPayload)

      resetCheckoutForm()
      await Promise.allSettled([fetchProducts(), fetchCustomers()])

      if (order?._id) {
        try {
          const invoice = await api.get(`/orders/${order._id}/invoice`)
          setPreviewInvoice(invoice)
        } catch (invoiceError) {
          showToast(
            getApiErrorMessage(invoiceError, 'Bill saved, but invoice preview could not be loaded'),
            'warning',
          )
        }
      }

      const message = `Bill generated. Invoice: ${order?.invoiceNumber || 'N/A'}`
      setSuccessMessage(message)
      showToast(message, 'success')
      focusProductSearch()
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to generate bill')
      setError(message)
      setSuccessMessage('')
      showToast(message)
    } finally {
      setSubmitting(false)
      checkoutLockRef.current = false
    }
  }, [
    availableStockMap,
    cartDiscountType,
    cartDiscountValue,
    cartLineItems,
    fetchCustomers,
    fetchProducts,
    focusProductSearch,
    insufficientStockMode,
    paymentMethod,
    placeOfSupplyInput,
    resetCheckoutForm,
    selectedCustomer,
    selectedCustomerId,
    showToast,
    shopStateCode,
    splitCashInput,
    splitUpiInput,
    summary.finalAmount,
    supplyType,
  ])

  const handleQuickCustomerSubmit = useCallback(
    async (payload) => {
      const normalizedPhone = normalizePhone(payload.phone)
      const duplicateCustomer = customerList.find((customer) => normalizePhone(customer.phone) === normalizedPhone)

      if (duplicateCustomer?._id) {
        setSelectedCustomerId(duplicateCustomer._id)
        setQuickCustomerDrawerOpen(false)
        showToast(`Customer ${duplicateCustomer.name} already exists and has been selected for billing`, 'warning')
        return true
      }

      setSavingQuickCustomer(true)

      try {
        const response = await api.post('/customers', payload)
        const customer = getApiResponseData(response)
        await fetchCustomers()
        setSelectedCustomerId(customer?._id || '')
        setQuickCustomerDrawerOpen(false)
        showToast('Customer added and selected for billing', 'success')
        return true
      } catch (apiError) {
        showToast(getApiErrorMessage(apiError, 'Failed to add customer from POS'))
        return false
      } finally {
        setSavingQuickCustomer(false)
      }
    },
    [customerList, fetchCustomers, showToast],
  )

  return (
    <>
      <div className="pos-page">
        <section className="pos-layer flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Retail POS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">POS / Billing</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Search products, add items to cart, review GST and payment details, and generate a bill from one compact workspace.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 xl:min-w-[440px]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Cart</p>
              <p className="mt-1 font-semibold text-slate-950">{cartLineItems.length} line item(s)</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Walk-In</p>
              <p className="mt-1 font-semibold text-slate-950">
                {defaultWalkInCustomerId ? defaultWalkInCustomerLabel || 'Configured' : 'Supported'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Stock Policy</p>
              <p className="mt-1 font-semibold text-slate-950">{insufficientStockMode === 'warn' ? 'Warn' : 'Block'}</p>
            </div>
          </div>
        </section>

        {error ? (
          <p className="pos-layer rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
        ) : null}
        {successMessage ? (
          <p className="pos-layer rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</p>
        ) : null}
        {insufficientStockMode === 'warn' ? (
          <p className="pos-layer rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Warn mode is enabled. Checkout can continue when requested quantity is higher than available stock.
          </p>
        ) : null}

        <section className="pos-layer grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <ProductDiscoveryPanel
            loading={loading}
            products={filteredProducts}
            insufficientStockMode={insufficientStockMode}
            searchText={searchText}
            barcodeInput={barcodeInput}
            highlightedProductId={highlightedProductId}
            searchInputRef={searchInputRef}
            onSearchChange={setSearchText}
            onSearchKeyDown={handleSearchKeyDown}
            onBarcodeChange={setBarcodeInput}
            onBarcodeKeyDown={handleBarcodeKeyDown}
            onHighlightProduct={setHighlightedProductId}
            onAddProduct={addToCart}
            cartItems={cartLineItems}
            availableStockMap={availableStockMap}
            onUpdateCartQuantity={updateCartQuantity}
            onUpdateItemDiscount={updateItemDiscount}
            onRemoveCartItem={removeCartItem}
          />

          <BillingPanel
            customers={customerList}
            selectedCustomerId={selectedCustomerId}
            selectedCustomer={selectedCustomer}
            onCustomerChange={handleCustomerChange}
            onClearCustomer={handleClearCustomer}
            onOpenQuickAdd={() => setQuickCustomerDrawerOpen(true)}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={handlePaymentMethodChange}
            splitCashInput={splitCashInput}
            splitUpiInput={splitUpiInput}
            onSplitCashChange={setSplitCashInput}
            onSplitUpiChange={setSplitUpiInput}
            supplyType={supplyType}
            onSupplyTypeChange={setSupplyType}
            placeOfSupplyInput={placeOfSupplyInput}
            onPlaceOfSupplyChange={setPlaceOfSupplyInput}
            cartDiscountType={cartDiscountType}
            onCartDiscountTypeChange={setCartDiscountType}
            cartDiscountValue={cartDiscountValue}
            onCartDiscountValueChange={setCartDiscountValue}
            cartItems={cartLineItems}
            availableStockMap={availableStockMap}
            insufficientStockMode={insufficientStockMode}
            onUpdateCartQuantity={updateCartQuantity}
            onUpdateItemDiscount={updateItemDiscount}
            onRemoveCartItem={removeCartItem}
            summary={summary}
            submitting={submitting}
            onCheckout={handleGenerateBill}
          />
        </section>
      </div>

      <CustomerFormDrawer
        key={`pos-quick-customer-${quickCustomerDrawerOpen ? 'open' : 'closed'}`}
        open={quickCustomerDrawerOpen}
        mode="create"
        title="Quick Add Customer"
        subtitle="Create a billing-ready customer without leaving POS."
        initialData={{
          ...getInitialCustomerForm(),
          customerType: 'regular',
        }}
        submitting={savingQuickCustomer}
        onClose={() => setQuickCustomerDrawerOpen(false)}
        onSubmit={handleQuickCustomerSubmit}
      />

      <InvoicePreviewModal
        invoice={previewInvoice}
        shopName={shopName}
        shopGstNumber={shopGstNumber}
        onClose={() => setPreviewInvoice(null)}
        onError={showToast}
      />
    </>
  )
}

export default POS
