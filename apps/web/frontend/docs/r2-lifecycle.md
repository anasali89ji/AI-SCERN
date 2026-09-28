# R2 Bucket Lifecycle Policy

Set this in Cloudflare Dashboard → R2 → aiscern-uploads → Settings → Lifecycle Rules:

**Rule 1: Delete all objects after 1 day**
- Prefix: `uploads/`
- Action: Delete
- Days after creation: 1

This ensures no file persists in R2 beyond 24 hours even if the app-level cleanup fails (e.g. Vercel timeout, unhandled error path).

## App-level cleanup
Each detect route calls `deleteR2Object(r2Key)` immediately after analysis completes (non-fatal — lifecycle rule is the safety net).
