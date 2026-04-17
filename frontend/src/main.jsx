import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import SessionEvents from './components/SessionEvents'
import { ConfirmDialogProvider } from './context/ConfirmDialogContext'
import { ToastProvider } from './context/ToastContext'
import Toast from './components/Toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmDialogProvider>
        <BrowserRouter>
          <SessionEvents />
          <App />
          <Toast />
        </BrowserRouter>
      </ConfirmDialogProvider>
    </ToastProvider>
  </StrictMode>,
)
