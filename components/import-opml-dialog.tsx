"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Rss, 
  Youtube, 
  Twitter, 
  Instagram, 
  Music2, 
  Globe, 
  Pencil, 
  Check,
  X,
  CheckSquare,
  Square
} from "lucide-react"
import { useSubscription } from "@/contexts/subscription-context"
import { sourceService } from "@/lib/services/source-service"
import { toast } from "sonner"

interface ImportOPMLDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: () => void | Promise<void>
}

type SourceType = "rss" | "youtube" | "podcast" | "twitter" | "instagram" | "tiktok" | "newsletter" | "website"

interface ParsedSource {
  id: string
  name: string
  type: SourceType
  url: string
  description?: string
  selected: boolean
  isEditing: boolean
}

// Detectar el tipo de fuente basándose en la URL
function detectSourceType(url: string): SourceType {
  const lowercaseUrl = url.toLowerCase()
  
  // YouTube
  if (
    lowercaseUrl.includes("youtube.com") || 
    lowercaseUrl.includes("youtu.be") ||
    lowercaseUrl.includes("youtube.com/feeds") ||
    lowercaseUrl.includes("yt.com")
  ) {
    return "youtube"
  }
  
  // Podcast (basado en patrones comunes de feeds de podcast)
  if (
    lowercaseUrl.includes("anchor.fm") ||
    lowercaseUrl.includes("feeds.buzzsprout.com") ||
    lowercaseUrl.includes("feeds.simplecast.com") ||
    lowercaseUrl.includes("feeds.transistor.fm") ||
    lowercaseUrl.includes("feeds.soundcloud.com") ||
    lowercaseUrl.includes("feeds.megaphone.fm") ||
    lowercaseUrl.includes("feeds.libsyn.com") ||
    lowercaseUrl.includes("feeds.podbean.com") ||
    lowercaseUrl.includes("podcast") ||
    lowercaseUrl.includes("spreaker.com") ||
    lowercaseUrl.includes("castbox.fm") ||
    lowercaseUrl.includes("overcast.fm") ||
    lowercaseUrl.includes("pcast.pocketcasts.com") ||
    lowercaseUrl.includes("audioboom.com") ||
    lowercaseUrl.includes("omny.fm") ||
    lowercaseUrl.includes("rss.art19.com") ||
    lowercaseUrl.includes("feeds.acast.com")
  ) {
    return "podcast"
  }
  
  // Twitter/X
  if (
    lowercaseUrl.includes("twitter.com") || 
    lowercaseUrl.includes("x.com") ||
    lowercaseUrl.includes("nitter")
  ) {
    return "twitter"
  }
  
  // Instagram
  if (lowercaseUrl.includes("instagram.com")) {
    return "instagram"
  }
  
  // TikTok
  if (lowercaseUrl.includes("tiktok.com")) {
    return "tiktok"
  }
  
  // Newsletter (Substack, Buttondown, etc.)
  if (
    lowercaseUrl.includes("substack.com") ||
    lowercaseUrl.includes("buttondown.email") ||
    lowercaseUrl.includes("newsletter") ||
    lowercaseUrl.includes("revue.co")
  ) {
    return "newsletter"
  }
  
  // Default to RSS
  return "rss"
}

// Icono para cada tipo de fuente
function SourceTypeIcon({ type, className }: { type: SourceType; className?: string }) {
  switch (type) {
    case "youtube":
      return <Youtube className={className} />
    case "podcast":
      return <Music2 className={className} />
    case "twitter":
      return <Twitter className={className} />
    case "instagram":
      return <Instagram className={className} />
    case "tiktok":
      return <Globe className={className} />
    case "newsletter":
      return <FileText className={className} />
    case "website":
      return <Globe className={className} />
    default:
      return <Rss className={className} />
  }
}

// Color del badge según el tipo
function getTypeBadgeColor(type: SourceType): string {
  switch (type) {
    case "youtube":
      return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
    case "podcast":
      return "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30"
    case "twitter":
      return "bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30"
    case "instagram":
      return "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30"
    case "tiktok":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30"
    case "newsletter":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
    default:
      return "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30"
  }
}

