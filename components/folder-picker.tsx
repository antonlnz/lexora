'use client'

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Search,
  Check,
  Inbox,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { folderService } from '@/lib/services/folder-service'
import type { ArchiveFolder, ArchiveFolderWithChildren } from '@/types/database'

// Iconos disponibles para carpetas
const FOLDER_ICONS = [
  'folder',
  'star',
  'heart',
  'bookmark',
  'tag',
  'file',
  'archive',
  'briefcase',
  'coffee',
  'code',
  'book',
  'music',
  'video',
  'image',
  'link',
] as const

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

interface FolderPickerProps {
  trigger?: React.ReactNode
  selectedFolderId?: string | null
  onSelect: (folderId: string | null) => void | Promise<void>
  onArchive?: () => void
  showCreateNew?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  onOpenChange?: (open: boolean) => void
}

export function FolderPicker({
  trigger,
  selectedFolderId,
  onSelect,
  onArchive,
  showCreateNew = true,
  align = 'end',
  side = 'bottom',
  onOpenChange,
}: FolderPickerProps) {
  const [open, setOpen] = useState(false)
  const [folders, setFolders] = useState<ArchiveFolderWithChildren[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const isMobile = useIsMobile()

  // Cargar carpetas cuando se abre el popover
  const loadFolders = useCallback(async () => {
    setLoading(true)
    try {
      const hierarchy = await folderService.getFolderHierarchy()
      setFolders(hierarchy)
    } catch (error) {
      console.error('Error loading folders:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadFolders()
    }
  }, [open, loadFolders])

  // Filtrar carpetas por búsqueda
  const filterFolders = (
    folders: ArchiveFolderWithChildren[],
    query: string
  ): ArchiveFolderWithChildren[] => {
    if (!query) return folders

    const lowerQuery = query.toLowerCase()
    return folders.reduce((acc: ArchiveFolderWithChildren[], folder) => {
      const matchesName = folder.name.toLowerCase().includes(lowerQuery)
      const filteredChildren = filterFolders(folder.children || [], query)

      if (matchesName || filteredChildren.length > 0) {
        acc.push({
          ...folder,
          children: filteredChildren,
        })
      }

      return acc
    }, [])
  }

  const filteredFolders = filterFolders(folders, searchQuery)

  // Crear nueva carpeta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      const newFolder = await folderService.createFolder(newFolderName.trim())
      if (newFolder) {
        setNewFolderName('')
        setIsCreating(false)
        // Primero seleccionar la nueva carpeta
        await onSelect(newFolder.id)
        if (onArchive) {
          onArchive()
        }
        // Luego cerrar
        setOpen(false)
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  // Seleccionar carpeta
  const handleSelectFolder = async (folderId: string | null) => {
    // Primero ejecutar la acción de guardado
    try {
      await onSelect(folderId)
      if (onArchive) {
        onArchive()
      }
    } finally {
      // Luego cerrar el picker
      setOpen(false)
      setSearchQuery('')
    }
  }

  // Renderizar carpeta con hijos
  const renderFolder = (
    folder: ArchiveFolderWithChildren,
    level: number = 0
  ) => {
    const isSelected = selectedFolderId === folder.id
    const hasChildren = folder.children && folder.children.length > 0

    return (
      <React.Fragment key={folder.id}>
        <CommandItem
          value={folder.name}
          onSelect={() => handleSelectFolder(folder.id)}
          className={cn(
            'flex items-center gap-3 cursor-pointer py-3',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${(level + 1) * 12}px` }}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded"
            style={{ backgroundColor: folder.color || FOLDER_COLORS[0] + '20' }}
          >
            <Folder
              className="w-4 h-4"
              style={{ color: folder.color || FOLDER_COLORS[0] }}
            />
          </div>
          <span className="flex-1 truncate text-base">{folder.name}</span>
          {isSelected && <Check className="w-5 h-5 text-primary" />}
          {hasChildren && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </CommandItem>
        {hasChildren &&
          folder.children!.map((child) => renderFolder(child, level + 1))}
      </React.Fragment>
    )
  }

  // Notificar cambios en el estado open
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  // Contenido compartido del picker
  const pickerContent = (
    <Command shouldFilter={false}>
      <div className="flex items-center border-b px-3 h-12">
        <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
        <input
          placeholder="Buscar carpeta..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <CommandList className={cn(
        "overflow-y-auto",
        isMobile ? "max-h-[50vh]" : "max-h-64"
      )}>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandGroup>
              {/* Opción sin carpeta (raíz del archivo) */}
              <CommandItem
                value="inbox"
                onSelect={() => handleSelectFolder(null)}
                className={cn(
                  'flex items-center gap-3 cursor-pointer py-3',
                  selectedFolderId === null && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded bg-muted">
                  <Inbox className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-base">No folder</span>
                {selectedFolderId === null && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </CommandItem>

              {filteredFolders.length > 0 && (
                <CommandSeparator className="my-1" />
              )}

              {/* Lista de carpetas */}
              {filteredFolders.map((folder) => renderFolder(folder))}
            </CommandGroup>

            {filteredFolders.length === 0 && searchQuery && (
              <CommandEmpty>
                No se encontraron carpetas
              </CommandEmpty>
            )}
          </>
        )}
      </CommandList>

      {showCreateNew && (
        <>
          <CommandSeparator />
          <div className="p-3">
            <AnimatePresence mode="wait">
              {isCreating ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="Nombre de la carpeta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFolder()
                      } else if (e.key === 'Escape') {
                        setIsCreating(false)
                        setNewFolderName('')
                      }
                    }}
                    className="h-10 text-base"
                    autoFocus
                    disabled={creatingFolder}
                  />
                  <Button
                    size="sm"
                    className="h-10 px-4"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                  >
                    {creatingFolder ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-3 w-full px-2 py-2.5 text-base text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <FolderPlus className="w-5 h-5" />
                  <span>Crear nueva carpeta</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </Command>
  )

  // En móviles, usar Drawer desde abajo
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild onClick={(e) => e.stopPropagation()}>
          {trigger || (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Folder className="h-4 w-4" />
            </Button>
          )}
        </DrawerTrigger>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center">Guardar en carpeta</DrawerTitle>
          </DrawerHeader>
          <div className="px-0">
            {pickerContent}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // En desktop, usar Popover
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Folder className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 overflow-hidden"
        align={align}
        side={side}
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.stopPropagation()}
      >
        {pickerContent}
      </PopoverContent>
    </Popover>
  )
}

// Componente simplificado para usar como botón de archivar con carpeta
interface ArchiveWithFolderButtonProps {
  contentType: 'article' | 'youtube_video' | 'podcast'
  contentId: string
  isArchived?: boolean
  currentFolderId?: string | null
  onArchive: (folderId: string | null) => Promise<void>
  className?: string
}

export function ArchiveWithFolderButton({
  contentType,
  contentId,
  isArchived = false,
  currentFolderId,
  onArchive,
  className,
}: ArchiveWithFolderButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleArchive = async (folderId: string | null) => {
    setLoading(true)
    try {
      await onArchive(folderId)
    } catch (error) {
      console.error('Error archiving content:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <FolderPicker
      selectedFolderId={currentFolderId}
      onSelect={handleArchive}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 relative', className)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Folder
              className={cn(
                'h-4 w-4 transition-colors',
                isArchived && 'fill-current text-primary'
              )}
            />
          )}
        </Button>
      }
    />
  )
}
