'use client';

import { SignUp } from '@clerk/nextjs';

function PasswordStrengthMeter({ password }: { password: string }) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    const levels = [
      { score: 0, label: 'Too weak', color: 'bg-rose-500' },
      { score: 1, label: 'Weak', color: 'bg-orange-500' },
      { score: 2, label: 'Fair', color: 'bg-yellow-500' },
      { score: 3, label: 'Good', color: 'bg-blue-500' },
      { score: 4, label: 'Strong', color: 'bg-emerald-500' },
      { score: 5, label: 'Very strong', color: 'bg-emerald-400' },
    ];
    return levels[score];
  };

  const strength = getStrength(password);
  const width = `${(strength.score / 5) * 100}%`;

  return (
    <div className="mt-2">
      <div className="w-full bg-neutral-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${strength.color}`}
          style={{ width }}
        />
      </div>
      <p className="text-xs text-neutral-400 mt-1">{strength.label}</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          card: 'shadow-none bg-transparent border-0 p-0',
          headerTitle: 'text-2xl font-bold text-white text-center',
          headerSubtitle: 'text-neutral-400 text-center text-sm mt-1',
          socialButtonsBlockButton:
            'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white rounded-xl h-11 transition-colors',
          formFieldLabel: 'text-neutral-300 text-sm font-medium mb-1.5',
          formFieldInput:
            'bg-neutral-800/50 border border-neutral-700 text-white rounded-xl h-11 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all w-full',
          formButtonPrimary:
            'bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11 w-full shadow-lg shadow-primary/25 transition-all active:scale-[0.98]',
          footerActionLink: 'text-primary hover:text-primary/80 font-medium',
          identityPreviewText: 'text-white',
          identityPreviewEditButton: 'text-primary hover:text-primary/80',
          formFieldErrorText: 'text-rose-400 text-xs mt-1',
          alertText: 'text-rose-400 text-sm',
          socialButtonsBlockButtonText: 'text-white',
          socialButtonsBlockButtonArrow: 'text-white',
          dividerLine: 'bg-neutral-700',
          dividerText: 'text-neutral-500',
          formFieldInfoText: 'text-neutral-400 text-xs',
          formFieldSuccessText: 'text-emerald-400 text-xs',
          footer: 'text-neutral-400',
          footerActionText: 'text-neutral-400',
        },
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
        },
      }}
      fallbackRedirectUrl="/dashboard?onboarding=true"
    />
  );
}
