/**
 * Font Configuration for Lexora
 * 
 * This file contains the configuration for all available fonts in the application.
 * To add a new font:
 * 1. Add a new entry to the FONTS array
 * 2. If it's a custom font, ensure it's loaded in the app (via layout.tsx or CSS)
 * 3. The font will automatically appear in all font selectors
 */

export interface FontConfig {
  /** Unique identifier for the font (used in settings) */
  id: string
  /** Display name shown in the UI */
  name: string
  /** Category for grouping/filtering */
  category: 'system' | 'sans-serif' | 'serif' | 'monospace' | 'display'
  /** CSS font-family value */
  cssValue: string
  /** Optional description */
  description?: string
  /** Whether this font requires external loading (Google Fonts, etc.) */
  requiresLoad?: boolean
  /** Preview text style class (for showing font in selector) */
  previewClass?: string
}

/**
 * Main fonts configuration array
 * Add new fonts here to make them available throughout the app
 */
export const FONTS: FontConfig[] = [
  // System fonts
  {
    id: 'system',
    name: 'System',
    category: 'system',
    cssValue: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    description: 'Default system font',
  },
  
  // Sans-serif fonts
  {
    id: 'inter',
    name: 'Inter',
    category: 'sans-serif',
    cssValue: 'var(--font-inter), Inter, sans-serif',
    description: 'Modern, clean sans-serif',
    requiresLoad: true,
  },
  
  // Serif fonts
  {
    id: 'playfair',
    name: 'Playfair Display',
    category: 'serif',
    cssValue: 'var(--font-playfair), "Playfair Display", Georgia, serif',
    description: 'Elegant serif typeface',
    requiresLoad: true,
  },
  {
    id: 'baskerville',
    name: 'Baskerville',
    category: 'serif',
    cssValue: 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif',
    description: 'Classic transitional serif',
  },
  
  // Monospace fonts
  {
    id: 'monospace',
    name: 'Monospace',
    category: 'monospace',
    cssValue: '"SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    description: 'Default monospace font',
  },
  {
    id: 'dm-mono',
    name: 'DM Mono',
    category: 'monospace',
    cssValue: 'var(--font-dm-mono), "DM Mono", "SF Mono", Menlo, Monaco, monospace',
    description: 'Low-contrast geometric monospace',
    requiresLoad: true,
  },
  {
    id: 'hack-nerd',
    name: 'Hack Nerd Font',
    category: 'monospace',
    cssValue: '"Hack Nerd Font", "Hack", "SF Mono", Menlo, monospace',
    description: 'Programming font with ligatures',
    requiresLoad: true,
  },
  
  // Display/Special fonts
  {
    id: 'moneta',
    name: 'Moneta',
    category: 'display',
    cssValue: '"Moneta", "Inter", sans-serif',
    description: 'Geometric display font',
    requiresLoad: true,
  },
  {
    id: 'isonorm',
    name: 'Isonorm 3098',
    category: 'display',
    cssValue: '"Isonorm 3098", "DIN Alternate", "Inter", sans-serif',
    description: 'Technical/Engineering style',
    requiresLoad: true,
  },
  {
    id: 'lettera-mono',
    name: 'Lettera Mono LL',
    category: 'monospace',
    cssValue: '"Lettera Mono LL", "SF Mono", Menlo, Monaco, monospace',
    description: 'Classic typewriter-style monospace',
    requiresLoad: true,
 },
]

/**
 * Get font configuration by ID
 */
export function getFontById(id: string): FontConfig | undefined {
  return FONTS.find(font => font.id === id)
}

/**
 * Get CSS value for a font ID
 * Returns a fallback if font is not found
 */
export function getFontCSSValue(fontId: string): string {
  const font = getFontById(fontId)
  return font?.cssValue ?? FONTS[0].cssValue // Fallback to system font
}

/**
 * Get fonts by category
 */
export function getFontsByCategory(category: FontConfig['category']): FontConfig[] {
  return FONTS.filter(font => font.category === category)
}

/**
 * Search fonts by name or description
 */
export function searchFonts(query: string): FontConfig[] {
  if (!query.trim()) return FONTS
  
  const lowerQuery = query.toLowerCase()
  return FONTS.filter(font => 
    font.name.toLowerCase().includes(lowerQuery) ||
    font.category.toLowerCase().includes(lowerQuery) ||
    font.description?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: FontConfig['category']): string {
  const labels: Record<FontConfig['category'], string> = {
    'system': 'System',
    'sans-serif': 'Sans Serif',
    'serif': 'Serif',
    'monospace': 'Monospace',
    'display': 'Display',
  }
  return labels[category]
}

/**
 * Get all unique categories
 */
export function getAllCategories(): FontConfig['category'][] {
  return [...new Set(FONTS.map(font => font.category))]
}

/**
 * Default font ID
 */
export const DEFAULT_FONT_ID = 'inter'
