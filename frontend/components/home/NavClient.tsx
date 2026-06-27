'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } 
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
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-[background-color,border-color,box-shadow,transform] duration-200
        ${hidden ? 'nav-hidden' : 'nav-visible'}
        ${scrolled
          ? 'border-b border-white/[0.08] bg-[#08080d]'
          : 'border-b border-transparent bg-[#08080d]'
        }`}
    >
      <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto h-full px-4 sm:px-6 2xl:px-10 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group" title="Aiscern — Free AI Content Detector">
          <span className="font-black text-xl gradient-text">Aiscern</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
          {[['/#tools', 'Tools'], ['/#how', 'How It Works']].map(([href, label]) => (
            <a key={href} href={href} className="relative hover:text-slate-100 transition-colors duration-200 group">
              {label}
              <span className="hidden" />
            </a>
          ))}
          <Link href={user ? '/chat' : '/signup'} className="relative hover:text-slate-100 transition-colors duration-200 group flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />AI Chat
            <span className="hidden" />
          </Link>
          {['/reviews', '/blog', '/pricing'].map(href => (
            <Link key={href} href={href} className="relative hover:text-slate-100 transition-colors duration-200 group capitalize">
              {href.slice(1)}
              <span className="hidden" />
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-600/20 transition-[background-color,border-color] duration-200 group">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
              </span>
              <span className="hidden sm:inline">Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] text-sm font-semibold text-slate-100 hover:bg-[#141420] hover:border-white/[0.12] transition-[background-color,border-color] duration-200">
                Sign In
              </Link>
              <Link href="/signup" className="relative overflow-hidden flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold transition-[transform,box-shadow] duration-200"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}
          <button
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface text-slate-500 hover:text-slate-100 transition-colors"
            onClick={() => setMobileNavOpen(o => !o)}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
          >
            
              {mobileNavOpen
                ? <div><X className="w-5 h-5" /></div>
                : <div><Menu className="w-5 h-5" /></div>
              }
            
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      
        {mobileNavOpen && (
          <div> e.key === 'Escape' && setMobileNavOpen(false)}
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
                <div>
                  <Link href={link.href} onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-slate-500 hover:text-slate-100 transition-colors text-sm font-medium">
                    <link.Icon className="w-4 h-4" />{link.label}
                  </Link>
                </div>
              ))}
              {!loading && !user && (
                <div>
                  <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-slate-500 hover:text-slate-100 transition-colors text-sm font-medium">
                    <Lock className="w-4 h-4" />Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileNavOpen(false)} className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                    <Zap className="w-4 h-4" />Get Started Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      
    </nav>
  )
}
