/**
 * Aiscern transactional email templates
 * All HTML is inline-styled for maximum email client compatibility.
 */

// ── Design tokens ──────────────────────────────────────────────
const T = {
  bg:          '#08080d',
  card:        '#0f0f17',
  border:      '#1c1c2e',
  borderLight: '#252538',
  text:        '#f1f5f9',
  muted:       '#94a3b8',
  dim:         '#64748b',
  primary:     '#2563eb',
  primaryDark: '#1d4ed8',
  cyan:        '#06b6d4',
  emerald:     '#10b981',
  amber:       '#f59e0b',
  rose:        '#f43f5e',
  purple:      '#8b5cf6',
}

const PLAN_META: Record<string, {
  label: string; color: string; dark: string; icon: string
  tagline: string; features: string[]
}> = {
  starter: {
    label:   'Starter',
    color:   T.primary,
    dark:    T.primaryDark,
    icon:    '⚡',
    tagline: 'You\'re just getting started — great things ahead.',
    features: [
      '100 scan credits / month',
      '100 daily scans',
      'Text, image & audio detection',
      'API access',
      'Email support',
    ],
  },
  pro: {
    label:   'Pro',
    color:   T.purple,
    dark:    '#7c3aed',
    icon:    '🚀',
    tagline: 'Full power unlocked. Welcome to Pro.',
    features: [
      '500 scan credits / month',
      '500 daily scans',
      'All detection modalities',
      'Priority API access',
      'Advanced forensic reports',
      'Priority support',
    ],
  },
  enterprise: {
    label:   'Enterprise',
    color:   T.amber,
    dark:    '#d97706',
    icon:    '👑',
    tagline: 'Unlimited access. Enterprise-grade detection at scale.',
    features: [
      'Unlimited scan credits',
      'Unlimited daily scans',
      'All detection modalities',
      'Dedicated API infrastructure',
      'White-label options',
      'SLA guarantee',
      'Dedicated account manager',
      'Custom integrations',
    ],
  },
  free: {
    label:   'Free',
    color:   T.dim,
    dark:    '#475569',
    icon:    '✨',
    tagline: 'Your account has been updated.',
    features: [
      '10 daily scans',
      'Text & image detection',
      'Basic reports',
    ],
  },
}

