import { TestimonialCarousel } from '@/components/home/TestimonialCarousel'

const TESTIMONIALS = [
  {
    name: 'Dr. Ayesha Khan',
    role: 'Dean of Academic Affairs',
    org: 'DHA Suffa University',
    quote: 'Aiscern has become essential for our examination office. We now verify every thesis submission for AI-generated content before it reaches the review board. The trust verification reports give us confidence in our academic integrity process.',
    initials: 'AK',
    accent: '#7c3aed',
  },
  {
    name: 'Bilal Ahmed',
    role: 'Editor-in-Chief',
    org: 'Daily Times Pakistan',
    quote: 'In an election cycle flooded with synthetic media, Aiscern gives our fact-checking team the speed and confidence we need to publish responsibly. Deepfake detection that actually works under deadline pressure.',
    initials: 'BA',
    accent: '#2563eb',
  },
  {
    name: 'Sana Tariq',
    role: 'Head of HR',
    org: 'Systems Limited',
    quote: 'We screened over 400 applications last quarter. Aiscern flagged 23 CVs with AI-generated cover letters we would have missed. The explainable trust verification reports make our hiring decisions defensible.',
    initials: 'ST',
    accent: '#047857', // emerald-700: original #10b981 was 2.54:1 with white text, failing WCAG AA
  },
]

export default function TestimonialsSection() {
  return (
    <section aria-label="Trust verification testimonials" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="text-sm font-medium uppercase tracking-wider text-text-muted">What professionals say about our AI content detection</span>
        </div>

        <TestimonialCarousel testimonials={TESTIMONIALS} />
      </div>
    </section>
  )
}
