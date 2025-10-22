"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ContentCard } from "@/components/content-card"
import { ContentViewer } from "@/components/content-viewer"
import { AdvancedFilters, type FilterState } from "@/components/advanced-filters"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { LayoutGrid, List, RefreshCw, Loader2, Plus } from "lucide-react"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useSubscription } from "@/contexts/subscription-context"

// Mock data for different content types
const mockContent = [
  {
    id: "1",
    type: "news" as const,
    title: "The Future of Sustainable Technology in 2025",
    excerpt:
      "Exploring breakthrough innovations that are reshaping how we think about environmental responsibility in tech.",
    source: "TechCrunch",
    author: "Sarah Chen",
    publishedAt: "2 hours ago",
    readTime: "5 min read",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Technology", "Sustainability", "Innovation"],
    isRead: false,
    isSaved: false,
  },
  {
    id: "2",
    type: "youtube" as const,
    title: "Building Modern Web Applications with Next.js 15",
    excerpt: "A comprehensive guide to the latest features and best practices for modern web development.",
    source: "Vercel",
    author: "Lee Robinson",
    publishedAt: "4 hours ago",
    duration: "24:15",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Web Development", "Next.js", "Tutorial"],
    isRead: false,
    isSaved: true,
    views: "125K views",
  },
  {
    id: "3",
    type: "twitter" as const,
    title: "Thread: The psychology behind great product design",
    excerpt: "A fascinating deep-dive into how cognitive biases influence user experience decisions. 🧠✨",
    source: "Twitter",
    author: "@designpsych",
    publishedAt: "6 hours ago",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Design", "Psychology", "UX"],
    isRead: true,
    isSaved: false,
    engagement: "2.4K likes • 180 retweets",
  },
  {
    id: "4",
    type: "newsletter" as const,
    title: "Weekly Design Inspiration #47",
    excerpt: "This week's curated collection of stunning interfaces, innovative interactions, and design thinking.",
    source: "Design Weekly",
    author: "Maria Rodriguez",
    publishedAt: "1 day ago",
    readTime: "8 min read",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Design", "Inspiration", "UI/UX"],
    isRead: false,
    isSaved: false,
  },
  {
    id: "5",
    type: "instagram" as const,
    title: "Behind the scenes of our latest photoshoot",
    excerpt: "Take a look at the creative process behind our minimalist fashion campaign.",
    source: "Instagram",
    author: "@studiominimal",
    publishedAt: "8 hours ago",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Fashion", "Photography", "Behind the Scenes"],
    isRead: false,
    isSaved: false,
    engagement: "1.8K likes • 45 comments",
  },
  {
    id: "6",
    type: "tiktok" as const,
    title: "Quick productivity hack that changed my workflow",
    excerpt: "A simple technique that can save you hours every week. Try it and let me know what you think!",
    source: "TikTok",
    author: "@productivitypro",
    publishedAt: "12 hours ago",
    duration: "0:47",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Productivity", "Tips", "Workflow"],
    isRead: false,
    isSaved: true,
    views: "89K views",
  },
]

