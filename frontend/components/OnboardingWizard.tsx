'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import {
  Sparkles, ArrowRight, SkipForward, LayoutDashboard, Image as ImageIcon,
  FileText, Clock, Settings, CheckCircle2, X
} from 'lucide-react';
import { isFirstTimeUser } from '@/lib/onboarding/detect-first-run';
import { completeOnboarding, skipOnboarding, updateOnboardingStep } from '@/lib/onboarding/store';

const TOTAL_STEPS = 4;

const USE_CASES = [
  {
    id: 'content-creator',
    title: 'Content Creator',
    description: 'I verify my content before publishing',
    icon: '✍️',
  },
  {
    id: 'educator',
    title: 'Educator',
    description: 'I check student work for AI-generated text',
    icon: '🎓',
  },
  {
    id: 'researcher',
    title: 'Researcher',
    description: 'I audit datasets and publications',
    icon: '🔬',
  },
  {
    id: 'developer',
    title: 'Developer',
    description: 'I integrate detection into my app',
    icon: '💻',
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    description: 'I need organization-wide content verification',
    icon: '🏢',
  },
];

const TOUR_STEPS = [
  {
    target: '[data-tour="overview"]',
    title: 'Overview',
    description: 'Your command center. See all activity at a glance.',
  },
  {
    target: '[data-tour="image"]',
    title: 'Image Detection',
    description: 'Upload or paste an image to detect AI generation.',
  },
  {
    target: '[data-tour="history"]',
    title: 'History',
    description: "Every scan you've ever run lives here.",
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings',
    description: 'Manage your API keys, integrations, and preferences.',
  },
];

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [tourIndex, setTourIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { user } = useUser();
  const router = useRouter();

  const handleNext = useCallback(async () => {
   if (currentStep < TOTAL_STEPS) {
      if (user?.id) {
        try {
          await updateOnboardingStep(user.id, currentStep + 1, selectedUseCase || undefined);
        } catch (err) {
          console.error('Failed to persist onboarding step (continuing anyway):', err);
        }
      }
      setCurrentStep((s) => s + 1);
    } else {
      // Final step — complete onboarding
      if (user?.id) {
        try {
          await completeOnboarding(user.id, selectedUseCase || undefined);
        } catch (err) {
          console.error('Failed to persist onboarding completion (continuing anyway):', err);
        }
      }
      setIsVisible(false);
      onComplete?.();
      // Navigate to first scan
      router.push('/detect/text');
    }
  }, [currentStep, user, selectedUseCase, onComplete, router]);

  const handleSkip = useCallback(async () => {
    if (user?.id) {
      try {
        await skipOnboarding(user.id);
      } catch (err) {
        console.error('Failed to persist onboarding skip (continuing anyway):', err);
      }
    }
    setIsVisible(false);
    onSkip?.();
  }, [user, onSkip]);

  const handleTourNext = useCallback(() => {
    if (tourIndex < TOUR_STEPS.length - 1) {
      setTourIndex((i) => i + 1);
    } else {
      handleNext();
    }
  }, [tourIndex, handleNext]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm" onClick={handleSkip} />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-10"
          >
            {/* Progress Bar */}
            <div className="w-full bg-neutral-800 rounded-full h-1.5 mb-8">
              <motion.div
                className="bg-primary h-1.5 rounded-full"
                initial={false}
                animate={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-neutral-500 text-xs text-center mb-6">
              Step {currentStep} of {TOTAL_STEPS}
            </p>

            {/* Step Content */}
            {currentStep === 1 && (
              <StepWelcome onNext={handleNext} onSkip={handleSkip} />
            )}
            {currentStep === 2 && (
              <StepUseCase
                selected={selectedUseCase}
                onSelect={setSelectedUseCase}
                onNext={handleNext}
                onSkip={handleSkip}
              />
            )}
            {currentStep === 3 && (
              <StepTour
                step={TOUR_STEPS[tourIndex]}
                tourIndex={tourIndex}
                totalTourSteps={TOUR_STEPS.length}
                onNext={handleTourNext}
                onSkip={handleSkip}
              />
            )}
            {currentStep === 4 && (
              <StepFirstScan onComplete={handleNext} onSkip={handleSkip} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Step 1: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <Image src="/logo.png" alt="Aiscern" width={64} height={64} className="animate-pulse" />
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Welcome to Aiscern</h2>
      <p className="text-neutral-400 mb-8">AI-powered detection for the modern web.</p>
      <button
        onClick={onNext}
        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Get Started <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={onSkip}
        className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

// ── Step 2: Use Case Selection ───────────────────────────────────────────────
function StepUseCase({
  selected,
  onSelect,
  onNext,
  onSkip,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white text-center mb-2">What brings you here?</h2>
      <p className="text-neutral-400 text-sm text-center mb-6">Select one to personalize your experience.</p>
      <div className="grid grid-cols-1 gap-3 mb-6">
        {USE_CASES.map((useCase) => (
          <button
            key={useCase.id}
            onClick={() => onSelect(useCase.id)}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left
              ${selected === useCase.id
                ? 'ring-2 ring-primary bg-primary/10 border-primary'
                : 'bg-neutral-800/50 border-neutral-700 hover:bg-neutral-800'
              }`}
          >
            <span className="text-2xl">{useCase.icon}</span>
            <div>
              <p className="text-white font-medium text-sm">{useCase.title}</p>
              <p className="text-neutral-400 text-xs">{useCase.description}</p>
            </div>
            {selected === useCase.id && (
              <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={onSkip} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          Skip
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="bg-primary hover:bg-primary/90 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold rounded-xl h-10 px-6 transition-all active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Interactive Tool Tour ────────────────────────────────────────────
function StepTour({
  step,
  tourIndex,
  totalTourSteps,
  onNext,
  onSkip,
}: {
  step: { target: string; title: string; description: string };
  tourIndex: number;
  totalTourSteps: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(step.target);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [step.target]);

  return (
    <>
      {/* Spotlight overlay with cutout */}
      {rect && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div
            className="absolute inset-0 bg-neutral-950/80"
            style={{
              clipPath: `polygon(
                0% 0%, 0% 100%, ${rect.left}px 100%, ${rect.left}px ${rect.top}px,
                ${rect.right}px ${rect.top}px, ${rect.right}px ${rect.bottom}px,
                ${rect.left}px ${rect.bottom}px, ${rect.left}px 100%,
                100% 100%, 100% 0%
              )`,
            }}
          />
        </div>
      )}

      {/* Tooltip */}
      <div className="relative z-50">
        <h2 className="text-xl font-bold text-white text-center mb-2">Quick Tour</h2>
        <div className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
              {tourIndex + 1} / {totalTourSteps}
            </span>
          </div>
          <p className="text-white font-semibold">{step.title}</p>
          <p className="text-neutral-400 text-sm mt-1">{step.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onSkip} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
            Skip Tour
          </button>
          <button
            onClick={onNext}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-10 px-6 transition-all active:scale-[0.98]"
          >
            {tourIndex === totalTourSteps - 1 ? 'Finish Tour' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Step 4: First Scan Guidance ──────────────────────────────────────────────
function StepFirstScan({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">You're all set!</h2>
      <p className="text-neutral-400 text-sm mb-6">
        Let's run your first detection. We'll take you to the text scanner and pre-fill a sample.
      </p>
      <button
        onClick={onComplete}
        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Start First Scan <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={onSkip}
        className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        I'll explore on my own
      </button>
    </div>
  );
}
