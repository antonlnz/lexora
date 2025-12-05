"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Clock, BookmarkCheck, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { getContentThumbnail, getContentMediaUrl, getContentMediaType } from "@/lib/content-type-config"
import { generateContentSlug } from "@/lib/utils/content-slug"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface MobileSearchProps {
  onClose?: () => void
}

export function MobileSearch({ onClose }: MobileSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ContentWithMetadata[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Función para abrir contenido en el viewer
  const handleOpenContent = (article: ContentWithMetadata) => {
    // Generar slug para la URL
    const slug = generateContentSlug(article.id, article.title)
    
    // Navegar a la página principal con solo el parámetro viewer
    router.push(`/?viewer=${encodeURIComponent(slug)}`)
    
    // Cerrar el diálogo de búsqueda con un pequeño delay
    setTimeout(() => onClose?.(), 50)
  }

  // Auto-focus al montar
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Buscar cuando cambia el query
  useEffect(() => {
    const searchArticles = async () => {
      if (query.trim().length < 2) {
        setResults([])
        setHasSearched(false)
        return
      }

      setIsSearching(true)
      setHasSearched(true)
      try {
        const searchResults = await contentService.searchContent(query)
        setResults(searchResults)
      } catch (error) {
        console.error("Error searching articles:", error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchArticles, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      if (diffInHours < 1) return "Hace menos de 1h"
      return `Hace ${diffInHours}h`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `Hace ${diffInDays}d`
    }

    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
  }

  const showResults = hasSearched || isSearching

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Search Input - Siempre arriba */}
      <div className="flex items-center gap-3 px-1 py-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar en tu contenido..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 h-11 bg-accent/30 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      {/* Results Area - Crece con animación */}
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          showResults ? "flex-1 opacity-100" : "h-0 opacity-0"
        )}
      >
        <div className="h-full overflow-y-auto overscroll-contain">
          {isSearching ? (
            // Loading state - Compacto
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : results.length === 0 && hasSearched ? (
            // No results
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No se encontraron resultados</p>
              <p className="text-xs opacity-70">Intenta con otros términos</p>
            </div>
          ) : results.length > 0 ? (
            // Results list
            <div className="pb-2">
              <div className="px-2 py-2 text-xs text-muted-foreground font-medium sticky top-0 bg-background/80 backdrop-blur-sm">
                {results.length} {results.length === 1 ? "resultado" : "resultados"}
              </div>
              <div className="space-y-1 px-1">
                {results.map((article) => {
                  const thumbnailUrl = getContentThumbnail(article)
                  const mediaUrl = getContentMediaUrl(article)
                  const mediaType = getContentMediaType(article)
                  const imageToShow = mediaType === 'image' ? (mediaUrl || thumbnailUrl) : thumbnailUrl

                  return (
                    <button
                      key={article.id}
                      onClick={() => handleOpenContent(article)}
                      className="flex gap-3 p-3 rounded-xl hover:bg-accent/50 active:bg-accent/70 transition-colors w-full text-left"
                    >
                      {/* Imagen */}
                      {imageToShow ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                          <Image
                            src={imageToShow || '/placeholder.svg'}
                            alt={article.title}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                          <Search className="h-5 w-5 text-primary/50" />
                        </div>
                      )}

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                          {article.title}
                        </h3>
                        
                        {/* Metadata */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="truncate max-w-[120px]">
                            {article.source?.title || "Fuente desconocida"}
                          </span>
                          
                          {article.published_at && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {formatDate(article.published_at)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Estado badges */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {article.user_content?.is_favorite && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">
                              <BookmarkCheck className="h-2.5 w-2.5" />
                              Guardado
                            </span>
                          )}
                          
                          {article.user_content?.is_archived && (
                            <span className="inline-flex items-center text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                              Archivado
                            </span>
                          )}
                          
                          {article.user_content?.is_read && (
                            <span className="inline-flex items-center text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                              Leído
                            </span>
                          )}

                          {!article.user_content?.is_read && 
                           !article.user_content?.is_favorite && 
                           !article.user_content?.is_archived && (
                            <span className="inline-flex items-center text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              Sin leer
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Placeholder cuando no hay búsqueda */}
      {!showResults && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Search className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-xs opacity-70">Escribe para buscar en tu contenido</p>
        </div>
      )}
    </div>
  )
}
