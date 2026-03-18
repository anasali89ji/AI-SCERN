'use client'
import Link from 'next/link'
import { Shield, ArrowLeft, Github, Mail, ExternalLink, MessageSquare } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black gradient-text">DETECTAI</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-text-primary mb-3">Get in <span className="gradient-text">Touch</span></h1>
          <p className="text-text-muted">Have a question, found a bug, or want to collaborate? Reach out.</p>
        </div>

        <div className="grid gap-4">
          <a href="mailto:contact@detectai.app"
            className="card hover:border-primary/30 transition-all flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-text-primary mb-0.5">Email</div>
              <div className="text-sm text-text-muted">contact@detectai.app</div>
            </div>
          </a>

          <a href="mailto:support@aiscern.com" target="_blank" rel="noopener noreferrer"
            className="card hover:border-primary/30 transition-all flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Github className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-text-primary mb-0.5">Support Tickets</div>
              <div className="text-sm text-text-muted">Bug reports &amp; feature requests</div>
            </div>
          </a>

          <Link href="/chat"
            className="card hover:border-emerald/30 transition-all flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald/20 transition-colors">
              <MessageSquare className="w-6 h-6 text-emerald" />
            </div>
            <div>
              <div className="font-semibold text-text-primary mb-0.5">AI Chat</div>
              <div className="text-sm text-text-muted">Ask our AI assistant anything about DETECTAI</div>
            </div>
          </Link>
        </div>

        <div className="mt-10 card border-border/50 text-center">
          <p className="text-text-muted text-sm">
            Built &amp; maintained by <span className="text-text-primary font-semibold">Anas Ali</span>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
