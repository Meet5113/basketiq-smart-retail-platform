import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, errorInfo) {
    const label = this.props.pageName || 'Application'

    console.error(`${label} crashed inside ErrorBoundary`, {
      error,
      componentStack: errorInfo?.componentStack || '',
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const label = this.props.pageName || 'This page'
    const message = this.state.error?.message || 'An unexpected error occurred.'

    return (
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Something went wrong</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{label} could not be displayed.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The rest of the app is still available. Try reloading this page or navigating back to continue working.
        </p>
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ds-btn ds-btn-primary"
          >
            Reload Page
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="ds-btn ds-btn-secondary"
          >
            Go Back
          </button>
        </div>
      </section>
    )
  }
}

export default ErrorBoundary
