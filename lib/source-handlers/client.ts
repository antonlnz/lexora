/**
 * Source Handlers - Client-Safe Utilities
 * 
 * Este archivo contiene funciones que pueden usarse de forma segura
 * en componentes del cliente (navegador).
 * 
 * NO importar handlers completos aquí ya que dependen de librerías
 * de Node.js como jsdom.
 */

import type { SourceType } from '@/types/database'

// ============================================================================
// TIPOS
// ============================================================================

export interface ClientDetectionResult {
  detected: boolean
  sourceType?: SourceType
  suggestedTitle?: string
  transformedUrl?: string
  faviconUrl?: string
  // Información de redirección para YouTube (handles secundarios)
  wasRedirected?: boolean
  originalHandle?: string | null
  finalHandle?: string | null
}

// ============================================================================
// PATRONES DE URL
// ============================================================================

const youtubePatterns = [
  /(?:youtube\.com\/(?:channel\/|c\/|user\/|@))([\w-]+)/,
  /(?:youtube\.com\/watch\?v=)([\w-]+)/,
  /(?:youtu\.be\/)([\w-]+)/,
  /\/feeds\/videos\.xml.*[?&]channel_id=([A-Za-z0-9_-]+)/,
]

const rssPatterns = [
  /\.rss$/i,
  /\.xml$/i,
  /\/feed\/?$/i,
  /\/rss\/?$/i,
  /\/atom\/?$/i,
  /feed\.xml/i,
  /rss\.xml/i,
  /atom\.xml/i,
]

const podcastPatterns = [
  /podcast/i,
  /feeds\.feedburner\.com/i,
  /anchor\.fm/i,
  /podcasts\.apple\.com/i,
  /open\.spotify\.com\/show/i,
  /castbox\.fm/i,
  /overcast\.fm/i,
  /pocketcasts\.com/i,
]

const twitterPatterns = [
  /(?:twitter\.com\/)([\w]+)/,
  /(?:x\.com\/)([\w]+)/,
]

const instagramPatterns = [
  /(?:instagram\.com\/)([\w.]+)/,
  /(?:instagr\.am\/)([\w.]+)/,
]

const tiktokPatterns = [
  /(?:tiktok\.com\/@)([\w.]+)/,
  /(?:vm\.tiktok\.com\/)([\w]+)/,
]

// ============================================================================
// DETECCIÓN DE TIPO DE FUENTE (CLIENTE)
// ============================================================================

/**
 * Detecta el tipo de fuente a partir de una URL.
 * Esta función es segura para usar en el navegador.
 * 
 * @param url - URL a analizar
 * @returns Resultado de la detección
 */
export async function detectSourceType(url: string): Promise<ClientDetectionResult> {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.replace(/^www\./, '').toLowerCase()
    const fullPath = urlObj.pathname + urlObj.search

    // YouTube - obtener nombre del canal desde el feed RSS
    if (host.includes('youtube.com') || host === 'youtu.be') {
      const channelMatch = url.match(/(?:@|\/c\/|\/user\/|\/channel\/)([\w-]+)/)
      const isChannel = !!channelMatch
      
      // Intentar obtener la info completa del canal (nombre y avatar)
      let channelName: string | null = null
      let avatarUrl: string | null = null
      let wasRedirected = false
      let originalHandle: string | null = null
      let finalHandle: string | null = null
      
      try {
        const channelInfo = await getYoutubeChannelInfo(url)
        if (channelInfo) {
          channelName = channelInfo.channelName
          avatarUrl = channelInfo.avatarUrl
          wasRedirected = channelInfo.wasRedirected || false
          originalHandle = channelInfo.originalHandle || null
          finalHandle = channelInfo.finalHandle || null
        }
      } catch (error) {
        console.error('Error getting YouTube channel info:', error)
      }
      
      // Formatear el título sugerido
      const suggestedTitle = channelName 
        ? `YouTube - ${channelName}`
        : channelMatch 
          ? channelMatch[1]
          : 'YouTube'
      
      return {
        detected: true,
        sourceType: isChannel ? 'youtube_channel' : 'youtube_video',
        suggestedTitle,
        faviconUrl: avatarUrl || undefined,
        wasRedirected,
        originalHandle,
        finalHandle,
      }
    }

    // Twitter/X
    for (const pattern of twitterPatterns) {
      const match = url.match(pattern)
      if (match) {
        return {
          detected: true,
          sourceType: 'twitter',
          suggestedTitle: `@${match[1]}`,
        }
      }
    }

    // Instagram
    for (const pattern of instagramPatterns) {
      const match = url.match(pattern)
      if (match) {
        return {
          detected: true,
          sourceType: 'instagram',
          suggestedTitle: `@${match[1]}`,
        }
      }
    }

    // TikTok
    for (const pattern of tiktokPatterns) {
      const match = url.match(pattern)
      if (match) {
        return {
          detected: true,
          sourceType: 'tiktok',
          suggestedTitle: `@${match[1]}`,
        }
      }
    }

    // Podcast (comprobar antes de RSS genérico)
    for (const pattern of podcastPatterns) {
      if (pattern.test(url)) {
        return {
          detected: true,
          sourceType: 'podcast',
          suggestedTitle: extractDomain(url),
        }
      }
    }

    // RSS patterns
    for (const pattern of rssPatterns) {
      if (pattern.test(fullPath)) {
        return {
          detected: true,
          sourceType: 'rss',
          suggestedTitle: extractDomain(url),
        }
      }
    }

    // Default a website si es URL válida
    return {
      detected: true,
      sourceType: 'website',
      suggestedTitle: extractDomain(url),
    }
  } catch {
    return { detected: false }
  }
}

