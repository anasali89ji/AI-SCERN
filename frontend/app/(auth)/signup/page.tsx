import type { Metadata } from 'next'
import SignUpContentPage from './signup-content'

export const metadata: Metadata = {
  title: 'Sign Up | Aiscern — Free AI Detector',
  description: 'Create a free Aiscern account to detect AI-generated text, images, audio, and video.',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return <SignUpContentPage />
}
