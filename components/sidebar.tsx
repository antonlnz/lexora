"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassNotificationBadge, GlassTooltip } from "@/components/glass-components"
import { Newspaper, Youtube, Twitter, Instagram, Music2, Mail, Plus, TrendingUp, Clock, Bookmark, ArrowLeft, ExternalLink, Globe, Rss } from "lucide-react"
import { useState, useEffect } from "react"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { useSubscription } from "@/contexts/subscription-context"
import { sourceService } from "@/lib/services/source-service"
import type { Source } from "@/types/database"

const initialSources = [
  {
    name: "RSS Feed",
    icon: Rss,
    count: 0,
    color: "bg-orange-500/20 text-orange-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "rss",
  },
  {
    name: "YouTube",
    icon: Youtube,
    count: 0,
    color: "bg-red-500/20 text-red-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "youtube",
  },
  {
    name: "Twitter",
    icon: Twitter,
    count: 0,
    color: "bg-sky-500/20 text-sky-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "twitter",
  },
  {
    name: "Instagram",
    icon: Instagram,
    count: 0,
    color: "bg-pink-500/20 text-pink-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "instagram",
  },
  {
    name: "TikTok",
    icon: Music2,
    count: 0,
    color: "bg-purple-500/20 text-purple-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "tiktok",
  },
  {
    name: "Newsletter",
    icon: Mail,
    count: 0,
    color: "bg-green-500/20 text-green-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "newsletter",
  },
  {
    name: "Website",
    icon: Globe,
    count: 0,
    color: "bg-gray-500/20 text-gray-600",
    hasNotifications: false,
    notificationCount: 0,
    source_type: "website",
  },
]

const quickActions = [
  { name: "Trending", icon: TrendingUp, notifications: 5 },
  { name: "Recent", icon: Clock, notifications: 0 },
  { name: "Saved", icon: Bookmark, notifications: 2 },
]

interface SourceCategory {
  name: string
  icon: any
  color: string
  source_type: string
}

export function Sidebar() {
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const { canAddSource } = useSubscription()
  const [sources, setSources] = useState<any[]>(initialSources)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [categorySources, setCategorySources] = useState<Source[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  const handleAddSource = (newSource: any) => {
    setSources((prev) => [...prev, { ...newSource, id: Date.now().toString() }])
    setIsAddSourceOpen(false)
  }

  const handleCategoryClick = async (categoryData: SourceCategory) => {
    setSelectedCategory(categoryData)
    setLoadingSources(true)
    
    try {
      const allSources = await sourceService.getUserSources(true)
      const filtered = allSources.filter(source => source.source_type === categoryData.source_type)
      setCategorySources(filtered)
    } catch (error) {
      console.error("Error loading category sources:", error)
      setCategorySources([])
    } finally {
      setLoadingSources(false)
    }
  }

  const handleBackToMain = () => {
    setSelectedCategory(null)
    setCategorySources([])
  }

  // Contar fuentes reales por tipo
  useEffect(() => {
    const loadSourceCounts = async () => {
      try {
        const allSources = await sourceService.getUserSources(true)
        const typeCounts = allSources.reduce((acc, source) => {
          const type = source.source_type
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        // Actualizar los contadores
        setSources(prev => prev.map(s => ({
          ...s,
          count: typeCounts[s.source_type] || 0
        })))
      } catch (error) {
        console.error("Error loading source counts:", error)
      }
    }

    loadSourceCounts()
  }, [])

  return (
    <>
      <div className="space-y-6">
        {selectedCategory ? (
          // Vista de detalle de categoría
          <div className="glass-card p-6 rounded-2xl hover-lift">
            {/* Header con título y botón de volver */}
            <div className="flex items-center gap-3 mb-6">
              <Button
                size="sm"
                variant="ghost"
                className="glass h-8 w-8 p-0"
                onClick={handleBackToMain}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-2 rounded-lg ${selectedCategory.color}`}>
                  <selectedCategory.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedCategory.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {categorySources.length} {categorySources.length === 1 ? 'fuente' : 'fuentes'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de fuentes de la categoría */}
            <div className="space-y-3">
              {loadingSources ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : categorySources.length > 0 ? (
                categorySources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/30 hover-lift-subtle transition-colors cursor-pointer group"
                    onClick={() => {
                      // Redirigir a la página principal con el filtro de fuente
                      const params = new URLSearchParams()
                      params.set('source', source.id)
                      window.location.href = `/?${params.toString()}`
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {source.favicon_url && (
                        <img 
                          src={source.favicon_url} 
                          alt="" 
                          className="h-6 w-6 rounded shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{source.title}</p>
                        {source.description && (
                          <p className="text-xs text-muted-foreground truncate">{source.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(source.url, '_blank')
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No hay fuentes de tipo {selectedCategory.name}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="glass"
                    onClick={() => setIsAddSourceOpen(true)}
                    disabled={!canAddSource(sources.length)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir fuente
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Vista principal
          <>
            {/* Sources */}
            <div className="glass-card p-6 rounded-2xl hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-balance">Sources</h3>
                <GlassTooltip content="Add new source">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="glass"
                    onClick={() => setIsAddSourceOpen(true)}
                    disabled={!canAddSource(sources.length)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </GlassTooltip>
              </div>

              <div className="space-y-3">
                {sources.map((source) => (
                  <div
                    key={source.source_type}
                    className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/30 hover-lift-subtle transition-colors cursor-pointer relative"
                    onClick={() => handleCategoryClick(source)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${source.color}`}>
                        <source.icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{source.name}</span>
                    </div>
                    <Badge variant="secondary" className="glass">
                      {source.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="glass-card p-6 rounded-2xl hover-lift">
              <h3 className="text-lg font-semibold mb-4 text-balance">Today's Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">New items</span>
                  <span className="font-semibold text-primary">113</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Read</span>
                  <span className="font-semibold">24</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Saved</span>
                  <span className="font-semibold">8</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reading time</span>
                  <span className="font-semibold">2h 15m</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AddSourceDialog component */}
      <AddSourceDialog 
        open={isAddSourceOpen} 
        onOpenChange={setIsAddSourceOpen} 
        onSourceAdded={async () => {
          // Recargar fuentes si estamos viendo una categoría
          if (selectedCategory) {
            setLoadingSources(true)
            try {
              const allSources = await sourceService.getUserSources(true)
              const filtered = allSources.filter(source => source.source_type === selectedCategory.source_type)
              setCategorySources(filtered)
            } catch (error) {
              console.error("Error reloading sources:", error)
            } finally {
              setLoadingSources(false)
            }
          }
          
          // Recargar contadores
          try {
            const allSources = await sourceService.getUserSources(true)
            const typeCounts = allSources.reduce((acc, source) => {
              const type = source.source_type
              acc[type] = (acc[type] || 0) + 1
              return acc
            }, {} as Record<string, number>)

            setSources(prev => prev.map(s => ({
              ...s,
              count: typeCounts[s.source_type] || 0
            })))
          } catch (error) {
            console.error("Error updating counts:", error)
          }
        }} 
      />
    </>
  )
}
