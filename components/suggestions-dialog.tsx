"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles, TrendingUp, Star, Users, AlertCircle } from "lucide-react"
import { useSubscription } from "@/contexts/subscription-context"
import { sourceService } from "@/lib/services/source-service"
import { toast } from "sonner"

interface SuggestionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: () => void | Promise<void>
}

interface Source {
  id: string
  name: string
  type: "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter" | "rss" | "website"
  url: string
  isActive: boolean
  lastSync: string
  itemCount: number
  status: "active" | "error" | "syncing"
  description?: string
  tags: string[]
  updateFrequency: "realtime" | "hourly" | "daily" | "weekly"
}

const suggestedSources = {
  trending: [
    {
      name: "OpenAI Blog",
      type: "rss" as const,
      url: "https://openai.com/blog/rss.xml",
      description: "Latest AI research and updates",
      tags: ["AI", "Research"],
      subscribers: "125K",
    },
    {
      name: "@sama",
      type: "twitter" as const,
      url: "https://twitter.com/sama",
      description: "Sam Altman's thoughts on AI and startups",
      tags: ["AI", "Startups"],
      subscribers: "2.1M",
    },
  ],
  popular: [
    {
      name: "Product Hunt",
      type: "rss" as const,
      url: "https://www.producthunt.com/feed",
      description: "Daily product launches",
      tags: ["Products", "Startups"],
      subscribers: "500K",
    },
    {
      name: "CSS-Tricks",
      type: "rss" as const,
      url: "https://css-tricks.com/feed/",
      description: "Web development tips and tricks",
      tags: ["Development", "CSS"],
      subscribers: "350K",
    },
  ],
  recommended: [
    {
      name: "Smashing Magazine",
      type: "rss" as const,
      url: "https://www.smashingmagazine.com/feed/",
      description: "Web design and development",
      tags: ["Design", "Development"],
      subscribers: "400K",
    },
    {
      name: "@levelsio",
      type: "twitter" as const,
      url: "https://twitter.com/levelsio",
      description: "Indie hacking and remote work",
      tags: ["Entrepreneurship", "Remote"],
      subscribers: "500K",
    },
  ],
}

