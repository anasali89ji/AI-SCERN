#!/bin/bash
# AI-SCERN UI Overhaul — Git Push Script
# Run this from the root of your AI-SCERN repo

set -e

echo "🚀 AI-SCERN UI Overhaul — Git Push Script"
echo ""

BRANCH="preview/ui-overhaul-2026"

echo "Step 1: Checking branch..."
git checkout "$BRANCH" || { echo "❌ Failed to checkout $BRANCH"; exit 1; }

echo "Step 2: Staging all changes..."
git add .

echo "Step 3: Committing..."
git commit -m "fix(ui-overhaul): restore ARIA, add missing pages, refactor chat architecture

- Restore aria-rag.ts and aria-knowledge.json (ARIA was completely dead)
- Add missing pages: verify/web, security, roadmap, image-error
- Add missing API routes: /api/v1/verify/web, /api/profiles/me, /api/scan/[id], /api/user/settings
- Add missing components: AuthShell, TrustScoreCard, SpotlightCard
- Refactor 42KB monolithic chat page into modular ChatSidebar, ChatMessage, ChatInput, ChatHeader, useChatStore
- Introduce design-tokens.ts for consistent spacing, motion, shadow, and typography
- Fix contrast issues and add keyboard accessibility across dashboard"

echo "Step 4: Pushing to origin..."
git push origin "$BRANCH"

echo ""
echo "✅ Successfully pushed to $BRANCH"
echo ""
echo "Next steps:"
echo "  1. Install missing deps: cd frontend && npm install react-markdown"
echo "  2. Run build: npm run build"
echo "  3. Test ARIA: open /chat and ask 'What is PRNU fingerprinting?'"
echo "  4. Create PR to main when ready"
