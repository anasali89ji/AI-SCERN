"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  LayoutDashboard, ImageIcon, FileText, Music, Video, History,
  Settings, User, CreditCard, MessageSquare, Zap, ChevronLeft,
  ChevronRight, X, Globe, Upload, ShieldCheck,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Detect Image", href: "/detect/image", icon: ImageIcon },
  { name: "Detect Text", href: "/detect/text", icon: FileText },
  { name: "Detect Audio", href: "/detect/audio", icon: Music },
  { name: "Detect Video", href: "/detect/video", icon: Video },
  { name: "Batch Scan", href: "/batch", icon: Upload },
  { name: "Web Scraper", href: "/scraper", icon: Globe },
  { name: "History", href: "/history", icon: History },
  { name: "AI Chat", href: "/chat", icon: MessageSquare, badge: "New" },
]

const secondaryNav = [
  { name: "Credits", href: "/credits", icon: CreditCard },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onCollapse?: (c: boolean) => void
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  className?: string
}

function NavLink({
  item,
  pathname,
  collapsed = false,
}: {
  item: { name: string; href: string; icon: React.ElementType; badge?: string }
  pathname: string
  collapsed?: boolean
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary/15 text-blue-400 border border-primary/20"
          : "text-text-muted hover:bg-white/5 hover:text-text-secondary",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-blue-400" : "text-text-disabled"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.name}</span>
          {item.badge && (
            <Badge className="text-xs px-1.5 py-0 h-4 bg-blue-600/20 text-blue-400 border-blue-500/20">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip key={item.name}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.name}</TooltipContent>
      </Tooltip>
    )
  }

  return <div key={item.name}>{link}</div>
}

function SidebarContent({
  pathname,
  collapsed = false,
}: {
  pathname: string
  collapsed?: boolean
}) {
  return (
    <nav className="space-y-1 px-2 py-2">
      {navigation.map((item) => (
        <NavLink key={item.name} item={item} pathname={pathname} collapsed={collapsed} />
      ))}
      <Separator className="my-3 opacity-50" />
      {secondaryNav.map((item) => (
        <NavLink key={item.name} item={item} pathname={pathname} collapsed={collapsed} />
      ))}
    </nav>
  )
}

export function AppSidebar({
  collapsed = false,
  onCollapse,
  mobile = false,
  open = false,
  onClose,
  className,
}: SidebarProps) {
  const pathname = usePathname()

  if (mobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-white/8 flex flex-col",
                className
              )}
            >
              <div className="flex items-center justify-between p-4 h-16">
                <Link href="/" className="text-xl font-bold gradient-text">
                  Aiscern
                </Link>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Separator className="opacity-50" />
              <ScrollArea className="flex-1">
                <SidebarContent pathname={pathname} />
              </ScrollArea>
              <SidebarFooter />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-surface border-r border-white/8 transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          className
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/5">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <Link href="/" className="text-xl font-bold gradient-text whitespace-nowrap">
                  Aiscern
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => onCollapse?.(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          <SidebarContent pathname={pathname} collapsed={collapsed} />
        </ScrollArea>

        {/* Footer */}
        {!collapsed && <SidebarFooter />}
      </div>
    </TooltipProvider>
  )
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t border-white/5">
      <div className="flex items-center gap-3 rounded-lg bg-surface-active p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
          A
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">Free Plan</p>
          <p className="text-xs text-text-muted">50 credits left</p>
        </div>
      </div>
    </div>
  )
}
