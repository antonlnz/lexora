import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/feeds/validate
 * Verifica si una URL es un feed RSS/Atom válido
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validar que sea una URL válida
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { isRss: false, isPodcast: false },
        { status: 200 }
      )
    }

    // Hacer fetch de la URL con timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Lexora RSS Reader/1.0',
          'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json(
          { isRss: false, isPodcast: false },
          { status: 200 }
        )
      }

      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()

      // Verificar el content-type
      const isXmlContentType = 
        contentType.includes('xml') || 
        contentType.includes('rss') ||
        contentType.includes('atom')

      // Verificar el contenido del documento
      const hasRssTag = /<rss[\s>]/i.test(text)
      const hasAtomTag = /<feed[\s>]/i.test(text) && text.includes('xmlns="http://www.w3.org/2005/Atom"')
      const hasRdfTag = /<rdf:RDF/i.test(text)
      const hasChannelTag = /<channel[\s>]/i.test(text)
      const hasItemTag = /<item[\s>]/i.test(text) || /<entry[\s>]/i.test(text)

      // Es RSS/Atom si tiene las etiquetas correctas
      const isRss = hasRssTag || hasAtomTag || hasRdfTag || (hasChannelTag && hasItemTag)

      if (!isRss) {
        return NextResponse.json(
          { isRss: false, isPodcast: false },
          { status: 200 }
        )
      }

      // Detectar si es un podcast (tiene elementos de audio/enclosure)
      const isPodcast = 
        /<enclosure[^>]+type=["']audio/i.test(text) ||
        /<itunes:/.test(text) ||
        /<podcast:/.test(text) ||
        /<media:content[^>]+type=["']audio/i.test(text)

      // Extraer título del feed
      let title: string | undefined
      const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      }

      // Extraer descripción del feed (usando [\s\S] en lugar de 's' flag para compatibilidad)
      let description: string | undefined
      const descMatch = text.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
      if (descMatch) {
        description = descMatch[1].trim()
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/<[^>]+>/g, '') // Eliminar tags HTML
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .substring(0, 500) // Limitar longitud
      }

      // Si no hay descripción, intentar con subtitle (Atom)
      if (!description) {
        const subtitleMatch = text.match(/<subtitle[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/subtitle>/i)
        if (subtitleMatch) {
          description = subtitleMatch[1].trim()
            .replace(/<!\[CDATA\[|\]\]>/g, '')
            .replace(/<[^>]+>/g, '')
            .substring(0, 500)
        }
      }

      return NextResponse.json({
        isRss: true,
        isPodcast,
        title,
        description,
        contentType,
      })

    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        console.error('Feed validation timeout:', url)
      } else {
        console.error('Feed validation error:', fetchError.message)
      }

      return NextResponse.json(
        { isRss: false, isPodcast: false },
        { status: 200 }
      )
    }

  } catch (error) {
    console.error('Error in feed validation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
