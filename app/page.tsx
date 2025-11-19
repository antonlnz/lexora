"use client"

import { Navigation } from "@/components/navigation"
import { ContentFeed } from "@/components/content-feed"
import { CollapsibleSidebar } from "@/components/collapsible-sidebar"
import { AuthGuard } from "@/components/auth-guard"

export default function HomePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navigation />

        <div className="pt-16">
          <CollapsibleSidebar />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8">
              <main className="w-full">
                <ContentFeed />
              </main>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
