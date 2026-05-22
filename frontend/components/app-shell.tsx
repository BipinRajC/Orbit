'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  FileText,
  FolderOpen,
  SlidersHorizontal,
  Brain,
  UserCircle2,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Mascot } from '@/components/mascot'
import { OnboardingDialog } from '@/components/onboarding-dialog'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  soon?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'Studio',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/projects', label: 'All Projects', icon: FolderOpen },
      { href: '/moments',  label: 'Moments',      icon: Layers },
      { href: '/drafts',   label: 'Drafts',       icon: FileText },
      { href: '/memory',   label: 'Memory Bank',  icon: Brain },
      { href: '/profile',  label: 'Profile',       icon: UserCircle2 },
    ],
  },
]

function SidebarContent({
  collapsed,
  setCollapsed,
  onLinkClick,
}: {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onLinkClick?: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      {/* Logo + mascot */}
      <div className="flex h-16 items-center gap-3 border-b-2 border-[#1a1a1a]/10 px-3.5">
        <Link href="/" className="shrink-0" onClick={onLinkClick}>
          <Mascot className="h-9 w-9" />
        </Link>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight text-[#1a1a1a]">OrbitOS</p>
            <p className="text-[10px] font-semibold leading-tight text-[#1a1a1a]/50">Creator Studio</p>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-6')}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]/40">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = !item.soon && (
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                )
                return (
                  <Link
                    key={item.label}
                    href={item.soon ? '#' : item.href}
                    onClick={item.soon ? (e) => e.preventDefault() : onLinkClick}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center rounded-xl px-3 py-2 text-sm font-bold transition-all',
                      collapsed ? 'justify-center' : 'gap-2.5',
                      active
                        ? 'border-2 border-[#1a1a1a] bg-[#FFD180] text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]'
                        : item.soon
                        ? 'cursor-default text-[#1a1a1a]/35'
                        : 'text-[#1a1a1a]/75 hover:bg-white hover:text-[#1a1a1a]'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.soon && (
                          <span className="rounded-full border border-[#1a1a1a]/15 bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#1a1a1a]/40">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t-2 border-[#1a1a1a]/10 px-3 py-3 space-y-2">
        <Link
          href="/profile"
          title={collapsed ? 'Profile' : undefined}
          onClick={onLinkClick}
          className={cn(
            'flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1a1a1a]/55 transition-all hover:bg-white hover:text-[#1a1a1a]',
            collapsed ? 'justify-center' : 'gap-2.5',
            usePathname() === '/profile' && 'bg-white text-[#1a1a1a] font-bold',
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Preferences</span>}
        </Link>

        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#1a1a1a]/40" />
            <span className="text-xs font-semibold text-[#1a1a1a]/40">AI-Powered</span>
          </div>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-white py-1.5 text-xs font-bold text-[#1a1a1a] transition-all hover:bg-[#FFD180]',
          collapsed ? 'px-0' : 'px-3'
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Collapse</span>
          </>
        )}
      </button>
    </>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <>
      <OnboardingDialog forceOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* ── Mobile top bar (hidden on md+) ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-[#1a1a1a]/10 bg-[#FAF7F0] px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Mascot className="h-8 w-8" />
          <span className="text-sm font-black tracking-tight text-[#1a1a1a]">OrbitOS</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#1a1a1a]/15 bg-white text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]/40"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1a1a1a]/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r-2 border-[#1a1a1a]/10 bg-[#FAF7F0] transition-transform duration-300 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer close button */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#1a1a1a]/15 bg-white text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]/40"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent
          collapsed={false}
          setCollapsed={() => {}}
          onLinkClick={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside
        className={cn(
          'relative hidden flex-col border-r-2 border-[#1a1a1a]/10 bg-[#FAF7F0] transition-all duration-300 overflow-hidden shrink-0 md:flex',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-[#FAF7F0] text-[#1a1a1a]">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </>
  )
}
