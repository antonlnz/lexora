"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
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
import type { ArticleWithUserData, Source } from "@/types/database"

export function ContentFeed() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [displayedItems, setDisplayedItems] = useState(6) // Start with 6 items
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [articles, setArticles] = useState<ArticleWithUserData[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingOlder, setIsSyncingOlder] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
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

  // Detectar filtros de fuente desde URL
  useEffect(() => {
    const sourceIdsFromUrl = searchParams.getAll('source')
    if (sourceIdsFromUrl.length > 0) {
      // Solo actualizar si las fuentes en la URL son diferentes a las del filtro
      const currentSources = filters.sources.sort().join(',')
      const urlSources = sourceIdsFromUrl.sort().join(',')
      if (currentSources !== urlSources) {
        setFilters(prev => ({
          ...prev,
          sources: sourceIdsFromUrl
        }))
      }
    }
  }, [searchParams])

  // Actualizar URL cuando cambien los filtros de fuente
  useEffect(() => {
    const currentSourceParams = searchParams.getAll('source')
    const currentSources = currentSourceParams.sort().join(',')
    const filterSources = filters.sources.sort().join(',')
    
    // Solo actualizar si hay diferencias
    if (currentSources !== filterSources) {
      const params = new URLSearchParams(searchParams.toString())
      
      // Eliminar todos los parámetros 'source' existentes
      params.delete('source')
      
      // Agregar todos los filtros de fuente
      if (filters.sources.length > 0) {
        filters.sources.forEach(sourceId => {
          params.append('source', sourceId)
        })
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      } else {
        // Si no hay fuentes en el filtro, quitar todos los parámetros de source
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
        router.replace(newUrl, { scroll: false })
      }
    }
  }, [filters.sources, pathname, router, searchParams])

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
      loadSources()
      loadSourceCount()
      // Solo sincronizar feeds si hay fuentes
      loadSourceCount().then(async (count) => {
        if (count > 0) {
          await syncFeedsWithProgress()
        }
      })
    }
  }, [isAuthenticated, authLoading])

  const syncFeedsWithProgress = async () => {
    try {
      setIsSyncing(true)
      
      // Obtener las fuentes primero para saber cuántas hay
      const userSources = await sourceService.getUserSources(true)
      setSyncProgress({ current: 0, total: userSources.length })
      
      // Sincronizar fuente por fuente y actualizar la lista en tiempo real
      for (let i = 0; i < userSources.length; i++) {
        const source = userSources[i]
        
        // Actualizar progreso
        setSyncProgress({ current: i + 1, total: userSources.length })
        
        // Sincronizar esta fuente específica
        try {
          const response = await fetch('/api/feeds/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourceId: source.id }),
          })
          
          if (response.ok) {
            // Recargar artículos después de cada fuente para mostrar progreso
            await loadArticles()
          }
        } catch (error) {
          console.error(`Error syncing source ${source.id}:`, error)
        }
      }
      
    } catch (error) {
      console.error('Error in sync process:', error)
    } finally {
      setIsSyncing(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }

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

  const loadSourceCount = async (): Promise<number> => {
    try {
      const sources = await sourceService.getUserSources(true)
      setSourceCount(sources.length)
      return sources.length
    } catch (error) {
      console.error('Error loading source count:', error)
      return 0
    }
  }

  const loadSources = async () => {
    try {
      const fetchedSources = await sourceService.getUserSources(true)
      setSources(fetchedSources)
    } catch (error) {
      console.error('Error loading sources:', error)
    }
  }

  const loadArticles = async () => {
    try {
      // Usar getArticlesWithUserData sin filtro de tiempo para cargar todos los artículos
      const fetchedArticles = await articleService.getArticlesWithUserData({
        limit: 100 // Cargar más artículos para tener mejor contexto
      })
      setArticles(fetchedArticles)
    } catch (error) {
      console.error('Error loading articles:', error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setDisplayedItems(6)
    await syncFeedsWithProgress() // Usar sincronización progresiva
    await loadSources()
    await loadSourceCount()
    setIsRefreshing(false)
  }

  const handleSourceAdded = async () => {
    await syncFeedsWithProgress() // Sincronización progresiva después de agregar una fuente
    await loadSources()
    await loadSourceCount()
  }

  const handleSyncOlderEntries = async () => {
    setIsSyncingOlder(true)
    try {
      // Si hay filtro de fuente específico, sincronizar solo esas fuentes
      const sourceIdsToSync = filters.sources.length > 0 ? filters.sources : []
      
      if (sourceIdsToSync.length > 0) {
        // Sincronizar cada fuente seleccionada
        for (const sourceId of sourceIdsToSync) {
          await fetch('/api/feeds/sync-older', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourceId }),
          })
        }
      } else {
        // Sincronizar todas las fuentes
        await fetch('/api/feeds/sync-older', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      }
      
      // Recargar artículos después de sincronizar
      await loadArticles()
      // Resetear los items mostrados para que se vea la actualización
      setDisplayedItems(6)
    } catch (error) {
      console.error('Error syncing older entries:', error)
    } finally {
      setIsSyncingOlder(false)
    }
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

      // Filtrar por fuentes seleccionadas
      if (filters.sources.length > 0 && !filters.sources.includes(article.source_id)) {
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
    return sources.map(source => ({
      id: source.id,
      title: source.title,
      favicon_url: source.favicon_url
    }))
  }, [sources])

  const availableTags = useMemo(() => {
    // Tags aún no implementados en BD
    return []
  }, [articles])

  // No mostrar nada si no está autenticado
  if (!isAuthenticated || authLoading) {
    return null
  }

  // Mostrar la interfaz completa incluso durante la carga inicial
  const showContent = true

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-bold text-balance">Your Content Universe</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedContent.length > 0 ? (
              <>
                {displayedContent.length} of {filteredAndSortedContent.length} items •{" "}
                {articles.filter((article) => !article.user_article?.is_read).length} unread
              </>
            ) : isSyncing ? (
              <>Syncing your sources...</>
            ) : (
              <>No items to display</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAddSource(sourceCount) && (
            <Button variant="outline" size="sm" onClick={() => setIsAddSourceOpen(true)} className="glass hover-lift-subtle">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing || isSyncing} className="glass hover-lift-subtle">
            <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || isSyncing) ? "animate-spin" : ""}`} />
            {isSyncing && syncProgress.total > 0 
              ? `Syncing ${syncProgress.current}/${syncProgress.total}...` 
              : (isRefreshing ? 'Syncing...' : 'Refresh')}
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

      {/* Indicador de sincronización */}
      {isSyncing && syncProgress.total > 0 && (
        <div className="glass rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Syncing your sources...</p>
                <p className="text-sm text-muted-foreground">
                  {syncProgress.current} of {syncProgress.total}
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            New articles will appear automatically as sources are synced
          </p>
        </div>
      )}

      {filteredAndSortedContent.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {isSyncing ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-lg mb-2">Fetching your latest content...</p>
                <p className="text-sm">
                  Syncing articles from your sources ({syncProgress.current}/{syncProgress.total})
                </p>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">
                  {articles.length === 0 ? "No articles in your feed yet" : "No content matches your filters"}
                </p>
                <p className="text-sm mb-4">
                  {articles.length === 0 
                    ? "Click below to sync older articles from your sources" 
                    : "Try adjusting your search criteria or clearing some filters"}
                </p>
                {/* Mostrar botón de sincronización si no hay artículos o si hay filtro de fuente activo */}
                {(articles.length === 0 || filters.sources.length > 0) && sourceCount > 0 && (
                  <div className="mt-6">
                    <Button 
                      onClick={handleSyncOlderEntries} 
                      disabled={isSyncingOlder}
                      variant="outline"
                      size="lg"
                      className="glass hover-lift-subtle"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingOlder ? "animate-spin" : ""}`} />
                      {isSyncingOlder ? 'Syncing older entries...' : 'Sync older entries'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      {filters.sources.length > 0 
                        ? 'Fetch articles older than 24 hours from selected sources'
                        : 'Fetch articles older than 24 hours from all your sources'
                      }
                    </p>
                  </div>
                )}
              </>
            )}
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
