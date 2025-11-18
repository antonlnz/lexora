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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Source {
  id: string
  userId: string
  name: string
  type: "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter" | "rss" | "website"
  url: string
  favicon?: string
  isActive: boolean
  lastFetchedAt?: string
  createdAt?: string
  updatedAt?: string
  lastSync: string
  itemCount: number
  status: "active" | "error" | "syncing"
  description?: string
  tags: string[]
  updateFrequency: "realtime" | "hourly" | "daily" | "weekly"
}

const mockSources: Source[] = [
  {
    id: "1",
    userId: "0",
    name: "TechCrunch",
    type: "news",
    url: "https://techcrunch.com",
    isActive: true,
    lastSync: "2 minutes ago",
    itemCount: 24,
    status: "active",
    description: "Latest technology news and startup coverage",
    tags: ["Technology", "Startups", "Innovation"],
    updateFrequency: "hourly",
  },
  {
    id: "2",
    userId: "0",
    name: "Vercel",
    type: "youtube",
    url: "https://youtube.com/@vercel",
    isActive: true,
    lastSync: "1 hour ago",
    itemCount: 12,
    status: "active",
    description: "Web development tutorials and product updates",
    tags: ["Web Development", "Next.js", "Tutorials"],
    updateFrequency: "daily",
  },
  {
    id: "3",
    userId: "0",
    name: "@designpsych",
    type: "twitter",
    url: "https://twitter.com/designpsych",
    isActive: true,
    lastSync: "5 minutes ago",
    itemCount: 48,
    status: "active",
    description: "Psychology insights for product design",
    tags: ["Design", "Psychology", "UX"],
    updateFrequency: "realtime",
  },
  {
    id: "4",
    userId: "0",
    name: "Design Weekly",
    type: "newsletter",
    url: "design-weekly@example.com",
    isActive: false,
    lastSync: "3 days ago",
    itemCount: 6,
    status: "error",
    description: "Weekly design inspiration and resources",
    tags: ["Design", "Inspiration", "Weekly"],
    updateFrequency: "weekly",
  },
  {
    id: "5",
    userId: "0",
    name: "@studiominimal",
    type: "instagram",
    url: "https://instagram.com/studiominimal",
    isActive: true,
    lastSync: "30 minutes ago",
    itemCount: 8,
    status: "active",
    description: "Minimalist design and photography",
    tags: ["Photography", "Minimalism", "Design"],
    updateFrequency: "daily",
  },
]

const sourceIcons = {
  news: Newspaper,
  youtube: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: Music2,
  newsletter: Mail,
  rss: Rss,
  website: Globe,
}

const sourceColors = {
  news: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  rss: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

const statusColors = {
  active: "text-green-600",
  error: "text-red-600",
  syncing: "text-yellow-600",
}

export function SourcesManager() {
  const { canAddSource, getSourceLimit, currentPlan } = useSubscription()
  const [sources, setSources] = useState<Source[]>(mockSources)
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleToggleSource = (sourceId: string) => {
    setSources((prev) =>
      prev.map((source) => (source.id === sourceId ? { ...source, isActive: !source.isActive } : source)),
    )
  }

  const handleDeleteSource = (sourceId: string) => {
    setSources((prev) => prev.filter((source) => source.id !== sourceId))
    if (selectedSource?.id === sourceId) {
      setSelectedSource(null)
    }
  }

  const handleUpdateSource = (updatedSource: Source) => {
    setSources((prev) => prev.map((source) => (source.id === updatedSource.id ? updatedSource : source)))
    setSelectedSource(updatedSource)
  }

  const handleAddSourceClick = () => {
    if (!canAddSource(sources.length)) {
      setShowLimitWarning(true)
      return
    }
    setIsAddDialogOpen(true)
  }

  const activeSources = sources.filter((source) => source.isActive)
  const inactiveSources = sources.filter((source) => !source.isActive)
  const sourceLimit = getSourceLimit()
  const isNearLimit = sources.length >= sourceLimit * 0.8

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
        onAdd={(newSource) => {
          setSources((prev) => [...prev, { ...newSource, id: Date.now().toString() }])
          setIsAddDialogOpen(false)
        }}
      />

      <ImportOPMLDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={(importedSources) => {
          setSources((prev) => [...prev, ...importedSources.map((s, i) => ({ ...s, id: (Date.now() + i).toString() }))])
          setIsImportOpen(false)
        }}
      />

      <SuggestionsDialog
        open={isSuggestionsOpen}
        onOpenChange={setIsSuggestionsOpen}
        onAdd={(newSources) => {
          setSources((prev) => [...prev, ...newSources.map((s, i) => ({ ...s, id: (Date.now() + i).toString() }))])
          setIsSuggestionsOpen(false)
        }}
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
        const IconComponent = sourceIcons[source.type]
        return (
          <Card
            key={source.id}
            className={`glass-card p-4 cursor-pointer transition-all hover:shadow-lg ${
              selectedId === source.id ? "ring-2 ring-primary/50" : ""
            }`}
            onClick={() => onSelect(source)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-2 rounded-lg ${sourceColors[source.type]}`}>
                  <IconComponent className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{source.name}</h3>
                    <Badge variant="outline" className={sourceColors[source.type]}>
                      {source.type}
                    </Badge>
                    {source.status === "active" && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {source.status === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </div>

                  {source.description && <p className="text-muted-foreground text-sm mb-2">{source.description}</p>}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span>{source.itemCount} items</span>
                    <span>•</span>
                    <span>Last sync: {source.lastSync}</span>
                    <span>•</span>
                    <span>Updates {source.updateFrequency}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {source.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs glass">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Switch checked={source.isActive} onCheckedChange={() => onToggle(source.id)} />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(source.id)} className="h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4" />
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

  return (
    <Card className="glass-card p-6 sticky top-24">
      <h3 className="text-lg font-semibold mb-4">Source Settings</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={localSource.name}
            onChange={(e) => setLocalSource({ ...localSource, name: e.target.value })}
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
          <Label htmlFor="frequency" className="mb-2 block">Update Frequency</Label>
          <Select 
            value={localSource.updateFrequency} 
            onValueChange={(value) => setLocalSource({ ...localSource, updateFrequency: value as Source["updateFrequency"] })}
          >
            <SelectTrigger className="glass">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-card">
              <SelectItem value="realtime">Real-time</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="active">Active</Label>
          <Switch
            id="active"
            checked={localSource.isActive}
            onCheckedChange={(checked) => setLocalSource({ ...localSource, isActive: checked })}
          />
        </div>

        <Button onClick={handleSave} className="w-full default">
          Save Changes
        </Button>
      </div>
    </Card>
  )
}
