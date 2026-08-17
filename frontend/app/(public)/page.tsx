"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";

/* ─── Reusable UI ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="technical-label mb-4">{children}</p>;
}
function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-display-lg font-bold tracking-tight text-aiscern-text-primary ${className}`}>{children}</h2>;
}
function SectionSubheading({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-lg text-aiscern-text-secondary max-w-2xl">{children}</p>;
}
function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center px-6 py-3 bg-aiscern-accent-cyan text-aiscern-bg-primary font-semibold rounded-lg hover:bg-aiscern-accent-cyan/90 transition-all hover:shadow-lg hover:shadow-aiscern-accent-cyan/20">
      {children}
    </Link>
  );
}
function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center px-6 py-3 border border-aiscern-border-strong text-aiscern-text-primary font-medium rounded-lg hover:bg-aiscern-bg-surface transition-all">
      {children}
    </Link>
  );
}
function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: 0.7, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── SECTION 01: HERO ─── */
function HeroSection() {
  const [scanStage, setScanStage] = useState(0);
  const stages = [
    { label: "INGESTING MEDIA", status: "File integrity verified", state: "ok" },
    { label: "ANALYZING FRAMES", status: "1,240 frames sampled", state: "ok" },
    { label: "ANALYZING AUDIO", status: "Synthetic speech indicators detected", state: "warn" },
    { label: "CHECKING METADATA", status: "Metadata extracted", state: "ok" },
    { label: "CROSS-MODAL CONSISTENCY", status: "Face/audio mismatch detected", state: "warn" },
    { label: "MODEL CONSENSUS", status: "87% suspicious", state: "alert" },
    { label: "GENERATING REPORT", status: "Evidence compiled", state: "ok" },
  ];
  useEffect(() => {
    const interval = setInterval(() => setScanStage((p) => (p + 1) % stages.length), 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-aiscern-bg-secondary/50 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aiscern-accent-cyan/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-aiscern-accent-blue/5 rounded-full blur-3xl" />
      <div className="section-container relative z-10">
        <div className="section-inner">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                <SectionLabel>Digital Trust Platform</SectionLabel>
                <h1 className="text-display-xl font-bold tracking-tight text-aiscern-text-primary">
                  VERIFY<br />WHAT&apos;S REAL.
                </h1>
                <p className="mt-6 text-xl text-aiscern-text-secondary max-w-lg leading-relaxed">
                  AI-powered verification for text, images, audio, video and digital content.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <PrimaryCTA href="/signup">Start Free Verification</PrimaryCTA>
                  <SecondaryCTA href="/technology/how-it-works">Explore the Technology</SecondaryCTA>
                </div>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="forensic-card p-6 relative overflow-hidden">
              <div className="scan-line-overlay">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-aiscern-status-authentic animate-pulse" />
                    <span className="technical-label">LIVE VERIFICATION</span>
                  </div>
                  <span className="text-xs font-mono text-aiscern-text-muted">v2.4.1</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-aiscern-bg-primary/50 border border-aiscern-border-subtle">
                    <p className="technical-label mb-2">INPUT</p>
                    <p className="text-sm font-mono text-aiscern-text-primary">video_042.mp4</p>
                    <p className="text-xs text-aiscern-text-muted mt-1">24.3 MB</p>
                  </div>
                  <div className="p-4 rounded-lg bg-aiscern-bg-primary/50 border border-aiscern-border-subtle flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-2 border-aiscern-accent-cyan/30 border-t-aiscern-accent-cyan animate-spin" />
                  </div>
                  <div className="p-4 rounded-lg bg-aiscern-bg-primary/50 border border-aiscern-border-subtle">
                    <p className="technical-label mb-2">STATUS</p>
                    <p className="text-sm font-bold text-aiscern-status-suspicious">SUSPICIOUS</p>
                    <p className="text-xs text-aiscern-text-muted mt-1">91% confidence</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {stages.map((stage, i) => (
                    <motion.div key={stage.label}
                      className={`flex items-center gap-3 p-2 rounded-md transition-colors ${i === scanStage ? "bg-aiscern-accent-cyan/10" : "bg-transparent"}`}
                      animate={{ opacity: i <= scanStage ? 1 : 0.4 }}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        stage.state === "ok" ? "bg-aiscern-status-authentic" : stage.state === "warn" ? "bg-aiscern-status-uncertain" : "bg-aiscern-status-suspicious"
                      }`} />
                      <span className="text-xs font-mono text-aiscern-text-secondary w-40">{stage.label}</span>
                      <span className="text-xs text-aiscern-text-muted truncate">{stage.status}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-aiscern-border-subtle flex justify-between items-center">
                  <div className="flex gap-4">
                    <div><p className="technical-label">SIGNALS</p><p className="text-lg font-bold text-aiscern-text-primary">07</p></div>
                    <div><p className="technical-label">CONFIDENCE</p><p className="text-lg font-bold text-aiscern-status-suspicious">91%</p></div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-aiscern-status-suspicious-dim text-aiscern-status-suspicious text-xs font-semibold">REVIEW REQUIRED</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 02: TRUST STRIP ─── */
function TrustStrip() {
  const audiences = ["Educators", "Journalists", "HR Teams", "Legal Professionals", "Security Teams", "Researchers", "Enterprises"];
  return (
    <section className="border-y border-aiscern-border-subtle bg-aiscern-bg-secondary/50">
      <div className="section-container py-12">
        <div className="section-inner text-center">
          <p className="text-sm text-aiscern-text-muted mb-6">Built for people who cannot afford to trust blindly.</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {audiences.map((a) => <span key={a} className="text-sm font-medium text-aiscern-text-secondary">{a}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 03: THE PROBLEM ─── */
function ProblemSection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-aiscern-status-risk-dim/5 to-transparent" />
      <div className="section-container relative z-10">
        <div className="section-inner max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <SectionLabel>The Trust Crisis</SectionLabel>
            <SectionHeading>AI changed how content is created.<br />It also changed how trust works.</SectionHeading>
            <SectionSubheading>
              Synthetic text is widespread. Images can be generated or manipulated. Voices can be cloned. Videos can be altered. Authentic media can be presented with false context.
            </SectionSubheading>
            <div className="mt-12 p-6 forensic-card border-l-2 border-l-aiscern-accent-cyan">
              <p className="text-lg text-aiscern-text-primary font-medium">Content can be real. The claim can still be false.</p>
              <p className="mt-2 text-aiscern-text-secondary">AISCERN verifies both media authenticity <em>and</em> contextual integrity.</p>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 04: ONE PLATFORM, EVERY MEDIUM ─── */
function ModalitySection() {
  const [activeTab, setActiveTab] = useState("text");
  const tabs = [
    { id: "text", label: "TEXT", signals: ["Linguistic analysis", "Perplexity scoring", "Burstiness patterns", "Vocabulary fingerprints", "Model structure detection"] },
    { id: "image", label: "IMAGE", signals: ["Frequency domain analysis", "Metadata forensics", "Compression artifacts", "Facial geometry", "Background coherence", "Generation signals"] },
    { id: "audio", label: "AUDIO", signals: ["Spectral analysis", "Speech pattern detection", "Synthetic voice indicators", "Waveform analysis", "Speaker consistency"] },
    { id: "video", label: "VIDEO", signals: ["Frame sampling", "Temporal consistency", "Face region analysis", "Audio/video sync", "Compression forensics", "Provenance tracking"] },
    { id: "url", label: "URL", signals: ["Source discovery", "Page extraction", "Claim verification", "Source comparison", "Provenance graph"] },
    { id: "document", label: "DOCUMENT", signals: ["Structure analysis", "Metadata inspection", "Edit history", "Font consistency", "Layout forensics"] },
  ];
  const activeSignals = tabs.find((t) => t.id === activeTab)?.signals || [];

  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Multimodal Coverage</SectionLabel>
            <SectionHeading>One platform. Every medium.</SectionHeading>
            <SectionSubheading>Specialized forensic engines for each content type, unified under one verification framework.</SectionSubheading>
          </AnimatedSection>
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 text-left px-5 py-4 rounded-lg border transition-all ${
                    activeTab === tab.id ? "border-aiscern-accent-cyan/40 bg-aiscern-accent-cyan/10 text-aiscern-accent-cyan" : "border-aiscern-border-subtle bg-aiscern-bg-surface/50 text-aiscern-text-secondary hover:text-aiscern-text-primary hover:border-aiscern-border"
                  }`}>
                  <span className="font-mono text-sm font-semibold tracking-wider">{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="forensic-card p-8 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full bg-aiscern-accent-cyan animate-pulse" />
                    <span className="technical-label">FORENSIC SIGNALS — {activeTab.toUpperCase()}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {activeSignals.map((signal, i) => (
                      <motion.div key={signal} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3 p-3 rounded-md bg-aiscern-bg-primary/50 border border-aiscern-border-subtle">
                        <div className="w-1 h-1 rounded-full bg-aiscern-accent-cyan" />
                        <span className="text-sm text-aiscern-text-secondary">{signal}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-aiscern-border-subtle">
                    <div className="flex items-center justify-between text-xs font-mono text-aiscern-text-muted">
                      <span>ENGINE STATUS: ACTIVE</span><span>LATENCY: ~120ms</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 05: VERIFICATION ENGINE ARCHITECTURE ─── */
function EngineSection() {
  const steps = [
    { label: "INPUT", desc: "Text / Image / Audio / Video / URL / Document" },
    { label: "PREPROCESSING", desc: "Normalization & integrity checks" },
    { label: "SIGNAL EXTRACTION", desc: "Multimodal feature decomposition" },
    { label: "SPECIALIZED MODELS", desc: "Modality-specific deep analysis" },
    { label: "CROSS-SIGNAL ANALYSIS", desc: "Inter-modal consistency verification" },
    { label: "CONSISTENCY ENGINE", desc: "Temporal & contextual coherence" },
    { label: "RISK / CONFIDENCE MODEL", desc: "Probabilistic assessment" },
    { label: "EVIDENCE REPORT", desc: "Explainable audit-ready output" },
  ];
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>System Architecture</SectionLabel>
            <SectionHeading>One verdict. Hundreds of signals.</SectionHeading>
            <SectionSubheading>Click any node to explore how AISCERN builds its assessment from raw input to verified conclusion.</SectionSubheading>
          </AnimatedSection>
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute left-4 lg:left-1/2 top-0 bottom-0 w-px bg-aiscern-border-subtle lg:-translate-x-px" />
              <div className="space-y-8">
                {steps.map((step, i) => (
                  <AnimatedSection key={step.label}>
                    <div className={`relative flex items-center gap-6 ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"}`}>
                      <div className="hidden lg:block lg:w-1/2" />
                      <div className="absolute left-4 lg:left-1/2 w-3 h-3 rounded-full bg-aiscern-bg-primary border-2 border-aiscern-accent-cyan z-10 -translate-x-1.5" />
                      <div className="ml-10 lg:ml-0 lg:w-1/2 forensic-card p-5 hover:border-aiscern-accent-cyan/30 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="technical-label text-aiscern-accent-cyan">{String(i + 1).padStart(2, "0")}</span>
                          <h3 className="font-semibold text-aiscern-text-primary group-hover:text-aiscern-accent-cyan transition-colors">{step.label}</h3>
                        </div>
                        <p className="text-sm text-aiscern-text-secondary">{step.desc}</p>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 06: SHOW THE EVIDENCE ─── */
function EvidenceSection() {
  const [expandedSignal, setExpandedSignal] = useState<string | null>("synthetic-voice");
  const signals = [
    { id: "synthetic-voice", label: "Synthetic voice indicators", level: "HIGH", score: 94, desc: "Spectral analysis reveals harmonic structures consistent with neural vocoder artifacts. Formant transitions show unnatural smoothness." },
    { id: "frame-inconsistency", label: "Frame inconsistency", level: "MEDIUM", score: 67, desc: "Temporal coherence analysis detected 3 frames with mismatched lighting vectors between consecutive samples." },
    { id: "metadata", label: "Metadata anomaly", level: "LOW", score: 34, desc: "EXIF data shows editing software signature. Creation timestamp precedes claimed recording date by 48 hours." },
    { id: "lip-sync", label: "Lip synchronization", level: "HIGH", score: 89, desc: "Phoneme-viseme correlation coefficient below human baseline. Audio leads video by average 120ms in flagged segments." },
    { id: "compression", label: "Compression artifacts", level: "MEDIUM", score: 58, desc: "DCT coefficient distribution suggests double-compression. First generation likely synthetic, then re-encoded." },
  ];
  const levelColor = (level: string) => {
    switch (level) {
      case "HIGH": return "text-aiscern-status-suspicious bg-aiscern-status-suspicious-dim";
      case "MEDIUM": return "text-aiscern-status-uncertain bg-aiscern-status-uncertain-dim";
      case "LOW": return "text-aiscern-status-authentic bg-aiscern-status-authentic-dim";
      default: return "text-aiscern-text-muted bg-aiscern-bg-surface";
    }
  };

  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Forensic Reporting</SectionLabel>
            <SectionHeading>Show the evidence.</SectionHeading>
            <SectionSubheading>AISCERN doesn&apos;t just generate a score. It investigates, documents, and explains every signal.</SectionSubheading>
          </AnimatedSection>
          <div className="max-w-4xl mx-auto forensic-card overflow-hidden">
            <div className="p-6 border-b border-aiscern-border-subtle bg-aiscern-bg-surface/50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="technical-label mb-1">VERIFICATION REPORT</p>
                  <h3 className="text-2xl font-bold text-aiscern-text-primary">video_042.mp4</h3>
                </div>
                <div className="flex gap-6">
                  <div className="text-right"><p className="technical-label">STATUS</p><p className="text-lg font-bold text-aiscern-status-suspicious">SUSPICIOUS</p></div>
                  <div className="text-right"><p className="technical-label">CONFIDENCE</p><p className="text-lg font-bold text-aiscern-text-primary">91%</p></div>
                  <div className="text-right"><p className="technical-label">SIGNALS</p><p className="text-lg font-bold text-aiscern-text-primary">07</p></div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-aiscern-border-subtle">
              {signals.map((signal) => (
                <div key={signal.id} className="group">
                  <button onClick={() => setExpandedSignal(expandedSignal === signal.id ? null : signal.id)}
                    className="w-full p-5 flex items-center justify-between hover:bg-aiscern-bg-surface/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        signal.level === "HIGH" ? "bg-aiscern-status-suspicious" : signal.level === "MEDIUM" ? "bg-aiscern-status-uncertain" : "bg-aiscern-status-authentic"
                      }`} />
                      <span className="text-sm font-medium text-aiscern-text-primary">{signal.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${levelColor(signal.level)}`}>{signal.level}</span>
                      <svg className={`w-4 h-4 text-aiscern-text-muted transition-transform ${expandedSignal === signal.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedSignal === signal.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="px-5 pb-5 pl-11">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex-1 h-2 bg-aiscern-bg-primary rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${signal.score}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                                className={`h-full rounded-full ${
                                  signal.level === "HIGH" ? "bg-aiscern-status-suspicious" : signal.level === "MEDIUM" ? "bg-aiscern-status-uncertain" : "bg-aiscern-status-authentic"
                                }`} />
                            </div>
                            <span className="text-sm font-mono text-aiscern-text-muted w-10">{signal.score}%</span>
                          </div>
                          <p className="text-sm text-aiscern-text-secondary leading-relaxed">{signal.desc}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <div className="p-5 bg-aiscern-status-suspicious-dim/30 border-t border-aiscern-border-subtle">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-aiscern-status-suspicious flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-aiscern-status-suspicious">Recommendation: Human review required</p>
                  <p className="text-xs text-aiscern-text-secondary mt-1">Detection results are probabilistic. This content exhibits multiple corroborating synthetic signals and should be reviewed by a human analyst before any high-stakes decision.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 07: TRUST SCORE ─── */
function TrustScoreSection() {
  const metrics = [
    { label: "Visual integrity", score: 78 },
    { label: "Audio integrity", score: 29 },
    { label: "Provenance", score: 14 },
    { label: "Context confidence", score: 21 },
  ];
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Confidence Model</SectionLabel>
            <SectionHeading>Trust, not certainty.</SectionHeading>
            <SectionSubheading>Verification is probabilistic. AISCERN communicates confidence with precision, never implying mathematical certainty where none exists.</SectionSubheading>
          </AnimatedSection>
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="flex justify-center">
              <div className="relative w-64 h-64">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <motion.circle cx="50" cy="50" r="45" fill="none" stroke="#F97316" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - 31 / 100)}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                    whileInView={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - 31 / 100) }}
                    viewport={{ once: true }} transition={{ duration: 1.5, ease: "easeOut" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-aiscern-text-primary">31</span>
                  <span className="text-sm text-aiscern-text-muted">/ 100</span>
                  <span className="mt-2 px-3 py-1 rounded-full bg-aiscern-status-suspicious-dim text-aiscern-status-suspicious text-xs font-semibold">SUSPICIOUS</span>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {metrics.map((m, i) => (
                <AnimatedSection key={m.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-aiscern-text-secondary">{m.label}</span>
                    <span className="text-sm font-mono text-aiscern-text-primary">{m.score}</span>
                  </div>
                  <div className="h-2 bg-aiscern-bg-primary rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.score}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.15, ease: "easeOut" }}
                      className={`h-full rounded-full ${m.score > 60 ? "bg-aiscern-status-authentic" : m.score > 30 ? "bg-aiscern-status-uncertain" : "bg-aiscern-status-suspicious"}`} />
                  </div>
                </AnimatedSection>
              ))}
              <div className="pt-4 border-t border-aiscern-border-subtle">
                <p className="text-xs text-aiscern-text-muted leading-relaxed">
                  <strong className="text-aiscern-text-secondary">Note:</strong> Scores represent signal strength, not absolute truth. A low score in one domain can be overridden by high-confidence signals in another. Always combine AISCERN results with human judgment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 08: REAL MEDIA VS FALSE CONTEXT ─── */
function ContextSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Context Verification</SectionLabel>
            <SectionHeading>Real media. False context.</SectionHeading>
            <SectionSubheading>AISCERN evaluates both the authenticity of the media itself and the integrity of the claims made about it.</SectionSubheading>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="forensic-card p-8 border-l-2 border-l-aiscern-status-authentic">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-aiscern-status-authentic" />
                <span className="technical-label text-aiscern-status-authentic">MEDIA STATUS</span>
              </div>
              <h3 className="text-xl font-bold text-aiscern-text-primary mb-2">Authentic</h3>
              <p className="text-sm text-aiscern-text-secondary">The image was captured by a verified camera. EXIF data is consistent. No manipulation signals detected.</p>
            </div>
            <div className="forensic-card p-8 border-l-2 border-l-aiscern-status-suspicious">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-aiscern-status-suspicious" />
                <span className="technical-label text-aiscern-status-suspicious">CLAIM STATUS</span>
              </div>
              <h3 className="text-xl font-bold text-aiscern-text-primary mb-2">False</h3>
              <p className="text-sm text-aiscern-text-secondary">The image is real, but the caption claims it depicts a different event, location, and date than verified sources confirm.</p>
            </div>
          </div>
          <div className="mt-8 p-6 forensic-card text-center">
            <p className="text-aiscern-text-primary font-medium">Authentic media does not automatically mean authentic context.</p>
            <p className="text-sm text-aiscern-text-secondary mt-2">AISCERN cross-references claims against verified sources, timestamps, and geographic data.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 09: USE CASES ─── */
function UseCasesSection() {
  const cases = [
    { title: "Education", desc: "Verify assignments, essays and research material for academic integrity.", icon: "🎓" },
    { title: "HR & Recruiting", desc: "Review AI-assisted applications and interview material with confidence.", icon: "👔" },
    { title: "Media & Journalism", desc: "Verify media before publication. Protect editorial credibility.", icon: "📰" },
    { title: "Legal & Compliance", desc: "Support digital evidence review with forensic-grade documentation.", icon: "⚖️" },
    { title: "Security", desc: "Analyze suspicious synthetic media in threat intelligence workflows.", icon: "🛡️" },
    { title: "Research", desc: "Evaluate generated content and model behavior in scientific studies.", icon: "🔬" },
  ];
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Applications</SectionLabel>
            <SectionHeading>Built for high-stakes decisions.</SectionHeading>
            <SectionSubheading>Organizations across industries rely on AISCERN to verify content they cannot afford to get wrong.</SectionSubheading>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c, i) => (
              <AnimatedSection key={c.title}>
                <div className="forensic-card p-6 h-full hover:border-aiscern-accent-cyan/20 transition-all group cursor-pointer">
                  <div className="text-3xl mb-4">{c.icon}</div>
                  <h3 className="text-lg font-semibold text-aiscern-text-primary mb-2 group-hover:text-aiscern-accent-cyan transition-colors">{c.title}</h3>
                  <p className="text-sm text-aiscern-text-secondary leading-relaxed">{c.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-aiscern-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Explore workflow</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 10: BATCH ANALYSIS ─── */
function BatchSection() {
  const files = [
    { name: "essay-01.docx", type: "TEXT", result: "AI", confidence: 94, color: "text-aiscern-status-suspicious" },
    { name: "image-021.jpg", type: "IMAGE", result: "HUMAN", confidence: 87, color: "text-aiscern-status-authentic" },
    { name: "voice-07.wav", type: "AUDIO", result: "AI", confidence: 91, color: "text-aiscern-status-suspicious" },
    { name: "clip-19.mp4", type: "VIDEO", result: "SUSPICIOUS", confidence: 89, color: "text-aiscern-status-uncertain" },
    { name: "report-v2.pdf", type: "DOCUMENT", result: "HUMAN", confidence: 76, color: "text-aiscern-status-authentic" },
  ];
  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Enterprise Scale</SectionLabel>
            <SectionHeading>Batch analysis at scale.</SectionHeading>
            <SectionSubheading>Process hundreds of files simultaneously. Organize, filter, export, and audit every result.</SectionSubheading>
          </AnimatedSection>
          <div className="max-w-4xl mx-auto forensic-card overflow-hidden">
            <div className="p-4 border-b border-aiscern-border-subtle bg-aiscern-bg-surface/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-aiscern-accent-cyan animate-pulse" />
                <span className="technical-label">BATCH QUEUE — 5 FILES</span>
              </div>
              <span className="text-xs font-mono text-aiscern-text-muted">Processing...</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-aiscern-border-subtle text-aiscern-text-muted">
                    <th className="text-left p-4 font-mono text-label">FILE</th>
                    <th className="text-left p-4 font-mono text-label">TYPE</th>
                    <th className="text-left p-4 font-mono text-label">RESULT</th>
                    <th className="text-right p-4 font-mono text-label">CONFIDENCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aiscern-border-subtle">
                  {files.map((file, i) => (
                    <motion.tr key={file.name} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      className="hover:bg-aiscern-bg-surface/30 transition-colors">
                      <td className="p-4 font-mono text-aiscern-text-primary">{file.name}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded bg-aiscern-bg-primary text-xs font-mono text-aiscern-text-secondary">{file.type}</span></td>
                      <td className="p-4 font-semibold {file.color}">{file.result}</td>
                      <td className="p-4 text-right font-mono text-aiscern-text-primary">{file.confidence}%</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-aiscern-border-subtle flex items-center justify-between text-xs text-aiscern-text-muted">
              <span>Processed in 4.2s</span>
              <div className="flex gap-4">
                <span>Export CSV</span>
                <span>Export PDF</span>
                <span>Audit Trail</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 11: AI ASSISTANT ─── */
function AssistantSection() {
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Analytical Companion</SectionLabel>
            <SectionHeading>Ask why. Get evidence.</SectionHeading>
            <SectionSubheading>The AISCERN Assistant doesn&apos;t chat. It explains forensic results with precision and citations.</SectionSubheading>
          </AnimatedSection>
          <div className="forensic-card p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aiscern-accent-cyan to-aiscern-accent-blue flex items-center justify-center flex-shrink-0">
                <span className="text-aiscern-bg-primary font-bold text-xs">A</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-aiscern-text-primary">AISCERN Assistant</p>
                <p className="text-xs text-aiscern-text-muted">AI Verification Analyst</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-aiscern-bg-primary/50 border border-aiscern-border-subtle">
                <p className="text-sm text-aiscern-text-secondary italic">&ldquo;Why was this image flagged?&rdquo;</p>
              </div>
              <div className="p-4 rounded-lg bg-aiscern-accent-cyan/5 border border-aiscern-accent-cyan/20">
                <p className="text-sm text-aiscern-text-primary leading-relaxed">
                  Three independent signal groups contributed to the result:
                </p>
                <ol className="mt-3 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-aiscern-text-secondary">
                    <span className="text-aiscern-accent-cyan font-mono">1.</span>
                    <span><strong className="text-aiscern-text-primary">Frequency artifacts</strong> — DCT coefficient distribution shows patterns consistent with generative model output, not natural camera capture.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-aiscern-text-secondary">
                    <span className="text-aiscern-accent-cyan font-mono">2.</span>
                    <span><strong className="text-aiscern-text-primary">Missing camera provenance</strong> — No verifiable EXIF chain. Lens distortion model does not match any known commercial sensor.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-aiscern-text-secondary">
                    <span className="text-aiscern-accent-cyan font-mono">3.</span>
                    <span><strong className="text-aiscern-text-primary">Facial geometry inconsistencies</strong> — Pupil spacing and jaw symmetry fall outside human population variance for the claimed demographic.</span>
                  </li>
                </ol>
                <p className="mt-4 text-xs text-aiscern-text-muted">Confidence: 91% | Model version: 2.4.1 | Analysis ID: ASC-8842-FF</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 12: TECHNOLOGY LAYERS ─── */
function TechnologySection() {
  const layers = [
    { title: "Input Layer", items: ["Text", "Image", "Audio", "Video", "URL"], color: "border-aiscern-accent-cyan" },
    { title: "Processing Layer", items: ["Normalization", "Feature Extraction", "Metadata Parsing"], color: "border-aiscern-accent-blue" },
    { title: "Intelligence Layer", items: ["Specialized Models", "Ensemble Architecture"], color: "border-aiscern-accent-cyan" },
    { title: "Forensics Layer", items: ["Signal Analysis", "Consistency Checks", "Cross-Modal Verification"], color: "border-aiscern-accent-blue" },
    { title: "Decision Layer", items: ["Confidence Scoring", "Risk Assessment", "Verification Status"], color: "border-aiscern-status-uncertain" },
    { title: "Evidence Layer", items: ["Report Generation", "Audit Trail", "Human Review Queue"], color: "border-aiscern-status-authentic" },
  ];
  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Technical Architecture</SectionLabel>
            <SectionHeading>Six layers. One purpose.</SectionHeading>
            <SectionSubheading>From raw input to verified conclusion, every layer is inspectable, auditable, and explainable.</SectionSubheading>
          </AnimatedSection>
          <div className="max-w-3xl mx-auto space-y-4">
            {layers.map((layer, i) => (
              <AnimatedSection key={layer.title}>
                <motion.div whileHover={{ x: 8 }} className={`forensic-card p-5 border-l-2 ${layer.color} hover:bg-aiscern-bg-surface/50 transition-colors cursor-default`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-aiscern-text-primary">{layer.title}</h3>
                    <span className="technical-label">LAYER {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {layer.items.map((item) => (
                      <span key={item} className="px-3 py-1 rounded-full bg-aiscern-bg-primary/50 border border-aiscern-border-subtle text-xs text-aiscern-text-secondary">{item}</span>
                    ))}
                  </div>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 13: BENCHMARKS ─── */
function BenchmarksSection() {
  const benchmarks = [
    { metric: "AUC-ROC", value: "0.94", context: "Internal test set, v2.4.1" },
    { metric: "Precision", value: "0.91", context: "Text modality, balanced dataset" },
    { metric: "Recall", value: "0.89", context: "Image modality, diverse sources" },
    { metric: "F1 Score", value: "0.90", context: "Cross-modal ensemble" },
    { metric: "False Positive Rate", value: "4.2%", context: "Conservative threshold" },
  ];
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Scientific Rigor</SectionLabel>
            <SectionHeading>Benchmarked. Transparent.</SectionHeading>
            <SectionSubheading>We publish our methodology, datasets, and limitations. No black boxes. No exaggerated claims.</SectionSubheading>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {benchmarks.map((b, i) => (
              <AnimatedSection key={b.metric}>
                <div className="forensic-card p-6 text-center h-full">
                  <p className="technical-label mb-3">{b.metric}</p>
                  <p className="text-metric-lg font-bold text-aiscern-text-primary">{b.value}</p>
                  <p className="text-xs text-aiscern-text-muted mt-2">{b.context}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-xs text-aiscern-text-muted max-w-2xl mx-auto">
              Benchmarks reflect controlled test conditions. Real-world performance varies by content type, quality, and adversarial sophistication. 
              <Link href="/technology/benchmarks" className="text-aiscern-accent-cyan hover:underline ml-1">View full methodology</Link>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 14: TRANSPARENCY ─── */
function TransparencySection() {
  const items = [
    { label: "Content Processing", status: "Documented", desc: "All uploaded content is analyzed in-memory. No persistent storage of user uploads without explicit consent." },
    { label: "Data Retention", status: "Configurable", desc: "Default retention: 30 days. Enterprise plans support custom retention policies and immediate deletion." },
    { label: "Model Training Policy", status: "Opt-out", desc: "User content is never used to train models without explicit opt-in. Research datasets are fully anonymized." },
    { label: "Third-Party Providers", status: "Disclosed", desc: "Infrastructure: Vercel, Supabase, Convex. No user content is sent to third-party LLM APIs." },
    { label: "Encryption", status: "AES-256", desc: "All data in transit (TLS 1.3) and at rest (AES-256-GCM). Enterprise plans include dedicated encryption keys." },
  ];
  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Trust Through Transparency</SectionLabel>
            <SectionHeading>Nothing to hide.</SectionHeading>
            <SectionSubheading>We believe trust is earned through openness. Here is exactly how AISCERN handles your data.</SectionSubheading>
          </AnimatedSection>
          <div className="space-y-4">
            {items.map((item) => (
              <AnimatedSection key={item.label}>
                <div className="forensic-card p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-shrink-0">
                    <span className="px-3 py-1 rounded-full bg-aiscern-status-authentic-dim text-aiscern-status-authentic text-xs font-semibold">{item.status}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-aiscern-text-primary mb-1">{item.label}</h3>
                    <p className="text-sm text-aiscern-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <div className="mt-8 text-center">
            <SecondaryCTA href="/trust/transparency">Read Full Transparency Report</SecondaryCTA>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 15: ENTERPRISE ─── */
function EnterpriseSection() {
  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Enterprise</SectionLabel>
            <SectionHeading>Verification infrastructure for organizations that cannot afford uncertainty.</SectionHeading>
            <SectionSubheading>Dedicated infrastructure, custom SLAs, SSO/SAML, audit trails, and dedicated onboarding.</SectionSubheading>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: "API Access", desc: "RESTful API with SDKs for Python, Node.js, and Go. Rate limits tailored to your volume." },
              { title: "SSO / SAML", desc: "Integrate with your existing identity provider. Role-based access control included." },
              { title: "Audit Trails", desc: "Every detection, every report, every API call is logged and exportable for compliance." },
              { title: "Custom Retention", desc: "Define your own data lifecycle policies. Immediate deletion on request." },
              { title: "SLA Guarantee", desc: "99.9% uptime SLA with dedicated support channel and escalation procedures." },
              { title: "Dedicated Onboarding", desc: "White-glove setup with solution architects and integration engineers." },
            ].map((feat) => (
              <AnimatedSection key={feat.title}>
                <div className="forensic-card p-6 h-full">
                  <h3 className="font-semibold text-aiscern-text-primary mb-2">{feat.title}</h3>
                  <p className="text-sm text-aiscern-text-secondary leading-relaxed">{feat.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <div className="mt-12 text-center flex flex-wrap justify-center gap-4">
            <PrimaryCTA href="/contact/enterprise">Talk to Enterprise</PrimaryCTA>
            <SecondaryCTA href="/api-docs">Explore API Docs</SecondaryCTA>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 16: FINAL CTA ─── */
function FinalCTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-aiscern-accent-cyan/5 via-transparent to-transparent" />
      <div className="section-container relative z-10">
        <div className="section-inner text-center max-w-3xl mx-auto">
          <AnimatedSection>
            <SectionLabel>Get Started</SectionLabel>
            <h2 className="text-display-lg font-bold tracking-tight text-aiscern-text-primary mb-6">
              Start verifying today.
            </h2>
            <p className="text-lg text-aiscern-text-secondary mb-8">
              Free tier includes 50 verifications per month. No credit card required. Upgrade anytime.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <PrimaryCTA href="/signup">Start Free Verification</PrimaryCTA>
              <SecondaryCTA href="/enterprise">Contact Sales</SecondaryCTA>
            </div>
            <p className="mt-6 text-xs text-aiscern-text-muted">
              Detection results are probabilistic. Human review is recommended for high-stakes decisions.
            </p>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── MAIN PAGE ─── */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustStrip />
      <ProblemSection />
      <ModalitySection />
      <EngineSection />
      <EvidenceSection />
      <TrustScoreSection />
      <ContextSection />
      <UseCasesSection />
      <BatchSection />
      <AssistantSection />
      <TechnologySection />
      <BenchmarksSection />
      <TransparencySection />
      <EnterpriseSection />
      <FinalCTASection />
    </>
  );
}
