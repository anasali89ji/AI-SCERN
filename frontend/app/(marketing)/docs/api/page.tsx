import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'API Documentation | Aiscern AI Detection REST API',
  description: 'Integrate AI content detection into your app. Free REST API for detecting AI text, images, audio and video.',
  alternates: { canonical: 'https://aiscern.com/docs/api' },
}

import Link from 'next/link'
import { Shield } from 'lucide-react'

const CODE = {
  curl: `curl -X POST https://aiscern.com/api/v1/detect/text \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "The text you want to analyze goes here..."}'`,

  python: `import requests

response = requests.post(
    "https://aiscern.com/api/v1/detect/text",
    headers={"X-API-Key": "YOUR_API_KEY"},
    json={"text": "The text you want to analyze goes here..."}
)
result = response.json()
print(result["verdict"])  # "AI", "HUMAN", or "UNCERTAIN"`,

  js: `const response = await fetch('https://aiscern.com/api/v1/detect/text', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: 'The text you want to analyze...' }),
})
const { verdict, confidence } = await response.json()`,
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-border px-6 py-4">
        <Link href="/" className="text-xl font-black gradient-text">DETECTAI</Link>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div>
          <h1 className="text-4xl font-black mb-3">API Documentation</h1>
          <p className="text-text-muted">Programmatic access to DETECTAI. Available on Pro and Enterprise plans.</p>
        </div>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">Authentication</h2>
          <p className="text-text-muted text-sm">Include your API key in every request using the <code className="bg-surface-active px-1.5 py-0.5 rounded text-primary text-xs">X-API-Key</code> header.</p>
          <p className="text-text-muted text-sm">Generate your API key in <Link href="/settings" className="text-primary hover:underline">Settings → API Access</Link> (Pro/Enterprise only).</p>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">POST /api/v1/detect/text</h2>
          <p className="text-text-muted text-sm">Analyze a text sample for AI generation.</p>
          <h3 className="font-semibold text-sm">Request Body</h3>
          <pre className="bg-surface-active rounded-xl p-4 text-xs overflow-x-auto text-green-400">{`{ "text": "string (50–10,000 characters)" }`}</pre>
          <h3 className="font-semibold text-sm">Response</h3>
          <pre className="bg-surface-active rounded-xl p-4 text-xs overflow-x-auto text-cyan-400">{`{
  "verdict": "AI" | "HUMAN" | "UNCERTAIN",
  "confidence": 0.94,
  "credits_remaining": 498,
  "processing_time": 1240
}`}</pre>
        </section>

        <section className="card p-6 space-y-5">
          <h2 className="text-xl font-bold">Code Examples</h2>
          {Object.entries(CODE).map(([lang, code]) => (
            <div key={lang}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{lang}</h3>
              <pre className="bg-surface-active rounded-xl p-4 text-xs overflow-x-auto text-text-secondary">{code}</pre>
            </div>
          ))}
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {['Plan', 'Monthly Credits', 'Rate Limit'].map(h => <th key={h} className="text-left py-2 px-3 text-text-muted text-xs">{h}</th>)}
              </tr></thead>
              <tbody>
                {[['Pro', '500/month', '60 req/min'], ['Enterprise', 'Unlimited', '300 req/min']].map(([plan, credits, limit]) => (
                  <tr key={plan} className="border-b border-border/50">
                    <td className="py-2 px-3 text-text-primary font-semibold">{plan}</td>
                    <td className="py-2 px-3 text-text-secondary">{credits}</td>
                    <td className="py-2 px-3 text-text-secondary">{limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="text-center">
          <Link href="/pricing" className="btn-primary px-6 py-3 rounded-xl inline-flex items-center gap-2">
            <Shield className="w-4 h-4" /> Get API Access
          </Link>
        </div>
      </div>
    </div>
  )
}
