export function creditsUpdateEmail(opts: {
  name: string; email: string; delta: number; newBalance: number; oldBalance: number; reason: string
}) {
  const sign = opts.delta > 0 ? '+' : ''
  return {
    subject: `Your Aiscern credits have been ${opts.delta > 0 ? 'updated' : 'adjusted'}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 8px">Credit Update</h2>
      <p style="color:#555;font-size:14px">Hi ${opts.name || 'there'},</p>
      <p style="color:#555;font-size:14px">Your credit balance has been updated by an administrator.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px"><strong>Change:</strong> <span style="color:${opts.delta > 0 ? '#10b981' : '#ef4444'}">${sign}${opts.delta}</span></p>
        <p style="margin:4px 0 0;font-size:14px"><strong>New Balance:</strong> ${opts.newBalance}</p>
        <p style="margin:4px 0 0;font-size:14px"><strong>Reason:</strong> ${opts.reason}</p>
      </div>
      <p style="color:#999;font-size:12px">If you did not expect this change, please contact support.</p>
    </div>`,
  }
}

export function planUpgradeEmail(opts: {
  name: string; email: string; newPlan: string; oldPlan: string
}) {
  const planLabels: Record<string, string> = {
    free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
  }
  return {
    subject: `Your plan has been upgraded to ${planLabels[opts.newPlan] || opts.newPlan}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 8px">Plan Updated</h2>
      <p style="color:#555;font-size:14px">Hi ${opts.name || 'there'},</p>
      <p style="color:#555;font-size:14px">Your Aiscern plan has been updated by an administrator.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px"><strong>Previous:</strong> ${planLabels[opts.oldPlan] || opts.oldPlan}</p>
        <p style="margin:4px 0 0;font-size:14px"><strong>New:</strong> <span style="color:#2563eb;font-weight:700">${planLabels[opts.newPlan] || opts.newPlan}</span></p>
      </div>
      <a href="https://aiscern.com/dashboard" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Go to Dashboard →</a>
    </div>`,
  }
}

export function banEmail(opts: { name: string; email: string; reason?: string; unban?: boolean }) {
  return {
    subject: opts.unban ? 'Your Aiscern account has been restored' : 'Your Aiscern account has been suspended',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 8px">Account ${opts.unban ? 'Restored' : 'Suspended'}</h2>
      <p style="color:#555;font-size:14px">Hi ${opts.name || 'there'},</p>
      <p style="color:#555;font-size:14px">Your account has been ${opts.unban ? 'restored' : 'suspended'} by an administrator.</p>
      ${opts.reason ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;font-size:14px"><strong>Reason:</strong> ${opts.reason}</p></div>` : ''}
      ${opts.unban ? '<p style="color:#10b981;font-size:14px">You may now log in and use Aiscern normally.</p>' : '<p style="color:#ef4444;font-size:14px">If you believe this is an error, please contact support.</p>'}
    </div>`,
  }
}

export function welcomeAdminEmail(opts: { name: string; email: string; tempPassword: string }) {
  return {
    subject: 'Welcome to Aiscern Admin Panel',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 8px">Welcome to the Team</h2>
      <p style="color:#555;font-size:14px">Hi ${opts.name},</p>
      <p style="color:#555;font-size:14px">You have been granted access to the Aiscern Admin Panel.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:4px 0 0;font-size:14px"><strong>Temporary Password:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px">${opts.tempPassword}</code></p>
      </div>
      <p style="color:#ef4444;font-size:12px">Please change your password after first login.</p>
      <a href="https://admin.aiscern.com" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Login to Admin →</a>
    </div>`,
  }
}
