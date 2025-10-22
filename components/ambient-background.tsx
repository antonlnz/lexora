"use client"

import { useEffect, useState, useRef } from "react"

interface AmbientBackgroundProps {
  imageUrl: string
  isActive: boolean
  intensity?: number
}

export function AmbientBackground({ imageUrl, isActive, intensity = 0.3 }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dominantColors, setDominantColors] = useState<string[]>([])

  useEffect(() => {
    const extractColors = async () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
          canvas.width = 100
          canvas.height = 100
          ctx.drawImage(img, 0, 0, 100, 100)

          const imageData = ctx.getImageData(0, 0, 100, 100)
          const colors = extractDominantColors(imageData.data)
          setDominantColors(colors)
        }

        img.src = imageUrl
      } catch (error) {
        console.log("Error extracting colors:", error)
      }
    }

    extractColors()
  }, [imageUrl])

  const extractDominantColors = (data: Uint8ClampedArray): string[] => {
    const colorMap = new Map<string, number>()

    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const alpha = data[i + 3]

      if (alpha < 128) continue // Skip transparent pixels

      // Group similar colors
      const groupedR = Math.floor(r / 32) * 32
      const groupedG = Math.floor(g / 32) * 32
      const groupedB = Math.floor(b / 32) * 32

      const colorKey = `${groupedR},${groupedG},${groupedB}`
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
    }

    // Get top 3 most frequent colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => {
        const [r, g, b] = color.split(",").map(Number)
        return `rgb(${r}, ${g}, ${b})`
      })

    return sortedColors
  }

  if (!isActive || dominantColors.length === 0) {
    return null
  }

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000 z-0"
        style={{
          background: `
            radial-gradient(circle at 20% 80%, ${dominantColors[0]}${Math.floor(intensity * 255)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${dominantColors[1] || dominantColors[0]}${Math.floor(intensity * 255)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, ${dominantColors[2] || dominantColors[0]}${Math.floor(intensity * 255)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 50%)
          `,
          opacity: isActive ? 1 : 0,
        }}
      />

      {/* Animated color blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {dominantColors.slice(0, 3).map((color, index) => (
          <div
            key={index}
            className="absolute rounded-full blur-3xl animate-pulse"
            style={{
              backgroundColor: color,
              opacity: intensity * 0.5,
              width: "300px",
              height: "300px",
              left: `${20 + index * 30}%`,
              top: `${20 + index * 20}%`,
              animationDelay: `${index * 2}s`,
              animationDuration: `${8 + index * 2}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}
