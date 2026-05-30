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

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console so Vercel function logs capture it
    console.error('[ErrorBoundary] Section crashed:', error.message)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center border border-red-500/20 rounded-2xl bg-red-500/5 my-4">
          <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Section failed to load</h3>
          <p className="text-gray-400 text-sm mb-4 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
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
