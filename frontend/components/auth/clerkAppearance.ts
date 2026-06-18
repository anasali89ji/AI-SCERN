/**
 * clerkAppearance.ts — Aiscern auth design system
 *
 * Card is transparent — the outer shell owns the background and border.
 * Every element class is intentional; nothing inherited from Clerk defaults.
 * Mobile-first: inputs are 44 px tall for comfortable thumb interaction.
 */

export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'bottom'      as const,
    socialButtonsVariant:   'blockButton' as const,
    showOptionalFields:     false,
  },

  variables: {
    colorPrimary:                 '#2563eb',
    colorBackground:              'transparent',
    colorInputBackground:         '#070718',
    colorInputText:               '#e8edff',
    colorText:                    '#e8edff',
    colorTextSecondary:           '#64748b',
    colorTextOnPrimaryBackground: '#ffffff',
    colorNeutral:                 '#1e1e42',
    colorDanger:                  '#fb7185',
    colorSuccess:                 '#34d399',
    colorWarning:                 '#fbbf24',
    borderRadius:                 '10px',
    fontFamily:                   'inherit',
    fontSize:                     '14px',
    spacingUnit:                  '16px',
    fontWeight: {
      normal: 400,
      medium: 500,
      bold:   600,
    } as Record<string, number>,
  },

  elements: {
    /* ── Shell ───────────────────────────────────────────────── */
    rootBox: 'w-full',
    card:    '!bg-transparent !shadow-none !border-none !p-0 !m-0 !rounded-none',
    cardBox: '!bg-transparent !rounded-none',
    header:  '!hidden',

    /* ── Form wrapper ────────────────────────────────────────── */
    main:         'px-7 sm:px-8 pb-2 pt-6',
    formFieldRow: 'mb-4',

    /* ── Labels ──────────────────────────────────────────────── */
    formFieldLabelRow: 'flex items-center justify-between mb-[7px]',
    formFieldLabel:    'text-[11px] font-semibold tracking-[0.09em] uppercase text-slate-500 select-none',
    formFieldHintText: 'text-slate-600 text-[12px] mt-1.5 leading-relaxed',

    /* ── Inputs — 44 px tall for touch ───────────────────────── */
    formFieldInput: [
      'w-full h-11',
      'bg-[#070718] text-[#dde4ff]',
      'border border-[#1c1c40] rounded-[10px]',
      'text-[14px] font-normal px-4',
      'placeholder:text-[#2e2e5a]',
      'transition-[border-color,box-shadow,background-color] duration-150',
      'focus:outline-none',
      'focus:bg-[#090924]',
      'focus:border-[#2563eb]',
      'focus:shadow-[0_0_0_3px_rgba(37,99,235,0.14)]',
      'hover:border-[#28285c]',
    ].join(' '),

    formFieldInputShowPasswordButton:
      'text-slate-600 hover:text-slate-400 transition-colors duration-150 mr-1 outline-none',

    formFieldAction:
      'text-[#4b82f7] hover:text-[#93b4fd] text-[12px] font-medium transition-colors duration-150',

    /* ── Validation text ─────────────────────────────────────── */
    formFieldErrorText:   'text-rose-400 text-[12px] mt-[5px] leading-relaxed',
    formFieldSuccessText: 'text-emerald-400 text-[12px] mt-[5px]',
    formFieldWarningText: 'text-amber-400 text-[12px] mt-[5px]',

    /* ── OTP cells ───────────────────────────────────────────── */
    otpCodeFieldInput: [
      'bg-[#070718] border border-[#1c1c40] text-white',
      'font-mono text-[20px] font-bold rounded-[10px] text-center',
      'h-12 w-10',
      'transition-[border-color,box-shadow] duration-150',
      'focus:outline-none focus:border-[#2563eb]',
      'focus:shadow-[0_0_0_3px_rgba(37,99,235,0.14)]',
    ].join(' '),

    /* ── Primary button ──────────────────────────────────────── */
    formButtonPrimary: [
      'w-full h-11',
      'bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]',
      'text-white font-semibold text-[14px] rounded-[10px]',
      'border-0',
      'shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_20px_rgba(37,99,235,0.3)]',
      'hover:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_28px_rgba(37,99,235,0.4)]',
      'transition-[background-color,box-shadow] duration-200',
      'disabled:opacity-40 disabled:cursor-not-allowed',
    ].join(' '),

    formButtonReset:
      'text-[#4b82f7] hover:text-[#93b4fd] text-[13px] font-medium transition-colors duration-150 outline-none',

    /* ── Divider ─────────────────────────────────────────────── */
    dividerRow:  'my-5',
    dividerLine: 'bg-[#12122a]',
    dividerText: 'text-[#2a2a4e] text-[10px] px-3 uppercase tracking-[0.12em] font-semibold',

    /* ── Social / OAuth ──────────────────────────────────────── */
    socialButtonsBlockButton: [
      'w-full h-11',
      'bg-[#07071a] border border-[#1c1c40] rounded-[10px]',
      'text-slate-400 text-[13px] font-medium',
      'transition-[border-color,background-color,color] duration-150',
      'hover:bg-[#0b0b22] hover:border-[#272760] hover:text-slate-200',
    ].join(' '),
    socialButtonsBlockButtonText:  'text-[13px] font-medium',
    socialButtonsBlockButtonArrow: 'hidden',
    socialButtonsProviderIcon:     'w-[18px] h-[18px]',

    /* ── Alert ───────────────────────────────────────────────── */
    alert:          'border rounded-[10px] px-4 py-3 my-4 bg-rose-500/[0.06] border-rose-500/20',
    alertText:      'text-rose-300 text-[13px] leading-relaxed',
    alertTextDanger:'text-rose-300 text-[13px] leading-relaxed',

    /* ── Footer ──────────────────────────────────────────────── */
    footer:           'px-7 sm:px-8 pb-7 pt-3',
    footerAction:     'flex items-center justify-center',
    footerActionText: 'text-slate-600 text-[13px]',
    footerActionLink: [
      'text-[#4b82f7] hover:text-[#93b4fd]',
      'font-semibold text-[13px]',
      'transition-colors duration-150 ml-1',
    ].join(' '),
    footerPages: '!hidden',

    /* ── Identity preview (email step) ──────────────────────── */
    identityPreviewText:       'text-slate-300 text-[14px]',
    identityPreviewEditButton: 'text-[#4b82f7] hover:text-[#93b4fd] text-[13px] transition-colors duration-150',

    /* ── Misc ────────────────────────────────────────────────── */
    spinner: 'text-[#2563eb]',
    alternativeMethodsBlockButton: [
      'w-full h-11',
      'bg-[#07071a] border border-[#1c1c40] rounded-[10px]',
      'text-slate-400 text-[13px] font-medium',
      'hover:bg-[#0b0b22] hover:border-[#272760] hover:text-slate-200',
      'transition-all duration-150',
    ].join(' '),
    formFieldCheckboxInput: 'accent-blue-600 w-4 h-4',
    formFieldCheckboxLabel: 'text-slate-500 text-[12.5px] leading-relaxed',
  },
}
