import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONTENT_TYPE_TO_TABLE } from '@/types/content'
import type { ArticleWithUserData } from '@/types/database'
import { rateLimiter, getClientIdentifier, getCORSHeaders } from '@/lib/utils/security'

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Timeout para consultas (30 segundos)
// Nota: Supabase tiene su propio timeout, esto es una capa adicional
const QUERY_TIMEOUT = 30000

/**
 * GET /api/articles/[id]
 * Obtiene un artículo por ID sin requerir autenticación (público)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Manejar CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: getCORSHeaders(),
    })
  }

  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    if (!rateLimiter.isAllowed(clientId)) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: 60
        },
        { 
          status: 429,
          headers: {
            ...getCORSHeaders(),
            'Retry-After': '60',
            'X-RateLimit-Remaining': rateLimiter.getRemainingRequests(clientId).toString(),
          }
        }
      )
    }

    const supabase = await createClient()
    const { id } = await params
    const articleId = id?.trim()

    // Validar que el ID existe y tiene formato válido
    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Validar formato UUID
    if (!UUID_REGEX.test(articleId)) {
      return NextResponse.json(
        { error: 'Invalid article ID format' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Validar longitud (UUIDs tienen exactamente 36 caracteres)
    if (articleId.length !== 36) {
      return NextResponse.json(
        { error: 'Invalid article ID length' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Intentar obtener el artículo desde rss_content primero (el más común)
    let article: any = null
    let contentType: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'podcast' = 'rss'

    // Probar con rss_content primero
    // Nota: Supabase tiene timeout interno configurado en el cliente
    const { data: rssArticle, error: rssError } = await supabase
      .from('rss_content')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('id', articleId)
      .single()

    if (rssArticle && !rssError) {
      article = rssArticle
      contentType = 'rss'
    } else {
      // Probar con youtube_content
      const { data: youtubeArticle, error: youtubeError } = await supabase
        .from('youtube_content')
        .select(`
          *,
          source:content_sources(*)
        `)
        .eq('id', articleId)
        .single()

      if (youtubeArticle && !youtubeError) {
        article = youtubeArticle
        contentType = 'youtube'
      } else {
        // Probar con otros tipos de contenido
        const contentTypes: Array<'twitter' | 'instagram' | 'tiktok' | 'podcast'> = ['twitter', 'instagram', 'tiktok', 'podcast']
        
        for (const type of contentTypes) {
          const table = CONTENT_TYPE_TO_TABLE[type]
          const { data: content, error } = await supabase
            .from(table)
            .select(`
              *,
              source:content_sources(*)
            `)
            .eq('id', articleId)
            .single()

          if (content && !error) {
            article = content
            contentType = type
            break
          }
        }
      }
    }

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { 
          status: 404,
          headers: getCORSHeaders()
        }
      )
    }

    // Verificar si hay un usuario autenticado para obtener datos de user_content
    const { data: { user } } = await supabase.auth.getUser()
    let userContent = null

    if (user) {
      const { data: userContentData } = await supabase
        .from('user_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', articleId)
        .single()

      userContent = userContentData
    }

    // Si es RSS, construir la respuesta en el formato ArticleWithUserData
    if (contentType === 'rss') {
      const response: ArticleWithUserData = {
        ...article,
        source: article.source,
        user_article: userContent ? {
          ...userContent,
          article_id: userContent.content_id,
          reading_time_spent: userContent.time_spent
        } : null
      } as ArticleWithUserData

      return NextResponse.json(response, {
        headers: {
          ...getCORSHeaders(),
          'X-RateLimit-Remaining': rateLimiter.getRemainingRequests(clientId).toString(),
        }
      })
    }

    // Para otros tipos de contenido, devolver un formato similar
    return NextResponse.json({
      ...article,
      content_type: contentType,
      source: article.source,
      user_article: userContent ? {
        ...userContent,
        article_id: userContent.content_id,
        reading_time_spent: userContent.time_spent
      } : null
    }, {
      headers: {
        ...getCORSHeaders(),
        'X-RateLimit-Remaining': rateLimiter.getRemainingRequests(clientId).toString(),
      }
    })
  } catch (error) {
    // En producción, no exponer detalles del error
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching article:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: getCORSHeaders()
      }
    )
  }
}

