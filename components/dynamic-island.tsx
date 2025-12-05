"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  X, 
  Bookmark, 
  BookmarkCheck, 
  Share, 
  Download, 
  Maximize2,
  ExternalLink,
  Circle,
  Settings,
  Type,
  Palette,
  Sun,
  Moon,
  Minus,
  Plus,
  AlignLeft,
  Monitor,
  Loader2,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { FolderPicker } from "@/components/folder-picker"

interface DynamicIslandProps {
  onClose: () => void
  isSaved?: boolean
  onToggleArchive?: () => void | Promise<void>
  onSaveToFolder?: (folderId: string | null) => void | Promise<void>
  currentFolderId?: string | null
  savingToFolder?: boolean
  onDownload: () => void
  onShare: () => void
  onOpenInNewTab?: () => void
  onOpenOriginal: () => void
  isScrolling: boolean
  scrollProgress: number
  // Reading settings
  fontSize?: number
  setFontSize?: (size: number) => void
  fontFamily?: string
  setFontFamily?: (family: string) => void
  isDarkMode?: boolean
  setIsDarkMode?: (dark: boolean) => void
  backgroundColor?: string
  setBackgroundColor?: (color: string) => void
  textColor?: string
  setTextColor?: (color: string) => void
  lineHeight?: number
  setLineHeight?: (height: number) => void
  maxWidth?: number
  setMaxWidth?: (width: number) => void
  // Optional props for public pages
  hideCloseButton?: boolean
  shareUrl?: string
}

const backgroundPresets = [
  { name: "White", color: "#ffffff" },
  { name: "Cream", color: "#fefcf3" },
  { name: "Sepia", color: "#f4f1e8" },
  { name: "Light Gray", color: "#f8f9fa" },
  { name: "Warm White", color: "#fdf6e3" },
  { name: "Dark Gray", color: "#1f2937" },
  { name: "Black", color: "#000000" },
]

const textColorPresets = [
  { name: "Black", color: "#000000" },
  { name: "Dark Gray", color: "#374151" },
  { name: "Warm Black", color: "#1f2937" },
  { name: "Brown", color: "#92400e" },
  { name: "Blue Gray", color: "#475569" },
  { name: "Light Gray", color: "#d1d5db" },
  { name: "White", color: "#ffffff" },
]

