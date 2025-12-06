"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ContentCard } from "@/components/content-card"
import { ContentViewer } from "@/components/content-viewer"
import { PodcastViewer } from "@/components/podcast-viewer"
import { AdvancedFilters, type FilterState } from "@/components/advanced-filters"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { LayoutGrid, List, RefreshCw, Loader2, Plus } from "lucide-react"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { usePullToLoad } from "@/hooks/use-pull-to-load"
import { useSubscription } from "@/contexts/subscription-context"
import { useAuth } from "@/contexts/auth-context"
import { usePodcastPlayer, type PodcastEpisode } from "@/contexts/podcast-player-context"
import { usePendingDeletions } from "@/contexts/pending-deletions-context"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { sourceService, type SourceWithUserData } from "@/lib/services/source-service"
import { generateContentSlug, parseContentSlug } from "@/lib/utils/content-slug"

export function ContentFeed() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [displayedItems, setDisplayedItems] = useState(6) // Start with 6 items
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [articles, setArticles] = useState<ContentWithMetadata[]>([])
  const [sources, setSources] = useState<SourceWithUserData[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingOlder, setIsSyncingOlder] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [syncOlderProgress, setSyncOlderProgress] = useState({ current: 0, total: 0 })
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
  
  // Estado para el podcast viewer
  const [isPodcastViewerOpen, setIsPodcastViewerOpen] = useState(false)
  const [currentPodcastEpisode, setCurrentPodcastEpisode] = useState<PodcastEpisode | null>(null)
  const [podcastEpisodes, setPodcastEpisodes] = useState<PodcastEpisode[]>([])
  
  // Ref para rastrear si estamos abriendo desde URL (evitar bucles)
  const isOpeningFromUrl = useRef(false)
  // Ref para rastrear si ya procesamos la URL inicial
  const hasProcessedInitialUrl = useRef(false)
  // Ref para rastrear si estamos en proceso de abrir el viewer manualmente
  const isOpeningManually = useRef(false)

  // Hook del podcast player para detectar cuando se quiere maximizar
  const { shouldOpenViewer, clearShouldOpenViewer, currentEpisode } = usePodcastPlayer()
  
  // Hook para obtener las eliminaciones pendientes
  const { pendingDeletions } = usePendingDeletions()
  
  // IDs de fuentes pendientes de eliminación
  const pendingDeletionSourceIds = useMemo(() => 
    new Set(pendingDeletions.map(pd => pd.source.id)),
    [pendingDeletions]
  )

  // Abrir el podcast viewer cuando se maximiza desde el mini player
  useEffect(() => {
    if (shouldOpenViewer && currentEpisode) {
      setCurrentPodcastEpisode(currentEpisode)
      
      // Cargar episodios del mismo podcast si aún no están cargados
      if (articles.length > 0 && currentEpisode.source_id) {
        const allPodcastEpisodes = articles
          .filter(a => a.source_id === currentEpisode.source_id && a.source.source_type === 'podcast')
          .map(a => ({
            id: a.id,
            source_id: a.source_id,
            title: a.title,
            url: a.url,
            author: (a as any).author || null,
            published_at: a.published_at || null,
            description: (a as any).description || null,
            show_notes: (a as any).show_notes || null,
            audio_url: (a as any).audio_url,
            image_url: (a as any).image_url || null,
            duration: (a as any).duration || null,
            episode_number: (a as any).episode_number || null,
            season_number: (a as any).season_number || null,
            created_at: (a as any).created_at || new Date().toISOString(),
            updated_at: (a as any).updated_at || new Date().toISOString(),
            source: a.source,
          })) as PodcastEpisode[]
        
        if (allPodcastEpisodes.length > 0) {
          setPodcastEpisodes(allPodcastEpisodes)
        }
      }
      
      setIsPodcastViewerOpen(true)
      clearShouldOpenViewer()
    }
  }, [shouldOpenViewer, currentEpisode, articles, clearShouldOpenViewer])

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
      
      // Iniciar un intervalo para actualizar artículos cada 2 segundos durante la sincronización
      const refreshInterval = setInterval(async () => {
        //console.log('🔄 Actualizando artículos durante sincronización...')
        await loadArticles()
      }, 2000)
      
      try {
        // Sincronizar fuente por fuente
        for (let i = 0; i < userSources.length; i++) {
          const source = userSources[i]
          
          // Actualizar progreso
          setSyncProgress({ current: i + 1, total: userSources.length })
          
          // Sincronizar esta fuente específica
          try {
            // console.log(`Syncing source ${source.id} (${i + 1} of ${userSources.length})`)
            const response = await fetch('/api/feeds/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sourceId: source.id }),
            })
            
            if (!response.ok) {
              console.error(`Error syncing source ${source.id}:`, response.status)
            }
          } catch (error) {
            console.error(`Error syncing source ${source.id}:`, error)
          }
        }
      } finally {
        // Detener el intervalo de actualización
        clearInterval(refreshInterval)
        // Una última actualización para asegurar que tenemos todos los artículos
        await loadArticles()
      }
      
    } catch (error) {
      console.error('Error in sync process:', error)
    } finally {
      setIsSyncing(false)
      setSyncProgress({ current: 0, total: 0 })
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
      // console.log('Loading articles...')
      // Usar getContentWithUserData sin filtro de tiempo para cargar todos los artículos
      const fetchedArticles = await contentService.getContentWithUserData({
        limit: 100 // Cargar más artículos para tener mejor contexto
      })
      //console.log(`Loaded ${fetchedArticles.length} articles`)
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
      
      // Iniciar un intervalo para actualizar artículos cada 2 segundos durante la sincronización
      const refreshInterval = setInterval(async () => {
        //console.log('🔄 Actualizando artículos durante sincronización (older entries)...')
        await loadArticles()
      }, 2000)
      
      try {
        if (sourceIdsToSync.length > 0) {
          // Sincronizar cada fuente seleccionada
          // console.log('Syncing specific sources:', sourceIdsToSync)
          setSyncOlderProgress({ current: 0, total: sourceIdsToSync.length })
          
          for (let i = 0; i < sourceIdsToSync.length; i++) {
            const sourceId = sourceIdsToSync[i]
            setSyncOlderProgress({ current: i + 1, total: sourceIdsToSync.length })
            
            const response = await fetch('/api/feeds/sync-older', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sourceId }),
            })
            
            if (!response.ok) {
              console.error('Error syncing source:', sourceId, response.status)
            } else {
              const data = await response.json()
              // console.log('Source synced:', sourceId, data)
            }
          }
        } else {
          // Sincronizar todas las fuentes una por una
          // console.log('Syncing all sources (older entries)')
          const userSources = await sourceService.getUserSources(true)
          setSyncOlderProgress({ current: 0, total: userSources.length })
          
          for (let i = 0; i < userSources.length; i++) {
            const source = userSources[i]
            setSyncOlderProgress({ current: i + 1, total: userSources.length })
            
            const response = await fetch('/api/feeds/sync-older', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sourceId: source.id }),
            })
            
            if (!response.ok) {
              console.error('Error syncing source:', source.id, response.status)
            } else {
              const data = await response.json()
              // console.log('Source synced:', source.id, data)
            }
          }
        }
      } finally {
        // Detener el intervalo de actualización
        clearInterval(refreshInterval)
        // Una última actualización para asegurar que tenemos todos los artículos
        await loadArticles()
      }
      
      // Resetear los items mostrados para que se vea la actualización
      setDisplayedItems(6)
    } catch (error) {
      console.error('Error syncing older entries:', error)
    } finally {
      setIsSyncingOlder(false)
      setSyncOlderProgress({ current: 0, total: 0 })
    }
  }

  // Pull-to-load para cargar entradas anteriores
  const { pullDistance, isPulling, progress, isTriggered } = usePullToLoad({
    touchThreshold: 120,
    onTrigger: handleSyncOlderEntries,
    isLoading: isSyncingOlder
  })

  // Helper para determinar si un contenido debe usar PodcastViewer
  // Solo los podcasts de audio usan PodcastViewer, YouTube normal usa ContentViewer
  const shouldUsePodcastViewer = (content: ContentWithMetadata): boolean => {
    const sourceType = content.source.source_type
    return sourceType === 'podcast'
  }

  // Helper para abrir el visor correcto según el tipo de contenido
  const openCorrectViewer = useCallback((content: ContentWithMetadata) => {
    console.log('[openCorrectViewer] Opening viewer for content:', content.id)
    // Actualizar URL solo si no estamos abriendo desde URL
    if (!isOpeningFromUrl.current) {
      // Marcar que estamos abriendo manualmente para evitar que el efecto de cierre interfiera
      isOpeningManually.current = true
      console.log('[openCorrectViewer] Updating URL for viewer')
      const slug = generateContentSlug(content.id, content.title)
      const params = new URLSearchParams(searchParams.toString())
      params.set('viewer', slug)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      console.log('[openCorrectViewer] URL updated')
      // Desmarcar después de un breve delay para dar tiempo a que la URL se actualice
      setTimeout(() => {
        isOpeningManually.current = false
      }, 100)
    }
    
    if (shouldUsePodcastViewer(content)) {
      // Cerrar ContentViewer si está abierto
      if (isViewerOpen) {
        setIsViewerOpen(false)
        setViewerContent(null)
      }
      
      // Convertir a PodcastEpisode
      const isYouTube = content.source.source_type === 'youtube_channel' || content.source.source_type === 'youtube_video'
      const episode: PodcastEpisode = {
        id: content.id,
        source_id: content.source_id,
        title: content.title,
        url: content.url,
        author: (content as any).author || (content as any).channel_name || null,
        published_at: content.published_at || null,
        description: (content as any).description || null,
        show_notes: (content as any).show_notes || null,
        audio_url: isYouTube ? content.url : (content as any).audio_url,
        image_url: (content as any).image_url || null,
        duration: (content as any).duration || null,
        episode_number: (content as any).episode_number || null,
        season_number: (content as any).season_number || null,
        created_at: (content as any).created_at || new Date().toISOString(),
        updated_at: (content as any).updated_at || new Date().toISOString(),
        source: content.source,
      }
      
      // Obtener todos los episodios del mismo tipo de source
      const allEpisodes = articles
        .filter(a => a.source_id === content.source_id && shouldUsePodcastViewer(a))
        .map(a => {
          const aIsYouTube = a.source.source_type === 'youtube_channel' || a.source.source_type === 'youtube_video'
          return {
            id: a.id,
            source_id: a.source_id,
            title: a.title,
            url: a.url,
            author: (a as any).author || (a as any).channel_name || null,
            published_at: a.published_at || null,
            description: (a as any).description || null,
            show_notes: (a as any).show_notes || null,
            audio_url: aIsYouTube ? a.url : (a as any).audio_url,
            image_url: (a as any).image_url || null,
            duration: (a as any).duration || null,
            episode_number: (a as any).episode_number || null,
            season_number: (a as any).season_number || null,
            created_at: (a as any).created_at || new Date().toISOString(),
            updated_at: (a as any).updated_at || new Date().toISOString(),
            source: a.source,
          }
        }) as PodcastEpisode[]
      
      setCurrentPodcastEpisode(episode)
      setPodcastEpisodes(allEpisodes)
      setIsPodcastViewerOpen(true)
    } else {
      // Cerrar PodcastViewer si está abierto
      if (isPodcastViewerOpen) {
        console.log('[openCorrectViewer] Closing PodcastViewer')
        setIsPodcastViewerOpen(false)
      }
      
      console.log('[openCorrectViewer] Using ContentViewer for content:', content.id)
      // Usar ContentViewer
      setViewerContent(content)
      setIsViewerOpen(true)
    }
  }, [articles, isViewerOpen, isPodcastViewerOpen, searchParams, pathname, router])

  const handleOpenViewer = (content: ContentWithMetadata, cardElement: HTMLElement) => {
    console.log('[handleOpenViewer] Opening viewer for content:', content.id)
    const rect = cardElement.getBoundingClientRect()
    console.log('[handleOpenViewer] Card position:', rect)
    setCardPosition(rect)
    console.log('[handleOpenViewer] Calling openCorrectViewer')
    openCorrectViewer(content)
  }
  
  // Función para limpiar URL al cerrar visor
  const clearViewerUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('viewer')
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl, { scroll: false })
  }, [searchParams, pathname, router])

  const handleCloseViewer = () => {
    clearViewerUrl()
    setIsViewerOpen(false)
    setTimeout(() => {
      setViewerContent(null)
      setCardPosition(null)
    }, 300)
  }
  
  const handleClosePodcastViewer = () => {
    clearViewerUrl()
    setIsPodcastViewerOpen(false)
    // No limpiar el episodio inmediatamente para permitir mini player
  }

  // Ref para rastrear el último viewer procesado
  const lastProcessedViewer = useRef<string | null>(null)

  // Efecto para abrir visor desde URL al cargar contenido o cuando cambia el parámetro viewer
  useEffect(() => {
    const viewerParam = searchParams.get('viewer')
    
    // Si no hay parámetro viewer, resetear y salir
    if (!viewerParam) {
      lastProcessedViewer.current = null
      hasProcessedInitialUrl.current = true
      return
    }
    
    // Si ya procesamos este mismo viewer, no hacer nada
    if (viewerParam === lastProcessedViewer.current) return
    
    // Necesitamos artículos para la carga inicial, pero permitimos navegación desde búsqueda
    const contentId = parseContentSlug(viewerParam)
    if (!contentId) {
      hasProcessedInitialUrl.current = true
      return
    }
    
    // Buscar el contenido por ID en los artículos cargados
    let content = articles.find(a => a.id === contentId)
    
    // Si no encontramos el contenido pero es una navegación desde búsqueda (no carga inicial)
    // intentar buscar el contenido directamente
    if (!content && hasProcessedInitialUrl.current) {
      // Buscar el contenido de forma asíncrona
      contentService.getContentById(contentId).then(fetchedContent => {
        if (fetchedContent) {
          lastProcessedViewer.current = viewerParam
          isOpeningFromUrl.current = true
          openCorrectViewer(fetchedContent)
          isOpeningFromUrl.current = false
        }
      }).catch(err => {
        console.error('Error fetching content for viewer:', err)
      })
      return
    }
    
    if (content) {
      lastProcessedViewer.current = viewerParam
      // Marcar que estamos abriendo desde URL para evitar actualizar la URL de nuevo
      isOpeningFromUrl.current = true
      openCorrectViewer(content)
      isOpeningFromUrl.current = false
    }
    
    hasProcessedInitialUrl.current = true
  }, [articles, searchParams, openCorrectViewer])

  // Efecto para cerrar visor cuando el parámetro viewer desaparece de la URL (navegación hacia atrás)
  useEffect(() => {
    const viewerParam = searchParams.get('viewer')
    
    // No cerrar si estamos en proceso de abrir manualmente (la URL aún no se ha actualizado)
    if (isOpeningManually.current) return
    
    // Si no hay parámetro viewer y algún visor está abierto, cerrarlo
    if (!viewerParam && (isViewerOpen || isPodcastViewerOpen)) {
      if (isViewerOpen) {
        setIsViewerOpen(false)
        setTimeout(() => {
          setViewerContent(null)
          setCardPosition(null)
        }, 300)
      }
      if (isPodcastViewerOpen) {
        setIsPodcastViewerOpen(false)
      }
    }
  }, [searchParams, isViewerOpen, isPodcastViewerOpen])

  const handleNavigateNext = () => {
    const currentContent = viewerContent || (isPodcastViewerOpen && currentPodcastEpisode ? 
      filteredAndSortedContent.find(c => c.id === currentPodcastEpisode.id) : null)
    if (!currentContent) return
    
    const currentIndex = filteredAndSortedContent.findIndex((item) => item.id === currentContent.id)
    if (currentIndex !== -1 && currentIndex < filteredAndSortedContent.length - 1) {
      const nextContent = filteredAndSortedContent[currentIndex + 1]
      openCorrectViewer(nextContent)
    }
  }

  const handleNavigatePrevious = () => {
    const currentContent = viewerContent || (isPodcastViewerOpen && currentPodcastEpisode ? 
      filteredAndSortedContent.find(c => c.id === currentPodcastEpisode.id) : null)
    if (!currentContent) return
    
    const currentIndex = filteredAndSortedContent.findIndex((item) => item.id === currentContent.id)
    if (currentIndex > 0) {
      const previousContent = filteredAndSortedContent[currentIndex - 1]
      openCorrectViewer(previousContent)
    }
  }

  // Función auxiliar para normalizar texto (eliminar acentos)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  // Función de búsqueda fuzzy local
  const fuzzyMatch = (text: string, searchTerm: string): boolean => {
    const normalizedText = normalizeText(text)
    const normalizedSearch = normalizeText(searchTerm)
    
    // Coincidencia exacta normalizada
    if (normalizedText.includes(normalizedSearch)) return true
    
    // Buscar coincidencia de palabras individuales
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1)
    const textWords = normalizedText.split(/\s+/)
    
    for (const searchWord of searchWords) {
      let found = false
      for (const textWord of textWords) {
        if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
          found = true
          break
        }
        // Tolerancia a errores tipográficos (similitud básica)
        if (searchWord.length > 3 && textWord.length > 3) {
          let matches = 0
          const minLen = Math.min(searchWord.length, textWord.length)
          for (let i = 0; i < minLen; i++) {
            if (searchWord[i] === textWord[i]) matches++
          }
          if (matches / minLen >= 0.7) {
            found = true
            break
          }
        }
      }
      if (found) return true
    }
    
    return false
  }

  const filteredAndSortedContent = useMemo(() => {
    const filtered = articles.filter((article) => {
      // Excluir contenido de fuentes pendientes de eliminación
      if (pendingDeletionSourceIds.has(article.source_id)) {
        return false
      }
      
      if (filters.search) {
        // Acceso seguro a propiedades que pueden no existir en todos los tipos de contenido
        const excerpt = 'excerpt' in article ? (article.excerpt || '') : ('description' in article ? (article.description || '') : '')
        const author = 'author' in article ? (article.author || '') : ('channel_name' in article ? (article.channel_name || '') : '')
        
        // Usar búsqueda fuzzy
        if (
          !fuzzyMatch(article.title, filters.search) &&
          !fuzzyMatch(excerpt, filters.search) &&
          !fuzzyMatch(author, filters.search) &&
          !fuzzyMatch(article.source.title, filters.search)
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

      if (filters.readStatus === "read" && !article.user_content?.is_read) return false
      if (filters.readStatus === "unread" && article.user_content?.is_read) return false

      if (filters.savedStatus === "saved" && !article.user_content?.is_favorite) return false
      if (filters.savedStatus === "unsaved" && article.user_content?.is_favorite) return false

      // Filtro de tiempo de lectura solo para contenido RSS que tiene esta propiedad
      if ('reading_time' in article && article.reading_time) {
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
  }, [articles, filters, pendingDeletionSourceIds])

  const displayedContent = useMemo(() => {
    return filteredAndSortedContent.slice(0, displayedItems)
  }, [filteredAndSortedContent, displayedItems])

  // Calcular índice actual considerando ambos visores
  const getCurrentIndex = () => {
    if (viewerContent) {
      return filteredAndSortedContent.findIndex((item) => item.id === viewerContent.id)
    }
    if (isPodcastViewerOpen && currentPodcastEpisode) {
      return filteredAndSortedContent.findIndex((item) => item.id === currentPodcastEpisode.id)
    }
    return -1
  }
  
  const currentIndex = getCurrentIndex()
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
    return sources
      .filter(source => !pendingDeletionSourceIds.has(source.id))
      .map(source => ({
        id: source.id,
        title: source.title,
        favicon_url: source.favicon_url
      }))
  }, [sources, pendingDeletionSourceIds])

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
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-bold text-balance">Your Content Universe</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedContent.length > 0 ? (
              <>
                {displayedContent.length} of {filteredAndSortedContent.length} items •{" "}
                {articles.filter((article) => !article.user_content?.is_read).length} unread
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

      {/* Indicador de sincronización de entradas antiguas */}
      {isSyncingOlder && syncOlderProgress.total > 0 && (
        <div className="glass rounded-lg p-4 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Syncing older entries...</p>
                <p className="text-sm text-muted-foreground">
                  {syncOlderProgress.current} of {syncOlderProgress.total}
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${(syncOlderProgress.current / syncOlderProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Fetching articles older than 24 hours from your sources
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
          {displayedContent.map((article, index) => (
            <ContentCard 
              key={article.id && article.id.length > 0 ? `${article.content_type}-${article.id}` : `article-fallback-${index}`} 
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
        <div className="text-center py-8 relative">
          <div className="text-muted-foreground text-sm">
            You've reached the end of your content feed, no endless scrolling here.
          </div>
          <div className="mx-auto mt-4 text-6xl opacity-50">✅</div>
          
          {/* Pull-to-load indicator (funciona en mobile y desktop) */}
          {(isPulling || isTriggered || isSyncingOlder) ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="relative">
                {/* Círculo de progreso */}
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted opacity-20"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                    className="text-primary transition-all duration-300"
                    strokeLinecap="round"
                  />
                </svg>
                {!isSyncingOlder && !isTriggered && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                    {Math.round(progress)}%
                  </div>
                )}
                {(isSyncingOlder || isTriggered) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              
              <div className="text-sm font-medium">
                {isSyncingOlder ? (
                  <>
                    <div className="animate-pulse">Loading older entries...</div>
                    {syncOlderProgress.total > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {syncOlderProgress.current} / {syncOlderProgress.total} sources
                      </div>
                    )}
                  </>
                ) : isTriggered ? (
                  "Fetching older entries..."
                ) : isPulling ? (
                  <span className="hidden md:inline">Scroll down to load older entries</span>
                ) : null}
                {isPulling && (
                  <span className="md:hidden">Pull to load older entries</span>
                )}
              </div>
            </div>
          ) : (
            /* Botón alternativo cuando no está en pull mode */
            <div className="mt-6">
              <Button 
                onClick={handleSyncOlderEntries} 
                disabled={isSyncingOlder}
                variant="outline"
                size="lg"
                className="glass hover-lift-subtle"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Load older entries
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Articles older than 24 hours
                <span className="hidden md:inline"> • Or drag down to pull-to-load</span>
              </p>
            </div>
          )}
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

      <PodcastViewer
        isOpen={isPodcastViewerOpen}
        onClose={handleClosePodcastViewer}
        episode={currentPodcastEpisode}
        episodes={podcastEpisodes}
        source={currentPodcastEpisode?.source}
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
