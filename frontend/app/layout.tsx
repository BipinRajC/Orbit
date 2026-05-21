import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OrbitOS — AI Shorts Studio',
  description: 'Turn your YouTube long-form videos into a week of platform-ready shorts — powered by your persona.',
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
