/**
 * lib/settings/types.ts
 *
 * Shared UserSettings type and defaults — imported by both the server-side
 * /api/user/settings/route.ts AND client-side hooks (useUserSettings,
 * useDetectSettings). Kept as a plain module with no server-only imports.
 */

export const SETTINGS_DEFAULTS = {
  email_notif:         true,
  batch_alerts:        true,
  weekly_report:       false,
  auto_save:           true,
  upgrade_alerts:      true,
  high_acc_mode:       false,
  save_history:        true,
  auto_download_pdf:   false,
  show_confidence:     true,
  show_signals:        true,
  default_modality:    'text' as const,
  public_profile:      false,
  share_anon:          true,
  analytics_opt_out:   false,
  data_retention_days: 90 as 30 | 90 | 365 | -1,
  theme:               'dark' as 'dark' | 'light' | 'system',
  language:            'en' as 'en' | 'ur' | 'ar' | 'es' | 'fr',
  compact_view:        false,
  animations_off:      false,
} as const

export type UserSettings = {
  email_notif:         boolean
  batch_alerts:        boolean
  weekly_report:       boolean
  auto_save:           boolean
  upgrade_alerts:      boolean
  high_acc_mode:       boolean
  save_history:        boolean
  auto_download_pdf:   boolean
  show_confidence:     boolean
  show_signals:        boolean
  default_modality:    'text' | 'image' | 'audio' | 'video' | 'url'
  public_profile:      boolean
  share_anon:          boolean
  analytics_opt_out:   boolean
  data_retention_days: 30 | 90 | 365 | -1
  theme:               'dark' | 'light' | 'system'
  language:            'en' | 'ur' | 'ar' | 'es' | 'fr'
  compact_view:        boolean
  animations_off:      boolean
}
