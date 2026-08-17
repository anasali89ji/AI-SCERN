import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "AI Text Detector", href: "/product/text-detector" },
      { label: "AI Image Detector", href: "/product/image-detector" },
      { label: "AI Audio Detector", href: "/product/audio-detector" },
      { label: "AI Video Detector", href: "/product/video-detector" },
      { label: "Deepfake Detection", href: "/product/deepfake" },
      { label: "Batch Analyzer", href: "/product/batch" },
      { label: "API", href: "/api-docs" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Education", href: "/solutions/education" },
      { label: "HR & Recruiting", href: "/solutions/hr" },
      { label: "Media & Journalism", href: "/solutions/media" },
      { label: "Legal & Compliance", href: "/solutions/legal" },
      { label: "Security", href: "/solutions/security" },
      { label: "Enterprise", href: "/enterprise" },
    ],
  },
  {
    title: "Technology",
    links: [
      { label: "How It Works", href: "/technology/how-it-works" },
      { label: "Methodology", href: "/technology/methodology" },
      { label: "Benchmarks", href: "/technology/benchmarks" },
      { label: "Research", href: "/research" },
      { label: "Transparency", href: "/trust/transparency" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Guides", href: "/guides" },
      { label: "Comparisons", href: "/comparisons" },
      { label: "FAQ", href: "/faq" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "API Docs", href: "/api-docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Security", href: "/trust/security" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-aiscern-border-subtle bg-aiscern-bg-secondary relative">
      <div className="section-container py-16 lg:py-20">
        <div className="section-inner">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aiscern-accent-cyan to-aiscern-accent-blue flex items-center justify-center">
                  <span className="text-aiscern-bg-primary font-bold text-sm">A</span>
                </div>
                <span className="font-semibold text-lg tracking-tight">AISCERN</span>
              </Link>
              <p className="text-sm text-aiscern-text-muted leading-relaxed mb-6">
                Digital trust and verification infrastructure for the AI era.
              </p>
              <div className="flex gap-4">
                {["GitHub", "Twitter", "LinkedIn"].map((social) => (
                  <a key={social} href="#" className="text-xs text-aiscern-text-muted hover:text-aiscern-accent-cyan transition-colors uppercase tracking-wider">{social}</a>
                ))}
              </div>
            </div>
            {footerColumns.map((col) => (
              <div key={col.title}>
                <h4 className="technical-label mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-aiscern-text-secondary hover:text-aiscern-text-primary transition-colors">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-16 pt-8 border-t border-aiscern-border-subtle flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-aiscern-text-muted">&copy; {new Date().getFullYear()} AISCERN. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/legal/privacy" className="text-xs text-aiscern-text-muted hover:text-aiscern-text-secondary transition-colors">Privacy Policy</Link>
              <Link href="/legal/terms" className="text-xs text-aiscern-text-muted hover:text-aiscern-text-secondary transition-colors">Terms of Service</Link>
              <Link href="/legal/dpa" className="text-xs text-aiscern-text-muted hover:text-aiscern-text-secondary transition-colors">DPA</Link>
            </div>
          </div>
          <div className="mt-12 text-center">
            <p className="text-display-md font-bold text-aiscern-text-primary/5 select-none">Verify what&apos;s real.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
