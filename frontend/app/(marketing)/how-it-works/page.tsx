import { redirect } from 'next/navigation'

// /how-it-works redirects to /methodology
// The methodology page covers attestation pipeline in full detail
export default function HowItWorksPage() {
  redirect('/methodology')
}

export const metadata = {
  title: 'How Aiscern Works — AI Attestation Methodology',
  description: 'Learn how Aiscern attests AI-generated text, images, audio, and video using ensemble models.',
}
