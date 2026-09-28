import { motion } from "framer-motion";
import { AnimatedSection, SectionLabel, SectionHeading, SectionSubheading } from "../ui";

export function TechnologySection() {
  const layers = [
    { title: "Input Layer", items: ["Text", "Image", "Audio", "Video", "URL"], color: "border-aiscern-accent-cyan" },
    { title: "Processing Layer", items: ["Normalization", "Feature Extraction", "Metadata Parsing"], color: "border-aiscern-accent-blue" },
    { title: "Intelligence Layer", items: ["Specialized Models", "Ensemble Architecture"], color: "border-aiscern-accent-cyan" },
    { title: "Forensics Layer", items: ["Signal Analysis", "Consistency Checks", "Cross-Modal Verification"], color: "border-aiscern-accent-blue" },
    { title: "Decision Layer", items: ["Confidence Scoring", "Risk Assessment", "Verification Status"], color: "border-aiscern-status-uncertain" },
    { title: "Evidence Layer", items: ["Report Generation", "Audit Trail", "Human Review Queue"], color: "border-aiscern-status-authentic" },
  ];

  return (
    <section className="py-24 lg:py-32">
      <div className="section-container">
        <div className="section-inner">
          <AnimatedSection className="text-center mb-16">
            <SectionLabel>Technical Architecture</SectionLabel>
            <SectionHeading>Six layers. One purpose.</SectionHeading>
            <SectionSubheading>From raw input to verified conclusion, every layer is inspectable, auditable, and explainable.</SectionSubheading>
          </AnimatedSection>
          <div className="max-w-3xl mx-auto space-y-4">
            {layers.map((layer, i) => (
              <AnimatedSection key={layer.title}>
                <motion.div whileHover={{ x: 8 }} className={`forensic-card p-5 border-l-2 ${layer.color} hover:bg-aiscern-bg-surface/50 transition-colors cursor-default`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-aiscern-text-primary">{layer.title}</h3>
                    <span className="technical-label">LAYER {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {layer.items.map((item) => (
                      <span key={item} className="px-3 py-1 rounded-full bg-aiscern-bg-primary/50 border border-aiscern-border-subtle text-xs text-aiscern-text-secondary">{item}</span>
                    ))}
                  </div>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
