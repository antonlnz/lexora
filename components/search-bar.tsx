"use client"

import { useState, useEffect, useRef } from "react"
import { Search, X, BookmarkCheck, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { getContentThumbnail, getContentMediaUrl, getContentMediaType } from "@/lib/content-type-config"
import { generateContentSlug } from "@/lib/utils/content-slug"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface SearchBarProps {
  onClose?: () => void
  defaultExpanded?: boolean
}

export function SearchBar({ onClose, defaultExpanded = false }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ContentWithMetadata[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Función para abrir contenido en el viewer
  const handleOpenContent = (article: ContentWithMetadata) => {
    const slug = generateContentSlug(article.id, article.title)
    // Navegar a la página principal con solo el parámetro viewer
    router.push(`/?viewer=${encodeURIComponent(slug)}`)
    // Cerrar el buscador con un pequeño delay para permitir la navegación
    setTimeout(() => handleClose(), 50)
  }

  // Auto-focus cuando se expande
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isExpanded])

  // Buscar cuando cambia el query
  useEffect(() => {
    const searchArticles = async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
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

  const handleClose = () => {
    setIsExpanded(false)
    setQuery("")
    setResults([])
    onClose?.()
  }

  const handleExpand = () => {
    setIsExpanded(true)
  }

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

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="glass hover-lift-subtle"
        onClick={handleExpand}
      >
        <Search className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="flex items-center gap-2 desktop-search-input rounded-full px-4 py-2 min-w-[300px] md:min-w-[400px]">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar en tu contenido..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-8 px-0"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent/50 rounded-full shrink-0"
            onClick={() => setQuery("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-accent/50 rounded-full shrink-0"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Results Popup */}
      {query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 right-0 w-[400px] md:w-[500px] desktop-search-results rounded-2xl shadow-2xl max-h-[500px] overflow-hidden z-50">
          {isSearching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No se encontraron resultados</p>
              <p className="text-xs opacity-70 mt-1">Intenta con otros términos</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[500px]">
              <div className="px-4 py-3 text-xs text-muted-foreground font-medium border-b border-border/30 sticky top-0 bg-inherit backdrop-blur-sm">
                {results.length} {results.length === 1 ? "resultado" : "resultados"}
              </div>
              <div className="p-2">
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
                      <span className="truncate max-w-[150px]">
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
              )})}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
