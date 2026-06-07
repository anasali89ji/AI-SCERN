'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import {
  Zap, ArrowRight, MessageSquare, FileText,
  Star, Menu, X, Lock, Cpu, Activity,
} from 'lucide-react'

function useNavScrollBehavior() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      if (y > lastY.current + 10 && y > 100) setHidden(true)
      else if (y < lastY.current - 5) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return { scrolled, hidden }
}

export default function NavClient() {
  const { user, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { scrolled, hidden } = useNavScrollBehavior()

  // iOS scroll lock
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [mobileNavOpen])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-[background-color,border-color,box-shadow,transform] duration-300
        ${hidden ? 'nav-hidden' : 'nav-visible'}
        ${scrolled
          ? 'border-b border-primary/10 bg-[#08080d]/95 sm:bg-background/88 sm:backdrop-blur-2xl shadow-lg shadow-black/20'
          : 'border-b border-transparent bg-[#08080d]/90 sm:bg-background/60 sm:backdrop-blur-xl'
        }`}
    >
      <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto h-full px-4 sm:px-6 2xl:px-10 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group" title="Aiscern — Free AI Content Detector">
          <Image src="/logo.png" alt="Aiscern logo" width={24} height={28}
            className="object-contain h-6 sm:h-7 w-auto drop-shadow-[0_0_8px_rgba(245,100,0,0.5)] group-hover:drop-shadow-[0_0_14px_rgba(245,100,0,0.7)] transition-[filter] duration-300" priority />
          <span className="font-semibold text-xl gradient-text">Aiscern</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
          {[['/#tools', 'Tools'], ['/#how', 'How It Works']].map(([href, label]) => (
            <a key={href} href={href} className="relative hover:text-text-primary transition-colors duration-200 group">
              {label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-gradient-to-r from-primary to-blue-500 group-hover:w-full transition-[width] duration-300 rounded-full" />
            </a>
          ))}
          <Link href={user ? '/chat' : '/signup'} className="relative hover:text-text-primary transition-colors duration-200 group flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />AI Chat
            <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-gradient-to-r from-emerald to-cyan group-hover:w-full transition-[width] duration-300 rounded-full" />
          </Link>
          {['/reviews', '/blog', '/pricing'].map(href => (
            <Link key={href} href={href} className="relative hover:text-text-primary transition-colors duration-200 group capitalize">
              {href.slice(1)}
              <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-gradient-to-r from-primary to-blue-500 group-hover:w-full transition-[width] duration-300 rounded-full" />
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-[background-color,border-color] duration-200 group">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
              </span>
              <span className="hidden sm:inline">Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-sm font-semibold text-text-primary hover:bg-surface-hover hover:border-primary/30 transition-[background-color,border-color] duration-200">
                Sign In
              </Link>
              <Link href="/signup" className="relative overflow-hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold shadow-lg shadow-primary/20 transition-[transform,box-shadow] duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}
          <button
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setMobileNavOpen(o => !o)}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileNavOpen
                ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.div>
                : <motion.div key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-5 h-5" /></motion.div>
              }
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            id="mobile-nav-panel"
            role="dialog"
            aria-label="Navigation menu"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden border-t border-white/5 bg-[#08080d] overflow-hidden"
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && setMobileNavOpen(false)}
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {[
                { href: '/#tools', label: 'Tools', Icon: Cpu },
                { href: '/#how', label: 'How It Works', Icon: Activity },
                { href: user ? '/chat' : '/signup', label: 'AI Detection Assistant', Icon: MessageSquare },
                { href: '/reviews', label: 'Reviews', Icon: Star },
                { href: '/blog', label: 'Blog', Icon: FileText },
                { href: '/pricing', label: 'Pricing', Icon: Zap },
              ].map((link, i) => (
                <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link href={link.href} onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-colors text-sm font-medium">
                    <link.Icon className="w-4 h-4" />{link.label}
                  </Link>
                </motion.div>
              ))}
              {!loading && !user && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
                  <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-colors text-sm font-medium">
                    <Lock className="w-4 h-4" />Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileNavOpen(false)} className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                    <Zap className="w-4 h-4" />Get Started Free
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
