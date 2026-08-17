import Link from 'next/link'
import { GraduationCap, Users, Newspaper, Scale } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealStagger, RevealStaggerItem } from '@/components/motion/RevealStagger'

const PATHWAYS = [
  {
    title: 'Higher Education',
    icon: GraduationCap,
    description: 'Maintain academic integrity across campuses.',
    href: '/solutions/education',
    gradient: 'from-primary/25 via-primary/5 to-transparent',
  },
  {
    title: 'Human Resources',
    icon: Users,
    description: 'Identify AI-assisted job applications before interview.',
    href: '/solutions/hr',
    gradient: 'from-secondary/25 via-secondary/5 to-transparent',
  },
  {
    title: 'Media & Journalism',
    icon: Newspaper,
    description: 'Verify breaking news before publication.',
    href: '/solutions/media',
    gradient: 'from-cyan/25 via-cyan/5 to-transparent',
  },
  {
    title: 'Legal & Compliance',
    icon: Scale,
    description: 'Support authenticity review of digital evidence.',
    href: '/solutions/legal',
    gradient: 'from-emerald/25 via-emerald/5 to-transparent',
  },
]

export default function WhoWeServeSection() {
  return (
    <section id="who-we-serve" aria-label="Who we serve" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="Who we serve." />

        <RevealStagger className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {PATHWAYS.map((p) => {
            const Icon = p.icon
            return (
              <RevealStaggerItem key={p.title} className="transition-transform duration-200 hover:-translate-y-1">
                <Link href={p.href} className="group block rounded-[24px] overflow-hidden bg-surface border border-border h-full">
                  <div className={`relative h-40 flex items-center justify-center bg-gradient-to-br ${p.gradient}`}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                    <Icon className="w-16 h-16 text-text-primary relative" strokeWidth={1.2} aria-hidden="true" />
                  </div>
                  <div className="p-6 md:p-8">
                    <h3 className="text-xl font-semibold text-text-primary mb-2">{p.title}</h3>
                    <p className="text-base text-text-secondary leading-relaxed">{p.description}</p>
                  </div>
                </Link>
              </RevealStaggerItem>
            )
          })}
        </RevealStagger>
      </div>
    </section>
  )
}
