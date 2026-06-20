# @aiscern/ui

Home for shadcn/ui-based components shared between `frontend` and `admin`
(both are Next.js apps and both have their own `components/ui` today).

## Status: empty, not yet adopted

No components have been extracted yet. `frontend/components/ui` is the
current source of truth for the design system established on
`preview/ui-overhaul-2026` (blue-600 only, no gradients). Extracting the
first shared primitive (e.g. `Button`) here is a good first real PR for
Phase 2 — small enough to verify both apps still build correctly after.
