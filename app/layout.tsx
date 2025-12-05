import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Playfair_Display, DM_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { SubscriptionProvider } from "@/contexts/subscription-context"
import { InterfaceSettingsProvider } from "@/contexts/interface-settings-context"
import { PendingDeletionsProvider } from "@/contexts/pending-deletions-context"
import { PodcastPlayerProvider } from "@/contexts/podcast-player-context"
import { SessionSyncProvider } from "@/components/session-sync-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { MiniPodcastPlayer } from "@/components/mini-podcast-player"
import { YouTubeBackgroundPlayer } from "@/components/youtube-background-player"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Lexora - Your Content Universe",
  description: "Centralize all your digital content in one elegant space",
  generator: "Lexora",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lexora",
    startupImage: "/placeholder-logo.png",
  },
  icons: {
    icon: "/placeholder-logo.png",
    apple: "/placeholder-logo.png",
  },
  other: {
    "theme-color": "#fafaf9",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SubscriptionProvider>
              <InterfaceSettingsProvider>
                <PendingDeletionsProvider>
                  <PodcastPlayerProvider>
                    <SessionSyncProvider>
                      <Suspense fallback={null}>{children}</Suspense>
                      <MiniPodcastPlayer />
                      <YouTubeBackgroundPlayer />
                    </SessionSyncProvider>
                  </PodcastPlayerProvider>
                </PendingDeletionsProvider>
              </InterfaceSettingsProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}