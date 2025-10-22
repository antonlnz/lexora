"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"

export function CollapsibleSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (!isMobile) return

    const swipeThreshold = 50
    if (info.offset.x > swipeThreshold) {
      setIsOpen(true)
    } else if (info.offset.x < -swipeThreshold) {
      setIsOpen(false)
    }
  }

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

      <motion.aside
        ref={sidebarRef}
        initial={false}
        animate={{
          x: isOpen ? 0 : isMobile ? -400 : -320,
        }}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300,
        }}
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: -400, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
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
          className="absolute -right-10 top-4 glass rounded-l-none rounded-r-lg h-12 w-10 p-0"
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </motion.aside>

      {isMobile && !isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 lg:hidden"
        >
          <div className="glass-card p-2 rounded-r-lg">
            <ChevronRight className="h-5 w-5 text-muted-foreground animate-pulse" />
          </div>
        </motion.div>
      )}
    </>
  )
}