// ============================================================================
// YOUTUBE UTILITIES
// ============================================================================

/**
 * Extrae el ID del canal de YouTube de una URL (solo para URLs con channel ID explícito)
 */
function extractYoutubeChannelId(url: string): string | null {
  // Check if it's already a channel ID in the URL
  const channelIdMatch = url.match(/\/channel\/([A-Za-z0-9_-]+)/)
  if (channelIdMatch) return channelIdMatch[1]

  // Check for RSS feed URL with channel_id
  const rssMatch = url.match(/[?&]channel_id=([A-Za-z0-9_-]+)/)
  if (rssMatch) return rssMatch[1]

  return null
}

/**
 * Obtiene la URL del feed RSS de un canal de YouTube.
 * Usa el endpoint del servidor para evitar problemas de CORS.
 * 
 * @param channelUrl - URL del canal de YouTube
 * @returns URL del feed RSS o null si no se puede resolver
 */
export async function getYoutubeRssFeedUrl(channelUrl: string): Promise<string | null> {
  // Si ya es un feed RSS, devolverlo
  if (channelUrl.includes('/feeds/videos.xml')) {
    return channelUrl
  }

  // Intentar extraer channel ID directo (sin necesidad de API)
  const directId = extractYoutubeChannelId(channelUrl)
  if (directId) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${directId}`
  }

  // Para handles (@user) y otros formatos, usar el endpoint del servidor
  try {
    const response = await fetch('/api/youtube/channel-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: channelUrl }),
    })

    if (!response.ok) {
      console.error('Failed to get YouTube channel info')
      return null
    }

    const data = await response.json()
    return data.feedUrl || null
  } catch (error) {
    console.error('Error getting YouTube RSS feed URL:', error)
    return null
  }
}

/**
 * Obtiene el nombre del canal de YouTube usando el endpoint del servidor.
 * Esto evita problemas de CORS al hacer la petición desde el navegador.
 * 
 * @param channelUrl - URL del canal de YouTube
 * @returns Nombre del canal formateado como "YouTube - NOMBRE" o null
 */
export async function getYoutubeChannelName(channelUrl: string): Promise<string | null> {
  try {
    const info = await getYoutubeChannelInfo(channelUrl)
    if (!info?.channelName) return null
    // Formatear el nombre del canal en el cliente
    return `YouTube - ${info.channelName}`
  } catch (error) {
    console.error('Error getting YouTube channel name:', error)
    return null
  }
}

/**
 * Obtiene información completa del canal de YouTube (nombre y avatar).
 * Usa el endpoint del servidor para evitar problemas de CORS.
 * También detecta si hubo una redirección a un canal diferente (handles secundarios).
 * 
 * @param channelUrl - URL del canal de YouTube
 * @returns Objeto con channelName, avatarUrl, feedUrl, channelId y info de redirección o null
 */
export async function getYoutubeChannelInfo(channelUrl: string): Promise<{
  channelName: string | null
  avatarUrl: string | null
  feedUrl: string | null
  channelId: string | null
  wasRedirected?: boolean
  originalHandle?: string | null
  finalHandle?: string | null
} | null> {
  try {
    const response = await fetch('/api/youtube/channel-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: channelUrl }),
    })

    if (!response.ok) {
      console.error('Failed to get YouTube channel info')
      return null
    }

    const data = await response.json()
    return {
      channelName: data.channelName || null,
      avatarUrl: data.avatarUrl || null,
      feedUrl: data.feedUrl || null,
      channelId: data.channelId || null,
      wasRedirected: data.wasRedirected || false,
      originalHandle: data.originalHandle || null,
      finalHandle: data.finalHandle || null,
    }
  } catch (error) {
    console.error('Error getting YouTube channel info:', error)
    return null
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Extrae el dominio de una URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}

/**
 * Valida si una URL es válida
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Obtiene la URL del favicon usando Google Favicon Service
 */
export function getFaviconUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.origin}&sz=128`
  } catch {
    return null
  }
}
