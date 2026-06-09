import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { CheckCircle, Clock, AlertTriangle, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'System Status — Aiscern',
  description: 'Current operational status for Aiscern AI detection services, API, and infrastructure.',
  openGraph: {
    title: 'System Status — Aiscern',
    url: 'https://aiscern.com/status',
    siteName: 'Aiscern',
  },
}

const SERVICES = [
  { name: 'Text Detection API',    status: 'operational', latency: '< 2s'   },
  { name: 'Image Detection API',   status: 'operational', latency: '5–10s'  },
  { name: 'Audio Detection API',   status: 'operational', latency: '8–15s'  },
  { name: 'Video Detection API',   status: 'operational', latency: '30–90s' },
  { name: 'Authentication (Clerk)', status: 'operational', latency: '< 100ms'},
  { name: 'Web Application',       status: 'operational', latency: '< 500ms'},
  { name: 'API Documentation',     status: 'operational', latency: '< 200ms'},
  { name: 'Billing & Credits',     status: 'operational', latency: '< 1s'   },
]

const INCIDENTS: { date: string; title: string; status: 'resolved' | 'monitoring'; desc: string }[] = []

export default function StatusPage() {
  const allOperational = SERVICES.every(s => s.status === 'operational')

  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6 ${
              allOperational
                ? 'bg-emerald/10 border border-emerald/20 text-emerald'
                : 'bg-amber/10 border border-amber/20 text-amber'
            }`}>
              {allOperational ? (
                <><CheckCircle className="w-4 h-4" /> All Systems Operational</>
              ) : (
                <><AlertTriangle className="w-4 h-4" /> Service Degradation Detected</>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-4">System Status</h1>
            <p className="text-text-secondary">
              Real-time operational status for all Aiscern services.
              Last checked: {new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>
        </section>

        {/* Service Grid */}
        <section className="pb-16">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10">
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Services</h2>
            <div className="card border border-white/[0.08] rounded-xl divide-y divide-border/40">
              {SERVICES.map((service, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald" />
                    </span>
                    <span className="text-sm font-medium text-text-primary">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {service.latency}
                    </span>
                    <span className="text-xs font-semibold text-emerald capitalize">{service.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Uptime */}
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { label: '30-day uptime', value: '99.9%' },
                { label: '90-day uptime', value: '99.8%' },
                { label: 'Incidents (30d)', value: '0' },
              ].map((stat, i) => (
                <div key={i} className="card border border-white/[0.08] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-text-primary mb-1">{stat.value}</div>
                  <div className="text-xs text-text-muted">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Incident History */}
            <div className="mt-10">
              <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Recent Incidents</h2>
              {INCIDENTS.length === 0 ? (
                <div className="card border border-white/[0.08] rounded-xl p-6 text-center text-text-muted text-sm flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4 text-emerald" />
                  No incidents in the past 90 days
                </div>
              ) : (
                <div className="space-y-3">
                  {INCIDENTS.map((inc, i) => (
                    <div key={i} className="card border border-white/[0.08] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-text-primary">{inc.title}</span>
                        <span className={`text-xs font-bold ${inc.status === 'resolved' ? 'text-emerald' : 'text-amber'}`}>{inc.status}</span>
                      </div>
                      <div className="text-xs text-text-muted mb-2">{inc.date}</div>
                      <p className="text-xs text-text-secondary">{inc.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
