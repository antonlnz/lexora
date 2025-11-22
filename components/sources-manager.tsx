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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  Check,
  Crown,
  MoreVertical,
  Ban,
  Zap,
  Sparkles,
  Upload,
  Download,
  Loader2,
  Undo2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { sourceService, type SourceWithUserData } from "@/lib/services/source-service"

// Tipo actualizado para usar el nuevo esquema
type Source = SourceWithUserData

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
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<Source | null>(null)
  const [deletedSource, setDeletedSource] = useState<{ source: Source; timeout: NodeJS.Timeout } | null>(null)

  // Cargar fuentes al montar el componente
  useEffect(() => {
    loadSources()
  }, [])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (deletedSource?.timeout) {
        clearTimeout(deletedSource.timeout)
      }
    }
  }, [deletedSource])

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
      await sourceService.toggleSourceActive(sourceId, !source.user_source.is_active)
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, user_source: { ...s.user_source, is_active: !s.user_source.is_active } } : s)),
      )
      toast.success(source.user_source.is_active ? "Fuente desactivada" : "Fuente activada")
    } catch (error) {
      toast.error("Error al actualizar fuente")
    }
  }

  const handleDeleteSource = async (source: Source) => {
    // Cerrar el diálogo de confirmación
    setDeleteConfirmSource(null)

    // Eliminar de la lista inmediatamente
    setSources((prev) => prev.filter((s) => s.id !== source.id))
    if (selectedSource?.id === source.id) {
      setSelectedSource(null)
    }

    // Configurar timeout de 5 segundos para eliminar permanentemente
    const timeout = setTimeout(async () => {
      try {
        await sourceService.unsubscribeFromSource(source.id)
        setDeletedSource(null)
      } catch (error) {
        // Si falla, restaurar la fuente
        setSources((prev) => [...prev, source])
        toast.error("Error al eliminar fuente")
      }
    }, 5000)

    setDeletedSource({ source, timeout })
    toast.success("Fuente eliminada")
  }

  const handleUndoDelete = () => {
    if (!deletedSource) return

    // Cancelar el timeout
    clearTimeout(deletedSource.timeout)

    // Restaurar la fuente
    setSources((prev) => [...prev, deletedSource.source])
    setDeletedSource(null)
    toast.success("Eliminación cancelada")
  }

  const handleUpdateSource = async (updatedSource: Source) => {
    try {
      await sourceService.updateSource(updatedSource.id, {
        title: updatedSource.title,
        description: updatedSource.description,
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

  const activeSources = sources.filter((source) => source.user_source.is_active)
  const inactiveSources = sources.filter((source) => !source.user_source.is_active)
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
            <Ban className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-2">Source Limit Reached</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You've reached the maximum of {sourceLimit} sources for your {currentPlan} plan. Upgrade to add more
                sources.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setShowLimitWarning(false)} variant="outline" className="glass hover-lift-subtle">
                  Close
                </Button>
                <Button onClick={() => (window.location.href = "/settings")} className="default hover-lift-subtle">
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <TabsList className="glass-card hover-lift-subtle w-full sm:w-auto">
            <TabsTrigger value="all" className="hover-lift-subtle flex-1 sm:flex-none">
              <span className="hidden sm:inline">All Sources ({sources.length})</span>
              <span className="sm:hidden">All ({sources.length})</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="hover-lift-subtle flex-1 sm:flex-none">
              <span className="hidden sm:inline">Active ({activeSources.length})</span>
              <span className="sm:hidden">Active ({activeSources.length})</span>
            </TabsTrigger>
            <TabsTrigger value="inactive" className="hover-lift-subtle flex-1 sm:flex-none">
              <span className="hidden sm:inline">Inactive ({inactiveSources.length})</span>
              <span className="sm:hidden">Inactive ({inactiveSources.length})</span>
            </TabsTrigger>
          </TabsList>


          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={handleAddSourceClick} className="default hover-lift-subtle flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
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
                onDelete={setDeleteConfirmSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
                onUpdate={handleUpdateSource}
              />
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              <SourcesList
                sources={activeSources}
                onToggle={handleToggleSource}
                onDelete={setDeleteConfirmSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
                onUpdate={handleUpdateSource}
              />
            </TabsContent>

            <TabsContent value="inactive" className="mt-0">
              <SourcesList
                sources={inactiveSources}
                onToggle={handleToggleSource}
                onDelete={setDeleteConfirmSource}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
                onUpdate={handleUpdateSource}
              />
            </TabsContent>
          </div>

          <div className="hidden lg:block lg:col-span-1">
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

      <AlertDialog open={!!deleteConfirmSource} onOpenChange={(open) => !open && setDeleteConfirmSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la fuente <strong>{deleteConfirmSource?.title}</strong>. 
              Esta acción se puede deshacer en los próximos 5 segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmSource && handleDeleteSource(deleteConfirmSource)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Botón de Undo */}
      {deletedSource && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <Card className="glass-card p-4 shadow-lg border-primary/20">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Fuente eliminada</p>
                <p className="text-xs text-muted-foreground">{deletedSource.source.title}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndoDelete}
                className="shrink-0 hover-lift-subtle"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Deshacer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

interface SourcesListProps {
  sources: Source[]
  onToggle: (id: string) => void
  onDelete: (source: Source) => void
  onSelect: (source: Source) => void
  selectedId?: string
  onUpdate: (source: Source) => void
}

function SourcesList({ sources, onToggle, onDelete, onSelect, selectedId, onUpdate }: SourcesListProps) {
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
        const isSelected = selectedId === source.id
        
        return (
          <div key={source.id}>
            <Card
              className={`glass-card p-4 cursor-pointer transition-all hover:shadow-lg hover-lift-subtle ${
                isSelected ? "ring-2 ring-primary/50" : ""
              }`}
              onClick={() => onSelect(isSelected ? null! : source)}
            >
              <div className="flex items-start gap-3">
                {source.favicon_url ? (
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <img src={source.favicon_url} alt="" className="h-5 w-5" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-lg ${typeColorClass} shrink-0`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-base sm:text-lg truncate">{source.title}</h3>
                    <Badge variant="outline" className={`${typeColorClass} text-xs shrink-0`}>
                      {sourceTypeLabels[source.source_type]}
                    </Badge>
                    {source.user_source.is_active && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                  </div>

                  {source.description && (
                    <p className="text-muted-foreground text-xs sm:text-sm mb-2 line-clamp-2">{source.description}</p>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="truncate">{source.url}</span>
                      {source.last_fetched_at && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="whitespace-nowrap">Last sync: {new Date(source.last_fetched_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Switch 
                        checked={source.user_source.is_active} 
                        className="hover-lift-subtle" 
                        onCheckedChange={() => onToggle(source.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-3 hover-lift-subtle"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(source)
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(source)
                        }} 
                        className="h-8 px-3 hover-lift-subtle text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Panel de configuración en mobile */}
            {isSelected && (
              <div className="lg:hidden mt-4 mb-2">
                <SourceSettings source={source} onUpdate={onUpdate} isMobile />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface SourceSettingsProps {
  source: Source
  onUpdate: (source: Source) => void
  isMobile?: boolean
}

function SourceSettings({ source, onUpdate, isMobile = false }: SourceSettingsProps) {
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
    <Card className={`glass-card p-6 ${isMobile ? '' : 'sticky top-24'}`}>
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
