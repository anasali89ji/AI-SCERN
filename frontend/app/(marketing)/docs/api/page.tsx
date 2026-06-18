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
    <div className="min-h-screen bg-[#08080d] text-slate-100">
      <div className="border-b border-white/[0.08] px-6 py-4">
        <Link href="/" className="text-xl font-black gradient-text">Aiscern</Link>
      </div>
      <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 2xl:px-8 py-12 space-y-10">
        <div>
          <h1 className="text-4xl font-black mb-3">API Documentation</h1>
          <p className="text-slate-500">Programmatic access to Aiscern detection. Free for all registered users.</p>
        </div>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">Authentication</h2>
          <p className="text-slate-500 text-sm">Include your API key in every request using the <code className="bg-[#141420] px-1.5 py-0.5 rounded text-blue-400 text-xs">X-API-Key</code> header.</p>
          <p className="text-slate-500 text-sm">Generate your API key in <Link href="/settings" className="text-blue-500 hover:underline">Settings → API Access</Link> — free for all users.</p>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">POST /api/v1/detect/text</h2>
          <p className="text-slate-500 text-sm">Analyze a text sample for AI generation.</p>
          <h3 className="font-semibold text-sm">Request Body</h3>
          <pre className="bg-[#141420] rounded-xl p-4 text-xs overflow-x-auto text-green-400">{`{ "text": "string (50–10,000 characters)" }`}</pre>
          <h3 className="font-semibold text-sm">Response</h3>
          <pre className="bg-[#141420] rounded-xl p-4 text-xs overflow-x-auto text-blue-400">{`{
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
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{lang}</h3>
              <pre className="bg-[#141420] rounded-xl p-4 text-xs overflow-x-auto text-slate-400">{code}</pre>
            </div>
          ))}
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.08]">
                {['Plan', 'Monthly Credits', 'Rate Limit'].map(h => <th key={h} className="text-left py-2 px-3 text-slate-500 text-xs">{h}</th>)}
              </tr></thead>
              <tbody>
                {[['Free', 'Unlimited', '60 req/min']].map(([plan, credits, limit]) => (
                  <tr key={plan} className="border-b border-white/[0.08]">
                    <td className="py-2 px-3 text-slate-100 font-semibold">{plan}</td>
                    <td className="py-2 px-3 text-slate-400">{credits}</td>
                    <td className="py-2 px-3 text-slate-400">{limit}</td>
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
