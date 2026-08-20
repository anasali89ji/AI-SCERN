"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function ModalitySection() {
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
