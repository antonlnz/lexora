import { Navigation } from "@/components/navigation"
import { ArchiveContent } from "@/components/archive-content"

export default function ArchivePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-playfair font-bold text-balance mb-2">Archive</h1>
            <p className="text-muted-foreground">
              Browse your reading history, saved articles, and organize your content library.
            </p>
          </div>

          <ArchiveContent />
        </div>
      </div>
    </div>
  )
}
