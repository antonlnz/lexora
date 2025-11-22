"use client"

import { useEffect, useState, useRef } from "react"

interface VideoAmbientBackgroundProps {
  videoElement: HTMLVideoElement | null
  isPlaying: boolean
  intensity?: number
  updateInterval?: number // Intervalo en ms para actualizar colores
}

export function VideoAmbientBackground({ 
  videoElement, 
  isPlaying, 
  intensity = 0.9,
  updateInterval = 500 
}: VideoAmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dominantColors, setDominantColors] = useState<string[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!videoElement) {
      setDominantColors([])
      return
    }

    const extractColors = () => {
      try {
        const canvas = canvasRef.current
        if (!canvas || !videoElement) {
          return
        }

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
          return
        }

        // Asegurar que el video esté cargado y tenga dimensiones válidas
        if (videoElement.readyState < 2) {
          return
        }
        
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          return
        }

        // Redimensionar canvas para análisis (más pequeño = más rápido)
        const sampleSize = 100
        canvas.width = sampleSize
        canvas.height = sampleSize

        // Dibujar el frame actual del video en el canvas
        ctx.drawImage(
          videoElement,
          0,
          0,
          videoElement.videoWidth,
          videoElement.videoHeight,
          0,
          0,
          sampleSize,
          sampleSize
        )

        // Extraer datos de píxeles
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const colors = extractDominantColors(imageData.data)
        if (colors.length > 0) {
          setDominantColors(colors)
        }
      } catch (error) {
        // Silenciar errores de CORS u otros problemas
        console.log("VideoAmbient: Could not extract colors (may be CORS issue):", error)
      }
    }

    // Función para actualizar colores periódicamente
    const scheduleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      if (isPlaying && videoElement && !videoElement.paused) {
        extractColors()
        updateTimeoutRef.current = setTimeout(() => {
          scheduleUpdate()
        }, updateInterval)
      }
    }

    // Esperar a que el video esté listo antes de empezar
    const handleCanPlay = () => {
      if (isPlaying) {
        scheduleUpdate()
      }
    }

    const handlePlay = () => {
      scheduleUpdate()
    }

    const handleTimeUpdate = () => {
      if (isPlaying && videoElement && !videoElement.paused) {
        extractColors()
      }
    }

    // Iniciar si ya está reproduciéndose
    if (isPlaying && videoElement.readyState >= 2) {
      scheduleUpdate()
    }

    videoElement.addEventListener("canplay", handleCanPlay)
    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("timeupdate", handleTimeUpdate)

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      videoElement.removeEventListener("canplay", handleCanPlay)
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
    }
  }, [videoElement, isPlaying, updateInterval])

  const extractDominantColors = (data: Uint8ClampedArray): string[] => {
    const colorMap = new Map<string, number>()

    // Muestrear píxeles para rendimiento (cada 8 píxeles)
    for (let i = 0; i < data.length; i += 32) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const alpha = data[i + 3]

      if (alpha < 128) continue // Saltar píxeles transparentes

      // Agrupar colores similares para reducir ruido
      const groupedR = Math.floor(r / 32) * 32
      const groupedG = Math.floor(g / 32) * 32
      const groupedB = Math.floor(b / 32) * 32

      const colorKey = `${groupedR},${groupedG},${groupedB}`
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
    }

    // Obtener los 3 colores más frecuentes
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => {
        const [r, g, b] = color.split(",").map(Number)
        return `rgb(${r}, ${g}, ${b})`
      })

    // Si no hay suficientes colores, usar un color por defecto
    while (sortedColors.length < 3) {
      sortedColors.push(sortedColors[0] || "rgb(128, 128, 128)")
    }

    return sortedColors
  }

  // Convertir intensidad a opacidad hexadecimal
  const opacityHex = Math.floor(intensity * 255)
    .toString(16)
    .padStart(2, "0")

  // Si no hay colores aún, no mostrar nada (esperar a que se extraigan)
  if (dominantColors.length === 0 && isPlaying) {
    // Mostrar un placeholder sutil mientras se cargan los colores
    return (
      <>
        <canvas ref={canvasRef} className="hidden" />
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(128, 128, 128, 0.1) 0%, transparent 70%)`,
            opacity: 0.3,
            zIndex: 1,
          }}
        />
      </>
    )
  }

  if (dominantColors.length === 0) {
    return <canvas ref={canvasRef} className="hidden" />
  }

  const colorsToUse = dominantColors

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Aura base con gradientes radiales que emanan desde el centro hacia los bordes */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, ${colorsToUse[0]}${opacityHex} 0%, transparent 50%),
            radial-gradient(ellipse 50% 80% at 100% 50%, ${colorsToUse[1] || colorsToUse[0]}${opacityHex} 0%, transparent 50%),
            radial-gradient(ellipse 80% 50% at 50% 100%, ${colorsToUse[2] || colorsToUse[0]}${opacityHex} 0%, transparent 50%),
            radial-gradient(ellipse 50% 80% at 0% 50%, ${colorsToUse[0]}${opacityHex} 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, ${colorsToUse[1] || colorsToUse[0]}${Math.floor(intensity * 0.2 * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)
          `,
          opacity: isPlaying ? 1 : 0,
          zIndex: 1,
        }}
      />

      {/* Blobs animados con los colores extraídos - posicionados alrededor del área del video */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        {colorsToUse.slice(0, 3).map((color, index) => {
          // Posiciones que rodean el área central donde típicamente está el video
          const positions = [
            { left: "20%", top: "15%" },
            { left: "80%", top: "50%" },
            { left: "50%", top: "85%" },
          ]
          const pos = positions[index] || positions[0]
          
          const baseOpacity = intensity * 0.5
          const duration = 10 + index * 2

          return (
            <div
              key={index}
              className="absolute rounded-full blur-3xl"
              style={{
                backgroundColor: color,
                opacity: baseOpacity,
                width: "500px",
                height: "500px",
                left: pos.left,
                top: pos.top,
                transform: `translate(-50%, -50%)`,
                animation: `video-ambient-pulse ${duration}s ease-in-out infinite`,
                animationDelay: `${index * 0.7}s`,
              }}
            />
          )
        })}
      </div>

      {/* Estilos de animación CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes video-ambient-pulse {
            0%, 100% { 
              transform: translate(-50%, -50%) scale(1);
              opacity: ${intensity * 0.5};
            }
            50% { 
              transform: translate(-50%, -50%) scale(1.15);
              opacity: ${intensity * 0.75};
            }
          }
        `
      }} />
    </>
  )
}

