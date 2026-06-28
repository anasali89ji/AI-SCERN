import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Brain, Zap, Globe, MapPin, Briefcase, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'About Aiscern — Free AI Content Detection',
  description: 'Aiscern is a free multi-modal AI content detection platform built in Mandi Bahauddin, Pakistan. Detect AI-generated text, images, audio, and video with ensemble-based analysis and published accuracy benchmarks.',
  openGraph: { title: 'About Aiscern', url: 'https://aiscern.com/about' },
}

const STATS = [
  { label: 'Modalities',       value: '4',    sub: 'text, image, audio, video' },
  { label: 'Detection models', value: '8+',   sub: 'in the ensemble pipeline'  },
  { label: 'Free tier',        value: '10/day', sub: 'no account required'     },
  { label: 'Text accuracy',    value: '~85%', sub: 'on text, ~82% images'      },
]

const VALUES = [
  {
    icon: Shield,
    title: 'Transparency first',
    desc: 'We publish our accuracy benchmarks, known limitations, and detection methodology openly. You should know exactly what our scores mean before acting on them.',
  },
  {
    icon: Brain,
    title: 'Ensemble over single models',
    desc: 'No single signal reliably catches all AI content. We combine multiple independent detection signals into one weighted verdict, so each scan is cross-verified before delivering a result.',
  },
  {
    icon: Zap,
    title: 'Accessible to everyone',
    desc: 'AI detection tools should not be locked behind subscriptions. Aiscern offers a free tier for individuals, educators, journalists, and researchers — no account required for basic detection.',
  },
  {
    icon: Globe,
    title: 'Built for everyone',
    desc: 'Developed in Mandi Bahauddin, Pakistan. We believe access to AI literacy tools should not depend on geography or budget.',
  },
]

const TEAM = [
  {
    name:     'Anas Ali',
    role:     'Founder & CEO',
    bio:      'Building Aiscern from Mandi Bahauddin, Pakistan. Passionate about AI transparency, media literacy, and making powerful detection tools accessible to everyone — regardless of budget or geography.',
    location: 'Mandi Bahauddin, Pakistan',
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
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
              Our Story
            </p>
            <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-5">
              About Aiscern
            </h1>
            <p className="text-[#A3A3A3] text-lg max-w-2xl mx-auto leading-relaxed">
              Free, open, and honest AI content detection. Built for educators, journalists, HR teams, and anyone who needs to know if content is human or machine-made.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
            {STATS.map(s => (
              <div key={s.label} className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-5 text-center">
                <div className="text-2xl sm:text-3xl font-black text-white mb-1">{s.value}</div>
                <div className="text-xs font-semibold text-white mb-0.5">{s.label}</div>
                <div className="text-[10px] text-[#6B6B6B]">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
            <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-6 sm:p-8">
              <p className="text-[#A3A3A3] text-base leading-relaxed mb-4">
                Aiscern exists because AI-generated content is now indistinguishable from human work at a glance, and the tools to detect it have historically been expensive, inaccurate, or locked behind enterprise contracts.
              </p>
              <p className="text-[#A3A3A3] text-base leading-relaxed">
                We are building multi-modal AI detection that is honest about its accuracy, transparent about its methodology, and free enough for a high-school teacher in a rural district to use it every day. If you can read this, you can use Aiscern.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-6">What We Stand For</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VALUES.map(v => (
                <div key={v.title} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-6 hover:border-[#2A2A2A] transition-all duration-200">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-[#2BEE34]/10 border border-[#2BEE34]/20">
                    <v.icon className="w-5 h-5 text-[#2BEE34]" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{v.title}</h3>
                  <p className="text-sm text-[#A3A3A3] leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-6">Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEAM.map(member => (
                <div key={member.name} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-[#2BEE34]/10 border-2 border-[#2BEE34]/20
                                    flex items-center justify-center text-lg font-black text-[#2BEE34] flex-shrink-0">
                      {member.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-sm text-[#2BEE34]">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#A3A3A3] leading-relaxed mb-4">{member.bio}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 text-[#6B6B6B]">
                      <MapPin className="w-3 h-3" /> {member.location}
                    </span>
                    <span className="flex items-center gap-1 text-[#6B6B6B]">
                      <Briefcase className="w-3 h-3" /> {member.skills}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-8 text-center">
            <h2 className="text-2xl font-semibold text-white mb-3">Start detecting today</h2>
            <p className="text-[#A3A3A3] mb-6 leading-relaxed">
              Free tier available — no account required for basic scans.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/detect/text"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                           bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                           transition-colors duration-150">
                Try Free Detector <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/methodology"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                           border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]
                           font-semibold text-sm transition-all duration-150">
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
