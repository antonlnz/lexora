"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Youtube,
  Twitter,
  Instagram,
  Music2,
  Mail,
  Rss,
  Globe,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Headphones,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { sourceService } from "@/lib/services/source-service"
import { useSubscription } from "@/contexts/subscription-context"
import { useIsMobile } from "@/hooks/use-mobile"
import type { SourceType } from "@/types/database"
import { 
  detectSourceType as detectSourceTypeFromUrl, 
  getYoutubeRssFeedUrl,
  isValidRssFeed,
} from "@/lib/source-handlers/client"

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSourceAdded?: () => void
}

// UI display types (simplified for user)
type UISourceType = "rss" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter" | "website" | "podcast"

// Map UI types to database types
function mapUITypeToDBType(uiType: UISourceType, url: string): SourceType {
  switch (uiType) {
    case "youtube":
      // Detect if it's a channel or video
      if (url.includes('/watch?v=') || url.includes('youtu.be/') || url.includes('youtube.com')) {
        return 'youtube_video'
      }
      return 'youtube_channel'
    case "podcast":
      return 'podcast'
    default:
      return uiType as SourceType
  }
}

const sourceTypes: {
  type: UISourceType
  name: string
  icon: any
  description: string
  color: string
}[] = [
  {
    type: "rss",
    name: "RSS Feed",
    icon: Rss,
    description: "RSS feeds from news websites",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  {
    type: "youtube",
    name: "YouTube",
    icon: Youtube,
    description: "YouTube channels and playlists",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  {
    type: "podcast",
    name: "Podcast",
    icon: Headphones,
    description: "Podcasts and audio feeds",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
  {
    type: "twitter",
    name: "Twitter",
    icon: Twitter,
    description: "Twitter profiles and lists",
    color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  },
  {
    type: "instagram",
    name: "Instagram",
    icon: Instagram,
    description: "Instagram profiles",
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  },
  {
    type: "tiktok",
    name: "TikTok",
    icon: Music2,
    description: "TikTok profiles",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  {
    type: "newsletter",
    name: "Newsletter",
    icon: Mail,
    description: "Email newsletters",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  {
    type: "website",
    name: "Website",
    icon: Globe,
    description: "Any website or blog",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
]

const urlPatterns = {
  youtube: [
    /(?:youtube\.com\/(?:channel\/|c\/|user\/|@))([\w-]+)/,
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /\/feeds\/videos\.xml.*[?&]channel_id=([A-Za-z0-9_-]+)/,
  ],
  instagram: [/(?:instagram\.com\/)([\w.]+)/, /(?:instagr\.am\/)([\w.]+)/],
  tiktok: [/(?:tiktok\.com\/@)([\w.]+)/, /(?:vm\.tiktok\.com\/)([\w]+)/],
  twitter: [/(?:twitter\.com\/)([\w]+)/, /(?:x\.com\/)([\w]+)/],
  rss: [/\.rss$/, /\.xml$/, /\/feed\/?$/, /\/rss\/?$/],
  podcast: [/podcast/i, /feeds\.feedburner\.com/, /anchor\.fm/],
}

/**
 * Detecta el tipo de fuente a partir de una URL (versión UI simplificada)
 * Para detección avanzada, el sistema usa detectSourceTypeFromUrl del sistema de handlers
 */
function detectUISourceType(url: string): UISourceType | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = (u.pathname + (u.search || '')).toLowerCase()

    // YouTube / youtu.be -> devolver "youtube" siempre para que el UI marque YouTube
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'

    // Comprobar patrones conocidos para otras redes
    for (const [type, patterns] of Object.entries(urlPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(host + path)) return type as UISourceType
      }
    }

    // Si es URL válida, considerarla website
    if (u.protocol === 'http:' || u.protocol === 'https:') return 'website'
  } catch {
    // invalid URL -> no detectar
  }
  return null
}

function validateUrl(url: string): { isValid: boolean; message: string } {
  if (!url) {
    return { isValid: false, message: "URL is required" }
  }

  try {
    new URL(url)
    return { isValid: true, message: "Valid URL" }
  } catch {
    return { isValid: false, message: "Please enter a valid URL" }
  }
}

/**
 * Normaliza una URL para comparación (elimina trailing slashes, www, etc.)
 */
function normalizeUrlForComparison(url: string): string {
  try {
    const u = new URL(url)
    // Normalizar: eliminar www, trailing slash, lowercase
    let normalized = u.hostname.replace(/^www\./, '').toLowerCase()
    normalized += u.pathname.replace(/\/$/, '').toLowerCase()
    // Para YouTube RSS feeds, extraer el channel_id como clave única
    if (u.hostname.includes('youtube.com') && u.pathname.includes('/feeds/videos.xml')) {
      const channelId = u.searchParams.get('channel_id')
      if (channelId) {
        return `youtube:${channelId}`
      }
    }
    return normalized
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Verifica si una URL ya existe en la lista de fuentes del usuario
 */
function checkDuplicate(url: string, existingSources: string[]): string | null {
  const normalized = normalizeUrlForComparison(url)
  const isDuplicate = existingSources.some(existing => {
    // Comparación exacta
    if (existing === normalized) return true
    // Para YouTube, también comparar por channel ID si ambas son del mismo canal
    if (normalized.startsWith('youtube:') && existing.startsWith('youtube:')) {
      return normalized === existing
    }
    return false
  })
  
  return isDuplicate ? "Esta fuente ya está en tu lista" : null
}

function extractSourceName(url: string, type: UISourceType): string {
  try {
    const urlObj = new URL(url)

    switch (type) {
      case "youtube":
        const ytMatch = url.match(/(?:@|\/c\/|\/user\/|\/channel\/)([\w-]+)/)
        return ytMatch ? ytMatch[1] : urlObj.hostname

      case "instagram":
      case "tiktok":
      case "twitter":
        const socialMatch = url.match(/(?:@|\/)([\w.]+)/)
        return socialMatch ? `@${socialMatch[1]}` : urlObj.hostname

      default:
        return urlObj.hostname.replace("www.", "")
    }
  } catch {
    return ""
  }
}

async function fetchFaviconUrl(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.origin
    
    // Intentar con Google Favicon Service
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  } catch {
    return null
  }
}

export function AddSourceDialog({ open, onOpenChange, onSourceAdded }: AddSourceDialogProps) {
  const { canAddSource, getSourceLimit, currentPlan } = useSubscription()
  const isMobile = useIsMobile()
  const [url, setUrl] = useState("")
  const [selectedType, setSelectedType] = useState<UISourceType | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlValidation, setUrlValidation] = useState<{ isValid: boolean; message: string } | null>(null)
  const [detectedFaviconUrl, setDetectedFaviconUrl] = useState<string | null>(null)
  const [redirectWarning, setRedirectWarning] = useState<{
    wasRedirected: boolean
    originalHandle: string | null
    finalHandle: string | null
  } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [userSourcesCount, setUserSourcesCount] = useState(0)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [existingSources, setExistingSources] = useState<string[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // Cargar el número actual de fuentes cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setIsLoadingSources(true)
      sourceService.getUserSources()
        .then(sources => {
          setUserSourcesCount(sources.length)
          // Guardar las URLs de fuentes existentes para detectar duplicados
          setExistingSources(sources.map(s => normalizeUrlForComparison(s.url)))
        })
        .catch(error => {
          console.error("Error loading sources count:", error)
        })
        .finally(() => {
          setIsLoadingSources(false)
        })
    }
  }, [open])

  useEffect(() => {
    if (url) {
      setIsDetecting(true)
      setDuplicateWarning(null)
      const timer = setTimeout(async () => {
        const validation = validateUrl(url)
        setUrlValidation(validation)

        if (validation.isValid) {
          // Verificar duplicados primero
          const duplicate = checkDuplicate(url, existingSources)
          if (duplicate) {
            setDuplicateWarning(duplicate)
          }

          // Detectar tipo de forma más inteligente
          let detectedType = detectUISourceType(url)
          
          // Para URLs que parecen websites, verificar si realmente son RSS
          if (detectedType === 'website' || detectedType === null) {
            try {
              const rssCheck = await isValidRssFeed(url)
              if (rssCheck.isRss) {
                detectedType = rssCheck.isPodcast ? 'podcast' : 'rss'
                // Usar el título del feed si está disponible
                if (rssCheck.title) {
                  setFormData((prev) => ({ 
                    ...prev, 
                    name: rssCheck.title!,
                    description: rssCheck.description || prev.description 
                  }))
                }
              }
            } catch (error) {
              console.error('Error checking RSS:', error)
            }
          }
          
          if (detectedType) {
            setSelectedType(detectedType)
            
            // Para YouTube, usar la detección asíncrona que obtiene el nombre real del canal
            if (detectedType === 'youtube') {
              try {
                const result = await detectSourceTypeFromUrl(url)
                if (result.suggestedTitle) {
                  // Siempre actualizar el nombre cuando cambia la URL
                  setFormData((prev) => ({ 
                    ...prev, 
                    name: result.suggestedTitle!,
                    // También actualizar la descripción si existe
                    description: result.suggestedDescription || prev.description 
                  }))
                }
                // Guardar el favicon/avatar del canal si existe
                if (result.faviconUrl) {
                  setDetectedFaviconUrl(result.faviconUrl)
                } else {
                  setDetectedFaviconUrl(null)
                }
                // Verificar si hubo redirección (handle secundario)
                if (result.wasRedirected) {
                  setRedirectWarning({
                    wasRedirected: true,
                    originalHandle: result.originalHandle || null,
                    finalHandle: result.finalHandle || null,
                  })
                } else {
                  setRedirectWarning(null)
                }
                
                // Re-verificar duplicado con el RSS feed resuelto
                const rssFeedUrl = await getYoutubeRssFeedUrl(url)
                if (rssFeedUrl) {
                  const duplicateRss = checkDuplicate(rssFeedUrl, existingSources)
                  if (duplicateRss) {
                    setDuplicateWarning(duplicateRss)
                  }
                }
              } catch (error) {
                console.error('Error detecting YouTube channel name:', error)
                // Fallback al nombre extraído de la URL
                const suggestedName = extractSourceName(url, detectedType)
                if (suggestedName) {
                  setFormData((prev) => ({ ...prev, name: suggestedName }))
                }
                setDetectedFaviconUrl(null)
                setRedirectWarning(null)
              }
            } else if (detectedType !== 'rss' && detectedType !== 'podcast') {
              // Para otros tipos (no RSS/podcast que ya se manejaron arriba)
              const suggestedName = extractSourceName(url, detectedType)
              if (suggestedName && !formData.name) {
                setFormData((prev) => ({ ...prev, name: suggestedName }))
              }
              setRedirectWarning(null)
            }
          }
        }
        setIsDetecting(false)
      }, 500)

      return () => clearTimeout(timer)
    } else {
      setUrlValidation(null)
      setSelectedType(null)
      setDetectedFaviconUrl(null)
      setRedirectWarning(null)
      setDuplicateWarning(null)
      // Limpiar el nombre cuando se borra la URL
      setFormData((prev) => ({ ...prev, name: "" }))
    }
  }, [url, existingSources])

  const handleReset = () => {
    setUrl("")
    setSelectedType(null)
    setUrlValidation(null)
    setDetectedFaviconUrl(null)
    setRedirectWarning(null)
    setDuplicateWarning(null)
    setFormData({
      name: "",
      description: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !formData.name || !url || !urlValidation?.isValid) return

    // Verificar límite del plan antes de añadir
    if (!canAddSource(userSourcesCount)) {
      const sourceLimit = getSourceLimit()
      toast.error("Límite de fuentes alcanzado", {
        description: `Has alcanzado el límite de ${sourceLimit} fuentes para tu plan ${currentPlan}. Actualiza tu plan para añadir más fuentes.`,
      })
      return
    }

    setIsSubmitting(true)

    try {
      let urlToSave = url
      if (selectedType === "youtube") {
        const rss = await getYoutubeRssFeedUrl(url)
        console.log("Resolved YouTube RSS URL:", rss)
        if (rss) {
          urlToSave = rss
        } else {
          // si no se pudo resolver en cliente, opcional: llamar a un endpoint server-side
        }
      }

      // Obtener favicon - usar el detectado para YouTube, o Google Favicon Service para otros
      const faviconUrl = detectedFaviconUrl || await fetchFaviconUrl(url)

      // Map UI type to database type
      const dbType = mapUITypeToDBType(selectedType, url)

      // Crear o suscribirse a fuente en Supabase
      // Usar urlToSave (URL transformada para YouTube) en lugar de url original
      await sourceService.createOrSubscribeToSource({
        title: formData.name,
        url: urlToSave,
        description: formData.description || null,
        favicon_url: faviconUrl,
        source_type: dbType,
      })

      // Mostrar toast de éxito
      toast.success("Fuente añadida", {
        description: `${formData.name} ha sido añadida exitosamente`,
      })

      // Resetear formulario
      handleReset()

      // Cerrar diálogo
      onOpenChange(false)

      // Notificar al padre para actualizar la lista
      if (onSourceAdded) {
        onSourceAdded()
      }
    } catch (error: any) {
      console.error("Error adding source:", error)
      
      // Mostrar error específico
      if (error.message?.includes('duplicate')) {
        toast.error("Fuente duplicada", {
          description: "Esta fuente ya existe en tu lista",
        })
      } else {
        toast.error("Error al añadir fuente", {
          description: error.message || "No se pudo añadir la fuente. Intenta de nuevo.",
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Componente de contenido reutilizable memoizado para evitar re-creaciones
  const formContent = useMemo(() => (
    <>
      {/* Advertencia de límite */}
      {!isLoadingSources && (() => {
        const sourceLimit = getSourceLimit()
        const isAtLimit = userSourcesCount >= sourceLimit
        const isNearLimit = userSourcesCount >= sourceLimit * 0.8 && !isAtLimit
        
        if (isAtLimit || isNearLimit) {
          return (
            <div className={`p-4 rounded-lg border-2 ${
              isAtLimit ? 'border-red-500/50 bg-red-500/10' : 'border-amber-500/50 bg-amber-500/10'
            }`}>
              <div className="flex items-start gap-3 ">
                <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${
                  isAtLimit ? 'text-red-600' : 'text-amber-600'
                }`} />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">
                    {isAtLimit ? 'Source Limit Reached' : 'Near Source Limit'}
                  </h3>
                    <p className="text-sm text-muted-foreground">
                    {isAtLimit 
                      ? `You've reached your limit of ${sourceLimit} sources for the ${currentPlan} plan. Upgrade to add more sources.`
                      : `You're using ${userSourcesCount} of ${sourceLimit} sources (${currentPlan} plan).`
                    }
                  </p>
                </div>
              </div>
            </div>
          )
        }
        return null
      })()}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="url">Source URL *</Label>
          <div className="relative">
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/@vercel or https://example.com/feed"
              className="bg-white dark:bg-gray-900 pr-10"
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isDetecting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!isDetecting && urlValidation?.isValid && <CheckCircle className="h-4 w-4 text-green-600" />}
              {!isDetecting && urlValidation && !urlValidation.isValid && (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
          </div>
          {urlValidation && (
            <p className={`text-sm ${urlValidation.isValid ? "text-green-600" : "text-red-600"}`}>
              {urlValidation.message}
            </p>
          )}
        </div>

        {selectedType && (
          <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3">
              {(() => {
                const sourceType = sourceTypes.find((s) => s.type === selectedType)!
                return (
                  <>
                    <div className={`p-2 rounded-lg ${sourceType.color}`}>
                      <sourceType.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{sourceType.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          Auto-detected
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{sourceType.description}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                      Change
                    </Button>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Advertencia de fuente duplicada */}
        {duplicateWarning && (
          <div className="p-4 rounded-lg border-2 border-red-500/50 bg-red-500/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-red-800 dark:text-red-200">
                  Fuente duplicada
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {duplicateWarning}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Advertencia de redirección de canal de YouTube */}
        {redirectWarning?.wasRedirected && (
          <div className="p-4 rounded-lg border-2 border-amber-500/50 bg-amber-500/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-amber-800 dark:text-amber-200">
                  Secondary Channel Handle Detected
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The handle <strong>@{redirectWarning.originalHandle}</strong> redirects to the main channel <strong>@{redirectWarning.finalHandle}</strong>. 
                  YouTube doesn&apos;t allow subscribing to secondary handles separately - all videos will come from the main channel.
                </p>
              </div>
            </div>
          </div>
        )}

        {url && urlValidation?.isValid && !selectedType && (
          <div className="space-y-3">
            <Label>Select Source Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sourceTypes.map((sourceType) => (
                <Card
                  key={sourceType.type}
                  className="p-3 cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 bg-white dark:bg-gray-900"
                  onClick={() => setSelectedType(sourceType.type)}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`p-2 rounded-lg ${sourceType.color}`}>
                      <sourceType.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{sourceType.name}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedType && urlValidation?.isValid && (
          <div className="space-y-2 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="name">Source Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., TechCrunch, @vercel"
                className="bg-white dark:bg-gray-900"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this source"
                className="bg-white dark:bg-gray-900"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={
              !selectedType || 
              !formData.name || 
              !url || 
              !urlValidation?.isValid || 
              isSubmitting || 
              !canAddSource(userSourcesCount) ||
              !!duplicateWarning
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  ), [
    isLoadingSources,
    userSourcesCount,
    getSourceLimit,
    currentPlan,
    url,
    urlValidation,
    selectedType,
    isDetecting,
    formData,
    isSubmitting,
    canAddSource,
    handleSubmit,
    handleReset,
    setUrl,
    setSelectedType,
    setFormData,
    redirectWarning,
  ])

  // Renderizar Sheet en mobile, Dialog en desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto bg-white dark:bg-gray-950 p-0 rounded-t-2xl">
          {/* Barra de arrastre visual */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
          </div>
          
          <div className="sticky top-0 bg-white dark:bg-gray-950 border-b z-10 px-6 py-4">
            <SheetHeader>
              <SheetTitle className="text-2xl font-playfair">Add New Source</SheetTitle>
              <SheetDescription>
                Paste a link from YouTube, Instagram, TikTok, Twitter, RSS feeds, or any website
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="px-6 py-6">
            {formContent}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-950">
        <DialogHeader>
          <DialogTitle className="text-2xl font-playfair">Add New Source</DialogTitle>
          <DialogDescription>
            Paste a link from YouTube, Instagram, TikTok, Twitter, RSS feeds, or any website
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
