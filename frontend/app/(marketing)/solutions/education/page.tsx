import type { Metadata } from 'next'
import { GraduationCap } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Education | Aiscern',
  description: 'Detect AI-generated essays, ChatGPT submissions, and academic dishonesty with sentence-level heatmaps. Free tier for educators.',
}

export default function EducationSolutionPage() {
  return (
    <SolutionPage
      industry="Education"
      tagline="Protect Academic Integrity at Scale"
      description="Aiscern gives educators and institutions a sentence-level heatmap of AI-generated content in student work — catching ChatGPT, Claude, Gemini, and other models other tools miss."
      icon={GraduationCap}
      color="#2563eb"
      heroImage="/solutions/hero-education.jpg"
      actionImage="/solutions/action-education.jpg"
      stats={[
        { value: '~85%', label: 'Text detection accuracy' },
        { value: '<3s',  label: 'Average scan time' },
        { value: 'Free', label: 'Tier available' },
      ]}
      painPoints={[
        {
          problem: 'Students submitting ChatGPT essays — academic integrity eroding class by class.',
          solution: 'Sentence-level heatmap shows exactly which sections are likely AI-generated, with confidence scores per paragraph.',
        },
        {
          problem: 'Existing tools only give a single percentage score with no explanation.',
          solution: 'Aiscern breaks down every sentence: human-written (green), uncertain (amber), likely AI (red).',
        },
        {
          problem: 'Paraphrasing tools let students evade simple pattern-matching detectors.',
          solution: 'Ensemble of 3 RoBERTa models analyzes linguistic signals, not surface patterns — harder to fool.',
        },
        {
          problem: 'No audit trail when students dispute a result.',
          solution: 'Every scan produces a shareable, timestamped report link you can include in grade appeals.',
        },
      ]}
      useCases={[
        { title: 'Essay & Assignment Review', desc: 'Paste or upload student essays for instant AI probability scoring with sentence-level breakdown.' },
        { title: 'Batch Grading', desc: 'Submit up to 20 documents at once — ideal for large classes and end-of-term workloads.' },
        { title: 'Research Paper Verification', desc: 'Check undergraduate and postgraduate research papers before submission to journals.' },
        { title: 'Discussion Board Monitoring', desc: 'Scan forum posts and online discussion contributions for AI-generated responses.' },
        { title: 'Code Assignment Review', desc: 'Detect AI-generated code in programming assignments alongside written explanations.' },
        { title: 'Take-Home Exam Auditing', desc: 'Verify authenticity of take-home exam answers with timestamped, shareable evidence.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Scan a Student Essay"
      toolName="AI Text Detector"
    />
  )
}
