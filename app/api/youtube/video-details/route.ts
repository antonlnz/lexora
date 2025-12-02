import { NextResponse } from 'next/server'

/**
 * API endpoint para obtener detalles de videos de YouTube
 * Obtiene duration, view_count y like_count usando la YouTube Data API v3
 * 
 * Puede recibir un solo videoId o múltiples (hasta 50 por petición)
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface VideoDetails {
  videoId: string
  duration: number | null // en segundos
  viewCount: number | null
  likeCount: number | null
}

interface YouTubeAPIResponse {
  items: Array<{
    id: string
    contentDetails?: {
      duration: string // ISO 8601 duration format (PT1H2M3S)
    }
    statistics?: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
    }
  }>
}

/**
 * Convierte una duración ISO 8601 (PT1H2M3S) a segundos
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

export async function POST(request: Request) {
  try {
    // Verificar que tenemos la API key
    if (!YOUTUBE_API_KEY) {
      console.warn('YOUTUBE_API_KEY not configured, using fallback method')
      // Fallback: intentar obtener datos de la página del video
      const { videoIds } = await request.json()
      const results = await getVideoDetailsFallback(videoIds)
      return NextResponse.json({ videos: results })
    }

    const { videoIds } = await request.json()

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'videoIds is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // La API de YouTube permite hasta 50 IDs por petición
    if (videoIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 video IDs per request' },
        { status: 400 }
      )
    }

    const results = await getVideoDetailsFromAPI(videoIds)
    return NextResponse.json({ videos: results })

  } catch (error) {
    console.error('Error fetching YouTube video details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Obtiene detalles de videos usando la YouTube Data API v3
 */
async function getVideoDetailsFromAPI(videoIds: string[]): Promise<VideoDetails[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'contentDetails,statistics')
  url.searchParams.set('id', videoIds.join(','))
  url.searchParams.set('key', YOUTUBE_API_KEY!)

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('YouTube API error:', errorText)
    throw new Error(`YouTube API error: ${response.status}`)
  }

  const data: YouTubeAPIResponse = await response.json()
  
  // Crear un mapa para acceso rápido
  const videoMap = new Map<string, VideoDetails>()
  
  // Inicializar con valores nulos para todos los IDs solicitados
  for (const id of videoIds) {
    videoMap.set(id, {
      videoId: id,
      duration: null,
      viewCount: null,
      likeCount: null,
    })
  }
  
  // Rellenar con datos de la API
  for (const item of data.items || []) {
    const details: VideoDetails = {
      videoId: item.id,
      duration: item.contentDetails?.duration 
        ? parseDuration(item.contentDetails.duration) 
        : null,
      viewCount: item.statistics?.viewCount 
        ? parseInt(item.statistics.viewCount, 10) 
        : null,
      likeCount: item.statistics?.likeCount 
        ? parseInt(item.statistics.likeCount, 10) 
        : null,
    }
    videoMap.set(item.id, details)
  }
  
  return Array.from(videoMap.values())
}

/**
 * Fallback: obtiene detalles de videos scrapeando las páginas de YouTube
 * Menos fiable pero no requiere API key
 */
async function getVideoDetailsFallback(videoIds: string[]): Promise<VideoDetails[]> {
  const results: VideoDetails[] = []
  
  for (const videoId of videoIds) {
    try {
      const details = await scrapeVideoDetails(videoId)
      results.push(details)
    } catch (error) {
      console.error(`Error scraping video ${videoId}:`, error)
      results.push({
        videoId,
        duration: null,
        viewCount: null,
        likeCount: null,
      })
    }
  }
  
  return results
}

/**
 * Scrapea los detalles de un video de YouTube desde la página
 */
async function scrapeVideoDetails(videoId: string): Promise<VideoDetails> {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`)
  }

  const html = await response.text()
  
  let duration: number | null = null
  let viewCount: number | null = null
  let likeCount: number | null = null

  // Buscar duración en el JSON embebido
  // Formato: "lengthSeconds":"123"
  const durationMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/)
  if (durationMatch) {
    duration = parseInt(durationMatch[1], 10)
  }

  // Buscar view count
  // Formato: "viewCount":"123456"
  const viewCountMatch = html.match(/"viewCount"\s*:\s*"(\d+)"/)
  if (viewCountMatch) {
    viewCount = parseInt(viewCountMatch[1], 10)
  }

  // Buscar like count (más difícil ya que YouTube lo oculta a veces)
  // Intentar varios patrones
  const likePatterns = [
    /"likeCount"\s*:\s*(\d+)/,
    /"likes"\s*:\s*"?(\d+)"?/,
    /"likesCount"\s*:\s*"?(\d+)"?/,
  ]
  
  for (const pattern of likePatterns) {
    const match = html.match(pattern)
    if (match) {
      likeCount = parseInt(match[1], 10)
      break
    }
  }

  return {
    videoId,
    duration,
    viewCount,
    likeCount,
  }
}

// También soportar GET para pruebas simples
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  
  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId query parameter is required' },
      { status: 400 }
    )
  }

  // Redirigir a POST con el array
  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoIds: [videoId] }),
  })
  
  return POST(postRequest)
}
