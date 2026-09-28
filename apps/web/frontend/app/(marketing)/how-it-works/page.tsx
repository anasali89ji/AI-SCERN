import { redirect } from 'next/navigation'

// /how-it-works redirects to /methodology
// The methodology page covers detection pipeline in full detail
export default function HowItWorksPage() {
  redirect('/methodology')
}

export const metadata = {
  title: 'How Aiscern Verifies AI Content — Detection Methodology',
  description: 'Learn how Aiscern verifies AI-generated text, images, audio, and video — the ensemble detection models behind every verification result.',
}
