import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function ProblemSection() {
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
