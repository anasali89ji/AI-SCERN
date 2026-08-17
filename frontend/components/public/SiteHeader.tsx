"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const productItems = {
  Detection: [
    { label: "AI Text Detector", href: "/product/text-detector", desc: "Linguistic analysis & model fingerprints" },
    { label: "AI Image Detector", href: "/product/image-detector", desc: "Frequency analysis & provenance" },
    { label: "AI Audio Detector", href: "/product/audio-detector", desc: "Spectral & synthetic voice analysis" },
    { label: "AI Video Detector", href: "/product/video-detector", desc: "Frame analysis & temporal consistency" },
    { label: "Deepfake Detection", href: "/product/deepfake", desc: "Multi-signal face & media forensics" },
    { label: "Batch Analyzer", href: "/product/batch", desc: "High-volume enterprise processing" },
  ],
  Platform: [
    { label: "Verification Engine", href: "/platform/engine", desc: "Core multimodal analysis pipeline" },
    { label: "Trust Reports", href: "/platform/reports", desc: "Explainable evidence & audit trails" },
    { label: "API", href: "/api-docs", desc: "RESTful API for integrations" },
    { label: "Enterprise", href: "/enterprise", desc: "SSO, SLA & dedicated infrastructure" },
  ],
};

const solutionItems = [
  { label: "Education", href: "/solutions/education" },
  { label: "HR & Recruiting", href: "/solutions/hr" },
  { label: "Media & Journalism", href: "/solutions/media" },
  { label: "Legal & Compliance", href: "/solutions/legal" },
  { label: "Security", href: "/solutions/security" },
  { label: "Research", href: "/solutions/research" },
  { label: "Enterprise", href: "/solutions/enterprise" },
];

const technologyItems = [
  { label: "How It Works", href: "/technology/how-it-works" },
  { label: "Methodology", href: "/technology/methodology" },
  { label: "Benchmarks", href: "/technology/benchmarks" },
  { label: "Research", href: "/research" },
  { label: "Transparency", href: "/trust/transparency" },
  { label: "Model Updates", href: "/technology/updates" },
];

const resourceItems = [
  { label: "Blog", href: "/blog" },
  { label: "Guides", href: "/guides" },
  { label: "Comparisons", href: "/comparisons" },
  { label: "FAQ", href: "/faq" },
  { label: "Reviews", href: "/reviews" },
  { label: "Changelog", href: "/changelog" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "API Docs", href: "/api-docs" },
];

export function SiteHeader() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleEnter = (menu: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menu);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveMenu(null), 150);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-aiscern-bg-primary/90 backdrop-blur-md border-b border-aiscern-border-subtle" : "bg-transparent"
    }`}>
      <div className="section-container">
        <div className="section-inner flex items-center justify-between h-16 lg:h-18">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aiscern-accent-cyan to-aiscern-accent-blue flex items-center justify-center">
              <span className="text-aiscern-bg-primary font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-lg tracking-tight group-hover:text-aiscern-accent-cyan transition-colors">AISCERN</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" onMouseLeave={handleLeave}>
            {["product","solutions","technology","resources"].map((key) => (
              <button key={key} onMouseEnter={() => handleEnter(key)}
                className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                  activeMenu === key ? "text-aiscern-accent-cyan" : "text-aiscern-text-secondary hover:text-aiscern-text-primary"
                }`}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
                {activeMenu === key && <motion.div layoutId="nav-underline" className="absolute bottom-0 left-3 right-3 h-px bg-aiscern-accent-cyan" />}
              </button>
            ))}
            <Link href="/pricing" className="px-3 py-2 text-sm font-medium text-aiscern-text-secondary hover:text-aiscern-text-primary transition-colors">Pricing</Link>
            <Link href="/enterprise" className="px-3 py-2 text-sm font-medium text-aiscern-text-secondary hover:text-aiscern-text-primary transition-colors">Enterprise</Link>
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-aiscern-text-secondary hover:text-aiscern-text-primary transition-colors">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold bg-aiscern-accent-cyan text-aiscern-bg-primary rounded-lg hover:bg-aiscern-accent-cyan/90 transition-colors">Start Free</Link>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-aiscern-text-secondary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {activeMenu && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }} onMouseEnter={() => activeMenu && handleEnter(activeMenu)} onMouseLeave={handleLeave}
            className="absolute top-full left-0 right-0 border-b border-aiscern-border-subtle bg-aiscern-bg-secondary/95 backdrop-blur-xl">
            <div className="section-container py-8">
              <div className="section-inner">
                {activeMenu === "product" && (
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h4 className="technical-label mb-4">Detection</h4>
                      <div className="space-y-1">
                        {productItems.Detection.map((item) => (
                          <Link key={item.label} href={item.href} onClick={() => setActiveMenu(null)}
                            className="flex flex-col p-3 rounded-lg hover:bg-aiscern-bg-surface transition-colors group">
                            <span className="text-sm font-medium text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{item.label}</span>
                            <span className="text-xs text-aiscern-text-muted">{item.desc}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="technical-label mb-4">Platform</h4>
                      <div className="space-y-1">
                        {productItems.Platform.map((item) => (
                          <Link key={item.label} href={item.href} onClick={() => setActiveMenu(null)}
                            className="flex flex-col p-3 rounded-lg hover:bg-aiscern-bg-surface transition-colors group">
                            <span className="text-sm font-medium text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{item.label}</span>
                            <span className="text-xs text-aiscern-text-muted">{item.desc}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeMenu === "solutions" && (
                  <div className="grid grid-cols-3 gap-4">
                    {solutionItems.map((item) => (
                      <Link key={item.label} href={item.href} onClick={() => setActiveMenu(null)}
                        className="p-4 rounded-lg border border-aiscern-border-subtle hover:border-aiscern-accent-cyan/30 hover:bg-aiscern-bg-surface transition-all group">
                        <span className="text-sm font-medium text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {activeMenu === "technology" && (
                  <div className="grid grid-cols-3 gap-4">
                    {technologyItems.map((item) => (
                      <Link key={item.label} href={item.href} onClick={() => setActiveMenu(null)}
                        className="p-4 rounded-lg border border-aiscern-border-subtle hover:border-aiscern-accent-cyan/30 hover:bg-aiscern-bg-surface transition-all group">
                        <span className="text-sm font-medium text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {activeMenu === "resources" && (
                  <div className="grid grid-cols-4 gap-4">
                    {resourceItems.map((item) => (
                      <Link key={item.label} href={item.href} onClick={() => setActiveMenu(null)}
                        className="p-3 rounded-lg hover:bg-aiscern-bg-surface transition-colors group">
                        <span className="text-sm font-medium text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-aiscern-bg-secondary border-b border-aiscern-border-subtle overflow-hidden">
            <div className="section-container py-6 space-y-4">
              {["Product","Solutions","Technology","Resources","Pricing","Enterprise"].map((item) => (
                <Link key={item} href={`/${item.toLowerCase()}`} onClick={() => setMobileOpen(false)}
                  className="block text-lg font-medium text-aiscern-text-primary">{item}</Link>
              ))}
              <div className="pt-4 border-t border-aiscern-border-subtle flex flex-col gap-3">
                <Link href="/login" className="text-center py-3 text-aiscern-text-secondary font-medium">Sign In</Link>
                <Link href="/signup" className="text-center py-3 bg-aiscern-accent-cyan text-aiscern-bg-primary font-semibold rounded-lg">Start Free</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
