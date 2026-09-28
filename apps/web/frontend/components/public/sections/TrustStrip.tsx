export function TrustStrip() {
  const audiences = ["Educators", "Journalists", "HR Teams", "Legal Professionals", "Security Teams", "Researchers", "Enterprises"];
  return (
    <section className="border-y border-aiscern-border-subtle bg-aiscern-bg-secondary/50">
      <div className="section-container py-12">
        <div className="section-inner text-center">
          <p className="text-sm text-aiscern-text-muted mb-6">Built for people who cannot afford to trust blindly.</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {audiences.map((a) => <span key={a} className="text-sm font-medium text-aiscern-text-secondary">{a}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
