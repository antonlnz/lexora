import { NextResponse } from 'next/server'

/**
 * API endpoint para obtener información de un canal de YouTube
 * Evita problemas de CORS al hacer la petición desde el servidor
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Verificar que sea una URL de YouTube
    const urlObj = new URL(url)
    const host = urlObj.hostname.replace(/^www\./, '').toLowerCase()
    
    if (!host.includes('youtube.com') && host !== 'youtu.be') {
      return NextResponse.json(
        { error: 'Not a YouTube URL' },
        { status: 400 }
      )
    }

    // Obtener el channel ID y avatar
    const channelInfo = await resolveChannelInfo(url)
    
    if (!channelInfo) {
      return NextResponse.json(
        { error: 'Could not resolve channel ID' },
        { status: 404 }
      )
    }

    const { channelId, avatarUrl, channelHandle, finalUrl, channelDescription } = channelInfo

    // Detectar si hubo una redirección a un canal diferente
    const originalHandle = url.match(/youtube\.com\/@([\w-]+)/)?.[1]?.toLowerCase()
    const finalHandle = channelHandle?.toLowerCase()
    const wasRedirected = originalHandle && finalHandle && originalHandle !== finalHandle

    // Obtener el feed RSS del canal
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const feedResponse = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Lexora/1.0',
      },
    })

    if (!feedResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch channel feed' },
        { status: feedResponse.status }
      )
    }

    const xml = await feedResponse.text()

    // Extraer el título del canal del feed
    const titleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/)
    const channelName = titleMatch?.[1]?.trim() || null

    return NextResponse.json({
      channelId,
      channelName,
      channelDescription,
      feedUrl,
      avatarUrl,
      // Información sobre redirección
      wasRedirected,
      originalHandle: originalHandle || null,
      finalHandle: channelHandle || null,
      finalUrl,
    })
  } catch (error) {
    console.error('Error fetching YouTube channel info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ChannelInfo {
  channelId: string
  avatarUrl: string | null
  channelHandle: string | null
  finalUrl: string
  channelDescription: string | null
}

/**
 * Resuelve el channel ID y avatar de una URL de YouTube
 */
async function resolveChannelInfo(url: string): Promise<ChannelInfo | null> {
  // Verificar si ya tiene channel ID directo
  const channelIdMatch = url.match(/\/channel\/(UC[A-Za-z0-9_-]+)/)
  if (channelIdMatch) {
    // Necesitamos hacer fetch de la página para obtener el avatar
    return await fetchChannelPage(`https://www.youtube.com/channel/${channelIdMatch[1]}`)
  }

  // Verificar si es un feed RSS
  const rssMatch = url.match(/[?&]channel_id=(UC[A-Za-z0-9_-]+)/)
  if (rssMatch) {
    return await fetchChannelPage(`https://www.youtube.com/channel/${rssMatch[1]}`)
  }

  // Intentar extraer handle/username y hacer fetch de la página
  const handleMatch = url.match(/youtube\.com\/@([\w-]+)/)
  const usernameMatch = url.match(/youtube\.com\/(?:c|user)\/([\w-]+)/)
  const identifier = handleMatch?.[1] || usernameMatch?.[1]

  if (!identifier) return null

  const pageUrl = handleMatch 
    ? `https://www.youtube.com/@${identifier}`
    : `https://www.youtube.com/c/${identifier}`

  return await fetchChannelPage(pageUrl)
}

/**
 * Hace fetch de una página de canal y extrae channelId y avatar
 * También detecta si hubo una redirección a un canal diferente
 */
async function fetchChannelPage(pageUrl: string): Promise<ChannelInfo | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow', // Seguir redirecciones
    })

    if (!response.ok) return null

    const html = await response.text()
    const finalUrl = response.url // URL final después de redirecciones

    // Buscar channelId de forma específica para el canal principal de la página
    let channelId: string | null = null
    
    // Método 1: Buscar el externalId que es el ID del canal principal
    const externalIdMatch = html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
    if (externalIdMatch) {
      channelId = externalIdMatch[1]
    }
    
    // Método 2: Buscar en la URL canónica <link rel="canonical" href="...">
    if (!channelId) {
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)["']/i)
      if (canonicalMatch) {
        channelId = canonicalMatch[1]
      }
    }
    
    // Método 3: Buscar browseId en el contexto inicial del canal
    if (!channelId) {
      const browseIdMatch = html.match(/"browseId"\s*:\s*"(UC[A-Za-z0-9_-]+)"[^}]*"canonicalBaseUrl"/)
      if (browseIdMatch) {
        channelId = browseIdMatch[1]
      }
    }

    // Método 4: Buscar channelId junto con vanityChannelUrl (más específico)
    if (!channelId) {
      const vanityMatch = html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"[^}]*"vanityChannelUrl"/)
      if (vanityMatch) {
        channelId = vanityMatch[1]
      }
    }

    // Método 5 (fallback): Primer channelId que aparece cerca de "ownerUrls" o "header"
    if (!channelId) {
      const headerMatch = html.match(/"header"[^}]*"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
      if (headerMatch) {
        channelId = headerMatch[1]
      }
    }

    // Último fallback: primera aparición de channelId (menos fiable)
    if (!channelId) {
      const jsonMatch = html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
      if (jsonMatch) {
        channelId = jsonMatch[1]
      }
    }

    if (!channelId) return null

    // Extraer el handle/nombre del canal desde la URL final
    let channelHandle: string | null = null
    const handleMatch = finalUrl.match(/youtube\.com\/@([\w-]+)/)
    if (handleMatch) {
      channelHandle = handleMatch[1]
    }

    // Extraer el avatar del canal
    let avatarUrl: string | null = null
    
    // Buscar en el JSON embebido: "avatar":{"thumbnails":[{"url":"..."
    const avatarMatch = html.match(/"avatar":\s*\{\s*"thumbnails":\s*\[\s*\{\s*"url":\s*"([^"]+)"/)
    if (avatarMatch) {
      avatarUrl = avatarMatch[1]
      // Asegurar protocolo https
      if (avatarUrl.startsWith('//')) {
        avatarUrl = 'https:' + avatarUrl
      }
    }

    // Fallback: buscar og:image
    if (!avatarUrl) {
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
      if (ogMatch) {
        avatarUrl = ogMatch[1]
      }
    }

    // Extraer la descripción del canal
    let channelDescription: string | null = null
    
    // Método 1: Buscar og:description (meta tag)
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)
    if (ogDescMatch && ogDescMatch[1]) {
      channelDescription = ogDescMatch[1].trim()
    }
    
    // Método 2: Buscar meta description
    if (!channelDescription) {
      const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      if (metaDescMatch && metaDescMatch[1]) {
        channelDescription = metaDescMatch[1].trim()
      }
    }
    
    // Método 3: Buscar en el JSON embebido "description":"..."
    if (!channelDescription) {
      const jsonDescMatch = html.match(/"description"\s*:\s*"([^"]{10,500})"/)
      if (jsonDescMatch && jsonDescMatch[1]) {
        // Decodificar caracteres escapados
        channelDescription = jsonDescMatch[1]
          .replace(/\\n/g, ' ')
          .replace(/\\r/g, '')
          .replace(/\\t/g, ' ')
          .replace(/\\"/g, '"')
          .trim()
      }
    }

    return { channelId, avatarUrl, channelHandle, finalUrl, channelDescription }
  } catch {
    return null
  }
}
