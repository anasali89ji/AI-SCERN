'use client'
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props  { children: ReactNode; fallback?: ReactNode }
interface State  { hasError: boolean; error?: Error }

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
          <div className="w-14 h-14 rounded-xl bg-[#FF4444]/10 border border-[#FF4444]/20
                          flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#FF4444]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Something went wrong</h3>
          <p className="text-[#A3A3A3] text-sm mb-6 max-w-sm leading-relaxed">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                       bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold
                       transition-colors duration-150"
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
