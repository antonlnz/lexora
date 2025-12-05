import { Navigation } from "@/components/navigation"
import { SourcesManager } from "@/components/sources-manager"

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-playfair font-bold text-balance mb-2">Content Sources</h1>
            <p className="text-muted-foreground">
              Manage your content sources and customize how you consume information from across the web.
            </p>
          </div>

          <SourcesManager />
        </div>
      </div>
    </div>
  )
}
