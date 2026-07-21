# Aiscern Admin Console v2.0

A complete overhaul of the Aiscern admin panel. This is the **master control center** for your entire platform.

## What's New in v2.0

### Critical Bug Fixes
- **Announcements now trigger notifications** — When you publish an announcement, users automatically receive a notification
- **Fixed auth session management** — Sessions are now stored in Supabase with proper revocation
- **Fixed all API error handling** — Every endpoint has proper try-catch and returns meaningful errors
- **Fixed rate limiting** — Admin APIs now have proper rate limits
- **Fixed user bulk actions** — Ban/unban/credits/plan changes all work correctly

### New Features
- **Role-Based Access Control (RBAC)** — super_admin, admin, moderator, viewer roles
- **Multi-Admin Support** — Create and manage multiple admin accounts
- **Live Scan Monitor** — Real-time view of all scans with filtering and export
- **Content Moderation** — Flag, review, and remove problematic content
- **Webhook Management** — Configure outgoing webhooks with event subscriptions
- **Rate Limit Monitor** — Track and block abusive IPs
- **Backup & Restore** — One-click database backups
- **Branding Controls** — Customize site name, colors, logo, emails
- **Maintenance Mode** — Put site in maintenance with custom message
- **Broadcast Notifications** — Send push notifications to all or segmented users
- **Revenue Forecasting** — AI-powered MRR predictions
- **Real-time SSE** — Live updates for new users, scans, and errors
- **Bulk User Actions** — Select multiple users and apply actions
- **User Export** — Export users to CSV
- **Error Resolution** — Mark errors as resolved with notes
- **Support Ticket Replies** — Reply to tickets directly from admin

## Installation

```bash
cd admin-overhaul
npm install
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD_BCRYPT` (generate with `bcryptjs`)
- `ADMIN_SESSION_SECRET` (32+ chars)

Optional but recommended:
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `HUGGINGFACE_API_TOKEN`

## Database Schema

Run the SQL in `schema.sql` to create the new tables required for v2.0.

## Deployment

```bash
npm run build
npm start
```

Or deploy to Vercel:
```bash
vercel --prod
```

## Architecture

```
app/
  api/           — 30+ API routes with RBAC
  dashboard/     — Admin UI with 24 tabs
  page.tsx       — Login page
lib/
  auth.ts        — Multi-admin auth with bcrypt + HMAC
  admin-middleware.ts — RBAC, rate limits, audit logging
  notifications.ts — Broadcast notification engine
  realtime.ts    — SSE event broadcasting
  db.ts          — Supabase client
  api-client.ts  — Typed API client with retries
  emails/        — Email templates + sender
```

## Security

- All routes protected by middleware
- Role-based permissions on every API
- Rate limiting per IP per action
- Audit logging for every admin action
- Session revocation support
- Maintenance mode with IP allowlist
