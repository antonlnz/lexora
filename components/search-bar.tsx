"use client"

import { useState, useEffect, useRef } from "react"
import { Search, X, Bookmark, BookmarkCheck, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { articleService } from "@/lib/services/article-service"
import type { ArticleWithUserData } from "@/types/database"
import Link from "next/link"
import Image from "next/image"

interface SearchBarProps {
  onClose?: () => void
}

export function SearchBar({ onClose }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ArticleWithUserData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

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
        const searchResults = await articleService.searchArticles(query)
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
      <div className="flex items-center gap-2 glass-card rounded-full px-4 py-2 min-w-[300px] md:min-w-[400px]">
        <Search className="h-4 w-4 text-muted-foreground" />
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
            className="h-6 w-6 p-0 hover:bg-accent/50 rounded-full"
            onClick={() => setQuery("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-accent/50 rounded-full"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Results Popup */}
      {query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 right-0 w-[400px] md:w-[500px] glass-card rounded-lg shadow-lg max-h-[500px] overflow-y-auto z-50">
          {isSearching ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            <div className="py-2">
              <div className="px-4 py-2 text-xs text-muted-foreground font-medium">
                {results.length} {results.length === 1 ? "resultado" : "resultados"}
              </div>
              {results.map((article) => (
                <Link
                  key={article.id}
                  href={`/read/${article.id}`}
                  onClick={handleClose}
                  className="block px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex gap-3">
                    {/* Imagen */}
                    {article.image_url ? (
                      <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0 bg-muted">
                        <Image
                          src={article.image_url}
                          alt={article.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                        <Search className="h-6 w-6 text-primary/50" />
                      </div>
                    )}

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">
                        {article.title}
                      </h3>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="truncate max-w-[150px]">
                          {article.source?.title || "Fuente desconocida"}
                        </span>
                        
                        {article.published_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(article.published_at)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Estado */}
                      <div className="flex items-center gap-2 mt-2">
                        {article.user_article?.is_favorite && (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            <BookmarkCheck className="h-3 w-3" />
                            Guardado
                          </span>
                        )}
                        
                        {article.user_article?.is_archived && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            Archivado
                          </span>
                        )}
                        
                        {article.user_article?.is_read && (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Leído
                          </span>
                        )}

                        {!article.user_article?.is_read && 
                         !article.user_article?.is_favorite && 
                         !article.user_article?.is_archived && (
                          <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Sin leer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
