/**
 * UI Component Barrel
 * Import from '@/components/ui' for any design system primitive.
 *
 * Prefer named imports over namespace imports:
 *   ✅  import { Button, Badge } from '@/components/ui'
 *   ❌  import * as UI from '@/components/ui'
 */

// ── Primitives ────────────────────────────────────────────────────────────────
export { Button }                          from './button'
export type { ButtonProps }                from './button'

export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
}                                          from './card'
export type { CardProps }                  from './card'

export { Input }                           from './input'
export type { InputProps }                 from './input'

export { Badge }                           from './badge'
export type { BadgeProps }                 from './badge'

export { Skeleton, SkeletonText, SkeletonCard } from './skeleton'

export { Separator }                       from './separator'

// ── Overlays ─────────────────────────────────────────────────────────────────
export {
  Dialog, DialogTrigger, DialogPortal, DialogClose,
  DialogOverlay, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
}                                          from './dialog'

export {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
}                                          from './tooltip'

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
}                                          from './dropdown-menu'

// ── Navigation / Layout ───────────────────────────────────────────────────────
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

export {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
}                                          from './accordion'

// ── Media ─────────────────────────────────────────────────────────────────────
export { Avatar, AvatarImage, AvatarFallback } from './avatar'
