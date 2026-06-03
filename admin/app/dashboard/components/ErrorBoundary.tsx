'use client'
import React from 'react'
import { AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'

interface State { hasError: boolean; error?: Error; open: boolean }
interface Props { children: React.ReactNode; tabName?: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, open: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, open: false }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    // Fire-and-forget log to server
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, tab: this.props.tabName }),
    }).catch(() => {})
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">
          Failed to load {this.props.tabName ?? 'this section'}
        </h3>
        <p className="text-sm text-text-muted mb-5">An unexpected error occurred. Try refreshing.</p>
        <button
          onClick={() => this.setState({ hasError: false, error: undefined, open: false })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
            focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
        {this.state.error && (
          <div className="mt-4 w-full max-w-lg">
            <button onClick={() => this.setState(s => ({ ...s, open: !s.open }))}
              className="flex items-center gap-1 text-xs text-text-disabled hover:text-text-muted transition-colors mx-auto">
              <ChevronDown className={`w-3 h-3 transition-transform ${this.state.open ? 'rotate-180' : ''}`} />
              Error details
            </button>
            {this.state.open && (
              <pre className="mt-2 p-3 rounded-xl text-left text-[10px] text-rose-300 overflow-auto max-h-40"
                style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
                {this.state.error.stack ?? this.state.error.message}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }
}
