import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | Aiscern AI Detector',
  description: 'Aiscern privacy policy. We do not sell your data, display ads, or require personal information to use our AI detection tools.',
}

const LAST_UPDATED = 'March 20, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Aiscern" className="w-8 h-auto object-contain" />
            <span className="font-black gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-text-primary mb-3">Privacy Policy</h1>
          <p className="text-text-muted">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose-aiscern space-y-8">
          <Section title="1. Introduction">
            <p>
              Welcome to Aiscern (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), operated by Anas Ali. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our AI content detection platform at{' '}
              <a href="https://aiscern.com" className="text-primary hover:underline">aiscern.com</a>.
            </p>
            <p>
              By using Aiscern, you agree to the collection and use of information as described in this policy. If you do not
              agree, please discontinue use of our services.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <SubSection title="2.1 Information You Provide">
              <ul>
                <li><strong>Account data:</strong> Email address, username, and password when you register</li>
                <li><strong>Content you submit:</strong> Text, images, audio, or video files you upload for detection analysis</li>
                <li><strong>Chat messages:</strong> Conversations with our AI assistant</li>
                <li><strong>Profile information:</strong> Any optional details you choose to add</li>
              </ul>
            </SubSection>
            <SubSection title="2.2 Automatically Collected Data">
              <ul>
                <li><strong>Usage data:</strong> Pages visited, features used, detection history, timestamps</li>
                <li><strong>Device information:</strong> Browser type, operating system, screen resolution</li>
                <li><strong>IP address:</strong> For security, rate limiting, and fraud prevention</li>
                <li><strong>Cookies:</strong> Authentication tokens and session management (see Section 7)</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul>
              <li>Providing and improving the Aiscern detection service</li>
              <li>Processing your submitted content through AI models to generate detection results</li>
              <li>Maintaining your account and authentication</li>
              <li>Storing your scan history for your reference</li>
              <li>Improving our AI models and detection accuracy using anonymized, aggregated data</li>
              <li>Responding to support requests</li>
              <li>Sending service-related notifications (no marketing without consent)</li>
              <li>Detecting and preventing fraud, abuse, or security threats</li>
            </ul>
          </Section>

          <Section title="4. Content You Submit">
            <p>
              Files you upload for analysis are processed by our AI models and results are returned to you. We store detection
              results in your scan history. Uploaded files may be temporarily cached for processing purposes and are not
              permanently stored beyond what is necessary for the service.
            </p>
            <p>
              <strong>We do not sell, share, or use your submitted content</strong> for any purpose other than providing the
              detection service to you.
            </p>
          </Section>

          <Section title="5. Data Sharing & Third Parties">
            <p>We use the following third-party services that may process your data:</p>
            <ul>
              <li><strong>Supabase:</strong> Database and authentication (EU/US infrastructure)</li>
              <li><strong>Vercel:</strong> Hosting and edge functions</li>
              <li><strong>Hugging Face:</strong> AI model inference</li>
              <li><strong>AI Vision Services:</strong> Advanced vision model for image analysis</li>
              <li><strong>Cloudflare:</strong> CDN, edge workers</li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We do not share your data with advertisers.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <ul>
              <li><strong>Account data:</strong> Retained until you delete your account</li>
              <li><strong>Scan history:</strong> Retained for 12 months, then automatically deleted</li>
              <li><strong>Uploaded files:</strong> Deleted within 24 hours of processing</li>
              <li><strong>Chat logs:</strong> Retained for 30 days for quality improvement, then deleted</li>
            </ul>
          </Section>

          <Section title="7. Cookies">
            <p>Aiscern uses strictly necessary cookies for:</p>
            <ul>
              <li>Authentication session management (Supabase auth tokens)</li>
              <li>Security CSRF protection</li>
              <li>User preferences (theme, language)</li>
            </ul>
            <p>We do not use tracking cookies, advertising cookies, or third-party analytics cookies.</p>
          </Section>

          <Section title="8. Security">
            <p>
              We implement industry-standard security measures including TLS encryption in transit, hashed passwords,
              row-level security in our database, and regular security reviews. However, no system is 100% secure and
              we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update inaccurate personal data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Portability:</strong> Export your scan history in JSON format</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
            </ul>
            <p>
              To exercise these rights, contact us at <a href="mailto:privacy@aiscern.com" className="text-primary hover:underline">privacy@aiscern.com</a>.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              Aiscern is not intended for users under 13 years of age. We do not knowingly collect data from children.
              If you believe a child has provided us with personal information, please contact us immediately.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant changes via email
              or a prominent notice on the platform. Continued use of Aiscern after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              For privacy-related questions or requests, contact:<br />
              <strong>Anas Ali</strong> — Developer & Data Controller<br />
              Email: <a href="mailto:privacy@aiscern.com" className="text-primary hover:underline">privacy@aiscern.com</a><br />
              Website: <a href="https://aiscern.com" className="text-primary hover:underline">aiscern.com</a>
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-text-primary mb-4 pb-2 border-b border-border">{title}</h2>
      <div className="space-y-3 text-text-secondary text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
      <div className="text-text-secondary text-sm leading-relaxed">{children}</div>
    </div>
  )
}
