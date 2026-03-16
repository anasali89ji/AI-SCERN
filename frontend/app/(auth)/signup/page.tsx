import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-primary" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black text-text-primary">Create account</h1>
          <p className="text-text-muted mt-2 text-sm">Start detecting AI-generated content</p>
        </div>
        <SignUp
          path="/signup"
          routing="path"
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  )
}
