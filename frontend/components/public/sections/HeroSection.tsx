"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SectionLabel, PrimaryCTA, SecondaryCTA } from "../ui";

export function HeroSection() {
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
