"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"

export function CollapsibleSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (isMobile) return

    const handleMouseMove = (e: MouseEvent) => {
      const edgeThreshold = 50 // pixels from left edge to trigger

      if (e.clientX <= edgeThreshold && !isOpen) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
          setIsOpen(true)
        }, 100)
      } else if (e.clientX > 400 && isOpen) {
        // Close when mouse moves away from sidebar
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
          setIsOpen(false)
        }, 300)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      clearTimeout(hoverTimeoutRef.current)
    }
  }, [isOpen, isMobile])

  // Reset drag state when opening/closing
  useEffect(() => {
    if (!isMobile) return
    setDragX(0)
    setIsDragging(false)
  }, [isOpen, isMobile])

  return (
    <>
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Backdrop durante el drag - aparece gradualmente */}
      {isMobile && !isOpen && isDragging && dragX > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.min(0.5, dragX / 320) }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-35 lg:hidden pointer-events-none"
        />
      )}

      {/* Área de detección del gesto en el borde izquierdo - solo mobile */}
      {isMobile && !isOpen && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.3 }}
          dragDirectionLock
          onDragStart={() => setIsDragging(true)}
          onDrag={(_, info) => {
            // Solo permitir arrastrar hacia la derecha
            if (info.offset.x > 0) {
              setDragX(Math.min(320, info.offset.x))
            }
          }}
          onDragEnd={(_, info) => {
            const swipeThreshold = 100
            const swipeVelocityThreshold = 500

            if (info.offset.x > swipeThreshold || info.velocity.x > swipeVelocityThreshold) {
              setIsOpen(true)
            }
            
            setDragX(0)
            setIsDragging(false)
          }}
          className="fixed left-0 top-0 h-full w-12 z-30 lg:hidden"
          style={{
            touchAction: "pan-y", // Permite scroll vertical
          }}
        />
      )}

      <motion.aside
        ref={sidebarRef}
        initial={false}
        animate={{
          x: isDragging && !isOpen ? dragX - 320 : isOpen ? 0 : -320,
        }}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300,
        }}
        drag={isMobile && isOpen ? "x" : false}
        dragConstraints={{ left: -320, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.1 }}
        dragDirectionLock
        onDragStart={() => {
          if (isOpen) setIsDragging(true)
        }}
        onDrag={(_, info) => {
          if (isMobile && isOpen) {
            // Si está abierto, permitir arrastrar a la izquierda
            setDragX(Math.min(0, info.offset.x))
          }
        }}
        onDragEnd={(_, info) => {
          if (!isMobile || !isOpen) return

          const swipeThreshold = 100
          const swipeVelocityThreshold = 500

          // Sidebar está abierto, deslizar izquierda para cerrar
          if (info.offset.x < -swipeThreshold || info.velocity.x < -swipeVelocityThreshold) {
            setIsOpen(false)
          }

          setDragX(0)
          setIsDragging(false)
        }}
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 z-50 ${isMobile ? "" : "lg:block"}`}
        style={{
          touchAction: "none",
        }}
      >
        <div className="h-full overflow-y-auto p-4 bg-background/95 backdrop-blur-xl border-r border-border/50">
          <Sidebar />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -right-10 top-4 bg-transparent hover:glass rounded-l-none rounded-r-lg h-12 w-10 p-0 transition-all duration-300"
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </motion.aside>

      {/* Indicador sutil en el borde izquierdo - solo mobile */}
      {isMobile && !isOpen && !isDragging && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{
            opacity: [0, 0.3, 0],
            x: [-10, 0, -10],
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: "easeInOut",
            delay: 2,
          }}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 lg:hidden pointer-events-none"
        >
          <div className="w-1 h-20 bg-gradient-to-r from-primary/30 to-transparent rounded-r-full" />
        </motion.div>
      )}
    </>
  )
}
