import Link from 'next/link'
import Image from 'next/image'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Brain, Zap, Globe, Users, GitBranch, MapPin, Briefcase } from 'lucide-react'

export const metadata = {
  title: 'About Aiscern — Free AI Content Detection',
  description: 'Aiscern is a free multi-modal AI content detection platform. Detect AI-generated text, images, audio, and video with ensemble-based analysis and published accuracy benchmarks.',
  openGraph: { title: 'About Aiscern', url: 'https://aiscern.com/about' },
}

const STATS = [
  { label: 'Modalities',       value: '4',    sub: 'text, image, audio, video' },
  { label: 'Detection models', value: '8+',   sub: 'in the ensemble pipeline'  },
  { label: '10 scans/day',      value: 'Free tier', sub: 'no account required'    },
  { label: 'Accuracy',         value: '~85%', sub: 'on text; ~82% images'      },
]

const VALUES = [
  {
    icon: Shield,
    title: 'Transparency first',
    desc:  'We publish our accuracy benchmarks, known limitations, and detection methodology openly. You should know exactly what our scores mean before acting on them.',
  },
  {
    icon: Brain,
    title: 'Ensemble over single models',
    desc:  'No single signal reliably catches all AI content. We combine multiple independent detection signals into one weighted verdict, so each scan is cross-verified before delivering a result.',
  },
  {
    icon: Zap,
    title: 'Accessible to everyone',
    desc:  'AI detection tools should not be locked behind subscriptions. Aiscern offers a free tier for individuals, educators, journalists, and researchers — no account required for basic detection.',
  },
  {
    icon: Globe,
    title: 'Built for everyone',
    desc:  'Developed in Mandi Bahauddin, Pakistan. We believe access to AI literacy tools should not depend on geography or budget.',
  },
]

// Team members — ordered: Founder first, then PM
const TEAM = [
  {
    name:     'Anas Ali',
    role:     'Founder & CEO',
    bio:      'Building Aiscern from Mandi Bahauddin, Pakistan. Passionate about AI transparency, media literacy, and making powerful detection tools accessible to everyone — regardless of budget or geography.',
    photo:    '/anas-ali.jpg',
    location: 'Mandi Bahauddin, Pakistan',
    skills:   'Full-Stack + AI/ML',
    gradient: 'from-primary/30 via-secondary/20 to-primary/20',
    ring:     'border-blue-500/20',
  },
  {
    name:     'Temah',
    role:     'Project Manager',
    bio:      'Overseeing product quality, sprint planning, and cross-functional coordination at Aiscern. Ensuring every release meets the bar for reliability, design consistency, and user experience.',
    photo:    null,
    location: 'Remote',
    skills:   'Product Management',
    gradient: 'from-emerald-600/30 via-teal-600/20 to-cyan-600/30',
    ring:     'border-emerald-500/30',
  },
]

function TeamCard({ member }: { member: typeof TEAM[0] }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f0f17] overflow-hidden hover:border-white/[0.12] transition-all duration-200">
      {/* Gradient header banner */}
      <div className={`h-20 bg-[#141420] relative`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.12),transparent)]" />
      </div>
      <div className="px-3 sm:px-6 pb-5 -mt-8 sm:-mt-10">
        {/* Avatar */}
        <div className={`w-20 h-20 rounded-full overflow-hidden ring-1 ring-white/[0.08] mb-4 bg-blue-600 flex items-center justify-center`}>
          {member.photo ? (
            <Image
              src={member.photo}
              alt={`${member.name} — ${member.role}`}
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-black text-white select-none">
              {member.name.charAt(0)}
            </span>
          )}
        </div>
        <h3 className="text-lg font-black text-slate-100">{member.name}</h3>
        <p className="text-sm text-blue-400 font-bold mb-3">{member.role}</p>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">{member.bio}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2.5 py-1 rounded-full bg-[#141420] border border-white/[0.08]">
            <MapPin className="w-3 h-3 text-blue-400" /> {member.location}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2.5 py-1 rounded-full bg-[#141420] border border-white/[0.08]">
            <Briefcase className="w-3 h-3 text-blue-400" /> {member.skills}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#08080d] text-slate-100">
      <SiteNav />

      <main className="pt-16 sm:pt-24 pb-12 sm:pb-20 max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl mx-auto px-3 sm:px-4 2xl:px-8">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold mb-4">
            <Users className="w-3 h-3" /> About us
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            AI detection that&apos;s <span className="gradient-text">actually free</span>
          </h1>
          <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Aiscern is a multi-modal AI content detection platform built to give everyone access to the tools they need to navigate a world full of synthetic media.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {STATS.map(s => (
            <div key={s.label} className="rounded-xl border border-white/[0.08] bg-[#0f0f17] p-5 text-center">
              <p className="text-3xl font-black gradient-text mb-1">{s.value}</p>
              <p className="text-xs font-bold text-slate-100 mb-0.5">{s.label}</p>
              <p className="text-xs text-slate-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 sm:p-8 mb-10 sm:mb-14">
          <h2 className="text-lg sm:text-xl font-black mb-3">Our mission</h2>
          <p className="text-slate-500 leading-relaxed mb-4">
            AI-generated content is proliferating faster than the tools to understand it. Deepfakes influence elections. Synthetic text floods classrooms. AI audio clones voices of public figures. The people most affected by this — journalists, teachers, researchers, everyday users — often have the least access to reliable detection tools.
          </p>
          <p className="text-slate-500 leading-relaxed">
            Aiscern exists to change that. We build production-grade AI detection for every modality and make it freely accessible. We also commit to being honest about what detection can and cannot do — publishing our accuracy numbers, limitations, and methodology openly rather than overselling what AI detection is capable of.
          </p>
        </div>

        {/* Values */}
        <div className="mb-14">
          <h2 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 text-center">What we stand for</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-white/[0.08] bg-[#0f0f17] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-slate-100">{title}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Team — always before tech stack (1.3 fix) ── */}
        <div className="mb-14">
          <h2 className="text-lg sm:text-xl font-black mb-2 text-center">The team</h2>
          <p className="text-slate-500 text-sm text-center mb-8 max-w-lg mx-auto">
            A small, focused team building AI transparency tools from Pakistan.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {TEAM.map(member => (
              <TeamCard key={member.name} member={member} />
            ))}
          </div>
        </div>

        {/* Tech stack — moved after team (1.3 fix) */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0f0f17] p-4 sm:p-6 mb-10 sm:mb-14">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-blue-400" />
            <h2 className="font-black text-lg">Built with</h2>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed mb-4">
            Aiscern is built on Next.js 15, TypeScript, Tailwind CSS, Supabase, Cloudflare R2, and a pipeline of HuggingFace inference models backed by NVIDIA NIM for GPU acceleration. Detection models are an ensemble of fine-tuned classifiers trained on public benchmarks and continuously updated as new generators emerge.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Next.js 15', 'TypeScript', 'Supabase', 'Cloudflare R2', 'HuggingFace', 'NVIDIA NIM', 'Inngest', 'Vercel'].map(t => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[#141420] border border-white/[0.08] text-slate-500">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black">Try it free</h2>
          <p className="text-slate-500">No account needed. Free tier available — no credit card required.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/detect/text" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors">
              Detect Text →
            </Link>
            <Link href="/detect/image" className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#0f0f17] font-bold text-sm hover:border-white/[0.12] transition-colors">
              Detect Images
            </Link>
            <Link href="/methodology" className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#0f0f17] font-bold text-sm hover:border-white/[0.12] transition-colors">
              How It Works
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
