import { SectionHeader } from '@/components/ui/SectionHeader'
import { InteractiveDemo } from '@/components/home/InteractiveDemo'

export default function InteractiveDemoSection() {
  return (
    <section id="demo" aria-label="Interactive AI content detection demo" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="See trust verification in action." subheadline="A guided walkthrough of our AI content detection — try a real scan anytime from the tools above." />
        <InteractiveDemo />
      </div>
    </section>
  )
}
