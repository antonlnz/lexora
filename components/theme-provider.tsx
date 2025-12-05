'use client'

import * as React from 'react'
import { useEffect } from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
  useTheme,
} from 'next-themes'

// Componente para sincronizar el theme-color con el tema activo
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // Colores de fondo según el tema (sin alpha para theme-color)
    const lightColor = '#fafaf9' // oklch(0.98 0.005 85) aproximado
    const darkColor = '#020201'  // oklch(0.08 0.01 85) aproximado

    const themeColor = resolvedTheme === 'dark' ? darkColor : lightColor

    // Actualizar o crear la meta tag theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.setAttribute('name', 'theme-color')
      document.head.appendChild(metaThemeColor)
    }
    metaThemeColor.setAttribute('content', themeColor)

    // También actualizar la meta tag para iOS Safari
    let metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (!metaAppleStatusBar) {
      metaAppleStatusBar = document.createElement('meta')
      metaAppleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
      document.head.appendChild(metaAppleStatusBar)
    }
    metaAppleStatusBar.setAttribute('content', 'black-translucent')
  }, [resolvedTheme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
