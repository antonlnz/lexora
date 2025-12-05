"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  Tag,
  User,
  X,
  ChevronDown,
  Bookmark,
  Eye,
  EyeOff,
} from "lucide-react"

interface FilterState {
  search: string
  types: string[]
  sources: string[]
  tags: string[]
  dateRange: "all" | "today" | "week" | "month" | "custom"
  readStatus: "all" | "read" | "unread"
  savedStatus: "all" | "saved" | "unsaved"
  sortBy: "date" | "title" | "source" | "engagement"
  sortOrder: "asc" | "desc"
  readTimeRange: [number, number]
}

interface AdvancedFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableSources: Array<{ id: string; title: string; favicon_url: string | null }>
  availableTags: string[]
}

const sortOptions = [
  { value: "date", label: "Date" },
  { value: "title", label: "Title" },
  { value: "source", label: "Source" },
  { value: "engagement", label: "Engagement" },
]

export function AdvancedFilters({ filters, onFiltersChange, availableSources, availableTags }: AdvancedFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [sourceSearchQuery, setSourceSearchQuery] = useState("")

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      search: "",
      types: [],
      sources: [],
      tags: [],
      dateRange: "all",
      readStatus: "all",
      savedStatus: "all",
      sortBy: "date",
      sortOrder: "desc",
      readTimeRange: [0, 60],
    })
  }

  const activeFiltersCount = [
    filters.search ? 1 : 0,
    filters.types.length,
    filters.sources.length,
    filters.tags.length,
    filters.dateRange !== "all" ? 1 : 0,
    filters.readStatus !== "all" ? 1 : 0,
    filters.savedStatus !== "all" ? 1 : 0,
  ].reduce((acc, val) => acc + val, 0)

  return (
    <div className="space-y-4">
      {/* Search and Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-10 glass hover-lift-subtle focus:hover-lift-subtle"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="glass bg-transparent hover-lift-subtle">
                {filters.sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4 mr-2" />
                ) : (
                  <SortDesc className="h-4 w-4 mr-2" />
                )}
                {sortOptions.find((opt) => opt.value === filters.sortBy)?.label}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="glass-card w-48 hover-lift" align="end">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort by</Label>
                {sortOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.sortBy === option.value ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start hover-lift-subtle"
                    onClick={() => updateFilters({ sortBy: option.value as FilterState["sortBy"] })}
                  >
                    {option.label}
                  </Button>
                ))}
                <div className="border-t pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start hover-lift-subtle"
                    onClick={() => updateFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
                  >
                    {filters.sortOrder === "asc" ? (
                      <SortDesc className="h-4 w-4 mr-2" />
                    ) : (
                      <SortAsc className="h-4 w-4 mr-2" />
                    )}
                    {filters.sortOrder === "asc" ? "Descending" : "Ascending"}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Advanced Filters */}
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="glass bg-transparent hover-lift-subtle">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="glass-card w-80 hover-lift" align="end">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Advanced Filters</h3>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="hover-lift-subtle">
                      Clear All
                    </Button>
                  )}
                </div>

                {/* Sources - Reemplaza Content Types */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Sources</Label>
                  {availableSources.length > 0 ? (
                    <>
                      <div className="relative mb-3">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="Search sources..."
                          value={sourceSearchQuery}
                          onChange={(e) => setSourceSearchQuery(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {availableSources
                          .filter((source) =>
                            source.title.toLowerCase().includes(sourceSearchQuery.toLowerCase())
                          )
                          .map((source) => (
                            <div key={source.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`source-${source.id}`}
                                checked={filters.sources.includes(source.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateFilters({ sources: [...filters.sources, source.id] })
                                  } else {
                                    updateFilters({ sources: filters.sources.filter((s) => s !== source.id) })
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`source-${source.id}`}
                                className="text-sm flex items-center gap-2 flex-1 cursor-pointer"
                              >
                                {source.favicon_url && (
                                  <img
                                    src={source.favicon_url}
                                    alt=""
                                    className="h-4 w-4 rounded"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none"
                                    }}
                                  />
                                )}
                                <span className="truncate">{source.title}</span>
                              </Label>
                            </div>
                          ))}
                        {availableSources.filter((source) =>
                          source.title.toLowerCase().includes(sourceSearchQuery.toLowerCase())
                        ).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            No sources found
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No sources available</p>
                  )}
                </div>

                {/* Read Status */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Read Status</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "all", label: "All", icon: null },
                      { value: "read", label: "Read", icon: Eye },
                      { value: "unread", label: "Unread", icon: EyeOff },
                    ].map((status) => (
                      <Button
                        key={status.value}
                        variant={filters.readStatus === status.value ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateFilters({ readStatus: status.value as FilterState["readStatus"] })}
                        className="flex-1 hover-lift-subtle"
                      >
                        {status.icon && <status.icon className="h-4 w-4 mr-1" />}
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Saved Status */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Saved Status</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "saved", label: "Saved" },
                      { value: "unsaved", label: "Not Saved" },
                    ].map((status) => (
                      <Button
                        key={status.value}
                        variant={filters.savedStatus === status.value ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateFilters({ savedStatus: status.value as FilterState["savedStatus"] })}
                        className="flex-1 hover-lift-subtle"
                      >
                        {status.value === "saved" && <Bookmark className="h-4 w-4 mr-1" />}
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "all", label: "All Time" },
                      { value: "today", label: "Today" },
                      { value: "week", label: "This Week" },
                      { value: "month", label: "This Month" },
                    ].map((range) => (
                      <Button
                        key={range.value}
                        variant={filters.dateRange === range.value ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateFilters({ dateRange: range.value as FilterState["dateRange"] })}
                        className="hover-lift-subtle"
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Read Time Range */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    Read Time: {filters.readTimeRange[0]}-{filters.readTimeRange[1]} min
                  </Label>
                  <Slider
                    value={filters.readTimeRange}
                    onValueChange={(value) => updateFilters({ readTimeRange: value as [number, number] })}
                    max={60}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Tags */}
                {availableTags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Tags</Label>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={filters.tags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer glass hover-lift-subtle"
                          onClick={() => {
                            if (filters.tags.includes(tag)) {
                              updateFilters({ tags: filters.tags.filter((t) => t !== tag) })
                            } else {
                              updateFilters({ tags: [...filters.tags, tag] })
                            }
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <Card className="glass-card p-3 hover-lift">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Active filters:</span>

            {filters.search && (
              <Badge variant="secondary" className="glass hover-lift-subtle">
                <Search className="h-3 w-3 mr-1" />"{filters.search}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => updateFilters({ search: "" })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}

            {filters.sources.map((sourceId) => {
              const source = availableSources.find((s) => s.id === sourceId)
              // No mostrar el badge si las fuentes aún no se han cargado (mostraría el ID)
              if (!source && availableSources.length === 0) {
                return (
                  <Badge key={sourceId} variant="secondary" className="glass hover-lift-subtle animate-pulse">
                    <User className="h-3 w-3 mr-1" />
                    <span className="w-16 h-3 bg-muted-foreground/20 rounded" />
                  </Badge>
                )
              }
              return (
                <Badge key={sourceId} variant="secondary" className="glass hover-lift-subtle">
                  <User className="h-3 w-3 mr-1" />
                  {source?.title || sourceId}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => updateFilters({ sources: filters.sources.filter((s) => s !== sourceId) })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            })}

            {filters.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="glass hover-lift-subtle">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => updateFilters({ tags: filters.tags.filter((t) => t !== tag) })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {filters.dateRange !== "all" && (
              <Badge variant="secondary" className="glass hover-lift-subtle">
                <Calendar className="h-3 w-3 mr-1" />
                {filters.dateRange}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => updateFilters({ dateRange: "all" })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}

            {filters.readStatus !== "all" && (
              <Badge variant="secondary" className="glass hover-lift-subtle">
                {filters.readStatus === "read" ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {filters.readStatus}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => updateFilters({ readStatus: "all" })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}

            {filters.savedStatus !== "all" && (
              <Badge variant="secondary" className="glass hover-lift-subtle">
                <Bookmark className="h-3 w-3 mr-1" />
                {filters.savedStatus}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => updateFilters({ savedStatus: "all" })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}

            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="ml-auto hover-lift-subtle">
              Clear All
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export type { FilterState }
