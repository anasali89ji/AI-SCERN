/**
 * components/auth/clerkAppearance.ts
 *
 * Unified Clerk appearance — applied to both SignIn and SignUp.
 * Design system: deep navy base (#050510), primary blue (#2563eb),
 * all inputs use a single-border style with precise focus rings.
 * Card is borderless (shell handles the frame); internal spacing is tight.
 */

export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'bottom' as const,
    socialButtonsVariant:   'blockButton' as const,
    showOptionalFields:     false,
  },
  variables: {
    colorPrimary:                 '#2563eb',
    colorBackground:              'transparent',  // shell controls the bg
    colorInputBackground:         '#0a0a1f',
    colorInputText:               '#e8edff',
    colorText:                    '#e8edff',
    colorTextSecondary:           '#8892b0',
    colorTextOnPrimaryBackground: '#ffffff',
    colorNeutral:                 '#2a2a50',
    colorDanger:                  '#f87171',
    colorSuccess:                 '#34d399',
    colorWarning:                 '#fbbf24',
    borderRadius:                 '8px',
    fontFamily:                   'inherit',
    fontSize:                     '14px',
    spacingUnit:                  '14px',
    fontWeight:                   { normal: 400, medium: 500, bold: 600 } as Record<string, number>,
  },
  elements: {
    // Root / card structure
    rootBox:  'w-full',
    card:     '!bg-transparent !shadow-none !border-none !p-0 !rounded-none',
    cardBox:  '!rounded-none',
    header:   '!hidden',

    // Form layout
    main:         'px-6 sm:px-8 pb-5 pt-5',
    formFieldRow: 'mb-[14px]',

    // Labels
    formFieldLabelRow:  'flex items-center justify-between mb-1.5',
    formFieldLabel:     'text-[11.5px] font-semibold tracking-[0.08em] uppercase text-slate-400',
    formFieldHintText:  'text-slate-500 text-[12px] mt-1.5 leading-relaxed',

    // Inputs
    formFieldInput: [
      'w-full bg-[#0a0a1f] text-[#e8edff] placeholder:text-slate-600',
      'border border-[#252550] rounded-[8px]',
      'text-[14px] px-3.5 py-[10px] leading-normal',
      'transition-all duration-150',
      'focus:outline-none focus:border-[#2563eb] focus:bg-[#0b0b23]',
      'focus:ring-[3px] focus:ring-[#2563eb]/15',
      'hover:border-[#33336a]',
    ].join(' '),
    formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-300 transition-colors pr-1',
    formFieldAction: 'text-[#4b82f7] hover:text-[#7aa5fa] text-[12px] font-medium transition-colors',

    // Error / success
    formFieldErrorText:   'text-rose-400 text-[12px] mt-1.5 leading-relaxed',
    formFieldSuccessText: 'text-emerald-400 text-[12px] mt-1.5',
    formFieldWarningText: 'text-amber-400 text-[12px] mt-1.5',

    // OTP code input — 6 cells, tight sizing for all viewports
    otpCodeFieldInput: [
      'bg-[#0a0a1f] border border-[#252550] text-white',
      'font-mono text-[18px] font-bold rounded-[8px] text-center',
      'w-9 h-10',
      'focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/15',
      'transition-all duration-150',
    ].join(' '),

    // Primary CTA button
    formButtonPrimary: [
      'w-full bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]',
      'text-white font-semibold text-[14px] rounded-[8px] py-[11px]',
      'border-0 shadow-[0_2px_16px_rgba(37,99,235,0.35)]',
      'hover:shadow-[0_4px_24px_rgba(37,99,235,0.45)]',
      'transition-all duration-200',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' '),
    formButtonReset: 'text-[#4b82f7] hover:text-[#7aa5fa] text-[13px] font-medium transition-colors',

    // Divider
    dividerRow:  'my-4',
    dividerLine: 'bg-[#1e1e40]',
    dividerText: 'text-slate-600 text-[10.5px] px-3 uppercase tracking-widest',

    // Social / OAuth buttons
    socialButtonsBlockButton:     'w-full bg-[#0d0d25] border border-[#1e1e40] text-slate-300 rounded-[8px] hover:bg-[#111130] hover:border-[#2a2a58] hover:text-white transition-all duration-200 py-[10px]',
    socialButtonsBlockButtonText: 'text-[13px] font-medium',
    socialButtonsBlockButtonArrow:'hidden',
    socialButtonsProviderIcon:    'w-4 h-4',

    // Alert
    alert:          'border rounded-[8px] px-4 py-3 my-3 bg-rose-500/[0.07] border-rose-500/30',
    alertText:      'text-rose-300 leading-relaxed text-[13px]',
    alertTextDanger:'text-rose-300 text-[13px]',

    // Footer (sign-in/up switch link)
    footer:          'px-6 sm:px-8 pb-6 pt-2',
    footerAction:    'text-center',
    footerActionText:'text-slate-500 text-[13px]',
    footerActionLink:'text-[#4b82f7] hover:text-[#7aa5fa] font-semibold text-[13px] transition-colors ml-1',
    footerPages:     '!hidden',

    // Identity preview (email confirmation step)
    identityPreviewText:       'text-slate-300 text-[14px]',
    identityPreviewEditButton: 'text-[#4b82f7] hover:text-[#7aa5fa] text-[13px] transition-colors',

    // Misc
    spinner:                      'text-[#2563eb]',
    alternativeMethodsBlockButton:'w-full bg-[#0d0d25] border border-[#1e1e40] text-slate-300 rounded-[8px] hover:bg-[#111130] hover:border-[#2a2a58] hover:text-white transition-all duration-200 py-[10px] text-[13px] font-medium',
    formFieldCheckboxInput:       'accent-blue-600 w-4 h-4 rounded border border-[#252550]',
    formFieldCheckboxLabel:       'text-slate-400 text-[12.5px] leading-relaxed',
  },
}
