import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function ContextSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Context Verification</SectionLabel>
            <SectionHeading>Real media. False context.</SectionHeading>
            <SectionSubheading>AISCERN evaluates both the authenticity of the media itself and the integrity of the claims made about it.</SectionSubheading>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="forensic-card p-8 border-l-2 border-l-aiscern-status-authentic">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-aiscern-status-authentic" />
                <span className="technical-label text-aiscern-status-authentic">MEDIA STATUS</span>
              </div>
              <h3 className="text-xl font-bold text-aiscern-text-primary mb-2">Authentic</h3>
              <p className="text-sm text-aiscern-text-secondary">The image was captured by a verified camera. EXIF data is consistent. No manipulation signals detected.</p>
            </div>
            <div className="forensic-card p-8 border-l-2 border-l-aiscern-status-suspicious">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-aiscern-status-suspicious" />
                <span className="technical-label text-aiscern-status-suspicious">CLAIM STATUS</span>
              </div>
              <h3 className="text-xl font-bold text-aiscern-text-primary mb-2">False</h3>
              <p className="text-sm text-aiscern-text-secondary">The image is real, but the caption claims it depicts a different event, location, and date than verified sources confirm.</p>
            </div>
          </div>
          <div className="mt-8 p-6 forensic-card text-center">
            <p className="text-aiscern-text-primary font-medium">Authentic media does not automatically mean authentic context.</p>
            <p className="text-sm text-aiscern-text-secondary mt-2">AISCERN cross-references claims against verified sources, timestamps, and geographic data.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
