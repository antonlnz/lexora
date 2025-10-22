"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Settings, Type, Palette, Sun, Moon, Minus, Plus, AlignLeft, Monitor } from "lucide-react"

interface ReadingControlsProps {
  fontSize: number
  setFontSize: (size: number) => void
  fontFamily: string
  setFontFamily: (family: string) => void
  isDarkMode: boolean
  setIsDarkMode: (dark: boolean) => void
  backgroundColor: string
  setBackgroundColor: (color: string) => void
  textColor: string
  setTextColor: (color: string) => void
  lineHeight: number
  setLineHeight: (height: number) => void
  maxWidth: number
  setMaxWidth: (width: number) => void
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

export function ReadingControls({
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  isDarkMode,
  setIsDarkMode,
  backgroundColor,
  setBackgroundColor,
  textColor,
  setTextColor,
  lineHeight,
  setLineHeight,
  maxWidth,
  setMaxWidth,
}: ReadingControlsProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button size="lg" className="rounded-full shadow-lg glass-card">
            <Settings className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 glass-card" align="end">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Reading Settings</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsDarkMode(!isDarkMode)} className="h-8 w-8 p-0">
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
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

            {/* Line Height */}
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

            {/* Max Width */}
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

            {!isDarkMode && (
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
    </div>
  )
}
