import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function AssistantSection() {
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
                <p className="text-sm text-aiscern-text-primary leading-relaxed">Three independent signal groups contributed to the result:</p>
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
