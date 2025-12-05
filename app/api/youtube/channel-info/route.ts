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

    const { channelId, avatarUrl, channelHandle, finalUrl, channelDescription, hasPodcast, podcastPlaylists } = channelInfo

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
      // Información sobre podcast - ahora devuelve todas las playlists
      hasPodcasts: hasPodcast || false,
      podcastPlaylists: podcastPlaylists || [],
      // Mantener compatibilidad con la playlist principal (la de más episodios)
      podcastPlaylistId: podcastPlaylists?.length > 0 ? podcastPlaylists[0].id : null,
      podcastsUrl: podcastPlaylists?.length > 0 ? podcastPlaylists[0].feedUrl : null,
    })
  } catch (error) {
    console.error('Error fetching YouTube channel info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface PodcastPlaylist {
  id: string
  title: string
  videoCount: number
  feedUrl: string
}

interface ChannelInfo {
  channelId: string
  avatarUrl: string | null
  channelHandle: string | null
  finalUrl: string
  channelDescription: string | null
  hasPodcast: boolean
  podcastPlaylists: PodcastPlaylist[]
}

/**
 * Resuelve el channel ID y avatar de una URL de YouTube
 * Soporta URLs de canales, handles, usuarios y vídeos individuales
 */
async function resolveChannelInfo(url: string): Promise<ChannelInfo | null> {
  // Verificar si es una URL de vídeo (watch?v= o youtu.be/)
  const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (videoIdMatch) {
    // Extraer el canal del vídeo
    return await resolveChannelFromVideo(videoIdMatch[1])
  }

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
 * Obtiene la información del canal a partir de un video ID
 */
async function resolveChannelFromVideo(videoId: string): Promise<ChannelInfo | null> {
  try {
    // Hacer fetch de la página del vídeo para extraer el channel ID
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) return null

    const html = await response.text()

    // Extraer el channelId del vídeo
    // Método 1: Buscar en ownerChannelId (más fiable para vídeos)
    let channelId: string | null = null
    const ownerChannelMatch = html.match(/"ownerChannelName"[^}]*"externalChannelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
    if (ownerChannelMatch) {
      channelId = ownerChannelMatch[1]
    }

    // Método 2: Buscar channelId junto con ownerUrls
    if (!channelId) {
      const channelMatch = html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"[^}]*"ownerUrls"/)
      if (channelMatch) {
        channelId = channelMatch[1]
      }
    }

    // Método 3: Buscar externalChannelId directamente
    if (!channelId) {
      const extMatch = html.match(/"externalChannelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
      if (extMatch) {
        channelId = extMatch[1]
      }
    }

    // Método 4: Fallback a cualquier channelId
    if (!channelId) {
      const fallbackMatch = html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)
      if (fallbackMatch) {
        channelId = fallbackMatch[1]
      }
    }

    if (!channelId) return null

    // Ahora obtenemos la información completa del canal
    return await fetchChannelPage(`https://www.youtube.com/channel/${channelId}`)
  } catch (error) {
    console.error('Error resolving channel from video:', error)
    return null
  }
}

/**
 * Hace fetch de una página de canal y extrae channelId y avatar
 * También detecta si hubo una redirección a un canal diferente
 * y si el canal tiene podcasts
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

    // Detectar si el canal tiene podcasts
    // Los podcasts de YouTube aparecen como tabs en el canal
    // El nombre puede variar según el idioma: "Podcasts", "Pódcasts", "Podcast", etc.
    // IMPORTANTE: YouTube ahora muestra la pestaña "Podcasts" en todos los canales,
    // aunque esté vacía. Por eso debemos verificar que haya contenido real.
    let hasPodcast = false
    let podcastPlaylists: PodcastPlaylist[] = []

    // Primero verificamos si tiene la pestaña de podcasts
    const hasPodcastTab = /"title"\s*:\s*"P[oó]dcasts?"/i.test(html)
    
    // Solo si tiene la pestaña, verificamos si hay contenido real
    if (hasPodcastTab && channelHandle) {
      try {
        const podcastPageUrl = `https://www.youtube.com/@${channelHandle}/podcasts`
        const podcastResponse = await fetch(podcastPageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
          redirect: 'follow',
        })
        
        if (podcastResponse.ok) {
          const podcastHtml = await podcastResponse.text()
          
          // Verificar que realmente hay contenido de podcasts (playlists)
          // y no solo una página vacía con placeholders
          const hasPlaylistContent = 
            podcastHtml.includes('"playlistRenderer"') || 
            podcastHtml.includes('"gridPlaylistRenderer"') ||
            podcastHtml.includes('"lockupViewModel"') || // Nuevo formato de YouTube
            podcastHtml.includes('"richGridRenderer"') // Otro formato posible
          
          // Verificar que NO sea una página vacía o de error
          const isEmptyOrError = 
            podcastHtml.includes('This channel doesn') || 
            podcastHtml.includes('This page isn') ||
            podcastHtml.includes('Este canal no') ||
            podcastHtml.includes('Esta página no')
          
          // Buscar TODAS las playlists con su información completa
          const playlistsData: Array<{ id: string; title: string; count: number }> = []
          
          // Buscar todas las playlists únicas con sus títulos
          // El formato típico es: "playlistId":"PLxxx"..."title":{"runs":[{"text":"Título"}]}
          const playlistRegex = /"playlistId"\s*:\s*"(PL[A-Za-z0-9_-]+)"/g
          const foundPlaylists = new Set<string>()
          let plMatch
          while ((plMatch = playlistRegex.exec(podcastHtml)) !== null) {
            foundPlaylists.add(plMatch[1])
          }
          
          // Para cada playlist, extraer título y count del contexto cercano
          for (const playlistId of foundPlaylists) {
            const playlistIndex = podcastHtml.indexOf(`"playlistId":"${playlistId}"`)
            if (playlistIndex === -1) continue
            
            // Buscar un bloque más amplio para encontrar el título (más hacia atrás porque el título suele estar antes)
            const contextStart = Math.max(0, playlistIndex - 2000)
            const contextEnd = Math.min(podcastHtml.length, playlistIndex + 1500)
            const playlistContext = podcastHtml.substring(contextStart, contextEnd)
            
            // Buscar el título - puede estar en varios formatos
            // El título suele estar en un objeto que contiene el playlistId
            let title = 'Podcast'
            
            // Formato más común: "title":{"runs":[{"text":"Nombre del Podcast"}]}
            const titleRunsMatch = playlistContext.match(/"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/)
            // Formato alternativo: "title":{"simpleText":"Nombre"}
            const titleSimpleMatch = playlistContext.match(/"title"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/)
            // Otro formato: "label":"Nombre","playlistId"
            const labelMatch = playlistContext.match(/"label"\s*:\s*"([^"]+)"\s*[,}]/)
            // Formato lockupViewModel: "metadata":{"lockupMetadataViewModel":{"title":{"content":"Nombre"}
            const lockupTitleMatch = playlistContext.match(/"title"\s*:\s*\{\s*"content"\s*:\s*"([^"]+)"/)
            // Formato accessibilityData: "accessibilityData":{"label":"Nombre - Playlist
            const accessibilityMatch = playlistContext.match(/"accessibilityData"\s*:\s*\{\s*"label"\s*:\s*"([^"\\-]+)/)
            
            if (titleRunsMatch) {
              title = titleRunsMatch[1]
            } else if (titleSimpleMatch) {
              title = titleSimpleMatch[1]
            } else if (lockupTitleMatch) {
              title = lockupTitleMatch[1]
            } else if (labelMatch && labelMatch[1].length < 100) {
              title = labelMatch[1]
            } else if (accessibilityMatch) {
              title = accessibilityMatch[1].trim()
            }
            
            // Limpiar el título de caracteres escapados
            title = title.replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            
            // Buscar videoCount o videoCountText
            const countMatch = playlistContext.match(/"videoCount"\s*:\s*"?(\d+)"?/) ||
                               playlistContext.match(/"text"\s*:\s*"(\d+)\s*(?:videos?|episodios?)"/i) ||
                               playlistContext.match(/"videoCountText"[^}]*"text"\s*:\s*"(\d+)/) ||
                               playlistContext.match(/"videoCountShortText"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"(\d+)/)
            
            const count = countMatch ? parseInt(countMatch[1], 10) : 0
            
            // Evitar duplicados
            if (!playlistsData.some(p => p.id === playlistId)) {
              playlistsData.push({ id: playlistId, title, count })
            }
          }
          
          const hasRealPlaylists = playlistsData.length > 0
          
          if ((hasPlaylistContent || hasRealPlaylists) && !isEmptyOrError) {
            hasPodcast = true
            
            // Ordenar por count descendente y construir array de playlists
            if (playlistsData.length > 0) {
              playlistsData.sort((a, b) => b.count - a.count)
              podcastPlaylists = playlistsData.map(p => ({
                id: p.id,
                title: p.title,
                videoCount: p.count,
                feedUrl: `https://www.youtube.com/feeds/videos.xml?playlist_id=${p.id}`
              }))
            }
          }
        }
      } catch {
        // Ignorar errores en la verificación de podcasts
      }
    }
    
    // Fallback: Si no pudimos verificar la página pero encontramos un playlistId
    // en la página principal asociado a podcasts, considerarlo válido
    if (!hasPodcast && hasPodcastTab) {
      const podcastTabMatch = html.match(/"tabRenderer"[^}]*"title"\s*:\s*"P[oó]dcasts?"[^}]*"browseId"\s*:\s*"(VL[A-Za-z0-9_-]+|PL[A-Za-z0-9_-]+)"/i)
      if (podcastTabMatch) {
        hasPodcast = true
        let playlistId = podcastTabMatch[1]
        if (playlistId.startsWith('VL')) {
          playlistId = 'PL' + playlistId.slice(2)
        }
        podcastPlaylists = [{
          id: playlistId,
          title: 'Podcast',
          videoCount: 0,
          feedUrl: `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
        }]
      }
    }

    return { 
      channelId, 
      avatarUrl, 
      channelHandle, 
      finalUrl, 
      channelDescription,
      hasPodcast,
      podcastPlaylists,
    }
  } catch {
    return null
  }
}
