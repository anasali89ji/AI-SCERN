import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading, SecondaryCTA } from "../ui";

export function TransparencySection() {
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
