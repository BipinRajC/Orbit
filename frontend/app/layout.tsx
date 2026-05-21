import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ContentOS — AI Content Studio',
  description: 'Turn any YouTube video into creator-voiced hooks, tweets, and clip framing.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
