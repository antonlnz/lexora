"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Newspaper, Youtube, Instagram, Zap } from "lucide-react"

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (sources: Omit<Source, "id">[]) => void
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

const quickTemplates = [
  {
    category: "Tech News",
    icon: Newspaper,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    sources: [
      {
        name: "TechCrunch",
        type: "news" as const,
        url: "https://techcrunch.com/feed/",
        description: "Latest technology news and startup coverage",
        tags: ["Technology", "Startups"],
      },
      {
        name: "The Verge",
        type: "news" as const,
        url: "https://www.theverge.com/rss/index.xml",
        description: "Technology, science, art, and culture",
        tags: ["Technology", "Culture"],
      },
      {
        name: "Hacker News",
        type: "rss" as const,
        url: "https://news.ycombinator.com/rss",
        description: "Tech and startup news from Y Combinator",
        tags: ["Technology", "Startups"],
      },
    ],
  },
  {
    category: "Design",
    icon: Instagram,
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    sources: [
      {
        name: "Dribbble",
        type: "rss" as const,
        url: "https://dribbble.com/shots/popular.rss",
        description: "Popular design shots",
        tags: ["Design", "Inspiration"],
      },
      {
        name: "Behance",
        type: "rss" as const,
        url: "https://www.behance.net/feeds/projects",
        description: "Creative work showcase",
        tags: ["Design", "Portfolio"],
      },
    ],
  },
  {
    category: "Development",
    icon: Youtube,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    sources: [
      {
        name: "@Fireship",
        type: "youtube" as const,
        url: "https://youtube.com/@Fireship",
        description: "Fast-paced coding tutorials",
        tags: ["Development", "Tutorials"],
      },
      {
        name: "@ThePrimeagen",
        type: "youtube" as const,
        url: "https://youtube.com/@ThePrimeagen",
        description: "Programming and productivity",
        tags: ["Development", "Productivity"],
      },
    ],
  },
  {
    category: "Business",
    icon: Newspaper,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    sources: [
      {
        name: "Harvard Business Review",
        type: "rss" as const,
        url: "https://hbr.org/feed",
        description: "Business management insights",
        tags: ["Business", "Management"],
      },
      {
        name: "Fast Company",
        type: "rss" as const,
        url: "https://www.fastcompany.com/latest/rss",
        description: "Innovation and leadership",
        tags: ["Business", "Innovation"],
      },
    ],
  },
]

export function QuickAddDialog({ open, onOpenChange, onAdd }: QuickAddDialogProps) {
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
    const sourcesToAdd: Omit<Source, "id">[] = []

    quickTemplates.forEach((template) => {
      template.sources.forEach((source) => {
        if (selectedSources.has(source.url)) {
          sourcesToAdd.push({
            ...source,
            isActive: true,
            lastSync: "Never",
            itemCount: 0,
            status: "syncing",
            updateFrequency: "daily",
          })
        }
      })
    })

    onAdd(sourcesToAdd)
    setSelectedSources(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-playfair">Quick Add Templates</DialogTitle>
          </div>
          <DialogDescription>
            Select from curated collections of popular sources to get started quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {quickTemplates.map((template) => (
            <div key={template.category} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${template.color}`}>
                  <template.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-lg">{template.category}</h3>
                <Badge variant="secondary" className="text-xs">
                  {template.sources.length} sources
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {template.sources.map((source) => (
                  <Card
                    key={source.url}
                    className={`glass-card p-4 cursor-pointer transition-all hover:shadow-lg ${
                      selectedSources.has(source.url) ? "ring-2 ring-primary/50" : ""
                    }`}
                    onClick={() => toggleSource(source.url)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedSources.has(source.url)}
                        onCheckedChange={() => toggleSource(source.url)}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold mb-1">{source.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{source.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {source.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

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
