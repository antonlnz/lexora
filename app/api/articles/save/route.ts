import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contentService } from '@/lib/services/content-service'
import { SOURCE_TYPE_TO_CONTENT_TYPE } from '@/types/content'
import { getCORSHeaders } from '@/lib/utils/security'

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * POST /api/articles/save
 * Guarda o desguarda un artículo como favorito
 */
export async function POST(request: Request) {
  // Manejar CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: getCORSHeaders(),
    })
  }

  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: getCORSHeaders()
        }
      )
    }

    const body = await request.json()
    const { articleId, isFavorite } = body

    // Validar articleId
    if (!articleId || typeof articleId !== 'string') {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Validar formato UUID
    if (!UUID_REGEX.test(articleId.trim())) {
      return NextResponse.json(
        { error: 'Invalid article ID format' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Validar isFavorite
    if (typeof isFavorite !== 'boolean') {
      return NextResponse.json(
        { error: 'isFavorite must be a boolean' },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }

    // Determinar el tipo de contenido buscando el artículo
    // Intentar con rss_content primero
    let contentType: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'podcast' = 'rss'
    
    const { data: rssArticle } = await supabase
      .from('rss_content')
      .select('id, source:content_sources(source_type)')
      .eq('id', articleId)
      .single()

    if (rssArticle) {
      const sourceType = (rssArticle.source as any)?.source_type
      contentType = SOURCE_TYPE_TO_CONTENT_TYPE[sourceType] || 'rss'
    } else {
      // Probar con otros tipos
      const { data: youtubeArticle } = await supabase
        .from('youtube_content')
        .select('id')
        .eq('id', articleId)
        .single()

      if (youtubeArticle) {
        contentType = 'youtube'
      } else {
        // Por defecto, asumir RSS
        contentType = 'rss'
      }
    }

    // Usar el servicio para guardar/desguardar
    await contentService.toggleFavorite(contentType, articleId, isFavorite)

    return NextResponse.json({
      success: true,
      isFavorite
    }, {
      headers: getCORSHeaders()
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error saving article:', error)
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

