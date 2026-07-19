'use client'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

export function EnterpriseContactForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [company, setCompany]     = useState('')
  const [useCase, setUseCase]     = useState('')

  const buildMailto = () => {
    const subject = `Enterprise Inquiry — ${company || 'New Prospect'}`
    const body = [
      `Name: ${firstName} ${lastName}`.trim(),
      `Email: ${email}`,
      `Company: ${company}`,
      '',
      'Use case:',
      useCase,
    ].join('\n')
    return `mailto:enterprise@aiscern.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">First Name</label>
          <input type="text" placeholder="Jane" className="input-field" value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Last Name</label>
          <input type="text" placeholder="Smith" className="input-field" value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Work Email</label>
        <input type="email" placeholder="jane@company.com" className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Company</label>
        <input type="text" placeholder="Acme Corp" className="input-field" value={company} onChange={e => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Use Case</label>
        <textarea rows={3} placeholder="Describe your attestation needs, expected volume, and any integration requirements..." className="input-field resize-none" value={useCase} onChange={e => setUseCase(e.target.value)} />
      </div>
      <a href={buildMailto()} className="btn-primary w-full justify-center">
        Send Inquiry <ArrowRight className="w-4 h-4" />
      </a>
      <p className="text-xs text-[#6B6B6B] text-center">Or email us directly at enterprise@aiscern.com</p>
    </div>
  )
}
