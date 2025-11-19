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
  Play,
  Pause,
  Volume2,
  VolumeX,
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
} from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface DynamicIslandProps {
  onClose: () => void
  isSaved: boolean
  onSave: () => void
  onDownload: () => void
  onShare: () => void
  onOpenInNewTab: () => void
  onOpenOriginal: () => void
  isMultimedia?: boolean
  isPlaying?: boolean
  isMuted?: boolean
  onTogglePlayback?: () => void
  onToggleMute?: () => void
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
}

const backgroundPresets = [
  { name: "White", color: "#ffffff" },
  { name: "Cream", color: "#fefcf3" },
  { name: "Sepia", color: "#f4f1e8" },
  { name: "Light Gray", color: "#f8f9fa" },
  { name: "Warm White", color: "#fdf6e3" },
]

const textColorPresets = [
  { name: "Black", color: "#000000" },
  { name: "Dark Gray", color: "#374151" },
  { name: "Warm Black", color: "#1f2937" },
  { name: "Brown", color: "#92400e" },
  { name: "Blue Gray", color: "#475569" },
]

export function DynamicIsland({
  onClose,
  isSaved,
  onSave,
  onDownload,
  onShare,
  onOpenInNewTab,
  onOpenOriginal,
  isMultimedia = false,
  isPlaying = false,
  isMuted = false,
  onTogglePlayback,
  onToggleMute,
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
}: DynamicIslandProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
    if (isScrolling && isExpanded && !isSettingsOpen) {
      setIsExpanded(false)
    }
  }, [isScrolling, isExpanded, isSettingsOpen])

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
    } else if (!isSettingsOpen) {
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
  }, [isHovered, isMobile, isScrolling, isSettingsOpen])

  // Cerrar al hacer clic fuera (solo si el popover no está abierto)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && !isSettingsOpen && islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, isSettingsOpen])

  const toggleExpanded = () => {
    // En móvil, siempre expandir/contraer al hacer clic
    if (isMobile) {
      setIsExpanded(!isExpanded)
    }
  }

  // Determinar estado visual basado en scroll y hover
  // En móvil: si está expandida, siempre opaca. Si no, depende del scroll.
  // En desktop: normal hover behavior
  const shouldBeCompact = isScrolling && !isExpanded && !isHovered
  const opacity = isMobile 
    ? (isExpanded ? 1 : (isScrolling ? 0.4 : 1))
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
        className="relative"
        onHoverStart={() => !isMobile && setIsHovered(true)}
        onHoverEnd={() => !isMobile && setIsHovered(false)}
        onClick={toggleExpanded}
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
          className="glass-card rounded-full flex items-center gap-2 shadow-2xl backdrop-blur-xl cursor-pointer overflow-hidden relative"
          style={{
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
                className="flex items-center gap-2 max-w-full"
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
                {/* Close button always first - fixed, no scroll */}
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

                <div className="w-px h-6 bg-border/50 shrink-0" />

                {/* Scrollable container for action buttons - only on mobile */}
                <div className="flex items-center gap-2 md:overflow-visible overflow-x-auto scrollbar-hide max-w-full">
                  {/* Multimedia controls */}
                  {isMultimedia && onTogglePlayback && onToggleMute && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          onTogglePlayback()
                        }}
                        className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleMute()
                        }}
                        className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>

                      <div className="w-px h-6 bg-border/50 shrink-0" />
                    </>
                  )}

                  {/* Action buttons */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onSave()
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title={isSaved ? "Unsave" : "Save"}
                  >
                    {isSaved ? (
                      <BookmarkCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>

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
                    onClick={(e) => {
                      e.stopPropagation()
                      onShare()
                    }}
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 transition-colors hover-lift-subtle shrink-0"
                    title="Share"
                  >
                    <Share className="h-4 w-4" />
                  </Button>

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
                      <div className="w-px h-6 bg-border/50 shrink-0" />
                      
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
                <Circle className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Subtle hint animation when first shown - solo en móvil */}
        {isMobile && !isExpanded && !shouldBeCompact && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full whitespace-nowrap pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              y: [10, 0, 0, -5]
            }}
            transition={{ 
              duration: 3, 
              times: [0, 0.1, 0.9, 1], 
              delay: 0.5,
              ease: [0.32, 0.72, 0, 1]
            }}
          >
            Tap to expand
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
