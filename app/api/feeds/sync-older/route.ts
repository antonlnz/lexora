import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RSSService } from '@/lib/services/rss-service'
import { SourceService } from '@/lib/services/source-service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Sync older: Unauthorized')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Obtener el sourceId del body si se proporciona
    const body = await request.json()
    const { sourceId } = body

    // console.log('Sync older request:', { userId: user.id, sourceId: sourceId || 'all' })

    // Crear instancias de los servicios con el cliente del servidor
    const sourceServiceWithServerClient = new SourceService(supabase)
    const rssServiceWithServerClient = new RSSService(supabase)
    
    // Obtener fuentes usando el servicio con el cliente del servidor
    const allSources = await sourceServiceWithServerClient.getUserSources(true)
    
    // console.log(`Sync older: getUserSources returned ${allSources.length} sources`)
    // console.log('Sync older: All sources:', allSources.map(s => ({ 
    //   id: s.id, 
    //   title: s.title, 
    //   type: s.source_type,
    //   is_active: s.user_source?.is_active
    // })))
    
    let sources = allSources.filter(s => s.source_type === 'rss')
    
    // console.log(`Sync older: Found ${sources.length} RSS sources for user`)
    
    if (sourceId) {
      // Sincronizar solo una fuente específica
      // El sourceId es el ID de content_sources, no de user_sources
      // console.log(`Sync older: Looking for source with id: ${sourceId}`)
      sources = sources.filter(s => s.id === sourceId)
      
      if (sources.length === 0) {
        console.error('Sync older: Source not found', { 
          requestedSourceId: sourceId,
          rssSources: allSources.filter(s => s.source_type === 'rss').map(s => ({ 
            id: s.id, 
            title: s.title 
          })),
          allSources: allSources.map(s => ({ 
            id: s.id, 
            title: s.title,
            type: s.source_type
          }))
        })
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        )
      }
      
      // console.log(`Sync older: Syncing specific source: ${sources[0].title}`)
    }

    if (sources.length === 0) {
      console.error('Sync older: No sources found')
      return NextResponse.json(
        { error: 'No sources found' },
        { status: 404 }
      )
    }

    // console.log(`Sync older: Found ${sources.length} sources to sync`)

    // Sincronizar artículos más antiguos (sin el filtro de 24 horas)
    let totalArticlesAdded = 0
    let totalArticlesUpdated = 0
    let successfulSyncs = 0
    let failedSyncs = 0

    for (const source of sources) {
      // console.log(`Syncing older articles from: ${source.title}`)
      const result = await rssServiceWithServerClient.syncFeedArticlesOlder(source)
      
      if (result.success) {
        successfulSyncs++
        totalArticlesAdded += result.articlesAdded
        totalArticlesUpdated += result.articlesUpdated
        // console.log(`  ✓ Success: +${result.articlesAdded} new, ~${result.articlesUpdated} updated`)
      } else {
        failedSyncs++
        console.error(`  ✗ Failed: ${result.error}`)
      }
    }

    // console.log(`Sync older completed: ${totalArticlesAdded} added, ${totalArticlesUpdated} updated`)

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