export function ImportOPMLDialog({ open, onOpenChange, onImport }: ImportOPMLDialogProps) {
  const { getSourceLimit, getSourcesUsed, currentPlan, canAddMultipleSources } = useSubscription()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedSources, setParsedSources] = useState<ParsedSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [userSourcesCount, setUserSourcesCount] = useState(0)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [editingName, setEditingName] = useState("")

  const selectedSources = parsedSources.filter(s => s.selected)
  const selectedCount = selectedSources.length

  // Calcular el máximo de fuentes que se pueden seleccionar
  const sourceLimit = getSourceLimit()
  const maxSelectableCount = Math.max(0, sourceLimit - userSourcesCount)

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.name.endsWith(".opml") || droppedFile.name.endsWith(".xml"))) {
      handleFile(droppedFile)
    } else {
      setError("Please upload a valid OPML or XML file")
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFile(selectedFile)
    }
  }

  const handleFile = async (file: File) => {
    setFile(file)
    setError(null)

    try {
      const text = await file.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, "text/xml")

      const outlines = xmlDoc.querySelectorAll("outline[xmlUrl], outline[url]")
      const sources: ParsedSource[] = []

      outlines.forEach((outline, index) => {
        const title = outline.getAttribute("title") || outline.getAttribute("text") || "Untitled"
        const url = outline.getAttribute("xmlUrl") || outline.getAttribute("url") || ""
        const description = outline.getAttribute("description") || ""

        if (url) {
          sources.push({
            id: `source-${index}-${Date.now()}`,
            name: title,
            type: detectSourceType(url),
            url: url,
            description: description,
            // Solo seleccionar hasta el máximo permitido
            selected: index < maxSelectableCount,
            isEditing: false,
          })
        }
      })

      if (sources.length === 0) {
        setError("No valid feeds found in the OPML file")
      } else {
        setParsedSources(sources)
        
        // Mostrar aviso si hay más fuentes de las que se pueden importar
        if (sources.length > maxSelectableCount && maxSelectableCount > 0) {
          toast.info(`Límite de fuentes`, {
            description: `Solo se han seleccionado ${maxSelectableCount} de ${sources.length} fuentes. Puedes cambiar la selección manualmente.`,
          })
        } else if (maxSelectableCount === 0) {
          toast.warning(`Límite alcanzado`, {
            description: `Has alcanzado el límite de ${sourceLimit} fuentes. Actualiza tu plan para importar más.`,
          })
        }
      }
    } catch (err) {
      setError("Failed to parse OPML file. Please check the file format.")
    }
  }

  const toggleSource = useCallback((id: string) => {
    setParsedSources(prev => {
      const source = prev.find(s => s.id === id)
      if (!source) return prev
      
      // Si está seleccionado, siempre permitir deseleccionar
      if (source.selected) {
        return prev.map(s => s.id === id ? { ...s, selected: false } : s)
      }
      
      // Si no está seleccionado, verificar que no exceda el límite
      const currentSelected = prev.filter(s => s.selected).length
      if (currentSelected >= maxSelectableCount) {
        toast.warning(`Límite de selección`, {
          description: `Solo puedes seleccionar ${maxSelectableCount} fuentes más. Deselecciona alguna para añadir otra.`,
        })
        return prev
      }
      
      return prev.map(s => s.id === id ? { ...s, selected: true } : s)
    })
  }, [maxSelectableCount])

  const toggleSelectAll = useCallback(() => {
    const hasAnySelected = parsedSources.some(s => s.selected)
    
    if (hasAnySelected) {
      // Si hay algo seleccionado, deseleccionar todas
      setParsedSources(prev => prev.map(s => ({ ...s, selected: false })))
    } else {
      // Si no hay nada seleccionado, seleccionar hasta el máximo permitido
      setParsedSources(prev => prev.map((s, index) => ({ 
        ...s, 
        selected: index < maxSelectableCount 
      })))
      
      if (parsedSources.length > maxSelectableCount) {
        toast.info(`Se seleccionaron ${maxSelectableCount} de ${parsedSources.length} fuentes (límite del plan)`)
      }
    }
  }, [parsedSources, maxSelectableCount])

  const startEditing = useCallback((source: ParsedSource) => {
    setParsedSources(prev => 
      prev.map(s => ({ ...s, isEditing: s.id === source.id }))
    )
    setEditingName(source.name)
  }, [])

  const cancelEditing = useCallback(() => {
    setParsedSources(prev => prev.map(s => ({ ...s, isEditing: false })))
    setEditingName("")
  }, [])

  const saveEditing = useCallback((id: string) => {
    if (editingName.trim()) {
      setParsedSources(prev => 
        prev.map(s => s.id === id ? { ...s, name: editingName.trim(), isEditing: false } : s)
      )
    }
    setEditingName("")
  }, [editingName])

  const handleImport = async () => {
    if (selectedCount === 0) return

    // Verificar límite usando la función del contexto
    const { allowed, maxAllowed } = canAddMultipleSources(selectedCount, userSourcesCount)
    
    if (!allowed) {
      toast.error("Límite de fuentes alcanzado", {
        description: `Has alcanzado el límite de ${sourceLimit} fuentes. Actualiza tu plan para añadir más.`,
      })
      return
    }
    
    // Verificar que no se exceda el límite
    if (selectedCount > maxAllowed) {
      toast.error("Demasiadas fuentes seleccionadas", {
        description: `Solo puedes importar ${maxAllowed} fuentes más. Por favor, deselecciona algunas.`,
      })
      return
    }

    setIsImporting(true)
    try {
      // TODO: Aquí deberíamos procesar y guardar las fuentes en Supabase
      // Por ahora solo refrescamos la lista
      await onImport()
      setFile(null)
      setParsedSources([])
      setError(null)
      onOpenChange(false)
      toast.success(`${selectedCount} fuente(s) importada(s)`)
    } catch (error) {
      toast.error("Error al importar fuentes")
    } finally {
      setIsImporting(false)
    }
  }

  const resetDialog = useCallback(() => {
    setFile(null)
    setParsedSources([])
    setError(null)
    setEditingName("")
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col bg-background border border-border shadow-xl">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Import from OPML</DialogTitle>
              <DialogDescription className="text-sm">
                Import your feeds from Feedly, Inoreader, or any OPML-compatible service
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          {/* Advertencia de límite */}
          {!isLoadingSources && parsedSources.length > 0 && (() => {
            const futureCount = userSourcesCount + selectedCount
            const willExceedLimit = futureCount > sourceLimit
            const isNearLimit = userSourcesCount >= sourceLimit * 0.8 && !willExceedLimit
            const isAtLimit = maxSelectableCount === 0
            
            if (isAtLimit) {
              return (
                <div className="p-3 rounded-lg border shrink-0 border-red-500/50 bg-red-500/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Límite de fuentes alcanzado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Has alcanzado el límite de {sourceLimit} fuentes del plan {currentPlan}. 
                        Actualiza a Pro para fuentes ilimitadas.
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
            
            if (willExceedLimit || isNearLimit) {
              return (
                <div className={`p-3 rounded-lg border shrink-0 ${
                  willExceedLimit 
                    ? 'border-red-500/50 bg-red-500/10' 
                    : 'border-amber-500/50 bg-amber-500/10'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
                      willExceedLimit ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {willExceedLimit ? 'Excederá el límite' : 'Cerca del límite'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {willExceedLimit 
                          ? `${selectedCount} seleccionadas excederán tu límite de ${sourceLimit}. Puedes añadir ${maxSelectableCount} más.`
                          : `Usando ${userSourcesCount}/${sourceLimit}. ${selectedCount} seleccionadas para importar.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
            
            // Mostrar info de selección limitada
            if (parsedSources.length > maxSelectableCount) {
              return (
                <div className="p-3 rounded-lg border shrink-0 border-blue-500/50 bg-blue-500/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Selección limitada</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Se encontraron {parsedSources.length} fuentes, pero solo puedes importar {maxSelectableCount} más con tu plan actual.
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
            
            return null
          })()}

          {/* Zona de drop */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all shrink-0 ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Drop your OPML file here</h3>
              <p className="text-sm text-muted-foreground mb-4">Supports .opml and .xml files</p>
              <input type="file" accept=".opml,.xml" onChange={handleFileInput} className="hidden" id="opml-upload" />
              <Button asChild variant="outline" size="sm">
                <label htmlFor="opml-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 flex items-start gap-3 shrink-0">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-600">Import Error</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Lista de fuentes parseadas */}
          {parsedSources.length > 0 && (
            <div className="flex flex-col min-h-0 rounded-lg border border-border overflow-hidden" style={{ maxHeight: '45vh' }}>
              {/* Header */}
              <div className="p-3 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      {selectedCount} de {parsedSources.length} fuentes seleccionadas
                      {maxSelectableCount < parsedSources.length && (
                        <span className="text-muted-foreground ml-1">
                          (máx. {maxSelectableCount})
                        </span>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-7 text-xs gap-1.5"
                    disabled={maxSelectableCount === 0}
                  >
                    {selectedCount > 0 ? (
                      <>
                        <Square className="h-3 w-3" />
                        Deseleccionar todo
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3" />
                        Seleccionar todo
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Lista scrolleable con altura fija */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-1">
                  {parsedSources.map((source) => {
                    // Determinar si se puede seleccionar esta fuente
                    const canSelect = source.selected || selectedCount < maxSelectableCount
                    
                    return (
                      <div
                        key={source.id}
                        className={`group flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                          source.selected 
                            ? 'bg-primary/10 hover:bg-primary/15 border border-primary/20' 
                            : canSelect
                              ? 'hover:bg-muted/50'
                              : 'opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <Checkbox
                          checked={source.selected}
                          onCheckedChange={() => toggleSource(source.id)}
                          disabled={!canSelect && !source.selected}
                          className="shrink-0"
                        />
                        
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${getTypeBadgeColor(source.type)}`}>
                          <SourceTypeIcon type={source.type} className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {source.isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing(source.id)
                                  if (e.key === 'Escape') cancelEditing()
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => saveEditing(source.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={cancelEditing}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{source.name}</span>
                                <button
                                  onClick={() => startEditing(source)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                            </>
                          )}
                        </div>

                        <Badge 
                          variant="outline" 
                          className={`shrink-0 text-[10px] px-1.5 py-0 h-5 ${getTypeBadgeColor(source.type)}`}
                        >
                          {source.type.toUpperCase()}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border shrink-0">
          {file && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null)
                setParsedSources([])
                setError(null)
              }}
              className="text-muted-foreground"
            >
              Choose Different File
            </Button>
          )}
          <div className={`flex gap-2 ${!file ? 'ml-auto' : ''}`}>
            <Button
              variant="outline"
              onClick={resetDialog}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={
                selectedCount === 0 || 
                isImporting ||
                selectedCount > maxSelectableCount ||
                maxSelectableCount === 0
              }
            >
              {isImporting 
                ? "Importing..." 
                : maxSelectableCount === 0
                  ? "Límite alcanzado"
                  : `Import ${selectedCount} Source${selectedCount !== 1 ? "s" : ""}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
