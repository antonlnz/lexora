"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles, TrendingUp, Star, Users } from "lucide-react"

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
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())

  const toggleSource = (sourceUrl: string) => {
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

  const handleAdd = () => {
    // TODO: Aquí deberíamos procesar y guardar las fuentes seleccionadas en Supabase
    // Por ahora solo refrescamos la lista
    onAdd()
    setSelectedSources(new Set())
    onOpenChange(false)
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
          <p className="text-sm text-muted-foreground">{selectedSources.size} sources selected</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="glass bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selectedSources.size === 0} className="glass">
              Add {selectedSources.size} Source{selectedSources.size !== 1 ? "s" : ""}
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
