"use client";

import { motion } from "framer-motion";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function BatchSection() {
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
                      <td className={`p-4 font-semibold ${file.color}`}>{file.result}</td>
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
