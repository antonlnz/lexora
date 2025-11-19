"use client"

import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { useSubscription } from "@/contexts/subscription-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { ImportOPMLDialog } from "@/components/import-opml-dialog"
import { SuggestionsDialog } from "@/components/suggestions-dialog"
import {
  Plus,
  Settings,
  Trash2,
  Newspaper,
  Youtube,
  Twitter,
  Instagram,
  Music2,
  Mail,
  Rss,
  Globe,
  CheckCircle,
  AlertCircle,
  Crown,
  MoreVertical,
  Zap,
  Sparkles,
  Upload,
  Download,
  Loader2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { sourceService } from "@/lib/services/source-service"
import type { Source as DBSource } from "@/types/database"

interface Source {
  id: string
  title: string
  url: string
  description: string | null
  source_type: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website'
  favicon_url: string | null
  is_active: boolean
  last_fetched_at: string | null
  created_at: string
  updated_at: string
}

const sourceTypeIcons: Record<string, any> = {
  rss: Rss,
  youtube: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: Music2,
  newsletter: Mail,
  website: Globe,
}

const sourceTypeLabels: Record<string, string> = {
  rss: "RSS Feed",
  youtube: "YouTube",
  twitter: "Twitter",
  instagram: "Instagram",
  tiktok: "TikTok",
  newsletter: "Newsletter",
  website: "Website",
}

const sourceTypeColors: Record<string, string> = {
  rss: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

export function SourcesManager() {
  const { canAddSource, getSourceLimit, currentPlan } = useSubscription()
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar fuentes al montar el componente
  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    setIsLoading(true)
    try {
      const data = await sourceService.getUserSources()
      setSources(data)
    } catch (error) {
      console.error("Error loading sources:", error)
      toast.error("Error al cargar fuentes")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleSource = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    try {
      await sourceService.toggleSourceActive(sourceId, !source.is_active)
      setSources((prev) =>
        prev.map((source) => (source.id === sourceId ? { ...source, is_active: !source.is_active } : source)),
      )
      toast.success(source.is_active ? "Fuente desactivada" : "Fuente activada")
    } catch (error) {
      toast.error("Error al actualizar fuente")
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await sourceService.deleteSource(sourceId)
      setSources((prev) => prev.filter((source) => source.id !== sourceId))
      if (selectedSource?.id === sourceId) {
        setSelectedSource(null)
      }
      toast.success("Fuente eliminada")
    } catch (error) {
      toast.error("Error al eliminar fuente")
    }
  }

  const handleUpdateSource = async (updatedSource: Source) => {
    try {
      await sourceService.updateSource(updatedSource.id, {
        title: updatedSource.title,
        url: updatedSource.url,
        description: updatedSource.description,
        source_type: updatedSource.source_type,
      })
      setSources((prev) => prev.map((source) => (source.id === updatedSource.id ? updatedSource : source)))
      setSelectedSource(updatedSource)
      toast.success("Fuente actualizada")
    } catch (error) {
      toast.error("Error al actualizar fuente")
    }
  }

  const handleAddSourceClick = () => {
    if (!canAddSource(sources.length)) {
      setShowLimitWarning(true)
      return
    }
    setIsAddDialogOpen(true)
  }

  const activeSources = sources.filter((source) => source.is_active)
  const inactiveSources = sources.filter((source) => !source.is_active)
  const sourceLimit = getSourceLimit()
  const isNearLimit = sources.length >= sourceLimit * 0.8

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading sources...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`glass-card p-4 rounded-lg ${isNearLimit ? "border-amber-500/50" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">
                {sources.length} / {sourceLimit} Sources
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentPlan === "free" ? "Free Plan" : currentPlan === "basic" ? "Basic Plan" : "Pro Plan"}
              </p>
            </div>
          </div>
          {isNearLimit && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              {sources.length >= sourceLimit ? "Limit Reached" : "Near Limit"}
            </Badge>
          )}
        </div>
        {sources.length >= sourceLimit && (
          <p className="text-sm text-muted-foreground mt-3">
            You've reached your source limit. Upgrade your plan to add more sources.
          </p>
        )}
      </div>

      {showLimitWarning && (
        <div className="glass-card p-6 rounded-lg border-amber-500/50">
          <div className="flex items-start gap-3 mb-4">
            <MoreVertical className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-2">Source Limit Reached</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You've reached the maximum of {sourceLimit} sources for your {currentPlan} plan. Upgrade to add more
                sources.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setShowLimitWarning(false)} variant="outline" className="glass">
                  Close
                </Button>
                <Button onClick={() => (window.location.href = "/settings")} className="glass">
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="glass-card hover-lift-subtle">
            <TabsTrigger value="all" className="hover-lift-subtle">All Sources ({sources.length})</TabsTrigger>
            <TabsTrigger value="active" className="hover-lift-subtle">Active ({activeSources.length})</TabsTrigger>
            <TabsTrigger value="inactive" className="hover-lift-subtle">Inactive ({inactiveSources.length})</TabsTrigger>
          </TabsList>


          <div className="flex gap-2">
            <Button onClick={handleAddSourceClick} className="default hover-lift-subtle">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setIsSuggestionsOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Browse Suggestions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import from OPML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export Sources
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TabsContent value="all" className="mt-0">
              <SourcesList
                sources={sources}
                onToggle={handleToggleSource}
                onDelete={handleDeleteSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
              />
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              <SourcesList
                sources={activeSources}
                onToggle={handleToggleSource}
                onDelete={handleDeleteSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
              />
            </TabsContent>

            <TabsContent value="inactive" className="mt-0">
              <SourcesList
                sources={inactiveSources}
                onToggle={handleToggleSource}
                onDelete={handleDeleteSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
              />
            </TabsContent>
          </div>

          <div className="lg:col-span-1">
            {selectedSource ? (
              <SourceSettings source={selectedSource} onUpdate={handleUpdateSource} />
            ) : (
              <Card className="glass-card p-6">
                <div className="text-center text-muted-foreground">
                  <MoreVertical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a source to configure its settings</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Tabs>

      <AddSourceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSourceAdded={loadSources}
      />

      <ImportOPMLDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={loadSources}
      />

      <SuggestionsDialog
        open={isSuggestionsOpen}
        onOpenChange={setIsSuggestionsOpen}
        onAdd={loadSources}
      />
    </div>
  )
}

interface SourcesListProps {
  sources: Source[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (source: Source) => void
  selectedId?: string
}

function SourcesList({ sources, onToggle, onDelete, onSelect, selectedId }: SourcesListProps) {
  if (sources.length === 0) {
    return (
      <Card className="glass-card p-8 text-center">
        <div className="text-muted-foreground">
          <MoreVertical className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No sources found</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sources.map((source) => {
        const IconComponent = sourceTypeIcons[source.source_type] || Globe
        const typeColorClass = sourceTypeColors[source.source_type] || sourceTypeColors.website
        
        return (
          <Card
            key={source.id}
            className={`glass-card p-4 cursor-pointer transition-all hover:shadow-lg hover-lift-subtle ${
              selectedId === source.id ? "ring-2 ring-primary/50" : ""
            }`}
            onClick={() => onSelect(source)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                {source.favicon_url ? (
                  <div className="p-2 rounded-lg bg-muted">
                    <img src={source.favicon_url} alt="" className="h-5 w-5" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-lg ${typeColorClass}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-lg">{source.title}</h3>
                    <Badge variant="outline" className={typeColorClass}>
                      {sourceTypeLabels[source.source_type]}
                    </Badge>
                    {source.is_active && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>

                  {source.description && <p className="text-muted-foreground text-sm mb-2">{source.description}</p>}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="truncate max-w-xs">{source.url}</span>
                    {source.last_fetched_at && (
                      <>
                        <span>•</span>
                        <span>Last sync: {new Date(source.last_fetched_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Switch checked={source.is_active} className="hover-lift-subtle" onCheckedChange={() => onToggle(source.id)} />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover-lift-subtle">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(source.id)
                  }} 
                  className="h-8 w-8 p-0 hover-lift-subtle"
                >
                  <Trash2 className="h-4 w-4 hover-lift-subtle" />
                </Button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

interface SourceSettingsProps {
  source: Source
  onUpdate: (source: Source) => void
}

function SourceSettings({ source, onUpdate }: SourceSettingsProps) {
  const [localSource, setLocalSource] = useState(source)

  useEffect(() => {
    setLocalSource(source)
  }, [source])

  const handleSave = () => {
    onUpdate(localSource)
  }

  const SelectedTypeIcon = sourceTypeIcons[localSource.source_type] || Globe
  const typeColorClass = sourceTypeColors[localSource.source_type] || sourceTypeColors.website

  return (
    <Card className="glass-card p-6 sticky top-24">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">Source Settings</h3>
        {localSource.favicon_url ? (
          <div className="p-2 rounded-lg bg-muted shrink-0">
            <img 
              src={localSource.favicon_url} 
              alt="" 
              className="h-6 w-6"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          </div>
        ) : (
          <div className={`p-2 rounded-lg ${typeColorClass} shrink-0`}>
            <SelectedTypeIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={localSource.title}
            onChange={(e) => setLocalSource({ ...localSource, title: e.target.value })}
            className="glass"
          />
        </div>

        <div>
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            value={localSource.url}
            onChange={(e) => setLocalSource({ ...localSource, url: e.target.value })}
            className="glass"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={localSource.description || ""}
            onChange={(e) => setLocalSource({ ...localSource, description: e.target.value })}
            className="glass"
          />
        </div>

        <div>
          <Label htmlFor="source_type" className="mb-2 block">Source Type</Label>
          <Select 
            value={localSource.source_type} 
            onValueChange={(value: any) => setLocalSource({ ...localSource, source_type: value })}
          >
            <SelectTrigger className="glass">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <SelectedTypeIcon className="h-4 w-4" />
                  <span>{sourceTypeLabels[localSource.source_type]}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="glass-card">
              <SelectItem value="rss">
                <div className="flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  <span>RSS Feed</span>
                </div>
              </SelectItem>
              <SelectItem value="youtube">
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  <span>YouTube</span>
                </div>
              </SelectItem>
              <SelectItem value="twitter">
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </div>
              </SelectItem>
              <SelectItem value="instagram">
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  <span>Instagram</span>
                </div>
              </SelectItem>
              <SelectItem value="tiktok">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4" />
                  <span>TikTok</span>
                </div>
              </SelectItem>
              <SelectItem value="newsletter">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>Newsletter</span>
                </div>
              </SelectItem>
              <SelectItem value="website">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Website</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full default">
          Save Changes
        </Button>
      </div>
    </Card>
  )
}
