'use client'
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose/10 border border-rose/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h3>
          <p className="text-text-muted text-sm mb-6 max-w-sm">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
