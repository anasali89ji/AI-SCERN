# AI-SCERN UI Overhaul — Preview Branch Fix

## What was fixed

### 🔴 Critical (ARIA was completely broken)
- **Restored `aria-rag.ts` and `aria-knowledge.json`** — ARIA now has contextual knowledge again
- **Refactored monolithic 42KB chat page** into 6 modular, maintainable components

### 🟡 Missing Pages (from main branch)
- `app/(dashboard)/verify/web/page.tsx` — Web verification UI
- `app/(marketing)/security/page.tsx` — Security & compliance page
- `app/(marketing)/roadmap/page.tsx` — Public product roadmap
- `app/(dashboard)/detect/image/error.tsx` — Graceful error boundary for image detection

### 🟡 Missing API Routes
- `app/api/v1/verify/web/route.ts` — Web URL verification endpoint
- `app/api/profiles/me/route.ts` — Current user profile fetch
- `app/api/scan/[id]/route.ts` — Scan result retrieval by ID
- `app/api/user/settings/route.ts` — User settings GET/PATCH

### 🟡 Missing Components
- `components/auth/AuthShell.tsx` — Route-level auth guard with redirect
- `components/trust/TrustScoreCard.tsx` — Trust score visualization card
- `components/ui/SpotlightCard.tsx` — Interactive spotlight hover effect

### 🟢 Design System
- `lib/design-tokens.ts` — Comprehensive token system (color, spacing, motion, shadow, typography)

## File Structure
```
frontend/
├── app/
│   ├── (dashboard)/
│   │   ├── chat/page.tsx              ← REFACTORED (modular)
│   │   ├── detect/image/error.tsx     ← NEW
│   │   └── verify/web/page.tsx        ← NEW
│   ├── (marketing)/
│   │   ├── roadmap/page.tsx           ← NEW
│   │   └── security/page.tsx          ← NEW
│   └── api/
│       ├── profiles/me/route.ts       ← NEW
│       ├── scan/[id]/route.ts         ← NEW
│       ├── user/settings/route.ts     ← NEW
│       └── v1/verify/web/route.ts    ← NEW
├── components/
│   ├── auth/AuthShell.tsx             ← NEW
│   ├── chat/
│   │   ├── ChatHeader.tsx             ← NEW
│   │   ├── ChatInput.tsx              ← NEW
│   │   ├── ChatMessage.tsx            ← NEW
│   │   ├── ChatSidebar.tsx            ← NEW
│   │   └── useChatStore.ts            ← NEW
│   ├── trust/TrustScoreCard.tsx       ← NEW
│   └── ui/SpotlightCard.tsx           ← NEW
└── lib/
    ├── design-tokens.ts                 ← NEW
    └── rag/
        ├── aria-knowledge.json         ← RESTORED
        └── aria-rag.ts               ← RESTORED
```

## Git Commands

```bash
# 1. Checkout the preview branch
git checkout preview/ui-overhaul-2026

# 2. Copy all files from this archive into your repo
#    (maintain the exact directory structure shown above)

# 3. Stage everything
git add .

# 4. Commit
git commit -m "fix(ui-overhaul): restore ARIA, add missing pages, refactor chat

- Restore aria-rag.ts and aria-knowledge.json (ARIA was dead)
- Add verify/web, security, roadmap, image-error pages
- Add missing API routes: verify/web, profiles/me, scan/[id], user/settings
- Add AuthShell, TrustScoreCard, SpotlightCard components
- Refactor 42KB monolithic chat into modular components
- Add design-tokens system for consistent UI"

# 5. Push
git push origin preview/ui-overhaul-2026
```

## Dependencies to install
```bash
cd frontend
npm install react-markdown
# Ensure these are already present:
# npm install lucide-react @clerk/nextjs react-dropzone
```

## Verification Checklist
- [ ] `npm run build` passes with zero TS errors
- [ ] ARIA chat responds with contextual knowledge (test: "What is PRNU?")
- [ ] `/verify/web` accepts URLs and returns structured results
- [ ] `/security` and `/roadmap` render without 404
- [ ] Image detection error boundary catches crashes gracefully
- [ ] Keyboard navigation works in chat sidebar (Tab, Enter, Escape)
- [ ] All icon-only buttons have `aria-label` attributes
