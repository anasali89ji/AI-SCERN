"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function EvidenceSection() {
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
