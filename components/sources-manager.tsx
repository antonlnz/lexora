"use client"

import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useState, useEffect, useRef, useCallback } from "react"
import { useSubscription } from "@/contexts/subscription-context"
import { usePendingDeletions } from "@/contexts/pending-deletions-context"
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
  CheckCircle,
  Crown,
  MoreVertical,
  Ban,
  Sparkles,
  Upload,
  Download,
  Loader2,
  AlertTriangle,
  Bookmark,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { sourceService, type SourceWithUserData, type SourceDeletionInfo } from "@/lib/services/source-service"
import { 
  SOURCE_TYPE_ICONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_COLORS,
  getSourceTypeIcon,
  getSourceTypeLabel,
  getSourceTypeColor,
} from "@/lib/content-type-config"
import type { SourceType } from "@/types/database"

// Tipo actualizado para usar el nuevo esquema
type Source = SourceWithUserData

export function SourcesManager() {
  const { canAddSource, getSourceLimit, currentPlan, hasFeature } = useSubscription()
  const { addPendingDeletion, registerSourceRestoredCallback } = usePendingDeletions()
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Estados para el flujo de eliminación
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<Source | null>(null)
  const [deletionInfo, setDeletionInfo] = useState<SourceDeletionInfo | null>(null)
  const [isLoadingDeletionInfo, setIsLoadingDeletionInfo] = useState(false)
  const [showSavedContentDialog, setShowSavedContentDialog] = useState(false)
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false)
  const [deleteSavedContent, setDeleteSavedContent] = useState(false)

  // Registrar callback para cuando se restaure una fuente
  useEffect(() => {
    const unregister = registerSourceRestoredCallback((source: Source) => {
      setSources(prev => {
        // Solo añadir si no existe ya
        if (prev.some(s => s.id === source.id)) return prev
        return [...prev, source]
      })
    })
    return unregister
  }, [registerSourceRestoredCallback])

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
      await sourceService.toggleSourceActive(sourceId, !source.user_source.is_active)
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, user_source: { ...s.user_source, is_active: !s.user_source.is_active } } : s)),
      )
      toast.success(source.user_source.is_active ? "Fuente desactivada" : "Fuente activada")
    } catch (error) {
      toast.error("Error al actualizar fuente")
    }
  }

  // Paso 1: Usuario hace clic en eliminar - cargar info y mostrar primer diálogo
  const handleInitiateDelete = async (source: Source) => {
    setDeleteConfirmSource(source)
    setIsLoadingDeletionInfo(true)
    
    try {
      const info = await sourceService.getSourceDeletionInfo(source.id)
      setDeletionInfo(info)
    } catch (error) {
      console.error('Error getting deletion info:', error)
      setDeletionInfo(null)
    } finally {
      setIsLoadingDeletionInfo(false)
    }
  }

  // Paso 2: Usuario confirma eliminación inicial
  const handleConfirmDelete = async () => {
    if (!deleteConfirmSource || !deletionInfo) return

    // Si tiene contenido guardado, preguntar qué hacer
    if (deletionInfo.hasSavedContent) {
      // Cerrar primer diálogo pero mantener la referencia a la fuente
      // NO hacer setDeleteConfirmSource(null) aquí
      setShowSavedContentDialog(true)
      return
    }

    // No tiene contenido guardado, proceder directamente
    await executeDelete(deleteConfirmSource, false)
  }

  // Paso 3a: Usuario decide qué hacer con el contenido guardado
  const handleSavedContentChoice = (keepSaved: boolean) => {
    if (!deleteConfirmSource) return
    
    setShowSavedContentDialog(false)
    
    if (keepSaved) {
      // Mantener guardados - proceder con eliminación
      executeDelete(deleteConfirmSource, false)
    } else {
      // Quiere eliminar también los guardados - pedir confirmación final
      setDeleteSavedContent(true)
      setShowFinalDeleteConfirm(true)
    }
  }

  // Paso 3b: Confirmación final para eliminar contenido guardado
  const handleFinalDeleteConfirm = () => {
    if (!deleteConfirmSource) return
    
    setShowFinalDeleteConfirm(false)
    executeDelete(deleteConfirmSource, true)
  }

  // Ejecutar la eliminación con undo de 10 segundos (usando el contexto global)
  const executeDelete = async (source: Source, deleteSaved: boolean) => {
    // Limpiar estados de diálogos
    setDeleteConfirmSource(null)
    setDeletionInfo(null)
    setDeleteSavedContent(false)

    // Eliminar de la lista inmediatamente (optimistic update)
    setSources((prev) => prev.filter((s) => s.id !== source.id))
    if (selectedSource?.id === source.id) {
      setSelectedSource(null)
    }

    // Añadir a las eliminaciones pendientes (el contexto maneja el timeout y la UI)
    addPendingDeletion(source, deleteSaved)
  }

  // Cancelar el flujo de eliminación
  const handleCancelDelete = () => {
    setDeleteConfirmSource(null)
    setDeletionInfo(null)
    setShowSavedContentDialog(false)
    setShowFinalDeleteConfirm(false)
    setDeleteSavedContent(false)
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

  // Exportar fuentes como OPML
  const handleExportSources = () => {
    // Verificar feature de exportación
    if (!hasFeature('export_data')) {
      toast.error("Función Pro", {
        description: "La exportación de fuentes está disponible solo para usuarios Pro.",
      })
      return
    }

    try {
      // Generar OPML
      const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Lexora Sources Export</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${sources.map(source => {
  const htmlUrl = source.metadata?.siteUrl || source.metadata?.htmlUrl || ''
  return `    <outline type="rss" text="${escapeXml(source.title)}" title="${escapeXml(source.title)}" xmlUrl="${escapeXml(source.url)}" htmlUrl="${escapeXml(htmlUrl)}" />`
}).join('\n')}
  </body>
</opml>`

      const blob = new Blob([opmlContent], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lexora-sources.opml'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Fuentes exportadas correctamente")
    } catch (error) {
      console.error('Error exporting sources:', error)
      toast.error("Error al exportar fuentes")
    }
  }

  // Helper para escapar XML
  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
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
                {currentPlan === "free" ? "Free Plan" : "Pro Plan"}
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
              <Button variant="outline" size="icon" className="shrink-0 hover-lift-subtle">
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
              <DropdownMenuItem onClick={handleExportSources}>
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
                onDelete={handleInitiateDelete}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
                onUpdate={handleUpdateSource}
              />
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              <SourcesList
                sources={activeSources}
                onToggle={handleToggleSource}
                onDelete={handleInitiateDelete}
                onSelect={setSelectedSource}
                selectedId={selectedSource?.id}
                onUpdate={handleUpdateSource}
              />
            </TabsContent>

            <TabsContent value="inactive" className="mt-0">
              <SourcesList
                sources={inactiveSources}
                onToggle={handleToggleSource}
                onDelete={handleInitiateDelete}
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

      {/* Diálogo 1: Confirmación inicial de eliminación */}
      <AlertDialog open={!!deleteConfirmSource && !showSavedContentDialog && !showFinalDeleteConfirm} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingDeletionInfo ? (
                <span>Comprobando información...</span>
              ) : (
                <>
                  Estás a punto de eliminar la fuente <strong>{deleteConfirmSource?.title}</strong>.
                  {deletionInfo?.hasSavedContent && (
                    <span className="block mt-2 text-amber-600">
                      Tienes {deletionInfo.savedContentCount} elemento(s) guardado(s) de esta fuente.
                    </span>
                  )}
                  <span className="block mt-2">Esta acción se puede deshacer en los próximos 10 segundos.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isLoadingDeletionInfo}
              className="bg-destructive text-white hover:bg-red-600 hover:shadow-lg hover:shadow-destructive/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {isLoadingDeletionInfo ? "Comprobando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo 2: Preguntar sobre contenido guardado */}
      <AlertDialog open={showSavedContentDialog} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Qué hacer con el contenido guardado?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes <strong>{deletionInfo?.savedContentCount || 0}</strong> elemento(s) guardado(s) de la fuente <strong>{deleteConfirmSource?.title}</strong>.
              <span className="block mt-2">¿Quieres mantenerlos o eliminarlos también?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelDelete}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleSavedContentChoice(true)}
            >
              Mantener guardados
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSavedContentChoice(false)
              }}
              className="bg-destructive text-white hover:bg-red-600 hover:shadow-lg hover:shadow-destructive/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo 3: Confirmación final para eliminar contenido guardado */}
      <AlertDialog open={showFinalDeleteConfirm} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación completa</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar permanentemente la fuente <strong>{deleteConfirmSource?.title}</strong> y todo su contenido guardado ({deletionInfo?.savedContentCount || 0} elemento(s)).
              <span className="block mt-2 font-medium text-destructive">Esta acción se puede deshacer en los próximos 10 segundos.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleFinalDeleteConfirm()
              }}
              className="bg-destructive text-white hover:bg-red-600 hover:shadow-lg hover:shadow-destructive/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Componente para el icono de la fuente con fallback
function SourceIcon({ source }: { source: Source }) {
  const [imageError, setImageError] = useState(false)
  const IconComponent = getSourceTypeIcon(source.source_type as SourceType)
  const typeColorClass = getSourceTypeColor(source.source_type as SourceType)

  if (source.favicon_url && !imageError) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        <img 
          src={source.favicon_url} 
          alt="" 
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  return (
    <div className={`p-2 rounded-lg ${typeColorClass} shrink-0`}>
      <IconComponent className="h-5 w-5" />
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
        const IconComponent = getSourceTypeIcon(source.source_type as SourceType)
        const typeColorClass = getSourceTypeColor(source.source_type as SourceType)
        const typeLabel = getSourceTypeLabel(source.source_type as SourceType)
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
                <SourceIcon source={source} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-base sm:text-lg truncate">{source.title}</h3>
                    <Badge variant="outline" className={`${typeColorClass} text-xs shrink-0`}>
                      {typeLabel}
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
                        className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors duration-150"
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

  const SelectedTypeIcon = getSourceTypeIcon(localSource.source_type as SourceType)
  const typeColorClass = getSourceTypeColor(localSource.source_type as SourceType)
  const typeLabel = getSourceTypeLabel(localSource.source_type as SourceType)

  return (
    <Card className={`glass-card p-6 ${isMobile ? '' : 'sticky top-24'}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">Source Settings</h3>
        {localSource.favicon_url ? (
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            <img 
              src={localSource.favicon_url} 
              alt="" 
              className="w-full h-full object-cover"
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
                  <span>{typeLabel}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="glass-card">
              {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[])
                .filter(type => !['youtube_channel', 'youtube_video'].includes(type))
                .map((type) => {
                  const TypeIcon = SOURCE_TYPE_ICONS[type]
                  return (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <span>{SOURCE_TYPE_LABELS[type]}</span>
                      </div>
                    </SelectItem>
                  )
                })
              }
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