export function SuggestionsDialog({ open, onOpenChange, onAdd }: SuggestionsDialogProps) {
  const { canAddSource, getSourceLimit, currentPlan } = useSubscription()
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [userSourcesCount, setUserSourcesCount] = useState(0)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detectar si es mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Cargar el número actual de fuentes cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setIsLoadingSources(true)
      sourceService.getUserSources()
        .then(sources => {
          setUserSourcesCount(sources.length)
        })
        .catch(error => {
          console.error("Error loading sources count:", error)
        })
        .finally(() => {
          setIsLoadingSources(false)
        })
    }
  }, [open])

  const toggleSource = (sourceUrl: string) => {
    const sourceLimit = getSourceLimit()
    const newCount = userSourcesCount + selectedSources.size + (selectedSources.has(sourceUrl) ? 0 : 1)
    
    // Si se va a exceder el límite, mostrar advertencia
    if (!selectedSources.has(sourceUrl) && newCount > sourceLimit) {
      toast.error("Límite de fuentes alcanzado", {
        description: `No puedes añadir más fuentes. Has alcanzado el límite de ${sourceLimit} fuentes para tu plan ${currentPlan}.`,
      })
      return
    }

    setSelectedSources((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sourceUrl)) {
        newSet.delete(sourceUrl)
      } else {
        newSet.add(sourceUrl)
      }
      return newSet
    })
  }

  const handleAdd = async () => {
    if (selectedSources.size === 0) return

    const sourceLimit = getSourceLimit()
    const newCount = userSourcesCount + selectedSources.size
    
    // Verificar límite final
    if (newCount > sourceLimit) {
      toast.error("Límite de fuentes alcanzado", {
        description: `No puedes añadir ${selectedSources.size} fuentes. Has alcanzado el límite de ${sourceLimit} fuentes para tu plan ${currentPlan}.`,
      })
      return
    }

    setIsAdding(true)
    try {
      // TODO: Aquí deberíamos procesar y guardar las fuentes seleccionadas en Supabase
      // Por ahora solo refrescamos la lista
      await onAdd()
      setSelectedSources(new Set())
      onOpenChange(false)
      toast.success(`${selectedSources.size} fuente(s) añadida(s)`)
    } catch (error) {
      toast.error("Error al añadir fuentes")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-playfair">Browse Suggestions</DialogTitle>
          </div>
          <DialogDescription>Discover popular sources curated by the Lexora community</DialogDescription>
        </DialogHeader>

        {/* Advertencia de límite */}
        {!isLoadingSources && (() => {
          const sourceLimit = getSourceLimit()
          const futureCount = userSourcesCount + selectedSources.size
          const isAtLimit = userSourcesCount >= sourceLimit
          const willExceedLimit = futureCount > sourceLimit
          const isNearLimit = userSourcesCount >= sourceLimit * 0.8 && !isAtLimit
          
          if (isAtLimit || willExceedLimit || isNearLimit) {
            return (
              <div className={`glass-card p-4 rounded-lg border-2 ${
                isAtLimit || willExceedLimit ? 'border-red-500/50 bg-red-500/10' : 'border-amber-500/50 bg-amber-500/10'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${
                    isAtLimit || willExceedLimit ? 'text-red-600' : 'text-amber-600'
                  }`} />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {isAtLimit ? 'Source Limit Reached' : willExceedLimit ? 'Will Exceed Limit' : 'Near Source Limit'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isAtLimit 
                        ? `You've reached your limit of ${sourceLimit} sources for the ${currentPlan} plan.`
                        : willExceedLimit
                        ? `Adding ${selectedSources.size} source(s) will exceed your limit of ${sourceLimit} sources.`
                        : `You're using ${userSourcesCount} of ${sourceLimit} sources (${currentPlan} plan).`
                      }
                      {selectedSources.size > 0 && ` Selected: ${selectedSources.size}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}

        <Tabs defaultValue="trending" className="w-full">
          <TabsList className="glass-card w-full">
            <TabsTrigger value="trending" className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="popular" className="flex-1">
              <Star className="h-4 w-4 mr-2" />
              Popular
            </TabsTrigger>
            <TabsTrigger value="recommended" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Recommended
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="space-y-3 mt-6">
            {suggestedSources.trending.map((source) => (
              <SuggestionCard
                key={source.url}
                source={source}
                isSelected={selectedSources.has(source.url)}
                onToggle={() => toggleSource(source.url)}
              />
            ))}
          </TabsContent>

          <TabsContent value="popular" className="space-y-3 mt-6">
            {suggestedSources.popular.map((source) => (
              <SuggestionCard
                key={source.url}
                source={source}
                isSelected={selectedSources.has(source.url)}
                onToggle={() => toggleSource(source.url)}
              />
            ))}
          </TabsContent>

          <TabsContent value="recommended" className="space-y-3 mt-6">
            {suggestedSources.recommended.map((source) => (
              <SuggestionCard
                key={source.url}
                source={source}
                isSelected={selectedSources.has(source.url)}
                onToggle={() => toggleSource(source.url)}
              />
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t border-glass-border">
          <p className="text-sm text-muted-foreground">
            {selectedSources.size} source{selectedSources.size !== 1 ? "s" : ""} selected
            {!isLoadingSources && ` • ${userSourcesCount}/${getSourceLimit()} total`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="glass bg-transparent" disabled={isAdding}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={
                selectedSources.size === 0 || 
                isAdding || 
                (userSourcesCount + selectedSources.size) > getSourceLimit()
              } 
              className="glass"
            >
              {isAdding ? "Adding..." : `Add ${selectedSources.size} Source${selectedSources.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SuggestionCard({
  source,
  isSelected,
  onToggle,
}: {
  source: any
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <Card
      className={`glass-card p-4 cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? "ring-2 ring-primary/50" : ""
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={isSelected} onCheckedChange={onToggle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">{source.name}</h4>
            <Badge variant="secondary" className="text-xs">
              {source.subscribers} followers
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{source.description}</p>
          <div className="flex flex-wrap gap-1">
            {source.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
