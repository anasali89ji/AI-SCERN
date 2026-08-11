import { redirect } from 'next/navigation'

// /how-it-works redirects to /methodology
// The methodology page covers detection pipeline in full detail
export default function HowItWorksPage() {
  redirect('/methodology')
}

export const metadata = {
  title: 'How It Works — AI Verification Methodology',
  description: 'Learn how Aiscern verifies AI-generated text, images, audio, and video using ensemble models.',
}
