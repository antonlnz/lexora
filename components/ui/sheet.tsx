'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { motion, useAnimation, useDragControls, PanInfo } from 'framer-motion'

import { cn } from '@/lib/utils'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Content> {
  side?: 'top' | 'right' | 'bottom' | 'left'
  onOpenChange?: (open: boolean) => void
}

function SheetContent({
  className,
  children,
  side = 'right',
  onOpenChange,
  ...props
}: SheetContentProps) {
  const controls = useAnimation()
  const dragControls = useDragControls()
  const [isDragging, setIsDragging] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)

  const handleDragEnd = async (_: any, info: PanInfo) => {
    setIsDragging(false)
    const threshold = 100
    const velocity = info.velocity.y
    const offset = info.offset.y

    // Si se arrastra hacia abajo lo suficiente o con suficiente velocidad
    if ((side === 'bottom' && (offset > threshold || velocity > 500)) ||
        (side === 'top' && (offset < -threshold || velocity < -500))) {
      // Animar hacia abajo antes de cerrar
      setIsClosing(true)
      await controls.start({ 
        y: '100%', 
        transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } 
      })
      if (onOpenChange) {
        onOpenChange(false)
      }
      setIsClosing(false)
    } else {
      // Volver a la posición original
      await controls.start({ y: 0, transition: { duration: 0.2 } })
    }
  }
  
  // Manejar cierre programático con animación
  const handleClose = async () => {
    if (side === 'bottom') {
      setIsClosing(true)
      await controls.start({ 
        y: '100%', 
        transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } 
      })
      if (onOpenChange) {
        onOpenChange(false)
      }
      setIsClosing(false)
    } else if (onOpenChange) {
      onOpenChange(false)
    }
  }

  const isBottomSheet = side === 'bottom'

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'bg-background fixed z-50 flex flex-col shadow-lg',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 transition ease-in-out inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 transition ease-in-out inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 transition ease-in-out inset-x-0 top-0 h-auto border-b',
          !isBottomSheet && 'gap-4',
          isBottomSheet && 'inset-x-0 bottom-0 border-t',
          className,
        )}
        asChild={isBottomSheet}
        onPointerDownOutside={(e) => {
          // Prevenir cierre durante animación
          if (isClosing) e.preventDefault()
        }}
        {...props}
      >
        {isBottomSheet ? (
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            animate={controls}
            initial={{ y: 0 }}
            style={{ touchAction: isDragging ? 'none' : 'pan-y' }}
            className="flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Handle para arrastrar */}
            <div 
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
            </div>
            {children}
            <SheetPrimitive.Close 
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
              onClick={(e) => {
                e.preventDefault()
                handleClose()
              }}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </motion.div>
        ) : (
          <>
            {children}
            <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
