"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, Search, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { 
  FONTS, 
  getFontById, 
  getCategoryLabel, 
  getAllCategories,
  type FontConfig 
} from "@/lib/fonts-config"

interface FontSelectorProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
}

export function FontSelector({ 
  value, 
  onValueChange, 
  className,
  placeholder = "Select font..."
}: FontSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  const selectedFont = getFontById(value)
  const categories = getAllCategories()
  
  // Filter fonts based on search query
  const filteredFonts = useMemo(() => {
    if (!searchQuery.trim()) return FONTS
    
    const lowerQuery = searchQuery.toLowerCase()
    return FONTS.filter(font => 
      font.name.toLowerCase().includes(lowerQuery) ||
      font.category.toLowerCase().includes(lowerQuery) ||
      font.description?.toLowerCase().includes(lowerQuery)
    )
  }, [searchQuery])
  
  // Group filtered fonts by category
  const groupedFonts = useMemo(() => {
    const groups: Record<string, FontConfig[]> = {}
    
    for (const font of filteredFonts) {
      if (!groups[font.category]) {
        groups[font.category] = []
      }
      groups[font.category].push(font)
    }
    
    return groups
  }, [filteredFonts])
  
  // Get categories that have fonts (after filtering)
  const activeCategories = categories.filter(cat => groupedFonts[cat]?.length > 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between glass hover-lift-subtle", className)}
        >
          <div className="flex items-center gap-2 truncate">
            <Type className="h-4 w-4 shrink-0 opacity-50" />
            {selectedFont ? (
              <span 
                className="truncate" 
                style={{ fontFamily: selectedFont.cssValue }}
              >
                {selectedFont.name}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 glass-card" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search fonts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No font found.</CommandEmpty>
            {activeCategories.map((category, index) => (
              <div key={category}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={getCategoryLabel(category)}>
                  {groupedFonts[category]?.map((font) => (
                    <CommandItem
                      key={font.id}
                      value={font.id}
                      onSelect={() => {
                        onValueChange(font.id)
                        setOpen(false)
                        setSearchQuery("")
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === font.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span 
                          className="truncate font-medium"
                          style={{ fontFamily: font.cssValue }}
                        >
                          {font.name}
                        </span>
                        {font.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {font.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
