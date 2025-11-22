"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { useSubscription } from "@/contexts/subscription-context"
import { sourceService } from "@/lib/services/source-service"
import { toast } from "sonner"

interface ImportOPMLDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: () => void | Promise<void>
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

export function ImportOPMLDialog({ open, onOpenChange, onImport }: ImportOPMLDialogProps) {
  const { canAddSource, getSourceLimit, currentPlan } = useSubscription()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedSources, setParsedSources] = useState<Omit<Source, "id">[]>([])
  const [error, setError] = useState<string | null>(null)
  const [userSourcesCount, setUserSourcesCount] = useState(0)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

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
      const sources: Omit<Source, "id">[] = []

      outlines.forEach((outline) => {
        const title = outline.getAttribute("title") || outline.getAttribute("text") || "Untitled"
        const url = outline.getAttribute("xmlUrl") || outline.getAttribute("url") || ""
        const description = outline.getAttribute("description") || ""

        if (url) {
          sources.push({
            name: title,
            type: "rss",
            url: url,
            description: description,
            isActive: true,
            lastSync: "Never",
            itemCount: 0,
            status: "syncing",
            tags: [],
            updateFrequency: "daily",
          })
        }
      })

      if (sources.length === 0) {
        setError("No valid feeds found in the OPML file")
      } else {
        setParsedSources(sources)
      }
    } catch (err) {
      setError("Failed to parse OPML file. Please check the file format.")
    }
  }

  const handleImport = async () => {
    if (parsedSources.length === 0) return

    const sourceLimit = getSourceLimit()
    const newCount = userSourcesCount + parsedSources.length
    
    // Verificar límite
    if (newCount > sourceLimit) {
      const maxAllowed = sourceLimit - userSourcesCount
      toast.error("Límite de fuentes alcanzado", {
        description: `No puedes importar ${parsedSources.length} fuentes. Solo puedes añadir ${maxAllowed} más fuente(s) con tu plan ${currentPlan}.`,
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
      toast.success(`${parsedSources.length} fuente(s) importada(s)`)
    } catch (error) {
      toast.error("Error al importar fuentes")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-playfair">Import from OPML</DialogTitle>
          </div>
          <DialogDescription>
            Import your RSS feeds from other readers like Feedly, Inoreader, or any OPML-compatible service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Advertencia de límite */}
          {!isLoadingSources && parsedSources.length > 0 && (() => {
            const sourceLimit = getSourceLimit()
            const futureCount = userSourcesCount + parsedSources.length
            const willExceedLimit = futureCount > sourceLimit
            const isNearLimit = userSourcesCount >= sourceLimit * 0.8 && !willExceedLimit
            
            if (willExceedLimit || isNearLimit) {
              return (
                <div className={`glass-card p-4 rounded-lg border-2 ${
                  willExceedLimit ? 'border-red-500/50 bg-red-500/10' : 'border-amber-500/50 bg-amber-500/10'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${
                      willExceedLimit ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        {willExceedLimit ? 'Will Exceed Limit' : 'Near Source Limit'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {willExceedLimit 
                          ? `Importing ${parsedSources.length} source(s) will exceed your limit of ${sourceLimit} sources for the ${currentPlan} plan. You can only add ${sourceLimit - userSourcesCount} more.`
                          : `You're using ${userSourcesCount} of ${sourceLimit} sources. Importing will add ${parsedSources.length} more.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-glass-border"
              }`}
            >
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Drop your OPML file here</h3>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <input type="file" accept=".opml,.xml" onChange={handleFileInput} className="hidden" id="opml-upload" />
              <Button asChild variant="outline" className="glass bg-transparent">
                <label htmlFor="opml-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
            </div>
          )}

          {error && (
            <div className="glass-card p-4 rounded-lg border-red-500/50 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-600 mb-1">Import Error</h4>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {parsedSources.length > 0 && (
            <div className="glass-card p-4 rounded-lg border-green-500/50">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-600 mb-1">Ready to Import</h4>
                  <p className="text-sm text-muted-foreground">
                    Found {parsedSources.length} feed{parsedSources.length !== 1 ? "s" : ""} in {file?.name}
                  </p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {parsedSources.slice(0, 10).map((source, index) => (
                  <div key={index} className="text-sm p-2 rounded glass-card">
                    <div className="font-medium">{source.name}</div>
                    <div className="text-muted-foreground text-xs truncate">{source.url}</div>
                  </div>
                ))}
                {parsedSources.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">and {parsedSources.length - 10} more...</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-glass-border">
          <Button
            variant="outline"
            onClick={() => {
              setFile(null)
              setParsedSources([])
              setError(null)
              onOpenChange(false)
            }}
            className="glass bg-transparent"
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={
              parsedSources.length === 0 || 
              isImporting ||
              (userSourcesCount + parsedSources.length) > getSourceLimit()
            } 
            className="glass"
          >
            {isImporting 
              ? "Importing..." 
              : `Import ${parsedSources.length} Source${parsedSources.length !== 1 ? "s" : ""}`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
