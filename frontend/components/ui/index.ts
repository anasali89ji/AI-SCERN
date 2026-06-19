/**
 * UI Component Barrel
 * Import from '@/components/ui' for any design system primitive.
 *
 * Prefer named imports over namespace imports:
 *   ✅  import { Button, Badge } from '@/components/ui'
 *   ❌  import * as UI from '@/components/ui'
 */

// ── Primitives ────────────────────────────────────────────────────────────────
export { Button, buttonVariants }          from './button'
export type { ButtonProps }                from './button'

export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  cardVariants,
}                                          from './card'
export type { CardProps }                  from './card'

export { Input, inputVariants }            from './input'
export type { InputProps }                 from './input'

export { Badge, badgeVariants }            from './badge'
export type { BadgeProps }                 from './badge'

export { Skeleton, SkeletonGroup, skeletonVariants } from './skeleton'
export type { SkeletonProps }              from './skeleton'

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
