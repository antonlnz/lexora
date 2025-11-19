"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ContentCard } from "@/components/content-card"
import { ContentViewer } from "@/components/content-viewer"
import { AdvancedFilters, type FilterState } from "@/components/advanced-filters"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { LayoutGrid, List, RefreshCw, Loader2, Plus } from "lucide-react"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useSubscription } from "@/contexts/subscription-context"
import { useAuth } from "@/contexts/auth-context"
import { articleService } from "@/lib/services/article-service"
import { sourceService } from "@/lib/services/source-service"
import type { ArticleWithUserData } from "@/types/database"

export function ContentFeed() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [displayedItems, setDisplayedItems] = useState(6) // Start with 6 items
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [articles, setArticles] = useState<ArticleWithUserData[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
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
  const { canAddSource, getSourceLimit } = useSubscription()
  const [sourceCount, setSourceCount] = useState(0)

  // Cargar artículos al montar el componente, solo si está autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadArticles()
      loadSourceCount()
      // Solo sincronizar feeds si hay fuentes
      loadSourceCount().then(() => {
        if (sourceCount > 0) {
          syncFeeds()
        }
      })
    }
  }, [isAuthenticated, authLoading])

  const syncFeeds = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch('/api/feeds/refresh', {
        method: 'POST',
      })
      
      if (!response.ok) {
        // Solo loguear si no es un 404 o similar
        if (response.status >= 500) {
          console.error('Server error syncing feeds:', response.status)
        }
        return
      }
      
      const data = await response.json()
      if (data.totalArticlesAdded > 0) {
        console.log(`Synced ${data.totalArticlesAdded} new articles`)
      }
    } catch (error) {
      // Silently fail - user might not have sources yet
    } finally {
      setIsSyncing(false)
    }
  }

  const loadSourceCount = async () => {
    try {
      const sources = await sourceService.getUserSources(true)
      setSourceCount(sources.length)
    } catch (error) {
      console.error('Error loading source count:', error)
    }
  }

  const loadArticles = async () => {
    setIsLoadingInitial(true)
    try {
      const fetchedArticles = await articleService.getRecentFeedArticles({
        limit: 50 // Cargar más artículos inicialmente para filtrado local
      })
      setArticles(fetchedArticles)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setIsLoadingInitial(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setDisplayedItems(6)
    await syncFeeds() // Primero sincronizar feeds
    await loadArticles() // Luego cargar artículos actualizados
    await loadSourceCount()
    setIsRefreshing(false)
  }

  const handleSourceAdded = async () => {
    await syncFeeds() // Sincronizar después de agregar una fuente
    await loadArticles()
    await loadSourceCount()
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

  const handleNavigateNext = () => {
    if (!viewerContent) return
    const currentIndex = filteredAndSortedContent.findIndex((item) => item.id === viewerContent.id)
    if (currentIndex !== -1 && currentIndex < filteredAndSortedContent.length - 1) {
      const nextContent = filteredAndSortedContent[currentIndex + 1]
      setViewerContent(nextContent)
      setCardPosition(null) // No animar desde tarjeta al navegar
    }
  }

  const handleNavigatePrevious = () => {
    if (!viewerContent) return
    const currentIndex = filteredAndSortedContent.findIndex((item) => item.id === viewerContent.id)
    if (currentIndex > 0) {
      const previousContent = filteredAndSortedContent[currentIndex - 1]
      setViewerContent(previousContent)
      setCardPosition(null) // No animar desde tarjeta al navegar
    }
  }

  const filteredAndSortedContent = useMemo(() => {
    const filtered = articles.filter((article) => {
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        if (
          !article.title.toLowerCase().includes(searchTerm) &&
          !(article.excerpt || '').toLowerCase().includes(searchTerm) &&
          !(article.author || '').toLowerCase().includes(searchTerm) &&
          !article.source.title.toLowerCase().includes(searchTerm)
        ) {
          return false
        }
      }

      if (filters.types.length > 0 && !filters.types.includes(article.source.source_type as any)) {
        return false
      }

      if (filters.sources.length > 0 && !filters.sources.includes(article.source.title)) {
        return false
      }

      // Tags no están implementados en la BD todavía, se puede omitir
      // if (filters.tags.length > 0 && !filters.tags.some((tag) => item.tags.includes(tag))) {
      //   return false
      // }

      if (filters.readStatus === "read" && !article.user_article?.is_read) return false
      if (filters.readStatus === "unread" && article.user_article?.is_read) return false

      if (filters.savedStatus === "saved" && !article.user_article?.is_favorite) return false
      if (filters.savedStatus === "unsaved" && article.user_article?.is_favorite) return false

      if (article.reading_time) {
        if (article.reading_time < filters.readTimeRange[0] || article.reading_time > filters.readTimeRange[1]) {
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
          comparison = a.source.title.localeCompare(b.source.title)
          break
        case "date":
        default:
          const aDate = a.published_at ? new Date(a.published_at).getTime() : 0
          const bDate = b.published_at ? new Date(b.published_at).getTime() : 0
          comparison = aDate - bDate
          break
      }

      return filters.sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [articles, filters])

  const displayedContent = useMemo(() => {
    return filteredAndSortedContent.slice(0, displayedItems)
  }, [filteredAndSortedContent, displayedItems])

  const currentIndex = viewerContent ? filteredAndSortedContent.findIndex((item) => item.id === viewerContent.id) : -1
  const hasNext = currentIndex !== -1 && currentIndex < filteredAndSortedContent.length - 1
  const hasPrevious = currentIndex > 0

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
    return Array.from(new Set(articles.map((article) => article.source.title))).sort()
  }, [articles])

  const availableTags = useMemo(() => {
    // Tags aún no implementados en BD
    return []
  }, [articles])

  // No mostrar nada si no está autenticado
  if (!isAuthenticated || authLoading) {
    return null
  }

  if (isLoadingInitial) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <div className="text-center">
            <p className="font-medium">Loading your feed...</p>
            {isSyncing && <p className="text-sm mt-1">Syncing latest articles from your sources...</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-bold text-balance">Your Content Universe</h1>
          <p className="text-muted-foreground mt-1">
            {displayedContent.length} of {filteredAndSortedContent.length} items •{" "}
            {articles.filter((article) => !article.user_article?.is_read).length} unread
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAddSource(sourceCount) && (
            <Button variant="outline" size="sm" onClick={() => setIsAddSourceOpen(true)} className="glass hover-lift-subtle">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="glass hover-lift-subtle">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </Button>

          <div className="flex items-center glass rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0 hover-lift-subtle"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0 hover-lift-subtle"
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

      {filteredAndSortedContent.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <p className="text-lg mb-2">
              {articles.length === 0 ? "No articles in your feed yet" : "No content matches your filters"}
            </p>
            <p className="text-sm">
              {articles.length === 0 
                ? "Add some sources to start seeing content from the last 24 hours" 
                : "Try adjusting your search criteria or clearing some filters"}
            </p>
          </div>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"}>
          {displayedContent.map((article) => (
            <ContentCard 
              key={article.id} 
              article={article} 
              viewMode={viewMode} 
              onOpenViewer={handleOpenViewer} 
            />
          ))}
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
          <div className="mx-auto mt-4 text-6xl opacity-50">✅</div>
        </div>
      )}

      <ContentViewer
        content={viewerContent}
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        cardPosition={cardPosition}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
      />

      <AddSourceDialog 
        open={isAddSourceOpen} 
        onOpenChange={setIsAddSourceOpen} 
        onSourceAdded={handleSourceAdded}
      />
    </div>
  )
}
