# Contributing to Aiscern

Thank you for your interest in contributing! This document covers code standards, workflow, and how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/AI-SCERN.git`
3. Install dependencies: `cd frontend && npm install --legacy-peer-deps`
4. Copy `.env.example` → `.env.local` and fill in values
5. Start dev server: `npm run dev`

## Development Workflow

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes with clear, atomic commits
3. Run type check: `npm run type-check` (or `npx tsc --noEmit`)
4. Open a Pull Request against `main`

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(detection): add audio deepfake confidence bands
fix(upload): reject SVG files in MIME allowlist
chore(deps): bump next to 15.2.0
docs(readme): update benchmark table
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `security`

## Code Standards

### TypeScript

- Strict mode on — no `any` unless absolutely unavoidable (use `unknown` + type narrowing)
- All API route handlers typed with `NextRequest` / `NextResponse`
- Interfaces over `type` for objects; `type` for unions/primitives

### Next.js

- Use App Router (no Pages Router)
- Server components by default; `'use client'` only when state/effects needed
- No hardcoded secrets in any file — use `process.env.*`
- `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_`

### Security

- Never return stack traces or SQL errors to the client
- All file uploads must go through `lib/security/fileValidation.ts`
- All POST/PUT/DELETE/PATCH routes must validate CSRF via `lib/security/csrf.ts`
- All API routes must authenticate via `creditGuard` or explicit Clerk `auth()`

### Styling

- Tailwind CSS only (no inline styles except for dynamic values)
- Mobile-first responsive design
- Touch targets ≥ 44px
- Base font ≥ 16px (prevents iOS auto-zoom)

## Pull Request Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] No secrets committed (run `git diff --staged` and verify)
- [ ] Mobile responsive (check iPhone SE viewport)
- [ ] All new API routes have auth + rate limiting
- [ ] New file upload paths use `fileValidation.ts`

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template.

## Requesting Features

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template.

## Security Vulnerabilities

See [SECURITY.md](SECURITY.md) — do **not** file a public issue.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
