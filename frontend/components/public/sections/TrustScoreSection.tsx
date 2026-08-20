import { motion } from "framer-motion";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function TrustScoreSection() {
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
