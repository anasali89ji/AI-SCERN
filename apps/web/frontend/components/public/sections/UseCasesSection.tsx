import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function UseCasesSection() {
  const cases = [
    { title: "Education", desc: "Verify assignments, essays and research material for academic integrity.", icon: "🎓" },
    { title: "HR & Recruiting", desc: "Review AI-assisted applications and interview material with confidence.", icon: "👔" },
    { title: "Media & Journalism", desc: "Verify media before publication. Protect editorial credibility.", icon: "📰" },
    { title: "Legal & Compliance", desc: "Support digital evidence review with forensic-grade documentation.", icon: "⚖️" },
    { title: "Security", desc: "Analyze suspicious synthetic media in threat intelligence workflows.", icon: "🛡️" },
    { title: "Research", desc: "Evaluate generated content and model behavior in scientific studies.", icon: "🔬" },
  ];

  return (
    <section className="py-24 lg:py-32 bg-aiscern-bg-secondary/30">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Applications</SectionLabel>
            <SectionHeading>Built for high-stakes decisions.</SectionHeading>
            <SectionSubheading>Organizations across industries rely on AISCERN to verify content they cannot afford to get wrong.</SectionSubheading>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c) => (
              <AnimatedSection key={c.title}>
                <div className="forensic-card p-6 h-full hover:border-aiscern-accent-cyan/20 transition-all group cursor-pointer">
                  <div className="text-3xl mb-4">{c.icon}</div>
                  <h3 className="text-lg font-semibold text-aiscern-text-primary mb-2 group-hover:text-aiscern-accent-cyan transition-colors">{c.title}</h3>
                  <p className="text-sm text-aiscern-text-secondary leading-relaxed">{c.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-aiscern-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Explore workflow</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
