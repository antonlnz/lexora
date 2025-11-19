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

    // Obtener el sourceId del body si se proporciona
    const body = await request.json()
    const { sourceId } = body

    let sources
    if (sourceId) {
      // Sincronizar solo una fuente específica
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', sourceId)
        .eq('source_type', 'rss')
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        )
      }
      sources = [data]
    } else {
      // Sincronizar todas las fuentes del usuario
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_type', 'rss')
        .eq('is_active', true)

      if (error || !data) {
        return NextResponse.json(
          { error: 'No sources found' },
          { status: 404 }
        )
      }
      sources = data
    }

    // Sincronizar artículos más antiguos (sin el filtro de 24 horas)
    let totalArticlesAdded = 0
    let totalArticlesUpdated = 0
    let successfulSyncs = 0
    let failedSyncs = 0

    for (const source of sources) {
      const result = await rssService.syncFeedArticlesOlder(source)
      
      if (result.success) {
        successfulSyncs++
        totalArticlesAdded += result.articlesAdded
        totalArticlesUpdated += result.articlesUpdated
      } else {
        failedSyncs++
      }
    }

    return NextResponse.json({
      success: true,
      totalSources: sources.length,
      successfulSyncs,
      failedSyncs,
      totalArticlesAdded,
      totalArticlesUpdated,
    })
  } catch (error) {
    console.error('Error syncing older feeds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
