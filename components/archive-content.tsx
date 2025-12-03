"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GlassStatsCard } from "@/components/glass-components"
import { ContentCard } from "@/components/content-card"
import { ContentViewer } from "@/components/content-viewer"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Search, 
  Bookmark, 
  Clock, 
  Archive, 
  Download, 
  Filter, 
  Loader2,
  Folder,
  FolderPlus,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Inbox,
  FolderOpen,
  Check,
  X,
  Lock,
  Crown,
  Menu
} from "lucide-react"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { folderService } from "@/lib/services/folder-service"
import type { ArchiveFolder, ArchiveFolderWithChildren } from "@/types/database"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { useSubscription } from "@/contexts/subscription-context"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

// Colores disponibles para carpetas
const FOLDER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#64748b', // slate
] as const

export function ArchiveContent() {
  const { hasFeature, currentPlan } = useSubscription()
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState("")
  const [archivedContent, setArchivedContent] = useState<ContentWithMetadata[]>([])
  const [readContent, setReadContent] = useState<ContentWithMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedArticle, setSelectedArticle] = useState<ContentWithMetadata | null>(null)
  const [stats, setStats] = useState({
    totalRead: 0,
    savedItems: 0,
    archived: 0
  })
  const [mobileFolderSheetOpen, setMobileFolderSheetOpen] = useState(false)

  // Features del plan
  const canSearch = hasFeature('archive_search')
  const canDownload = hasFeature('archive_download')

  // Estado para carpetas
  const [folders, setFolders] = useState<ArchiveFolderWithChildren[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderContent, setFolderContent] = useState<ContentWithMetadata[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [loadingFolderContent, setLoadingFolderContent] = useState(false)

  // Estado para crear/editar carpetas
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState<string>(FOLDER_COLORS[0])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [editingFolder, setEditingFolder] = useState<ArchiveFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<ArchiveFolder | null>(null)

  // Cargar carpetas
  const loadFolders = useCallback(async () => {
    setLoadingFolders(true)
    try {
      const hierarchy = await folderService.getFolderHierarchy()
      setFolders(hierarchy)
    } catch (error) {
      console.error('Error loading folders:', error)
    } finally {
      setLoadingFolders(false)
    }
  }, [])

  // Cargar contenido de una carpeta
  const loadFolderContent = useCallback(async (folderId: string | null) => {
    setLoadingFolderContent(true)
    try {
      const content = await contentService.getArchivedByFolder(folderId)
      setFolderContent(content)
    } catch (error) {
      console.error('Error loading folder content:', error)
    } finally {
      setLoadingFolderContent(false)
    }
  }, [])

  useEffect(() => {
    loadContent()
    loadFolders()
  }, [loadFolders])

  // Cargar contenido cuando cambia la carpeta seleccionada
  useEffect(() => {
    loadFolderContent(selectedFolderId)
  }, [selectedFolderId, loadFolderContent])

  const loadContent = async () => {
    setLoading(true)
    try {
      // Cargar contenido archivado
      const archived = await contentService.getArchivedContent()
      setArchivedContent(archived)

      // Cargar contenido leído (para la pestaña Read)
      const allContent = await contentService.getContentWithUserData({ limit: 100 })
      const read = allContent.filter(c => c.user_content?.is_read)
      setReadContent(read)

      // Calcular estadísticas
      setStats({
        totalRead: read.length,
        savedItems: archived.length,
        archived: archived.length
      })
    } catch (error) {
      console.error('Error loading archive content:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar contenido por búsqueda (solo si tiene la feature)
  const filterContent = (content: ContentWithMetadata[]) => {
    if (!searchQuery.trim() || !canSearch) return content
    const query = searchQuery.toLowerCase()
    return content.filter(item => {
      const title = 'title' in item ? (item.title as string)?.toLowerCase() : ''
      const description = 'description' in item ? (item.description as string)?.toLowerCase() : ''
      const content_text = 'content' in item ? (item.content as string)?.toLowerCase() : ''
      return title.includes(query) || description.includes(query) || content_text.includes(query)
    })
  }

  // Handler para búsqueda que verifica la feature
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canSearch) {
      toast.error("Función Pro", {
        description: "La búsqueda en el archivo está disponible solo para usuarios Pro.",
      })
      return
    }
    setSearchQuery(e.target.value)
  }

  // Handler para descargar que verifica la feature
  const handleExportOPML = async () => {
    if (!canDownload) {
      toast.error("Función Pro", {
        description: "La descarga de contenido está disponible solo para usuarios Pro.",
      })
      return
    }
    
    try {
      const opml = await folderService.exportFoldersAsOPML()
      const blob = new Blob([opml], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lexora-archive-folders.opml'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting OPML:', error)
    }
  }

  const filteredArchived = filterContent(archivedContent)
  const filteredRead = filterContent(readContent)
  const filteredFolderContent = filterContent(folderContent)

  const handleOpenViewer = (article: ContentWithMetadata) => {
    setSelectedArticle(article)
  }

  const handleCloseViewer = () => {
    setSelectedArticle(null)
    // Recargar para actualizar estados
    loadContent()
    loadFolderContent(selectedFolderId)
  }

  // Handler para cuando se quita un item del archivo
  const handleUnarchive = useCallback((article: ContentWithMetadata) => {
    // Actualizar archivedContent
    setArchivedContent(prev => prev.filter(
      item => !(item.content_type === article.content_type && item.id === article.id)
    ))
    // Actualizar folderContent
    setFolderContent(prev => prev.filter(
      item => !(item.content_type === article.content_type && item.id === article.id)
    ))
    // Actualizar stats
    setStats(prev => ({
      ...prev,
      savedItems: Math.max(0, prev.savedItems - 1),
      archived: Math.max(0, prev.archived - 1)
    }))
  }, [])

  // Crear nueva carpeta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      await folderService.createFolder(
        newFolderName.trim(),
        undefined, // parentId
        undefined, // icon
        newFolderColor
      )
      await loadFolders()
      setNewFolderName("")
      setNewFolderColor(FOLDER_COLORS[0])
      setIsCreatingFolder(false)
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  // Actualizar carpeta
  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      await folderService.updateFolder(editingFolder.id, {
        name: newFolderName.trim(),
        color: newFolderColor
      })
      await loadFolders()
      setEditingFolder(null)
      setNewFolderName("")
      setNewFolderColor(FOLDER_COLORS[0])
    } catch (error) {
      console.error('Error updating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  // Eliminar carpeta
  const handleDeleteFolder = async (deleteContents: boolean) => {
    if (!deletingFolder) return

    const folderToDelete = deletingFolder
    const wasSelected = selectedFolderId === deletingFolder.id
    
    // Cerrar el diálogo inmediatamente para mejor UX
    setDeletingFolder(null)
    
    if (wasSelected) {
      setSelectedFolderId(null)
    }

    try {
      await folderService.deleteFolder(folderToDelete.id, deleteContents)
      await loadFolders()
      await loadContent()
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Contar contenido en una carpeta (incluyendo subcarpetas recursivamente)
  const countFolderContent = (folder: ArchiveFolderWithChildren): number => {
    const directContent = archivedContent.filter(
      c => c.user_content?.folder_id === folder.id
    ).length
    const childrenContent = (folder.children || []).reduce(
      (acc, child) => acc + countFolderContent(child),
      0
    )
    return directContent + childrenContent
  }

  // Componente para botón con bloqueo Pro
  const ProFeatureButton = ({ 
    onClick, 
    disabled, 
    isProFeature, 
    children, 
    className,
    variant = "outline"
  }: { 
    onClick: () => void
    disabled?: boolean
    isProFeature: boolean
    children: React.ReactNode
    className?: string
    variant?: "outline" | "ghost" | "default"
  }) => {
    if (!isProFeature) {
      return (
        <Button 
          variant={variant} 
          className={cn("glass bg-transparent hover-lift-subtle", className)} 
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant={variant} 
              className={cn("glass bg-transparent hover-lift-subtle opacity-60", className)} 
              onClick={onClick}
            >
              {children}
              <Lock className="h-3 w-3 ml-1.5 text-amber-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span>Función disponible en el plan Pro</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Renderizar carpeta en el sidebar
  const renderFolderItem = (folder: ArchiveFolderWithChildren, level: number = 0) => {
    const isSelected = selectedFolderId === folder.id
    const contentCount = countFolderContent(folder)
    const hasChildren = folder.children && folder.children.length > 0

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
            "hover:bg-accent/50",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => setSelectedFolderId(folder.id)}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ backgroundColor: (folder.color || FOLDER_COLORS[0]) + '20' }}
          >
            {isSelected ? (
              <FolderOpen
                className="w-4 h-4"
                style={{ color: folder.color || FOLDER_COLORS[0] }}
              />
            ) : (
              <Folder
                className="w-4 h-4"
                style={{ color: folder.color || FOLDER_COLORS[0] }}
              />
            )}
          </div>
          <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
          <span className="text-xs text-muted-foreground">{contentCount}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setNewFolderName(folder.name)
                  setNewFolderColor(folder.color || FOLDER_COLORS[0])
                  setEditingFolder(folder)
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeletingFolder(folder)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {hasChildren && folder.children!.map(child => renderFolderItem(child, level + 1))}
      </div>
    )
  }

  // Contenido sin carpeta
  const unfiledCount = archivedContent.filter(c => !c.user_content?.folder_id).length

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Stats Overview - Scroll horizontal en mobile */}
      <div className="md:hidden -mx-4 px-4">
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-2">
            <div className="shrink-0 w-[160px]">
              <GlassStatsCard title="Total Read" value={stats.totalRead.toString()} change="" trend="up" icon={Clock} />
            </div>
            <div className="shrink-0 w-[160px]">
              <GlassStatsCard title="Saved Items" value={stats.savedItems.toString()} change="" trend="up" icon={Bookmark} />
            </div>
            <div className="shrink-0 w-[160px]">
              <GlassStatsCard title="Archived" value={stats.archived.toString()} change="" trend="up" icon={Archive} />
            </div>
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </div>
      
      {/* Stats Overview - Grid en desktop */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <GlassStatsCard title="Total Read" value={stats.totalRead.toString()} change="" trend="up" icon={Clock} />
        <GlassStatsCard title="Saved Items" value={stats.savedItems.toString()} change="" trend="up" icon={Bookmark} />
        <GlassStatsCard title="Archived" value={stats.archived.toString()} change="" trend="up" icon={Archive} />
      </div>

      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4" suppressHydrationWarning>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Input
                      placeholder={canSearch ? "Search your archive..." : "Search (Pro feature)"}
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className={cn(
                        "pl-10 glass hover-lift-subtle",
                        !canSearch && "opacity-60 cursor-not-allowed"
                      )}
                      disabled={!canSearch}
                    />
                    {!canSearch && (
                      <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </TooltipTrigger>
                {!canSearch && (
                  <TooltipContent side="bottom" className="flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    <span>Búsqueda disponible en el plan Pro</span>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" className="glass bg-transparent hover-lift-subtle">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <ProFeatureButton
            onClick={handleExportOPML}
            isProFeature={!canDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Export OPML
          </ProFeatureButton>
        </div>

        <Tabs defaultValue="saved" className="w-full">
          <TabsList className="glass-card justify-start mb-6">
            <TabsTrigger value="saved" className="hover-lift-subtle">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved ({filteredArchived.length})
            </TabsTrigger>
            <TabsTrigger value="read" className="hover-lift-subtle">
              <Clock className="h-4 w-4 mr-2" />
              Read ({filteredRead.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-6">
            {/* Mobile: Carpetas como chips horizontales + botón sheet */}
            <div className="md:hidden mb-4 space-y-3">
              {/* Botón para abrir sheet de carpetas + crear carpeta */}
              <div className="flex items-center gap-2">
                <Sheet open={mobileFolderSheetOpen} onOpenChange={setMobileFolderSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="glass bg-transparent">
                      <Menu className="h-4 w-4 mr-2" />
                      Carpetas
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-6" onOpenChange={setMobileFolderSheetOpen}>
                    <SheetHeader className="pb-4 pr-8">
                      <div className="flex items-center justify-between">
                        <SheetTitle>Carpetas</SheetTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setIsCreatingFolder(true)}
                        >
                          <FolderPlus className="h-4 w-4" />
                          <span>Nueva</span>
                        </Button>
                      </div>
                    </SheetHeader>
                    
                    {/* Crear carpeta en sheet */}
                    <AnimatePresence>
                      {(isCreatingFolder || editingFolder) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-4 space-y-3"
                        >
                          <Input
                            placeholder="Nombre de la carpeta"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="h-10"
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-2">
                            {FOLDER_COLORS.map((color) => (
                              <button
                                key={color}
                                className={cn(
                                  "w-7 h-7 rounded-full transition-transform",
                                  newFolderColor === color && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewFolderColor(color)}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                editingFolder ? handleUpdateFolder() : handleCreateFolder()
                                setMobileFolderSheetOpen(false)
                              }}
                              disabled={!newFolderName.trim() || creatingFolder}
                            >
                              {creatingFolder ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              {editingFolder ? "Guardar" : "Crear"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsCreatingFolder(false)
                                setEditingFolder(null)
                                setNewFolderName("")
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ScrollArea className="h-[calc(100%-100px)]">
                      <div className="space-y-1">
                        {/* Sin carpeta */}
                        <div
                          className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all",
                            "hover:bg-accent/50 active:scale-[0.98]",
                            selectedFolderId === null && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => {
                            setSelectedFolderId(null)
                            setMobileFolderSheetOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted shrink-0">
                            <Inbox className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">Sin carpeta</span>
                            <p className="text-xs text-muted-foreground">{unfiledCount} elementos</p>
                          </div>
                          {selectedFolderId === null && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>

                        {folders.length > 0 && (
                          <div className="h-px bg-border my-3" />
                        )}

                        {loadingFolders ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          folders.map(folder => {
                            const contentCount = countFolderContent(folder)
                            const isSelected = selectedFolderId === folder.id
                            return (
                              <div
                                key={folder.id}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all",
                                  "hover:bg-accent/50 active:scale-[0.98]",
                                  isSelected && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => {
                                  setSelectedFolderId(folder.id)
                                  setMobileFolderSheetOpen(false)
                                }}
                              >
                                <div
                                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                                  style={{ backgroundColor: (folder.color || FOLDER_COLORS[0]) + '20' }}
                                >
                                  {isSelected ? (
                                    <FolderOpen className="w-5 h-5" style={{ color: folder.color || FOLDER_COLORS[0] }} />
                                  ) : (
                                    <Folder className="w-5 h-5" style={{ color: folder.color || FOLDER_COLORS[0] }} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium truncate block">{folder.name}</span>
                                  <p className="text-xs text-muted-foreground">{contentCount} elementos</p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setNewFolderName(folder.name)
                                        setNewFolderColor(folder.color || FOLDER_COLORS[0])
                                        setEditingFolder(folder)
                                      }}
                                    >
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setDeletingFolder(folder)
                                        setMobileFolderSheetOpen(false)
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>

                {/* Chip de carpeta seleccionada */}
                <div className="flex-1 min-w-0">
                  {selectedFolderId ? (
                    <div 
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: (folders.find(f => f.id === selectedFolderId)?.color || FOLDER_COLORS[0]) + '20',
                        color: folders.find(f => f.id === selectedFolderId)?.color || FOLDER_COLORS[0]
                      }}
                    >
                      <Folder className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[150px]">
                        {folders.find(f => f.id === selectedFolderId)?.name}
                      </span>
                      <button 
                        onClick={() => setSelectedFolderId(null)}
                        className="hover:bg-black/10 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-muted-foreground">
                      <Inbox className="h-3.5 w-3.5" />
                      <span>Sin carpeta</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chips de carpetas horizontales (quick access) */}
              {folders.length > 0 && (
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2 pb-2">
                    {folders.slice(0, 6).map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0",
                          "border",
                          selectedFolderId === folder.id 
                            ? "border-transparent" 
                            : "border-border/50 bg-background/50 hover:bg-accent/50"
                        )}
                        style={selectedFolderId === folder.id ? { 
                          backgroundColor: (folder.color || FOLDER_COLORS[0]) + '20',
                          color: folder.color || FOLDER_COLORS[0]
                        } : {}}
                      >
                        <Folder className="h-3 w-3" style={{ color: folder.color || FOLDER_COLORS[0] }} />
                        <span className="truncate max-w-[80px]">{folder.name}</span>
                        <span className="text-[10px] opacity-60">
                          {countFolderContent(folder)}
                        </span>
                      </button>
                    ))}
                    {folders.length > 6 && (
                      <button
                        onClick={() => setMobileFolderSheetOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-background/50 hover:bg-accent/50 shrink-0"
                      >
                        +{folders.length - 6} más
                      </button>
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" className="h-1.5" />
                </ScrollArea>
              )}
            </div>

            {/* Desktop: Layout original con sidebar */}
            <div className="flex gap-6">
              {/* Sidebar de carpetas - Solo desktop */}
              <div className="w-64 shrink-0 hidden md:block">
                <Card className="glass-card p-4 sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">Carpetas</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsCreatingFolder(true)}
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Nueva carpeta inline */}
                  <AnimatePresence>
                    {(isCreatingFolder || editingFolder) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 space-y-2"
                      >
                        <Input
                          placeholder="Nombre de la carpeta"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              editingFolder ? handleUpdateFolder() : handleCreateFolder()
                            } else if (e.key === 'Escape') {
                              setIsCreatingFolder(false)
                              setEditingFolder(null)
                              setNewFolderName("")
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {FOLDER_COLORS.map((color) => (
                            <button
                              key={color}
                              className={cn(
                                "w-5 h-5 rounded-full transition-transform",
                                newFolderColor === color && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewFolderColor(color)}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-7"
                            onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                            disabled={!newFolderName.trim() || creatingFolder}
                          >
                            {creatingFolder ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => {
                              setIsCreatingFolder(false)
                              setEditingFolder(null)
                              setNewFolderName("")
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1">
                    {/* Todas las guardadas */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        "hover:bg-accent/50",
                        selectedFolderId === null && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setSelectedFolderId(null)}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted shrink-0">
                        <Inbox className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="flex-1 truncate text-sm font-medium">Sin carpeta</span>
                      <span className="text-xs text-muted-foreground">{unfiledCount}</span>
                    </div>

                    {/* Separador si hay carpetas */}
                    {folders.length > 0 && (
                      <div className="h-px bg-border my-2" />
                    )}

                    {/* Lista de carpetas */}
                    {loadingFolders ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      folders.map(folder => renderFolderItem(folder))
                    )}
                  </div>
                </Card>
              </div>

              {/* Contenido de la carpeta */}
              <div className="flex-1 min-w-0">
                {loading || loadingFolderContent ? (
                  <Card className="glass-card p-6 text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading content...</p>
                  </Card>
                ) : filteredFolderContent.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredFolderContent.map((item) => (
                      <ContentCard
                        key={`${item.content_type}-${item.id}`}
                        article={item}
                        viewMode="grid"
                        onOpenViewer={handleOpenViewer}
                        onUnarchive={handleUnarchive}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="glass-card p-6 text-center">
                    <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      {selectedFolderId ? "Carpeta vacía" : "Sin elementos guardados"}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? "No items match your search." 
                        : selectedFolderId 
                          ? "Mueve contenido a esta carpeta para verlo aquí."
                          : "Items you save will appear here for easy access later."}
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="read" className="space-y-4 mt-6">
            {loading ? (
              <Card className="glass-card p-6 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading reading history...</p>
              </Card>
            ) : filteredRead.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRead.map((item) => (
                  <ContentCard
                    key={`${item.content_type}-${item.id}`}
                    article={item}
                    viewMode="grid"
                    onOpenViewer={handleOpenViewer}
                    onUnarchive={handleUnarchive}
                  />
                ))}
              </div>
            ) : (
              <Card className="glass-card p-6 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No reading history</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "No items match your search." 
                    : "Your reading history will be displayed here."}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Content Viewer Modal */}
      {selectedArticle && (
        <ContentViewer
          content={selectedArticle}
          isOpen={!!selectedArticle}
          onClose={handleCloseViewer}
        />
      )}

      {/* Dialog para confirmar eliminación de carpeta */}
      <Dialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar carpeta</DialogTitle>
            <DialogDescription>
              ¿Qué quieres hacer con el contenido de la carpeta "{deletingFolder?.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => handleDeleteFolder(false)}
              className="flex-1 hover:bg-accent"
            >
              Mover a Sin carpeta
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteFolder(true)}
              className="flex-1"
            >
              Eliminar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
