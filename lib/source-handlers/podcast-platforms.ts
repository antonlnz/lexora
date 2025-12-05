/**
 * Podcast Platform Handlers
 * 
 * Módulo para extraer feeds RSS de diferentes plataformas de podcast:
 * - Spotify
 * - Apple Podcasts
 * - Amazon Music / Audible
 * - YouTube Podcasts
 * - RSS directo
 */

export interface PodcastPlatformResult {
  success: boolean
  feedUrl?: string
  title?: string
  description?: string
  imageUrl?: string
  author?: string
  platform: 'spotify' | 'apple' | 'amazon' | 'youtube' | 'rss' | 'unknown'
  error?: string
}

// ============================================================================
// PATRONES DE URL
// ============================================================================

const SPOTIFY_PATTERN = /open\.spotify\.com\/show\/([a-zA-Z0-9]+)/i
const APPLE_PODCAST_PATTERN = /podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^/]+\/id(\d+)/i
const AMAZON_PODCAST_PATTERN = /music\.amazon\.[a-z.]+\/podcasts\/([a-zA-Z0-9-]+)/i
const YOUTUBE_PODCAST_PATTERN = /youtube\.com\/@([^/]+)\/podcasts/i
const YOUTUBE_CHANNEL_PATTERN = /youtube\.com\/(?:@|channel\/|c\/|user\/)([^/?]+)/i

// ============================================================================
// DETECTAR PLATAFORMA
// ============================================================================

export function detectPodcastPlatform(url: string): PodcastPlatformResult['platform'] {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.toLowerCase()
    const fullUrl = url.toLowerCase()

    if (host.includes('spotify.com')) return 'spotify'
    if (host.includes('podcasts.apple.com')) return 'apple'
    if (host.includes('music.amazon')) return 'amazon'
    if (host.includes('youtube.com') && fullUrl.includes('/podcasts')) return 'youtube'
    
    // Verificar si parece un feed RSS/XML
    if (fullUrl.endsWith('.xml') || fullUrl.endsWith('.rss') || 
        fullUrl.includes('/feed') || fullUrl.includes('/rss') ||
        fullUrl.includes('feeds.') || fullUrl.includes('anchor.fm')) {
      return 'rss'
    }

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// ============================================================================
// SPOTIFY - Usar servicio de terceros para obtener RSS
// ============================================================================

/**
 * Spotify no provee feeds RSS directamente.
 * Usamos servicios como Spotify Podcast RSS o extraemos el ID para búsqueda manual.
 */
export async function getSpotifyPodcastInfo(url: string): Promise<PodcastPlatformResult> {
  const match = url.match(SPOTIFY_PATTERN)
  if (!match) {
    return { success: false, platform: 'spotify', error: 'Invalid Spotify URL' }
  }

  const showId = match[1]
  
  try {
    // Intentar obtener info usando la API de oEmbed de Spotify
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Lexora Podcast Reader/1.0',
      },
    })

    if (response.ok) {
      const data = await response.json()
      
      return {
        success: true,
        platform: 'spotify',
        title: data.title || 'Spotify Podcast',
        imageUrl: data.thumbnail_url,
        // Spotify no provee feed RSS directamente
        // Podríamos usar un servicio de terceros o advertir al usuario
        error: 'Spotify no proporciona feeds RSS. El podcast se sincronizará mediante scraping periódico.',
      }
    }
  } catch (error) {
    console.error('Error fetching Spotify podcast info:', error)
  }

  return {
    success: false,
    platform: 'spotify',
    error: 'No se pudo obtener información del podcast de Spotify',
  }
}

// ============================================================================
// APPLE PODCASTS - Usar iTunes Search API
// ============================================================================

