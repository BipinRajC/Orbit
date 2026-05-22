import { AppShell } from '@/components/app-shell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <AppShell>{children}</AppShell>
    </div>
  )
}
