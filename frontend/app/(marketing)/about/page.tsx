import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Brain, Zap, Globe, MapPin, Briefcase, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'About Aiscern — Free AI Content Attestation',
  description: 'Aiscern is a free multi-modal AI content attestation platform built in Pakistan. Attest AI-generated text, images, audio, and video with ensemble-based analysis and published accuracy benchmarks.',
  openGraph: { title: 'About Aiscern', url: 'https://aiscern.com/about' },
}

const STATS = [
  { label: 'Modalities',       value: '4',      sub: 'text, image, audio, video' },
  { label: 'Forensic engines', value: '8+',     sub: 'in the ensemble pipeline'  },
  { label: 'Free tier',        value: '10/day', sub: 'no account required'       },
  { label: 'Text accuracy',    value: '~94%',   sub: 'see /benchmarks'           },
]

// Conservative timeline — high-level milestones only, no invented precise dates.
const TIMELINE = [
  { year: '2025', title: 'Aiscern founded', desc: 'Started as a solo project to make AI content attestation free and transparent, built from Pakistan.' },
  { year: '2025', title: 'Multi-modal detection built', desc: 'Trained on a self-assembled dataset spanning text, image, audio, and video across dozens of AI generators.' },
  { year: '2025', title: 'Free tier launched', desc: 'Opened basic attestation to anyone, no account required — because access shouldn\'t depend on budget.' },
  { year: '2026', title: 'Design system overhaul', desc: 'Rebuilt the entire product on a unified dark design system with published methodology and benchmarks.' },
]

const VALUES = [
  {
    icon: Shield,
    title: 'Transparency first',
    desc: 'We publish our accuracy benchmarks, known limitations, and attestation methodology openly. You should know exactly what our scores mean before acting on them.',
  },
  {
    icon: Brain,
    title: 'Ensemble over single models',
    desc: 'No single signal reliably catches all AI content. We combine multiple independent forensic signals into one weighted verdict, so each examination is cross-verified before delivering a result.',
  },
  {
    icon: Zap,
    title: 'Accessible to everyone',
    desc: 'AI attestation tools should not be locked behind subscriptions. Aiscern offers a free tier for individuals, educators, journalists, and researchers — no account required for basic attestation.',
  },
  {
    icon: Globe,
    title: 'Built for everyone',
    desc: 'Developed in Pakistan. We believe access to AI literacy tools should not depend on geography or budget.',
  },
]

// Real team — not padded to a round number with placeholder people.
const TEAM = [
  {
    name:     'Anas Ali',
    role:     'Founder & CEO',
    bio:      'Building Aiscern from Pakistan. Passionate about AI transparency, media literacy, and making powerful attestation tools accessible to everyone — regardless of budget or geography.',
    location: 'Pakistan',
    skills:   'Full-Stack + AI/ML',
    initials: 'AA',
  },
  {
    name:     'Temah',
    role:     'Project Manager',
    bio:      'Overseeing product quality, sprint planning, and cross-functional coordination at Aiscern. Ensuring every release meets the bar for reliability, design consistency, and user experience.',
    location: 'Remote',
    skills:   'Product Management',
    initials: 'T',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface text-silver-700">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Header — left-aligned per spec */}
          <div className="mb-16 max-w-[60ch]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
              Our Story
            </p>
            <h1 className="text-headline text-silver-900 mb-5">
              Built for the age of synthetic media.
            </h1>
            <p className="text-lead text-silver-600">
              Free, open, and honest AI content attestation. Built for educators, journalists, HR teams, and anyone who needs to know if content is human or machine-made.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
            {STATS.map(s => (
              <div key={s.label} className="bg-depth-bg border border-white/[0.06] rounded-xl p-5 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-silver-900 mb-1">{s.value}</div>
                <div className="text-xs font-semibold text-silver-900 mb-0.5">{s.label}</div>
                <div className="text-[10px] text-silver-600">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-silver-900 mb-4">Our Mission</h2>
            <div className="bg-depth-bg border border-white/[0.06] rounded-xl p-6 sm:p-8">
              <p className="text-silver-600 text-base leading-relaxed mb-4">
                Aiscern exists because AI-generated content is now indistinguishable from human work at a glance, and the tools to attest it have historically been expensive, inaccurate, or locked behind enterprise contracts.
              </p>
              <p className="text-silver-600 text-base leading-relaxed">
                We are building multi-modal AI attestation that is honest about its accuracy, transparent about its methodology, and free enough for a high-school teacher in a rural district to use it every day. If you can read this, you can use Aiscern.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-silver-900 mb-8">Timeline</h2>
            <div className="relative pl-6 border-l border-white/10 space-y-8">
              {TIMELINE.map(item => (
                <div key={item.title} className="relative">
                  <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent" aria-hidden="true" />
                  <span className="text-accent text-sm font-mono">{item.year}</span>
                  <h3 className="text-silver-900 text-lg font-semibold mt-1 mb-1">{item.title}</h3>
                  <p className="text-silver-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Values */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-silver-900 mb-6">What We Stand For</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VALUES.map((v, i) => (
                <div key={v.title} className="bg-surface border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-all duration-200">
                  <span className="block text-5xl font-bold text-accent/20 mb-3 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-accent/10 border border-accent/20">
                    <v.icon className="w-5 h-5 text-accent" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-silver-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-silver-600 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-silver-900 mb-6">Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEAM.map(member => (
                <div key={member.name} className="bg-surface border border-white/[0.06] rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-accent/10 border-2 border-accent/20
                                    flex items-center justify-center text-lg font-bold text-accent flex-shrink-0">
                      {member.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-silver-900">{member.name}</p>
                      <p className="text-sm text-accent">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-silver-600 leading-relaxed mb-4">{member.bio}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 text-silver-600">
                      <MapPin className="w-3 h-3" aria-hidden="true" /> {member.location}
                    </span>
                    <span className="flex items-center gap-1 text-silver-600">
                      <Briefcase className="w-3 h-3" aria-hidden="true" /> {member.skills}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-depth-bg border border-white/[0.06] rounded-xl p-8 text-center">
            <h2 className="text-2xl font-semibold text-silver-900 mb-3">Start attesting today</h2>
            <p className="text-silver-600 mb-6 leading-relaxed">
              Free tier available — no account required for basic scans.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/detect/text"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                           bg-accent hover:bg-accent-hover text-depth-bg font-semibold text-sm
                           transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50">
                Try Free Attestation <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link href="/methodology"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                           border border-white/[0.08] text-silver-700 hover:border-accent hover:text-accent
                           font-semibold text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/50">
                Read Methodology
              </Link>
            </div>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
