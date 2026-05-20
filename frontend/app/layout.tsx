import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ContentOS',
  description: 'AI-native Creator Operating System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f9f9f8]">
        <nav className="border-b border-zinc-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900 tracking-tight">ContentOS</span>
            <span className="text-xs text-zinc-400">Creator OS</span>
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
