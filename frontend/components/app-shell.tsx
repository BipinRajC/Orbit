'use client'

import { useState } from 'react'
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <OnboardingDialog forceOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      {/* ── Sidebar — cream theme ── */}
      <aside
        className={cn(
          'relative flex flex-col border-r-2 border-[#1a1a1a]/10 bg-[#FAF7F0] transition-all duration-300 overflow-hidden shrink-0',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        {/* Logo + mascot */}
        <div className="flex h-16 items-center gap-3 border-b-2 border-[#1a1a1a]/10 px-3.5">
          <Link href="/" className="shrink-0">
            <Mascot className="h-9 w-9" />
          </Link>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-black tracking-tight text-[#1a1a1a]">ContentOS</p>
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
                      onClick={item.soon ? (e) => e.preventDefault() : undefined}
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
            className={cn(
              'flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1a1a1a]/55 transition-all hover:bg-white hover:text-[#1a1a1a]',
              collapsed ? 'justify-center' : 'gap-2.5',
              pathname === '/profile' && 'bg-white text-[#1a1a1a] font-bold',
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

        {/* Collapse toggle */}
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
      </aside>

      {/* ── Main content — cream ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-[#FAF7F0] text-[#1a1a1a]">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </div>
      </main>
    </>
  )
}
