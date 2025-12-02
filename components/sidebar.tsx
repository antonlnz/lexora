"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassNotificationBadge, GlassTooltip } from "@/components/glass-components"
import { Newspaper, Youtube, Twitter, Instagram, Music2, Mail, Plus, TrendingUp, Clock, Bookmark, ArrowLeft, ExternalLink, Globe, Rss, Mic } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { useSubscription } from "@/contexts/subscription-context"
import { sourceService, type SourceWithUserData } from "@/lib/services/source-service"

// Mapeo de tipos de BD a categorías de UI
// Algunos tipos de BD se agrupan en una misma categoría de UI
const SOURCE_TYPE_CATEGORIES: Record<string, string> = {
  'rss': 'rss',
  'youtube_channel': 'youtube',
  'youtube_video': 'youtube',
  'twitter': 'twitter',
  'instagram': 'instagram',
  'tiktok': 'tiktok',
  'newsletter': 'newsletter',
  'website': 'website',
  'podcast': 'podcast',
}

// Tipos de BD que corresponden a cada categoría de UI
const CATEGORY_TO_SOURCE_TYPES: Record<string, string[]> = {
  'rss': ['rss'],
  'youtube': ['youtube_channel', 'youtube_video'],
  'twitter': ['twitter'],
  'instagram': ['instagram'],
  'tiktok': ['tiktok'],
  'newsletter': ['newsletter'],
  'website': ['website'],
  'podcast': ['podcast'],
}

const initialSources = [
  {
    name: "RSS Feed",
    icon: Rss,
    count: 0,
    color: "bg-orange-500/20 text-orange-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "rss",
  },
  {
    name: "YouTube",
    icon: Youtube,
    count: 0,
    color: "bg-red-500/20 text-red-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "youtube",
  },
  {
    name: "Podcast",
    icon: Mic,
    count: 0,
    color: "bg-violet-500/20 text-violet-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "podcast",
  },
  {
    name: "Twitter",
    icon: Twitter,
    count: 0,
    color: "bg-sky-500/20 text-sky-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "twitter",
  },
  {
    name: "Instagram",
    icon: Instagram,
    count: 0,
    color: "bg-pink-500/20 text-pink-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "instagram",
  },
  {
    name: "TikTok",
    icon: Music2,
    count: 0,
    color: "bg-purple-500/20 text-purple-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "tiktok",
  },
  {
    name: "Newsletter",
    icon: Mail,
    count: 0,
    color: "bg-green-500/20 text-green-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "newsletter",
  },
  {
    name: "Website",
    icon: Globe,
    count: 0,
    color: "bg-gray-500/20 text-gray-600",
    hasNotifications: false,
    notificationCount: 0,
    category: "website",
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
  category: string
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const { canAddSource } = useSubscription()
  const [sources, setSources] = useState<any[]>(initialSources)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [categorySources, setCategorySources] = useState<SourceWithUserData[]>([])
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
      // Obtener los tipos de BD que corresponden a esta categoría
      const sourceTypes = CATEGORY_TO_SOURCE_TYPES[categoryData.category] || []
      const filtered = allSources.filter(source => sourceTypes.includes(source.source_type))
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

  // Contar fuentes reales por categoría (agrupando tipos de BD)
  useEffect(() => {
    const loadSourceCounts = async () => {
      try {
        const allSources = await sourceService.getUserSources(true)
        
        // Contar por categoría de UI (no por tipo de BD)
        const categoryCounts = allSources.reduce((acc, source) => {
          // Mapear el tipo de BD a la categoría de UI
          const category = SOURCE_TYPE_CATEGORIES[source.source_type] || source.source_type
          acc[category] = (acc[category] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        // Actualizar los contadores usando la categoría
        setSources(prev => prev.map(s => ({
          ...s,
          count: categoryCounts[s.category] || 0
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
                      // Navegar dinámicamente sin recarga
                      router.push(`/?source=${source.id}`)
                      // Cerrar la barra lateral
                      onClose?.()
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
                    key={source.category}
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
              // Obtener los tipos de BD que corresponden a esta categoría
              const sourceTypes = CATEGORY_TO_SOURCE_TYPES[selectedCategory.category] || []
              const filtered = allSources.filter(source => sourceTypes.includes(source.source_type))
              setCategorySources(filtered)
            } catch (error) {
              console.error("Error reloading sources:", error)
            } finally {
              setLoadingSources(false)
            }
          }
          
          // Recargar contadores usando categorías
          try {
            const allSources = await sourceService.getUserSources(true)
            
            // Contar por categoría de UI
            const categoryCounts = allSources.reduce((acc, source) => {
              const category = SOURCE_TYPE_CATEGORIES[source.source_type] || source.source_type
              acc[category] = (acc[category] || 0) + 1
              return acc
            }, {} as Record<string, number>)

            setSources(prev => prev.map(s => ({
              ...s,
              count: categoryCounts[s.category] || 0
            })))
          } catch (error) {
            console.error("Error updating counts:", error)
          }
        }} 
      />
    </>
  )
}
