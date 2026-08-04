'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Wrench, Clock, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'

export default function MaintenanceContent() {
  const searchParams = useSearchParams()
  const [countdown, setCountdown] = useState('')
  const [dots, setDots] = useState('.')

  const message = decodeURIComponent(searchParams.get('msg') || 'We are currently performing scheduled maintenance to improve your experience.')
  const duration = decodeURIComponent(searchParams.get('dur') || '')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 600)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!duration) return
    const match = duration.match(/(\d+)\s*(hour|minute|min|hr|h|m)s?/i)
    if (match) {
      const num = parseInt(match[1])
      const unit = match[2].toLowerCase()
      let totalSeconds = unit.startsWith('h') ? num * 3600 : num * 60

      const timer = setInterval(() => {
        totalSeconds -= 1
        if (totalSeconds <= 0) {
          setCountdown('Should be back any moment!')
          clearInterval(timer)
          return
        }
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)
        const s = totalSeconds % 60
        setCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [duration])

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-blue-500/10 animate-pulse"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        <div className="relative inline-flex">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Wrench className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Under Maintenance{dots}
          </h1>
          <p className="text-base text-gray-400 leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Status</p>
              <p className="text-sm font-semibold text-amber-400">Maintenance Active</p>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Estimated</p>
              <p className="text-sm font-semibold text-blue-400">
                {duration || 'Soon'}
              </p>
            </div>
          </div>
        </div>

        {countdown && (
          <div className="rounded-xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Time Remaining</p>
            <p className="text-2xl font-mono font-bold text-blue-400">{countdown}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors shadow-lg shadow-blue-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        <p className="text-xs text-gray-600">
          We apologize for the inconvenience. Our team is working hard to get things back online.
        </p>
      </div>
    </div>
  )
}