export function DynamicIsland({
  onClose,
  isSaved = false,
  onToggleArchive,
  onSaveToFolder,
  currentFolderId = null,
  savingToFolder = false,
  onDownload,
  onShare,
  onOpenInNewTab,
  onOpenOriginal,
  isScrolling,
  scrollProgress,
  // Reading settings
  fontSize = 16,
  setFontSize,
  fontFamily = "inter",
  setFontFamily,
  isDarkMode = false,
  setIsDarkMode,
  backgroundColor = "#ffffff",
  setBackgroundColor,
  textColor = "#000000",
  setTextColor,
  lineHeight = 1.6,
  setLineHeight,
  maxWidth = 800,
  setMaxWidth,
  // Optional props
  hideCloseButton = false,
  shareUrl,
}: DynamicIslandProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)
  const islandRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Detectar si es dispositivo móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-collapse when scrolling
  useEffect(() => {
    if (isScrolling && isExpanded && !isSettingsOpen && !isFolderPickerOpen) {
      setIsExpanded(false)
    }
  }, [isScrolling, isExpanded, isSettingsOpen, isFolderPickerOpen])

  // En desktop, expandir con hover - con delay si está scrolling
  useEffect(() => {
    // Solo aplicar lógica de hover en desktop
    if (isMobile) return

    // Limpiar timeout anterior
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (isHovered) {
      // Si está scrolling, esperar 0.5s antes de expandir
      if (isScrolling) {
        hoverTimeoutRef.current = setTimeout(() => {
          setIsExpanded(true)
        }, 500)
      } else {
        // Si no está scrolling, expandir inmediatamente
        setIsExpanded(true)
      }
    } else if (!isSettingsOpen && !isFolderPickerOpen) {
      // Delay de 0.5s antes de contraer cuando se deja de hacer hover
      hoverTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false)
      }, 500)
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [isHovered, isMobile, isScrolling, isSettingsOpen, isFolderPickerOpen])

  // Cerrar al hacer clic fuera (solo si los popovers no están abiertos)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // No cerrar si hay un popover abierto
      if (isSettingsOpen || isFolderPickerOpen) return
      
      if (isExpanded && islandRef.current && !islandRef.current.contains(event.target as Node)) {
        // Verificar que el clic no sea en un drawer/popover
        const target = event.target as HTMLElement
        const isInDrawer = target.closest('[data-slot="drawer-content"]') || 
                          target.closest('[data-radix-popper-content-wrapper]') ||
                          target.closest('[role="dialog"]')
        if (!isInDrawer) {
          setIsExpanded(false)
        }
      }
    }

    // Usar timeout para evitar cerrar inmediatamente después de cerrar un picker
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, isSettingsOpen, isFolderPickerOpen])

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  // Determinar estado visual basado en scroll y hover
  // En móvil: la opacidad siempre debe ser 1 cuando está expandida o cuando se está interactuando
  // En desktop: normal hover behavior
  const shouldBeCompact = isScrolling && !isExpanded && !isHovered
  
  // En móvil, si está expandida O si no está scrolling, opacidad completa
  // Esto evita el doble clic: cuando no está scrolling y se toca, se expande inmediatamente
  const opacity = isMobile 
    ? (isExpanded || !isScrolling ? 1 : 0.4)
    : ((isScrolling && !isHovered && !isExpanded) ? 0.4 : 1)

  return (
    <motion.div
      className="fixed left-1/2 -translate-x-1/2 z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.1, 0.25, 1]
      }}
    >
      <motion.div
        ref={islandRef}
        className={`relative ${isMobile ? 'cursor-pointer' : ''}`}
        onHoverStart={() => !isMobile && setIsHovered(true)}
        onHoverEnd={() => !isMobile && setIsHovered(false)}
        onClick={isMobile ? toggleExpanded : undefined}
        animate={{
          opacity,
          scaleX: shouldBeCompact ? 0.95 : 1,
          scaleY: 1, // Siempre mantener la altura
        }}
        transition={{ 
          opacity: {
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
          },
          scaleX: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
          },
          scaleY: {
            duration: 0
          }
        }}
      >
        <motion.div
          className={`rounded-full flex items-center gap-2 shadow-2xl backdrop-blur-xl overflow-hidden relative ${
            isDarkMode 
              ? 'bg-zinc-900/90 border-2 border-zinc-700/50' 
              : 'glass-card'
          }`}
          style={{
            ...(isDarkMode ? {
              boxShadow: `0 0 6px rgba(59, 130, 246, 0.4), 0 0 20px rgba(0, 0, 0, 0.5)`,
              border: '2px solid transparent',
              backgroundImage: `
                linear-gradient(rgb(24, 24, 27), rgb(24, 24, 27)),
                conic-gradient(
                  from -90deg,
                  rgb(59, 130, 246) 0%,
                  rgb(59, 130, 246) ${scrollProgress}%,
                  rgba(100, 100, 120, 0.3) ${scrollProgress}%,
                  rgba(100, 100, 120, 0.3) 100%
                )
              `,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
            } : {
              border: '2px solid transparent',
              backgroundImage: `
                linear-gradient(#ffffff, #ffffff),
                conic-gradient(
                  from -90deg,
                  rgb(59, 130, 246) 0%,
                  rgb(59, 130, 246) ${scrollProgress}%,
                  rgba(148, 163, 184, 0.2) ${scrollProgress}%,
                  rgba(148, 163, 184, 0.2) 100%
                )
              `,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 0 6px rgba(59, 130, 246, 0.4)',
            }),
            maxWidth: isExpanded ? 'calc(100vw - 32px)' : '56px',
          }}
          animate={{
            width: isExpanded ? 'auto' : '56px',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '12px',
            paddingBottom: '12px',
          }}
          transition={{ 
            width: { 
              duration: 0.5,
              ease: [0.25, 0.1, 0.25, 1],
            },
            paddingLeft: {
              duration: 0.5,
              ease: [0.25, 0.1, 0.25, 1]
            },
            paddingRight: {
              duration: 0.5,
              ease: [0.25, 0.1, 0.25, 1]
            },
          }}
          layout
          layoutRoot
        >
          <AnimatePresence mode="popLayout">
            {isExpanded ? (
              <motion.div
                key="expanded"
                className={`flex items-center gap-2 max-w-full ${isDarkMode ? 'text-zinc-200' : 'text-zinc-700'}`}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1,
                }}
                exit={{ 
                  opacity: 0,
                }}
                transition={{ 
                  opacity: { 
                    duration: 0.3,
                    ease: [0.25, 0.1, 0.25, 1]
                  }
                }}
                layout
              >
                {/* Close button - only show if not hidden */}
                {!hideCloseButton && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                      }}
                      className="h-9 w-9 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    <div className={`w-px h-6 shrink-0 ${isDarkMode ? 'bg-zinc-600' : 'bg-border/50'}`} />
                  </>
                )}

                {/* Scrollable container for action buttons - only on mobile */}
                <div className="flex items-center gap-2 md:overflow-visible overflow-x-auto scrollbar-hide max-w-full">
                  {/* Action buttons */}
                  {isSaved ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleArchive?.()
                      }}
                      className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                      title="Quitar del archivo"
                    >
                      <BookmarkCheck className="h-4 w-4 text-primary" />
                    </Button>
                  ) : onSaveToFolder ? (
                    <FolderPicker
                      selectedFolderId={currentFolderId}
                      onSelect={onSaveToFolder}
                      onOpenChange={setIsFolderPickerOpen}
                      trigger={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          disabled={savingToFolder}
                          title="Guardar en carpeta"
                        >
                          {savingToFolder ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </Button>
                      }
                    />
                  ) : null}

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload()
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (shareUrl) {
                        // Use provided share URL
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: document.title,
                              text: '',
                              url: shareUrl,
                            })
                          } catch (err) {
                            // User cancelled or error occurred
                            console.log("Error sharing:", err)
                          }
                        } else {
                          // Fallback: copy to clipboard
                          try {
                            await navigator.clipboard.writeText(shareUrl)
                          } catch (err) {
                            console.error('Error copying to clipboard:', err)
                          }
                        }
                      } else {
                        // Use default share handler
                        onShare()
                      }
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title="Share"
                  >
                    <Share className="h-4 w-4" />
                  </Button>

                  {onOpenInNewTab && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenInNewTab()
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title="Open in new tab"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  )}

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenOriginal()
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title="Open original link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>

                  {/* Reading Settings */}
                  {setFontSize && (
                    <>
                      <div className={`w-px h-6 shrink-0 ${isDarkMode ? 'bg-zinc-600' : 'bg-border/50'}`} />
                      
                      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors  hover-lift-subtle shrink-0"
                            title="Reading settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      <PopoverContent 
                        className="w-80 glass-card" 
                        align="center" 
                        side="top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Reading Settings</h3>
                            {setIsDarkMode && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsDarkMode(!isDarkMode)} 
                                className="h-8 w-8 p-0"
                              >
                                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>

                          {/* Font Size */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium flex items-center gap-2">
                                <Type className="h-4 w-4" />
                                Font Size
                              </label>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                                  className="h-6 w-6 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm w-8 text-center">{fontSize}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <Slider
                              value={[fontSize]}
                              onValueChange={(value) => setFontSize(value[0])}
                              min={12}
                              max={24}
                              step={1}
                              className="w-full"
                            />
                          </div>

                          {/* Font Family */}
                          {setFontFamily && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Font Family</label>
                              <Select value={fontFamily} onValueChange={setFontFamily}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inter">Inter (Sans-serif)</SelectItem>
                                  <SelectItem value="playfair">Playfair Display (Serif)</SelectItem>
                                  <SelectItem value="mono">Monospace</SelectItem>
                                  <SelectItem value="serif">System Serif</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Line Height */}
                          {setLineHeight && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <AlignLeft className="h-4 w-4" />
                                  Line Height
                                </label>
                                <span className="text-sm">{lineHeight.toFixed(1)}</span>
                              </div>
                              <Slider
                                value={[lineHeight]}
                                onValueChange={(value) => setLineHeight(value[0])}
                                min={1.2}
                                max={2.0}
                                step={0.1}
                                className="w-full"
                              />
                            </div>
                          )}

                          {/* Max Width */}
                          {setMaxWidth && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <Monitor className="h-4 w-4" />
                                  Content Width
                                </label>
                                <span className="text-sm">{maxWidth}px</span>
                              </div>
                              <Slider
                                value={[maxWidth]}
                                onValueChange={(value) => setMaxWidth(value[0])}
                                min={600}
                                max={1200}
                                step={50}
                                className="w-full"
                              />
                            </div>
                          )}

                          {!isDarkMode && setBackgroundColor && setTextColor && (
                            <>
                              {/* Background Color */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <Palette className="h-4 w-4" />
                                  Background
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                  {backgroundPresets.map((preset) => (
                                    <button
                                      key={preset.name}
                                      className={`w-8 h-8 rounded border-2 transition-all ${
                                        backgroundColor === preset.color
                                          ? "border-primary scale-110"
                                          : "border-border hover:scale-105"
                                      }`}
                                      style={{ backgroundColor: preset.color }}
                                      onClick={() => setBackgroundColor(preset.color)}
                                      title={preset.name}
                                    />
                                  ))}
                                </div>
                                <input
                                  type="color"
                                  value={backgroundColor}
                                  onChange={(e) => setBackgroundColor(e.target.value)}
                                  className="w-full h-8 rounded border border-border cursor-pointer"
                                />
                              </div>

                              {/* Text Color */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Text Color</label>
                                <div className="grid grid-cols-5 gap-2">
                                  {textColorPresets.map((preset) => (
                                    <button
                                      key={preset.name}
                                      className={`w-8 h-8 rounded border-2 transition-all ${
                                        textColor === preset.color ? "border-primary scale-110" : "border-border hover:scale-105"
                                      }`}
                                      style={{ backgroundColor: preset.color }}
                                      onClick={() => setTextColor(preset.color)}
                                      title={preset.name}
                                    />
                                  ))}
                                </div>
                                <input
                                  type="color"
                                  value={textColor}
                                  onChange={(e) => setTextColor(e.target.value)}
                                  className="w-full h-8 rounded border border-border cursor-pointer"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                className="flex items-center justify-center w-full"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: {
                    duration: 0.3,
                    ease: [0.25, 0.1, 0.25, 1]
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.8,
                  transition: {
                    duration: 0.2,
                    ease: [0.25, 0.1, 0.25, 1]
                  }
                }}
              >
                {/* Solo mostrar círculo en estado contraído */}
                <Circle className={`h-5 w-5 ${isDarkMode ? 'text-zinc-300' : 'text-zinc-600'}`} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
