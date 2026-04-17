/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const ConfirmDialogContext = createContext(null)

const defaultOptions = {
  title: 'Confirm action',
  description: 'Are you sure you want to continue?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
}

function ConfirmDialogProvider({ children }) {
  const resolverRef = useRef(null)
  const [dialogOptions, setDialogOptions] = useState(null)

  const closeDialog = (value) => {
    if (resolverRef.current) {
      resolverRef.current(value)
      resolverRef.current = null
    }

    setDialogOptions(null)
  }

  const confirm = (options = {}) =>
    new Promise((resolve) => {
      resolverRef.current = resolve
      setDialogOptions({
        ...defaultOptions,
        ...options,
      })
    })

  const value = useMemo(
    () => ({
      confirm,
      closeDialog,
    }),
    [],
  )

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={Boolean(dialogOptions)}
        title={dialogOptions?.title}
        description={dialogOptions?.description}
        confirmLabel={dialogOptions?.confirmLabel}
        cancelLabel={dialogOptions?.cancelLabel}
        tone={dialogOptions?.tone}
        onConfirm={() => closeDialog(true)}
        onCancel={() => closeDialog(false)}
      />
    </ConfirmDialogContext.Provider>
  )
}

const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext)

  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  }

  return context
}

export { ConfirmDialogProvider, useConfirmDialog }
