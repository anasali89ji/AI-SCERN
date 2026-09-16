import { Suspense } from 'react'
import SignupContent from './signup-content'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-deep" />}>
      <SignupContent />
    </Suspense>
  )
}
