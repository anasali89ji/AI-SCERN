import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading, PrimaryCTA, SecondaryCTA } from "../ui";

export function EnterpriseSection() {
  const features = [
    { title: "API Access", desc: "RESTful API with SDKs for Python, Node.js, and Go. Rate limits tailored to your volume." },
    { title: "SSO / SAML", desc: "Integrate with your existing identity provider. Role-based access control included." },
    { title: "Audit Trails", desc: "Every detection, every report, every API call is logged and exportable for compliance." },
    { title: "Custom Retention", desc: "Define your own data lifecycle policies. Immediate deletion on request." },
    { title: "SLA Guarantee", desc: "99.9% uptime SLA with dedicated support channel and escalation procedures." },
    { title: "Dedicated Onboarding", desc: "White-glove setup with solution architects and integration engineers." },
  ];

  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Enterprise</SectionLabel>
            <SectionHeading>Verification infrastructure for organizations that cannot afford uncertainty.</SectionHeading>
            <SectionSubheading>Dedicated infrastructure, custom SLAs, SSO/SAML, audit trails, and dedicated onboarding.</SectionSubheading>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feat) => (
              <AnimatedSection key={feat.title}>
                <div className="forensic-card p-6 h-full">
                  <h3 className="font-semibold text-aiscern-text-primary mb-2">{feat.title}</h3>
                  <p className="text-sm text-aiscern-text-secondary leading-relaxed">{feat.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <div className="mt-12 text-center flex flex-wrap justify-center gap-4">
            <PrimaryCTA href="/contact/enterprise">Talk to Enterprise</PrimaryCTA>
            <SecondaryCTA href="/api-docs">Explore API Docs</SecondaryCTA>
          </div>
        </div>
      </div>
    </section>
  );
}
