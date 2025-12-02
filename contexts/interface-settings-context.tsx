"use client"

import React, { createContext, useContext, ReactNode } from "react"
import { useInterfaceSettings, type InterfaceSettings } from "@/hooks/use-interface-settings"
import { getFontCSSValue } from "@/lib/fonts-config"

interface InterfaceSettingsContextType {
  settings: InterfaceSettings
  isLoaded: boolean
  updateSetting: <K extends keyof InterfaceSettings>(key: K, value: InterfaceSettings[K]) => void
  updateSettings: (newSettings: Partial<InterfaceSettings>) => void
  resetSettings: () => void
  currentTheme: string | undefined
  resolvedTheme: string | undefined
  getFontFamilyCSS: (fontFamily: string) => string
}

const InterfaceSettingsContext = createContext<InterfaceSettingsContextType | null>(null)

export function InterfaceSettingsProvider({ children }: { children: ReactNode }) {
  const interfaceSettings = useInterfaceSettings()

  return (
    <InterfaceSettingsContext.Provider value={{ ...interfaceSettings, getFontFamilyCSS: getFontCSSValue }}>
      {children}
    </InterfaceSettingsContext.Provider>
  )
}

export function useInterfaceSettingsContext() {
  const context = useContext(InterfaceSettingsContext)
  if (!context) {
    throw new Error('useInterfaceSettingsContext must be used within InterfaceSettingsProvider')
  }
  return context
}

// Hook para obtener solo los ajustes de visualización de cards (para ContentCard y ContentFeed)
export function useCardDisplaySettings() {
  const context = useContext(InterfaceSettingsContext)
  
  // Si no hay contexto, devolver valores por defecto (para SSR o componentes fuera del provider)
  if (!context) {
    return {
      showThumbnails: true,
      showExcerpts: true,
      compactView: false,
      isLoaded: false,
    }
  }
  
  return {
    showThumbnails: context.settings.showThumbnails,
    showExcerpts: context.settings.showExcerpts,
    compactView: context.settings.compactView,
    isLoaded: context.isLoaded,
  }
}
