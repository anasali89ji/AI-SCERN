'use client'
/**
 * MobileResultSheet — Fix 4.3
 *
 * A full-screen bottom sheet for displaying detection results on mobile (< lg).
 * On desktop screens the sheet is never rendered — results stay inline.
 *
 * Usage:
 *   <MobileResultSheet isOpen={!!result} onClose={() => setResult(null)} title="Scan Result">
 *     <ResultCard data={result} />
 *   </MobileResultSheet>
 */
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface MobileResultSheetProps {
  isOpen:   boolean
  onClose:  () => void
  children: React.ReactNode
  title:    string
}

export function MobileResultSheet({ isOpen, onClose, children, title }: MobileResultSheetProps) {
  // Lock body scroll while sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — mobile only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 bg-black/70 z-[70]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-[75] bg-[#0a0a12] rounded-t-3xl border-t border-border overflow-hidden"
            style={{
              maxHeight: '90dvh',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border/40">
              <h3 className="font-bold text-text-primary">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-surface-active text-text-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90dvh - 80px)' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
