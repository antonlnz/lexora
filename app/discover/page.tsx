import { Navigation } from "@/components/navigation"
import { DiscoverContent } from "@/components/discover-content"

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-playfair font-bold text-balance mb-2">Discover</h1>
            <p className="text-muted-foreground">
              Find new sources, trending topics, and personalized recommendations based on your interests.
            </p>
          </div>

          <DiscoverContent />
        </div>
      </div>
    </div>
  )
}
