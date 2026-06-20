/**
 * @aiscern/config — shared Tailwind preset.
 *
 * Placeholder for the design tokens enforced on `preview/ui-overhaul-2026`
 * (blue-600 only, no gradients/cyan/purple). Once stable, extract the real
 * `theme.extend` values from frontend/tailwind.config.ts here so frontend
 * and admin both consume one source of truth.
 *
 * NOT YET CONSUMED by frontend/ or admin/.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      // colors: { brand: { 600: '#2563eb' } }, // TODO: extract from frontend/tailwind.config.ts
    },
  },
};