export async function getApplePodcastInfo(url: string): Promise<PodcastPlatformResult> {
  const match = url.match(APPLE_PODCAST_PATTERN)
  if (!match) {
    return { success: false, platform: 'apple', error: 'Invalid Apple Podcasts URL' }
  }

  const podcastId = match[1]

  try {
    // Usar iTunes Search API para obtener el feed RSS
    const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`
    const response = await fetch(lookupUrl, {
      headers: {
        'User-Agent': 'Lexora Podcast Reader/1.0',
      },
    })

    if (response.ok) {
      const data = await response.json()
      const podcast = data.results?.[0]

      if (podcast && podcast.feedUrl) {
        return {
          success: true,
          platform: 'apple',
          feedUrl: podcast.feedUrl,
          title: podcast.trackName || podcast.collectionName,
          description: podcast.description,
          imageUrl: podcast.artworkUrl600 || podcast.artworkUrl100,
          author: podcast.artistName,
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Apple Podcast info:', error)
  }

  return {
    success: false,
    platform: 'apple',
    error: 'No se pudo obtener el feed RSS del podcast de Apple',
  }
}

// ============================================================================
// AMAZON MUSIC - Intentar extraer de la página
// ============================================================================

export async function getAmazonPodcastInfo(url: string): Promise<PodcastPlatformResult> {
  const match = url.match(AMAZON_PODCAST_PATTERN)
  if (!match) {
    return { success: false, platform: 'amazon', error: 'Invalid Amazon Music URL' }
  }

  // Amazon Music no provee API pública para podcasts
  // Necesitaríamos hacer scraping o usar una técnica alternativa
  return {
    success: false,
    platform: 'amazon',
    error: 'Amazon Music no proporciona acceso directo a feeds RSS. Intenta buscar el mismo podcast en Apple Podcasts o usa el feed RSS directo.',
  }
}

// ============================================================================
// YOUTUBE PODCASTS - Extraer feed del canal
// ============================================================================

export async function getYouTubePodcastInfo(url: string, fetchChannelInfo: (url: string) => Promise<any>): Promise<PodcastPlatformResult> {
  // Extraer el handle/channel del URL
  let channelHandle: string | null = null
  
  const podcastMatch = url.match(YOUTUBE_PODCAST_PATTERN)
  const channelMatch = url.match(YOUTUBE_CHANNEL_PATTERN)
  
  if (podcastMatch) {
    channelHandle = podcastMatch[1]
  } else if (channelMatch) {
    channelHandle = channelMatch[1]
  }

  if (!channelHandle) {
    return { success: false, platform: 'youtube', error: 'Invalid YouTube URL' }
  }

  try {
    // Usar la función de channel info existente
    const channelInfo = await fetchChannelInfo(url.replace('/podcasts', ''))
    
    if (channelInfo && channelInfo.feedUrl) {
      return {
        success: true,
        platform: 'youtube',
        feedUrl: channelInfo.feedUrl,
        title: channelInfo.channelName ? `${channelInfo.channelName} (Podcast)` : 'YouTube Podcast',
        description: channelInfo.channelDescription,
        imageUrl: channelInfo.avatarUrl,
        author: channelInfo.channelName,
      }
    }
  } catch (error) {
    console.error('Error fetching YouTube podcast info:', error)
  }

  return {
    success: false,
    platform: 'youtube',
    error: 'No se pudo obtener información del podcast de YouTube',
  }
}

// ============================================================================
// RSS DIRECTO - Validar y extraer metadata
// ============================================================================

export async function validateRssPodcastFeed(url: string): Promise<PodcastPlatformResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Lexora Podcast Reader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return {
        success: false,
        platform: 'rss',
        error: `Error al acceder al feed: ${response.status}`,
      }
    }

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    // Verificar que sea XML
    if (!text.trim().startsWith('<?xml') && !text.trim().startsWith('<rss') && !text.trim().startsWith('<feed')) {
      return {
        success: false,
        platform: 'rss',
        error: 'La URL no parece ser un feed RSS/Atom válido',
      }
    }

    // Verificar si contiene elementos de podcast (enclosures de audio o itunes namespace)
    const isPodcast = text.includes('xmlns:itunes') || 
                      text.includes('<enclosure') && text.includes('audio/') ||
                      text.includes('<itunes:') ||
                      text.includes('podcast') 

    // Extraer título básico
    const titleMatch = text.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i)
    const descMatch = text.match(/<description>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/description>/i)
    const imageMatch = text.match(/<itunes:image[^>]*href=["']([^"']+)["']/i) ||
                       text.match(/<image>\s*<url>([^<]+)<\/url>/i)
    const authorMatch = text.match(/<itunes:author>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/itunes:author>/i)

    return {
      success: true,
      platform: isPodcast ? 'rss' : 'rss',
      feedUrl: url,
      title: titleMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim()?.substring(0, 500),
      imageUrl: imageMatch?.[1],
      author: authorMatch?.[1]?.trim(),
    }
  } catch (error) {
    console.error('Error validating RSS feed:', error)
    return {
      success: false,
      platform: 'rss',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL - Detectar y obtener info
// ============================================================================

export async function getPodcastInfo(
  url: string, 
  fetchYouTubeChannelInfo?: (url: string) => Promise<any>
): Promise<PodcastPlatformResult> {
  const platform = detectPodcastPlatform(url)

  switch (platform) {
    case 'spotify':
      return getSpotifyPodcastInfo(url)
    
    case 'apple':
      return getApplePodcastInfo(url)
    
    case 'amazon':
      return getAmazonPodcastInfo(url)
    
    case 'youtube':
      if (fetchYouTubeChannelInfo) {
        return getYouTubePodcastInfo(url, fetchYouTubeChannelInfo)
      }
      return {
        success: false,
        platform: 'youtube',
        error: 'YouTube channel info fetcher not provided',
      }
    
    case 'rss':
      return validateRssPodcastFeed(url)
    
    default:
      // Intentar como RSS
      return validateRssPodcastFeed(url)
  }
}

// ============================================================================
// DETECTAR SI ES PODCAST
// ============================================================================

/**
 * Verifica rápidamente si una URL parece ser de un podcast
 */
export function isPodcastUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.toLowerCase()
    const path = urlObj.pathname.toLowerCase()
    const full = url.toLowerCase()

    // Plataformas conocidas de podcast
    if (host.includes('podcasts.apple.com')) return true
    if (host.includes('open.spotify.com') && full.includes('/show/')) return true
    if (host.includes('music.amazon') && full.includes('/podcasts/')) return true
    if (host.includes('youtube.com') && path.includes('/podcasts')) return true
    
    // Plataformas de hosting de podcast
    if (host.includes('anchor.fm')) return true
    if (host.includes('buzzsprout.com')) return true
    if (host.includes('transistor.fm')) return true
    if (host.includes('simplecast.com')) return true
    if (host.includes('megaphone.fm')) return true
    if (host.includes('art19.com')) return true
    if (host.includes('podbean.com')) return true
    if (host.includes('spreaker.com')) return true
    if (host.includes('libsyn.com')) return true
    if (host.includes('soundcloud.com')) return true
    if (host.includes('audioboom.com')) return true
    if (host.includes('overcast.fm')) return true
    if (host.includes('pocketcasts.com')) return true
    if (host.includes('castbox.fm')) return true
    if (host.includes('stitcher.com')) return true
    if (host.includes('ivoox.com')) return true
    
    // Palabras clave en la URL
    if (full.includes('podcast')) return true
    if (path.includes('/feed/podcast')) return true
    
    return false
  } catch {
    return false
  }
}
