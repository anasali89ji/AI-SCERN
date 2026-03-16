import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SignIn
        routing="hash"
        forceRedirectUrl="/dashboard"
        signUpUrl="/signup"
      />
    </div>
  )
}
