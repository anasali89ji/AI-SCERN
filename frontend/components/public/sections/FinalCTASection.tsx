import { AnimatedSection, SectionLabel, PrimaryCTA, SecondaryCTA } from "../ui";

export function FinalCTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-aiscern-accent-cyan/5 via-transparent to-transparent" />
      <div className="section-container relative z-10">
        <div className="section-inner text-center max-w-3xl mx-auto">
          <AnimatedSection>
            <SectionLabel>Get Started</SectionLabel>
            <h2 className="text-display-lg font-bold tracking-tight text-aiscern-text-primary mb-6">Start verifying today.</h2>
            <p className="text-lg text-aiscern-text-secondary mb-8">Free tier includes 50 verifications per month. No credit card required. Upgrade anytime.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <PrimaryCTA href="/signup">Start Free Verification</PrimaryCTA>
              <SecondaryCTA href="/enterprise">Contact Sales</SecondaryCTA>
            </div>
            <p className="mt-6 text-xs text-aiscern-text-muted">Detection results are probabilistic. Human review is recommended for high-stakes decisions.</p>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
