import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rssService } from '@/lib/services/rss-service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Obtener sourceId opcional del body
    let sourceId: string | undefined
    try {
      const body = await request.json()
      sourceId = body.sourceId
    } catch {
      // No body o JSON inválido - sincronizar todo
    }

    // Si se proporciona sourceId, sincronizar solo esa fuente
    if (sourceId) {
      // Verificar que la fuente pertenece al usuario
      const { data: source, error: sourceError } = await supabase
        .from('sources')
        .select('*')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .eq('source_type', 'rss')
        .eq('is_active', true)
        .single()

      if (sourceError || !source) {
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        )
      }

      const result = await rssService.syncFeedArticles(source)

      return NextResponse.json({
        success: result.success,
        articlesAdded: result.articlesAdded,
        articlesUpdated: result.articlesUpdated,
        error: result.error,
      })
    }

    // Sincronizar todos los feeds del usuario
    const result = await rssService.syncUserFeeds(user.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error refreshing feeds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint para verificar el estado de sincronización
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Obtener información de las fuentes
    const { data: sources, error } = await supabase
      .from('sources')
      .select('id, title, url, last_fetched_at, fetch_error, is_active')
      .eq('user_id', user.id)
      .eq('source_type', 'rss')
      .eq('is_active', true)

    if (error) {
      throw error
    }

    // Calcular estadísticas
    const now = new Date()
    const recentlyFetched = sources?.filter(source => {
      if (!source.last_fetched_at) return false
      const lastFetch = new Date(source.last_fetched_at)
      const minutesAgo = (now.getTime() - lastFetch.getTime()) / (1000 * 60)
      return minutesAgo < 30 // Consideramos "reciente" si fue en los últimos 30 minutos
    }).length || 0

    const withErrors = sources?.filter(source => source.fetch_error).length || 0

    return NextResponse.json({
      totalSources: sources?.length || 0,
      recentlyFetched,
      withErrors,
      sources,
    })
  } catch (error) {
    console.error('Error getting feed status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
