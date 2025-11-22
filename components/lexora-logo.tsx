import Link from "next/link"
import { cn } from "@/lib/utils"

interface LexoraLogoProps {
  href?: string
  className?: string
  onClick?: () => void
}

export function LexoraLogo({ href = "/", className, onClick }: LexoraLogoProps) {
  const content = (
    <span className={cn("text-2xl font-serif font-normal text-foreground hover-lift-subtle tracking-tight", className)}>
      lexora.
    </span>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center">
        {content}
      </button>
    )
  }

  return (
    <div className="flex items-center">
      <Link href={href} className="flex items-center">
        {content}
      </Link>
    </div>
  )
}

