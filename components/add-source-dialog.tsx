"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Newspaper,
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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { sourceService } from "@/lib/services/source-service"

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSourceAdded?: () => void
}

type SourceType = "rss" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter" | "website"

const sourceTypes: {
  type: SourceType
  name: string
  icon: any
  description: string
  color: string
  examples: string[]
}[] = [
  {
    type: "rss",
    name: "RSS Feed",
    icon: Rss,
    description: "RSS feeds from news websites",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    examples: ["CNN", "BBC", "TechCrunch", "The Verge"],
  },
  {
    type: "youtube",
    name: "YouTube",
    icon: Youtube,
    description: "YouTube channels and playlists",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    examples: ["@vercel", "@fireship", "@3blue1brown"],
  },
  {
    type: "twitter",
    name: "Twitter",
    icon: Twitter,
    description: "Twitter profiles and lists",
    color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    examples: ["@elonmusk", "@vercel", "@tailwindcss"],
  },
  {
    type: "instagram",
    name: "Instagram",
    icon: Instagram,
    description: "Instagram profiles",
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    examples: ["@design", "@minimal", "@photography"],
  },
  {
    type: "tiktok",
    name: "TikTok",
    icon: Music2,
    description: "TikTok profiles",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    examples: ["@productivity", "@tech", "@design"],
  },
  {
    type: "newsletter",
    name: "Newsletter",
    icon: Mail,
    description: "Email newsletters",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    examples: ["Morning Brew", "The Hustle", "Design Weekly"],
  },
  {
    type: "website",
    name: "Website",
    icon: Globe,
    description: "Any website or blog",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    examples: ["Personal blogs", "Company blogs", "Documentation"],
  },
]

const urlPatterns = {
  youtube: [
    /(?:youtube\.com\/(?:channel\/|c\/|user\/|@))([\w-]+)/,
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
  ],
  instagram: [/(?:instagram\.com\/)([\w.]+)/, /(?:instagr\.am\/)([\w.]+)/],
  tiktok: [/(?:tiktok\.com\/@)([\w.]+)/, /(?:vm\.tiktok\.com\/)([\w]+)/],
  twitter: [/(?:twitter\.com\/)([\w]+)/, /(?:x\.com\/)([\w]+)/],
  rss: [/\.rss$/, /\.xml$/, /\/feed\/?$/, /\/rss\/?$/],
}

function detectSourceType(url: string): SourceType | null {
  const lowerUrl = url.toLowerCase()

  for (const [type, patterns] of Object.entries(urlPatterns)) {
    if (patterns.some((pattern) => pattern.test(lowerUrl))) {
      return type as SourceType
    }
  }

  // Default to website if no specific pattern matches
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return "website"
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

function extractSourceName(url: string, type: SourceType): string {
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
  const [url, setUrl] = useState("")
  const [selectedType, setSelectedType] = useState<SourceType | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlValidation, setUrlValidation] = useState<{ isValid: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    if (url) {
      setIsDetecting(true)
      const timer = setTimeout(() => {
        const validation = validateUrl(url)
        setUrlValidation(validation)

        if (validation.isValid) {
          const detectedType = detectSourceType(url)
          if (detectedType) {
            setSelectedType(detectedType)
            const suggestedName = extractSourceName(url, detectedType)
            if (suggestedName && !formData.name) {
              setFormData((prev) => ({ ...prev, name: suggestedName }))
            }
          }
        }
        setIsDetecting(false)
      }, 500)

      return () => clearTimeout(timer)
    } else {
      setUrlValidation(null)
      setSelectedType(null)
    }
  }, [url])

  const handleReset = () => {
    setUrl("")
    setSelectedType(null)
    setUrlValidation(null)
    setFormData({
      name: "",
      description: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !formData.name || !url || !urlValidation?.isValid) return

    setIsSubmitting(true)

    try {
      // Obtener favicon
      const faviconUrl = await fetchFaviconUrl(url)

      // Crear fuente en Supabase
      await sourceService.createSource({
        title: formData.name,
        url: url,
        description: formData.description || null,
        favicon_url: faviconUrl,
        source_type: selectedType,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-playfair">Add New Source</DialogTitle>
          <DialogDescription>
            Paste a link from YouTube, Instagram, TikTok, Twitter, RSS feeds, or any website
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url">Source URL *</Label>
            <div className="relative">
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/@vercel or https://example.com/feed"
                className="glass pr-10"
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
            <div className="glass-card p-4 rounded-lg border-2 border-primary/20">
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

          {url && urlValidation?.isValid && !selectedType && (
            <div className="space-y-3">
              <Label>Select Source Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sourceTypes.map((sourceType) => (
                  <Card
                    key={sourceType.type}
                    className="glass-card p-3 cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
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
            <div className="space-y-2 pt-4 border-t border-glass-border">
              <div className="space-y-2">
                <Label htmlFor="name">Source Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., TechCrunch, @vercel"
                  className="glass"
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
                  className="glass"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-glass-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="glass"
              disabled={isSubmitting}
            >
              Reset
            </Button>
            <Button
              type="submit"
              className="glass"
              disabled={!selectedType || !formData.name || !url || !urlValidation?.isValid || isSubmitting}
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
      </DialogContent>
    </Dialog>
  )
}