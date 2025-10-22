"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface FilterTabsProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
}

const filters = [
  { id: "all", label: "All", count: 113 },
  { id: "news", label: "News", count: 24 },
  { id: "youtube", label: "YouTube", count: 12 },
  { id: "twitter", label: "Twitter", count: 48 },
  { id: "instagram", label: "Instagram", count: 8 },
  { id: "tiktok", label: "TikTok", count: 15 },
  { id: "newsletter", label: "Newsletters", count: 6 },
]

export function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  return (
    <div className="glass-card p-2 rounded-2xl">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={`flex items-center gap-2 whitespace-nowrap ${
              activeFilter === filter.id ? "" : "glass hover:bg-accent/50"
            }`}
          >
            {filter.label}
            <Badge
              variant="secondary"
              className={`text-xs ${activeFilter === filter.id ? "bg-primary-foreground/20" : "glass"}`}
            >
              {filter.count}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  )
}
