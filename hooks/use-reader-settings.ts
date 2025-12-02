"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { getFontCSSValue, DEFAULT_FONT_ID } from "@/lib/fonts-config"

export interface ReaderSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  maxWidth: number
  backgroundColor: string
  textColor: string
}

const defaultSettings: ReaderSettings = {
  fontSize: 16,
  fontFamily: DEFAULT_FONT_ID,
  lineHeight: 1.6,
  maxWidth: 800,
  backgroundColor: "#ffffff",
  textColor: "#000000",
}

const STORAGE_KEY = 'lexora-reader-settings'

// Convertir de BD a formato local
function dbToLocal(dbSettings: any): Partial<ReaderSettings> {
  return {
    fontSize: dbSettings.font_size ?? defaultSettings.fontSize,
    fontFamily: dbSettings.font_family ?? defaultSettings.fontFamily,
    lineHeight: dbSettings.line_height ?? defaultSettings.lineHeight,
    maxWidth: dbSettings.max_width ?? defaultSettings.maxWidth,
    backgroundColor: dbSettings.background_color ?? defaultSettings.backgroundColor,
    textColor: dbSettings.text_color ?? defaultSettings.textColor,
  }
}

// Convertir de formato local a BD
function localToDb(settings: Partial<ReaderSettings>): Record<string, any> {
  const dbSettings: Record<string, any> = {}
  if (settings.fontSize !== undefined) dbSettings.font_size = settings.fontSize
  if (settings.fontFamily !== undefined) dbSettings.font_family = settings.fontFamily
  if (settings.lineHeight !== undefined) dbSettings.line_height = settings.lineHeight
  if (settings.maxWidth !== undefined) dbSettings.max_width = settings.maxWidth
  if (settings.backgroundColor !== undefined) dbSettings.background_color = settings.backgroundColor
  if (settings.textColor !== undefined) dbSettings.text_color = settings.textColor
  return dbSettings
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesRef = useRef<Partial<ReaderSettings>>({})

  // Cargar ajustes al montar
  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient()
      
      // Primero cargar de localStorage para respuesta inmediata
      const savedSettings = localStorage.getItem(STORAGE_KEY)
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setSettings(prev => ({ ...prev, ...parsed }))
        } catch (e) {
          console.warn('Failed to parse reader settings from localStorage')
        }
      }

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserId(user.id)
        
        // Cargar de la BD (tiene prioridad sobre localStorage)
        const { data, error } = await supabase
          .from('user_viewer_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error loading reader settings from DB:', error)
        } else if (data) {
          const dbSettings = dbToLocal(data)
          setSettings(prev => ({ ...prev, ...dbSettings }))
          // Actualizar localStorage con los datos de la BD
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultSettings, ...dbSettings }))
        }
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
  }, [])

  // Guardar en BD con debounce
  const saveToDatabase = useCallback(async (settingsToSave: Partial<ReaderSettings>) => {
    if (!userId) return

    const supabase = createClient()
    const dbSettings = localToDb(settingsToSave)

    const { error } = await supabase
      .from('user_viewer_settings')
      .upsert({
        user_id: userId,
        ...dbSettings,
      })

    if (error) {
      console.error('Error saving reader settings to DB:', error)
    }
  }, [userId])

  // Programar guardado con debounce
  const scheduleSave = useCallback((newSettings: ReaderSettings) => {
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
  const updateSetting = useCallback(<K extends keyof ReaderSettings>(
    key: K, 
    value: ReaderSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
      scheduleSave(newSettings)
      return newSettings
    })
  }, [scheduleSave])

  // Update multiple settings at once
  const updateSettings = useCallback((newSettings: Partial<ReaderSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      scheduleSave(merged)
      return merged
    })
  }, [scheduleSave])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings))
    if (userId) {
      saveToDatabase(defaultSettings)
    }
  }, [userId, saveToDatabase])

  // Get font family CSS value - using centralized font config
  const getFontFamilyCSS = useCallback(() => {
    return getFontCSSValue(settings.fontFamily)
  }, [settings.fontFamily])

  return {
    settings,
    isLoaded,
    updateSetting,
    updateSettings,
    resetSettings,
    getFontFamilyCSS,
  }
}
