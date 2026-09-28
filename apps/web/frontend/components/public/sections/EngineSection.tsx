import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function EngineSection() {
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
