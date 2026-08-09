'use client'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

const INPUT_CLASS =
  'w-full min-h-11 bg-[#08080d] border border-[#333333] rounded-xl px-4 py-3 text-[16px] sm:text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#2BEE34] transition-colors'

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
          <input type="text" placeholder="Jane" className={INPUT_CLASS} value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Last Name</label>
          <input type="text" placeholder="Smith" className={INPUT_CLASS} value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Work Email</label>
        <input type="email" placeholder="jane@company.com" className={INPUT_CLASS} value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Company</label>
        <input type="text" placeholder="Acme Corp" className={INPUT_CLASS} value={company} onChange={e => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">Use Case</label>
        <textarea rows={3} placeholder="Describe your attestation needs, expected volume, and any integration requirements..." className={`${INPUT_CLASS} resize-none`} value={useCase} onChange={e => setUseCase(e.target.value)} />
      </div>
      <a href={buildMailto()} className="btn-primary w-full justify-center">
        Send Inquiry <ArrowRight className="w-4 h-4" />
      </a>
      <p className="text-xs text-[#6B6B6B] text-center">Or email us directly at enterprise@aiscern.com</p>
    </div>
  )
}