export function ContentFeed() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [displayedItems, setDisplayedItems] = useState(6) // Start with 6 items
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const itemsPerPage = 6

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    types: [],
    sources: [],
    tags: [],
    dateRange: "all",
    readStatus: "all",
    savedStatus: "all",
    sortBy: "date",
    sortOrder: "desc",
    readTimeRange: [0, 60],
  })

  const [viewerContent, setViewerContent] = useState<any>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [cardPosition, setCardPosition] = useState<DOMRect | null>(null)

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const { canAddSource } = useSubscription()
  const [sources, setSources] = useState<any[]>([]) // This would come from a sources context in production

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setDisplayedItems(6)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const handleOpenViewer = (content: any, cardElement: HTMLElement) => {
    const rect = cardElement.getBoundingClientRect()
    setCardPosition(rect)
    setViewerContent(content)
    setIsViewerOpen(true)
  }

  const handleCloseViewer = () => {
    setIsViewerOpen(false)
    setTimeout(() => {
      setViewerContent(null)
      setCardPosition(null)
    }, 300)
  }

  const handleAddSource = (newSource: any) => {
    setSources((prev) => [...prev, { ...newSource, id: Date.now().toString() }])
    setIsAddSourceOpen(false)
  }

  const filteredAndSortedContent = useMemo(() => {
    const filtered = mockContent.filter((item) => {
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        if (
          !item.title.toLowerCase().includes(searchTerm) &&
          !item.excerpt.toLowerCase().includes(searchTerm) &&
          !item.author.toLowerCase().includes(searchTerm) &&
          !item.source.toLowerCase().includes(searchTerm)
        ) {
          return false
        }
      }

      if (filters.types.length > 0 && !filters.types.includes(item.type)) {
        return false
      }

      if (filters.sources.length > 0 && !filters.sources.includes(item.source)) {
        return false
      }

      if (filters.tags.length > 0 && !filters.tags.some((tag) => item.tags.includes(tag))) {
        return false
      }

      if (filters.readStatus === "read" && !item.isRead) return false
      if (filters.readStatus === "unread" && item.isRead) return false

      if (filters.savedStatus === "saved" && !item.isSaved) return false
      if (filters.savedStatus === "unsaved" && item.isSaved) return false

      if (item.readTime) {
        const readTimeMinutes = Number.parseInt(item.readTime.split(" ")[0])
        if (readTimeMinutes < filters.readTimeRange[0] || readTimeMinutes > filters.readTimeRange[1]) {
          return false
        }
      }

      return true
    })

    filtered.sort((a, b) => {
      let comparison = 0

      switch (filters.sortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title)
          break
        case "source":
          comparison = a.source.localeCompare(b.source)
          break
        case "engagement":
          const aEngagement =
            Number.parseInt(a.views?.split("K")[0] || "0") + Number.parseInt(a.engagement?.split("K")[0] || "0")
          const bEngagement =
            Number.parseInt(b.views?.split("K")[0] || "0") + Number.parseInt(b.engagement?.split("K")[0] || "0")
          comparison = aEngagement - bEngagement
          break
        case "date":
        default:
          const timeUnits = { minute: 1, minutes: 1, hour: 60, hours: 60, day: 1440, days: 1440 }
          const getMinutes = (timeStr: string) => {
            const match = timeStr.match(/(\d+)\s+(minute|minutes|hour|hours|day|days)/)
            if (match) {
              const value = Number.parseInt(match[1])
              const unit = match[2] as keyof typeof timeUnits
              return value * timeUnits[unit]
            }
            return 0
          }
          comparison = getMinutes(a.publishedAt) - getMinutes(b.publishedAt)
          break
      }

      return filters.sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [filters])

  const displayedContent = useMemo(() => {
    return filteredAndSortedContent.slice(0, displayedItems)
  }, [filteredAndSortedContent, displayedItems])

  const hasNextPage = displayedItems < filteredAndSortedContent.length

  const fetchNextPage = async () => {
    if (isLoadingMore) return

    setIsLoadingMore(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setDisplayedItems((prev) => Math.min(prev + itemsPerPage, filteredAndSortedContent.length))
    setIsLoadingMore(false)
  }

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage: isLoadingMore,
    fetchNextPage,
    rootMargin: "200px",
  })

  const availableSources = useMemo(() => {
    return Array.from(new Set(mockContent.map((item) => item.source))).sort()
  }, [])

  const availableTags = useMemo(() => {
    return Array.from(new Set(mockContent.flatMap((item) => item.tags))).sort()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-bold text-balance">Your Content Universe</h1>
          <p className="text-muted-foreground mt-1">
            {displayedContent.length} of {filteredAndSortedContent.length} items •{" "}
            {mockContent.filter((item) => !item.isRead).length} unread
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAddSource && (
            <Button variant="outline" size="sm" onClick={() => setIsAddSourceOpen(true)} className="glass">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="glass">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="flex items-center glass rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableSources={availableSources}
        availableTags={availableTags}
      />

      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"}>
        {displayedContent.map((item) => (
          <ContentCard key={item.id} content={item} viewMode={viewMode} onOpenViewer={handleOpenViewer} />
        ))}
      </div>

      {filteredAndSortedContent.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <p className="text-lg mb-2">No content matches your filters</p>
            <p className="text-sm">Try adjusting your search criteria or clearing some filters</p>
          </div>
        </div>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center pt-8">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more content...</span>
            </div>
          )}
        </div>
      )}

      {!hasNextPage && filteredAndSortedContent.length > 0 && (
        <div className="text-center py-8">
          <div className="text-muted-foreground text-sm">
            You've reached the end of your content feed, no endless scrolling here.
          </div>
        </div>
      )}

      <ContentViewer
        content={viewerContent}
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        cardPosition={cardPosition}
      />

      <AddSourceDialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen} onAdd={handleAddSource} />
    </div>
  )
}
