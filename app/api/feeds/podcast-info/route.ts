import { NextResponse } from 'next/server'
import { getPodcastInfo, detectPodcastPlatform, isPodcastUrl } from '@/lib/source-handlers/podcast-platforms'

/**
 * POST /api/feeds/podcast-info
 * 
 * Obtiene información de un podcast desde múltiples plataformas:
 * - Spotify
 * - Apple Podcasts  
 * - Amazon Music
 * - YouTube Podcasts
 * - RSS directo
 * 
 * Body: { url: string }
 * Response: { success, platform, feedUrl?, title?, description?, imageUrl?, author?, error? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validar URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Función helper para obtener info de canal de YouTube
    const fetchYouTubeChannelInfo = async (ytUrl: string) => {
      // Llamar a nuestro propio endpoint interno
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      
      const response = await fetch(`${baseUrl}/api/youtube/channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
      })

      if (response.ok) {
        return response.json()
      }
      return null
    }

    // Obtener información del podcast
    const result = await getPodcastInfo(url, fetchYouTubeChannelInfo)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in podcast-info endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/feeds/podcast-info?url=...
 * 
 * Variante GET para verificación rápida
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { isPodcast: false, platform: 'unknown' },
      { status: 200 }
    )
  }

  const platform = detectPodcastPlatform(url)
  const isPodcast = isPodcastUrl(url)

  return NextResponse.json({
    isPodcast,
    platform,
    url,
  })
}
