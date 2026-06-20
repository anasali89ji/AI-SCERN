# @aiscern/utils

Small, framework-agnostic helper functions with no app-specific logic.
If a util needs to know about scans/auth/billing, it belongs in the app's
own `lib/`, not here.

## Status: starter helper only, not yet imported anywhere

`frontend/lib/utils` likely already has its own `cn()` — this is a
placeholder for consolidating it later, not a replacement today.
