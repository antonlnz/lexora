import type React from "react"
import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { SubscriptionProvider } from "@/contexts/subscription-context"
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

export const metadata: Metadata = {
  title: "Lexora - Your Content Universe",
  description: "Centralize all your digital content in one elegant space",
  generator: "Lexora",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <SubscriptionProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </SubscriptionProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}

// WITH THIS THE THEME WORKS

// import type { Metadata } from "next"
// import { Inter, Playfair_Display } from "next/font/google"
// import { Navigation } from "@/components/navigation"
// import { ThemeProvider } from "@/components/theme-provider"
// import { AuthProvider } from "@/contexts/auth-context"
// import { SubscriptionProvider } from "@/contexts/subscription-context"
// import { Toaster } from "@/components/ui/sonner"
// import "./globals.css"

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-inter",
// })

// const playfair = Playfair_Display({
//   subsets: ["latin"],
//   variable: "--font-playfair",
// })

// export const metadata: Metadata = {
//   title: "Lexora - Your Personalized Content Hub",
//   description: "Aggregate and curate content from all your favorite sources",
// }

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   return (
//     <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
//       <body className="min-h-screen bg-background font-sans antialiased">
//         <ThemeProvider
//           attribute="class"
//           defaultTheme="system"
//           enableSystem
//           disableTransitionOnChange
//         >
//           <AuthProvider>
//             <SubscriptionProvider>
//               <Navigation />
//               <main className="min-h-screen">
//                 {children}
//               </main>
//               <Toaster />
//             </SubscriptionProvider>
//           </AuthProvider>
//         </ThemeProvider>
//       </body>
//     </html>
//   )
// }