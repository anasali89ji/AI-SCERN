/**
 * clerkAppearance.ts — Aiscern auth design system (v5 — visibility pass)
 *
 * v4 leaned on very low-opacity borders (7–11% white) for a "quiet" look.
 * In practice that reads as *no* border on a lot of panels/monitors — the
 * card, the inputs, and especially the "Continue with Google" button all
 * blended into the page background instead of reading as distinct,
 * clickable components. This pass keeps the same palette and motion but
 * raises resting-state contrast across the board, so every section of the
 * form (fields, divider, social buttons, footer) is legible at a glance —
 * not just on focus/hover.
 *
 * Input borders: white at visible-but-not-harsh opacity at rest.
 * Focus / active: white border, white glow — clearly "selected".
 * Card is transparent; AuthShell owns bg + frame.
 * 44px touch targets throughout.
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
    colorInputBackground:         '#0a0a22',
    colorInputText:               '#e8edff',
    colorText:                    '#e8edff',
    colorTextSecondary:           '#8a93b8',
    colorTextOnPrimaryBackground: '#ffffff',
    colorNeutral:                 '#2a2a52',
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
    formFieldLabel:    'text-[11px] font-semibold tracking-[0.09em] uppercase text-slate-400 select-none',
    formFieldHintText: 'text-slate-500 text-[12px] mt-1.5 leading-relaxed',

    /* ── Inputs ──────────────────────────────────────────────── */
    // Default:  white border at 16% opacity — clearly a bounded field,
    //           not just placeholder text floating on the background.
    // Hover:    lifts to 28% — responds to intent.
    // Focus:    full white at 55% + white glow — unmistakably active.
    // Typing:   same as focus (border stays white while text is entered).
    formFieldInput: [
      'w-full h-11',
      'bg-[#0a0a22] text-[#e8edff] focus:text-[#0a0a18]',
      'border border-white/[0.16] rounded-[10px]',
      'text-[14px] font-normal px-4',
      'placeholder:text-white/[0.28] focus:placeholder:text-slate-400',
      'outline-none',
      'transition-[border-color,box-shadow,background-color] duration-150',
      'hover:border-white/[0.28]',
      'focus:border-white/[0.55]',
      'focus:bg-white',
      'focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]',
    ].join(' '),

    formFieldInputShowPasswordButton:
      'text-white/40 hover:text-white/70 transition-colors duration-150 mr-1 outline-none',

    formFieldAction:
      'text-[#4b82f7] hover:text-[#93b4fd] text-[12px] font-medium transition-colors duration-150',

    /* ── Validation text ─────────────────────────────────────── */
    formFieldErrorText:   'text-rose-400 text-[12px] mt-[5px] leading-relaxed',
    formFieldSuccessText: 'text-emerald-400 text-[12px] mt-[5px]',
    formFieldWarningText: 'text-amber-400 text-[12px] mt-[5px]',

    /* ── OTP cells ───────────────────────────────────────────── */
    otpCodeFieldInput: [
      'bg-[#0a0a22] text-white',
      'border border-white/[0.16] rounded-[10px]',
      'font-mono text-[20px] font-bold text-center',
      'h-12 w-10',
      'outline-none',
      'transition-[border-color,box-shadow] duration-150',
      'hover:border-white/[0.28]',
      'focus:border-white/[0.55]',
      'focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]',
    ].join(' '),

    /* ── Primary button ──────────────────────────────────────── */
    formButtonPrimary: [
      'w-full h-11',
      'bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]',
      'text-white font-semibold text-[14px] rounded-[10px]',
      'border-0 outline-none',
      'shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_20px_rgba(37,99,235,0.3)]',
      'hover:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_28px_rgba(37,99,235,0.4)]',
      'transition-[background-color,box-shadow] duration-200',
      'disabled:opacity-40 disabled:cursor-not-allowed',
    ].join(' '),

    formButtonReset:
      'text-[#4b82f7] hover:text-[#93b4fd] text-[13px] font-medium transition-colors duration-150 outline-none',

    /* ── Divider ─────────────────────────────────────────────── */
    // A visible rule either side of "OR" — v4's 5% line effectively
    // vanished, so the social buttons below looked disconnected from
    // the form above it rather than part of the same card.
    dividerRow:  'my-5',
    dividerLine: 'bg-white/[0.12]',
    dividerText: 'text-white/[0.38] text-[10px] px-3 uppercase tracking-[0.12em] font-semibold',

    /* ── Social / OAuth buttons ──────────────────────────────── */
    // This is the element most likely to be missed at a glance — raised
    // border opacity, a slightly stronger fill, and brighter label text
    // so "Continue with Google" reads as a real, clickable button with
    // its own visible boundary rather than bare text on the card bg.
    socialButtonsBlockButton: [
      'w-full h-11',
      'bg-white/[0.05] border border-white/[0.18] rounded-[10px]',
      'text-white/80 text-[13px] font-medium',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
      'outline-none',
      'transition-[border-color,background-color,color,box-shadow] duration-150',
      'hover:bg-white/[0.09] hover:border-white/[0.32] hover:text-white',
      'active:bg-white/[0.12]',
      'focus-visible:border-white/[0.55] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]',
    ].join(' '),
    socialButtonsBlockButtonText:  'text-[13px] font-medium',
    socialButtonsBlockButtonArrow: 'hidden',
    socialButtonsProviderIcon:     'w-[18px] h-[18px]',

    /* ── Alert ───────────────────────────────────────────────── */
    alert:           'border rounded-[10px] px-4 py-3 my-4 bg-rose-500/[0.08] border-rose-500/30',
    alertText:       'text-rose-300 text-[13px] leading-relaxed',
    alertTextDanger: 'text-rose-300 text-[13px] leading-relaxed',

    /* ── Footer ──────────────────────────────────────────────── */
    // A hairline above the footer separates "form" from "switch to
    // sign in / sign up" as two distinct sections of the card, instead
    // of the link floating directly under the last field.
    footer:           'px-7 sm:px-8 pb-7 pt-4 border-t border-white/[0.07] mt-1',
    footerAction:     'flex items-center justify-center',
    footerActionText: 'text-white/60 text-[13px]',
    footerActionLink: [
      'text-[#4b82f7] hover:text-[#93b4fd]',
      'font-semibold text-[13px] ml-1',
      'transition-colors duration-150',
    ].join(' '),
    footerPages: '!hidden',

    /* ── Identity preview ────────────────────────────────────── */
    identityPreviewText:       'text-slate-300 text-[14px]',
    identityPreviewEditButton: 'text-[#4b82f7] hover:text-[#93b4fd] text-[13px] transition-colors duration-150',

    /* ── Misc ────────────────────────────────────────────────── */
    spinner: 'text-[#2563eb]',
    alternativeMethodsBlockButton: [
      'w-full h-11',
      'bg-white/[0.05] border border-white/[0.18] rounded-[10px]',
      'text-white/70 text-[13px] font-medium outline-none',
      'hover:bg-white/[0.09] hover:border-white/[0.32] hover:text-white',
      'transition-all duration-150',
    ].join(' '),
    formFieldCheckboxInput: 'accent-blue-600 w-4 h-4',
    formFieldCheckboxLabel: 'text-white/50 text-[12.5px] leading-relaxed',
  },
}
