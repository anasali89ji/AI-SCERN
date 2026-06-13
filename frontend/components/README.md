# Components Directory

## Structure

```
components/
  ui/
    shadcn/       # Aiscern design system components (Button, Card, Badge, Input, Separator)
    CustomCursor.tsx
    InfiniteMarquee.tsx
    SpotlightCard.tsx  # deprecated — use card-hover class instead
    container.tsx
  home/           # Landing page sections
    AIvsRealSection.tsx
    HomepageReviews.tsx
    NavClient.tsx
    WhoNeedsSection.tsx
  hero/           # Hero section components
    HeroHeadline.tsx
  providers/      # React context providers
    MotionProvider.tsx
  dashboard/      # Dashboard-specific components (future)
  
  # Shared / cross-cutting components
  AuthGuard.tsx
  AuthModal.tsx
  ClerkClientProvider.tsx
  ComparisonTable.tsx
  CookieConsent.tsx
  CreditDisplay.tsx
  ErrorBoundary.tsx
  FeedbackBar.tsx
  LenisProvider.tsx   # no-op stub — Lenis removed, native scroll used
  MobileNav.tsx
  MobileResultSheet.tsx
  OnboardingWizard.tsx
  ReviewModal.tsx
  ReviewSuggestion.tsx
  ScanningLoader.tsx
  ScrollToTop.tsx
  SignupGate.tsx
  SiteNav.tsx
  SkeletonLoader.tsx
  SolutionPage.tsx
  ToolCard.tsx
  UpgradeModal.tsx
  UpgradeNotification.tsx
  UsageLimitBanner.tsx
  auth-provider.tsx
  site-footer.tsx
```

## Design System

Import from `@/components/ui/shadcn`:
```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, Separator } from '@/components/ui/shadcn'
```

Import the `cn` utility from `@/lib/cn`:
```tsx
import { cn } from '@/lib/cn'
```

Design tokens available at `@/lib/design-tokens`:
```tsx
import { tokens } from '@/lib/design-tokens'
```
