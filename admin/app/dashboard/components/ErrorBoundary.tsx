'use client'
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode; tabName?: string }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  componentDidCatch(error: Error, info: any) { console.error(`[ErrorBoundary${this.props.tabName ? ' @ ' + this.props.tabName : ''}]`, error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
          <p className="text-sm text-rose-400 mb-1">Something went wrong{this.props.tabName ? ` in ${this.props.tabName}` : ''}</p>
          <p className="text-xs text-text-muted mb-3 max-w-sm">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-text-primary bg-surface border border-border hover:bg-surface/80">
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
