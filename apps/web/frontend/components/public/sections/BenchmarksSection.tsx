import Link from "next/link";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function BenchmarksSection() {
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
            {benchmarks.map((b) => (
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
