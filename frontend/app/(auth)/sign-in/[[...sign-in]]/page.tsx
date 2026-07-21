'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <SignIn
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
      fallbackRedirectUrl="/dashboard"
    />
  );
}