// ── Layout wrapper ─────────────────────────────────────────────
function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>Aiscern</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${T.bg};min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">
                <img src="https://aiscern.com/logo.png" width="40" height="40"
                  alt="Aiscern" style="border-radius:10px;display:block;"/>
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:20px;font-weight:900;color:${T.text};letter-spacing:-0.5px;">Aiscern</div>
                <div style="font-size:10px;color:${T.dim};text-transform:uppercase;letter-spacing:2px;font-weight:600;">AI Content Detection</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${T.card};border:1px solid ${T.border};border-radius:20px;overflow:hidden;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:${T.dim};">
            Questions? We're here to help.
          </p>
          <p style="margin:0;font-size:12px;color:${T.dim};">
            <a href="mailto:support@aiscern.com" style="color:${T.primary};text-decoration:none;">support@aiscern.com</a>
            &nbsp;·&nbsp;
            <a href="mailto:contact@aiscern.com" style="color:${T.dim};text-decoration:none;">contact@aiscern.com</a>
          </p>
          <p style="margin:12px 0 0;font-size:11px;color:#2d2d3a;">
            © ${new Date().getFullYear()} Aiscern · Islamabad, Pakistan
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Plan upgrade email ─────────────────────────────────────────
export function planUpgradeEmail(opts: {
  name?: string
  email: string
  newPlan: string
  oldPlan: string
  credits: number
  dailyScans: number
}): { subject: string; html: string } {
  const plan    = PLAN_META[opts.newPlan] ?? PLAN_META.free
  const isUpgrade = opts.oldPlan !== 'free' && opts.newPlan !== opts.oldPlan
    ? true
    : opts.newPlan !== 'free'

  const firstName = opts.name?.split(' ')[0] ?? 'there'
  const creditsStr   = opts.credits   >= 9999 ? 'Unlimited' : opts.credits.toLocaleString()
  const dailyStr     = opts.dailyScans === -1  ? 'Unlimited' : opts.dailyScans.toLocaleString()
  const subject      = isUpgrade
    ? `${plan.icon} Welcome to ${plan.label} — your account is now active`
    : `Your Aiscern plan has been updated to ${plan.label}`

  const featureRows = plan.features.map(f => `
    <tr>
      <td style="padding:6px 0;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px;vertical-align:top;padding-top:2px;">
            <div style="width:18px;height:18px;background:${plan.color}20;border-radius:50%;
              display:flex;align-items:center;justify-content:center;text-align:center;line-height:18px;">
              <span style="font-size:10px;">✓</span>
            </div>
          </td>
          <td style="font-size:14px;color:${T.muted};line-height:1.5;">${f}</td>
        </tr></table>
      </td>
    </tr>`).join('')

  const html = wrap(`
    <!-- Hero gradient bar -->
    <tr><td style="height:4px;background:linear-gradient(90deg,${plan.dark},${plan.color},${T.cyan});"></td></tr>

    <!-- Body -->
    <tr><td style="padding:36px 36px 0;">

      <!-- Plan icon -->
      <div style="width:64px;height:64px;border-radius:18px;margin-bottom:24px;
        background:linear-gradient(135deg,${plan.dark},${plan.color});
        display:inline-flex;align-items:center;justify-content:center;
        font-size:28px;line-height:64px;text-align:center;">
        ${plan.icon}
      </div>

      <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:${T.text};letter-spacing:-0.5px;">
        ${isUpgrade ? `You're now on ${plan.label}` : `Plan Updated to ${plan.label}`}
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:${T.muted};line-height:1.6;">
        Hi ${firstName}, ${plan.tagline}
      </p>

      <!-- Stats row -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <div style="background:${T.bg};border:1px solid ${T.border};border-radius:14px;padding:16px;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:${plan.color};">${creditsStr}</div>
              <div style="font-size:11px;color:${T.dim};margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Monthly Credits</div>
            </div>
          </td>
          <td width="50%" style="padding-left:8px;">
            <div style="background:${T.bg};border:1px solid ${T.border};border-radius:14px;padding:16px;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:${T.cyan};">${dailyStr}</div>
              <div style="font-size:11px;color:${T.dim};margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Daily Scans</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Features -->
      <div style="background:${T.bg};border:1px solid ${T.border};border-radius:14px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:${T.dim};
          text-transform:uppercase;letter-spacing:1.5px;">
          What's included
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${featureRows}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="https://aiscern.com/dashboard"
          style="display:inline-block;background:linear-gradient(135deg,${plan.dark},${plan.color});
            color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;
            padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
          Open Dashboard →
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:${T.dim};">
          Or visit
          <a href="https://aiscern.com/profile" style="color:${plan.color};text-decoration:none;">
            aiscern.com/profile
          </a>
          to see your credits
        </p>
      </div>

    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 36px;">
      <div style="height:1px;background:${T.border};"></div>
    </td></tr>

    <!-- Footer note -->
    <tr><td style="padding:20px 36px 28px;">
      <p style="margin:0;font-size:12px;color:${T.dim};line-height:1.6;">
        This change was applied by the Aiscern team. If you believe this is an error,
        please contact
        <a href="mailto:support@aiscern.com" style="color:${plan.color};text-decoration:none;">
          support@aiscern.com
        </a>
        immediately.
      </p>
    </td></tr>
  `)

  return { subject, html }
}

// ── Credits update email ───────────────────────────────────────
export function creditsUpdateEmail(opts: {
  name?: string
  email: string
  delta: number
  newBalance: number
  oldBalance: number
  reason?: string
}): { subject: string; html: string } {
  const added    = opts.delta > 0
  const amount   = Math.abs(opts.delta)
  const color    = added ? T.emerald : T.rose
  const icon     = added ? '🎉' : '📊'
  const action   = added ? 'added to' : 'deducted from'
  const firstName = opts.name?.split(' ')[0] ?? 'there'
  const subject  = `${icon} ${amount.toLocaleString()} credit${amount !== 1 ? 's' : ''} ${action} your account`

  const html = wrap(`
    <tr><td style="height:4px;background:linear-gradient(90deg,${color},${color}88,${T.cyan});"></td></tr>
    <tr><td style="padding:36px;">

      <div style="width:56px;height:56px;border-radius:16px;margin-bottom:20px;
        background:${color}20;border:1px solid ${color}40;
        display:inline-flex;align-items:center;justify-content:center;
        font-size:24px;line-height:56px;text-align:center;">
        ${icon}
      </div>

      <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:${T.text};letter-spacing:-0.5px;">
        Credits ${added ? 'Added' : 'Adjusted'}
      </h1>
      <p style="margin:0 0 28px;font-size:14px;color:${T.muted};line-height:1.6;">
        Hi ${firstName}, your Aiscern account credits have been updated.
      </p>

      <!-- Change card -->
      <div style="background:${T.bg};border:1px solid ${T.border};border-radius:14px;
        padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:${T.dim};padding:6px 0;">Change</td>
            <td style="text-align:right;font-size:20px;font-weight:900;color:${color};padding:6px 0;">
              ${added ? '+' : ''}${opts.delta.toLocaleString()}
            </td>
          </tr>
          <tr><td colspan="2" style="height:1px;background:${T.border};padding:0;"></td></tr>
          <tr>
            <td style="font-size:13px;color:${T.dim};padding:8px 0 4px;">Previous</td>
            <td style="text-align:right;font-size:14px;color:${T.muted};padding:8px 0 4px;">${opts.oldBalance.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="font-size:14px;font-weight:700;color:${T.text};padding:4px 0 0;">New balance</td>
            <td style="text-align:right;font-size:22px;font-weight:900;color:${T.primary};padding:4px 0 0;">${opts.newBalance.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      ${opts.reason && opts.reason !== 'admin_grant' ? `
        <p style="font-size:12px;color:${T.dim};margin:0 0 24px;">
          Reason: <span style="color:${T.muted};">${opts.reason}</span>
        </p>` : ''}

      <div style="text-align:center;margin-bottom:8px;">
        <a href="https://aiscern.com/profile"
          style="display:inline-block;background:linear-gradient(135deg,${T.primaryDark},${T.primary});
            color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;
            padding:12px 28px;border-radius:10px;">
          View My Credits →
        </a>
      </div>

    </td></tr>
  `)

  return { subject, html }
}
