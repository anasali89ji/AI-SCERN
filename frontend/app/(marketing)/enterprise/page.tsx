import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Building2, Shield, Zap, Layers, Lock, Users, CheckCircle, Mail } from 'lucide-react'
import { EnterpriseContactForm } from '@/components/EnterpriseContactForm'

export const metadata: Metadata = {
  title: 'Enterprise — Aiscern AI Attestation at Scale',
  description: 'Custom pricing, SLA guarantees, priority support, and private deployment options for enterprise teams. Contact our sales team.',
  openGraph: {
    title: 'Enterprise Solutions — Aiscern',
    description: 'Aiscern Enterprise: custom limits, SLA, BAA/DPA support, and dedicated onboarding.',
    url: 'https://aiscern.com/enterprise',
    siteName: 'Aiscern',
  },
}

const FEATURES = [
  { icon: Zap, title: 'Custom API Rate Limits', desc: 'No shared infrastructure bottlenecks. Dedicated throughput aligned to your attestation volume requirements.' },
  { icon: Shield, title: 'SLA Guarantees', desc: '99.9% uptime SLA with priority incident response and dedicated status page communication.' },
  { icon: Layers, title: 'Batch Processing at Scale', desc: 'Bulk attest thousands of documents simultaneously via async batch API with webhook callbacks.' },
  { icon: Lock, title: 'Data Processing Agreements', desc: 'GDPR-compliant DPA and BAA available for healthcare and legal customers. Enhanced data handling options.' },
  { icon: Users, title: 'Team Management', desc: 'Centralized billing, role-based access control, audit logs, and team usage dashboards.' },
  { icon: Building2, title: 'Dedicated Onboarding', desc: 'Technical onboarding call, integration support, and a named account manager for enterprise clients.' },
]

const PLANS = [
  { label: 'Pro', price: 'From $49/mo', scans: '5,000 scans/mo', api: 'API access', support: 'Email support', highlight: false },
  { label: 'Team', price: 'From $199/mo', scans: '25,000 scans/mo', api: 'Priority API', support: 'Slack/email support', highlight: true },
  { label: 'Enterprise', price: 'Custom', scans: 'Unlimited / custom', api: 'Dedicated limits + SLA', support: 'Named account manager', highlight: false },
]

export default function EnterprisePage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-[#08080d] pt-16">
        {/* Hero */}
        <section className="pt-10 pb-14 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.10)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-xs font-semibold text-[#2BEE34] mb-6">
              <Building2 className="w-3.5 h-3.5" />
              Enterprise
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-5 leading-tight">
              AI Attestation at<br /><span className="text-[#2BEE34]">Enterprise Scale</span>
            </h1>
            <p className="text-base sm:text-lg text-[#A3A3A3] max-w-2xl mx-auto mb-8 leading-relaxed">
              Custom volumes, SLA guarantees, dedicated support, and compliance-ready data handling for teams that need more than a standard plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="mailto:enterprise@aiscern.com" className="btn-primary w-full sm:w-auto justify-center">
                <Mail className="w-4 h-4" /> Contact Enterprise Sales
              </a>
              <Link href="/pricing" className="btn-secondary w-full sm:w-auto justify-center">View All Plans</Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 border-t border-[#1E1E1E]/20">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-10">What Enterprise Includes</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => {
                const FIcon = f.icon
                return (
                  <div key={i} className="card p-5 rounded-xl border border-[#1E1E1E]">
                    <div className="w-10 h-10 rounded-xl bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center mb-4">
                      <FIcon className="w-5 h-5 text-[#2BEE34]" />
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-2">{f.title}</h3>
                    <p className="text-xs text-[#6B6B6B] leading-relaxed">{f.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Plan Comparison */}
        <section className="py-16 bg-surface/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-white text-center mb-8">Plan Overview</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {PLANS.map((plan, i) => (
                <div key={i} className={`p-6 rounded-xl border ${plan.highlight ? 'border-[#2BEE34]/30 bg-[#2BEE34]/5' : 'border-[#1E1E1E] bg-[#141414]'}`}>
                  <div className="text-sm font-bold text-white mb-1">{plan.label}</div>
                  <div className="text-xl font-black text-white mb-4">{plan.price}</div>
                  <ul className="space-y-2 text-xs text-[#6B6B6B]">
                    {[plan.scans, plan.api, plan.support].map((item, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-[#2BEE34] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-center mt-6">
              <Link href="/pricing" className="text-sm text-[#2BEE34] hover:underline">See full feature comparison on pricing page →</Link>
            </p>
          </div>
        </section>

        {/* Contact Form */}
        <section className="py-16 md:py-20">
          <div className="max-w-2xl 2xl:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="card border border-[#1E1E1E] rounded-xl p-8">
              <h2 className="text-xl font-black text-white mb-2">Talk to Sales</h2>
              <p className="text-sm text-[#6B6B6B] mb-6">Tell us about your use case and we&apos;ll get back within one business day.</p>
              <EnterpriseContactForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
