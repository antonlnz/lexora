"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { getFontCSSValue, DEFAULT_FONT_ID } from "@/lib/fonts-config"

export interface InterfaceSettings {
  themePreference: 'light' | 'dark' | 'system'
  fontFamily: string
  fontSize: number
  sidebarCollapsed: boolean
  viewMode: 'compact' | 'comfortable' | 'spacious'
  itemsPerPage: number
  showThumbnails: boolean
  showExcerpts: boolean
  compactView: boolean
}

const defaultSettings: InterfaceSettings = {
  themePreference: 'system',
  fontFamily: DEFAULT_FONT_ID,
  fontSize: 16,
  sidebarCollapsed: false,
  viewMode: 'comfortable',
  itemsPerPage: 20,
  showThumbnails: true,
  showExcerpts: true,
  compactView: false,
}

const STORAGE_KEY = 'lexora-interface-settings'

// Convertir de BD a formato local
function dbToLocal(dbSettings: any): Partial<InterfaceSettings> {
  return {
    themePreference: dbSettings.theme_preference ?? defaultSettings.themePreference,
    fontFamily: dbSettings.font_family ?? defaultSettings.fontFamily,
    fontSize: dbSettings.font_size ?? defaultSettings.fontSize,
    sidebarCollapsed: dbSettings.sidebar_collapsed ?? defaultSettings.sidebarCollapsed,
    viewMode: dbSettings.view_mode ?? defaultSettings.viewMode,
    itemsPerPage: dbSettings.items_per_page ?? defaultSettings.itemsPerPage,
    showThumbnails: dbSettings.show_thumbnails ?? defaultSettings.showThumbnails,
    showExcerpts: dbSettings.show_excerpts ?? defaultSettings.showExcerpts,
    compactView: dbSettings.compact_view ?? defaultSettings.compactView,
  }
}

// Convertir de formato local a BD
function localToDb(settings: Partial<InterfaceSettings>): Record<string, any> {
  const dbSettings: Record<string, any> = {}
  if (settings.themePreference !== undefined) dbSettings.theme_preference = settings.themePreference
  if (settings.fontFamily !== undefined) dbSettings.font_family = settings.fontFamily
  if (settings.fontSize !== undefined) dbSettings.font_size = settings.fontSize
  if (settings.sidebarCollapsed !== undefined) dbSettings.sidebar_collapsed = settings.sidebarCollapsed
  if (settings.viewMode !== undefined) dbSettings.view_mode = settings.viewMode
  if (settings.itemsPerPage !== undefined) dbSettings.items_per_page = settings.itemsPerPage
  if (settings.showThumbnails !== undefined) dbSettings.show_thumbnails = settings.showThumbnails
  if (settings.showExcerpts !== undefined) dbSettings.show_excerpts = settings.showExcerpts
  if (settings.compactView !== undefined) dbSettings.compact_view = settings.compactView
  return dbSettings
}

// Helper para obtener el CSS de la familia de fuente
// Re-exportamos desde fonts-config para mantener compatibilidad
export { getFontCSSValue as getFontFamilyCSS } from "@/lib/fonts-config"

// Base font size (default browser size)
const BASE_FONT_SIZE = 16

// Calculate the scale factor for font size
// This allows us to scale the entire UI proportionally
function getFontScale(fontSize: number): number {
  return fontSize / BASE_FONT_SIZE
}

export function useInterfaceSettings() {
  const [settings, setSettings] = useState<InterfaceSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesRef = useRef<Partial<InterfaceSettings>>({})
  
  // Integración con next-themes
  const { setTheme, theme, resolvedTheme } = useTheme()

  // Aplicar font-family al body y font-size al html (root) para escalar toda la UI
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Apply font family to body
      document.body.style.fontFamily = getFontCSSValue(settings.fontFamily)
      
      // Apply font size to html element (root) so rem units scale proportionally
      // This affects the entire UI since rem is relative to root font-size
      const scale = getFontScale(settings.fontSize)
      document.documentElement.style.fontSize = `${scale * 100}%`
    }
    
    // Cleanup function to reset to default when component unmounts
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = ''
      }
    }
  }, [settings.fontFamily, settings.fontSize])

  // Cargar ajustes al montar
  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient()
      
      // Primero cargar de localStorage para respuesta inmediata
      const savedSettings = localStorage.getItem(STORAGE_KEY)
      let loadedTheme: string | null = null
      
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setSettings(prev => ({ ...prev, ...parsed }))
          loadedTheme = parsed.themePreference || null
        } catch (e) {
          console.warn('Failed to parse interface settings from localStorage')
        }
      }

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserId(user.id)
        
        // Cargar de la BD (tiene prioridad sobre localStorage)
        const { data, error } = await supabase
          .from('user_interface_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error loading interface settings from DB:', error)
        } else if (data) {
          const dbSettings = dbToLocal(data)
          setSettings(prev => ({ ...prev, ...dbSettings }))
          loadedTheme = dbSettings.themePreference || loadedTheme
          // Actualizar localStorage con los datos de la BD
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultSettings, ...dbSettings }))
        }
      }
      
      // Aplicar tema después de cargar todos los settings
      if (loadedTheme) {
        setTheme(loadedTheme)
      }
      
      setIsLoaded(true)
    }

    loadSettings()

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo ejecutar una vez al montar

  // Guardar en BD con debounce
  const saveToDatabase = useCallback(async (settingsToSave: Partial<InterfaceSettings>) => {
    if (!userId) return

    const supabase = createClient()
    const dbSettings = localToDb(settingsToSave)

    const { error } = await supabase
      .from('user_interface_settings')
      .upsert({
        user_id: userId,
        ...dbSettings,
      })

    if (error) {
      console.error('Error saving interface settings to DB:', error)
    }
  }, [userId])

  // Programar guardado con debounce
  const scheduleSave = useCallback((newSettings: InterfaceSettings) => {
    // Acumular cambios pendientes
    pendingChangesRef.current = { ...pendingChangesRef.current, ...newSettings }
    
    // Cancelar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Programar nuevo guardado (500ms después del último cambio)
    saveTimeoutRef.current = setTimeout(() => {
      if (userId) {
        saveToDatabase(pendingChangesRef.current)
        pendingChangesRef.current = {}
      }
    }, 500)
  }, [userId, saveToDatabase])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof InterfaceSettings>(
    key: K, 
    value: InterfaceSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
      scheduleSave(newSettings)
      return newSettings
    })
    
    // Sincronizar tema con next-themes si es themePreference
    // Esto se ejecuta DESPUÉS del setState, no dentro del callback
    if (key === 'themePreference') {
      setTheme(value as string)
    }
  }, [scheduleSave, setTheme])

  // Update multiple settings at once
  const updateSettings = useCallback((newSettings: Partial<InterfaceSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      scheduleSave(merged)
      return merged
    })
    
    // Sincronizar tema si está incluido
    if (newSettings.themePreference) {
      setTheme(newSettings.themePreference)
    }
  }, [scheduleSave, setTheme])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings))
    setTheme(defaultSettings.themePreference)
    if (userId) {
      saveToDatabase(defaultSettings)
    }
  }, [userId, saveToDatabase, setTheme])

  return {
    settings,
    isLoaded,
    updateSetting,
    updateSettings,
    resetSettings,
    // Exponer tema actual para conveniencia
    currentTheme: theme,
    resolvedTheme,
  }
}
