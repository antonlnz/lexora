import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sourceSyncService, getHandler } from '@/lib/source-handlers'
import type { SourceWithUserData } from '@/lib/services/source-service'

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
      try {
        // Obtener la fuente directamente
        const { data: userSourcesData, error: sourcesError } = await supabase
          .from('user_sources')
          .select(`
            *,
            source:content_sources(*)
          `)
          .eq('user_id', user.id)
          .eq('source_id', sourceId)
          .single()

        if (sourcesError || !userSourcesData) {
          console.error(`[REFRESH] Error fetching source ${sourceId}:`, sourcesError)
          
          return NextResponse.json(
            { error: 'Source not found or not active' },
            { status: 404 }
          )
        }

        // Transformar a SourceWithUserData
        const source: SourceWithUserData = {
          ...userSourcesData.source,
          user_source: {
            id: userSourcesData.id,
            user_id: userSourcesData.user_id,
            source_id: userSourcesData.source_id,
            custom_title: userSourcesData.custom_title,
            is_active: userSourcesData.is_active,
            notification_enabled: userSourcesData.notification_enabled,
            folder: userSourcesData.folder,
            tags: userSourcesData.tags,
            subscribed_at: userSourcesData.subscribed_at,
            updated_at: userSourcesData.updated_at
          }
        } as SourceWithUserData

        // Verificar si hay un handler para este tipo de fuente
        const handler = getHandler(source.source_type)
        if (!handler) {
          return NextResponse.json({
            success: true,
            message: `No handler for source type: ${source.source_type}`,
            articlesAdded: 0,
            articlesUpdated: 0,
          })
        }

        // Usar el servicio unificado de sincronización
        const result = await sourceSyncService.syncSource(source, supabase)

        return NextResponse.json({
          success: result.success,
          articlesAdded: result.articlesAdded,
          articlesUpdated: result.articlesUpdated,
          error: result.error,
        })
      } catch (error) {
        console.error(`Error syncing source ${sourceId}:`, error)
        return NextResponse.json(
          { error: 'Error syncing source', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        )
      }
    }

    // Sincronizar todos los feeds del usuario
    // Obtener todas las fuentes activas
    const { data: userSourcesData, error: sourcesError } = await supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (sourcesError) {
      console.error('Error fetching user sources:', sourcesError)
      return NextResponse.json(
        { error: 'Error fetching sources' },
        { status: 500 }
      )
    }

    // Filtrar solo fuentes con handler disponible y transformar
    const sources = (userSourcesData || [])
      .filter((item: any) => item.source && getHandler(item.source.source_type))
      .map((item: any) => ({
        ...item.source,
        user_source: item
      }))

    const result = await sourceSyncService.syncSources(sources, supabase)

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

    // Obtener fuentes RSS activas del usuario directamente
    const { data: userSourcesData, error: sourcesError } = await supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (sourcesError) {
      console.error('Error fetching user sources:', sourcesError)
      return NextResponse.json(
        { error: 'Error fetching sources' },
        { status: 500 }
      )
    }

    const sources = (userSourcesData || [])
      .filter((item: any) => item.source?.source_type === 'rss')
      .map((item: any) => ({
        id: item.source.id,
        title: item.source.title,
        url: item.source.url,
        last_fetched_at: item.source.last_fetched_at,
        fetch_error: item.source.fetch_error,
        is_active: item.is_active
      }))

    // Calcular estadísticas
    const now = new Date()
    const recentlyFetched = sources.filter((source: any) => {
      if (!source.last_fetched_at) return false
      const lastFetch = new Date(source.last_fetched_at)
      const minutesAgo = (now.getTime() - lastFetch.getTime()) / (1000 * 60)
      return minutesAgo < 30 // Consideramos "reciente" si fue en los últimos 30 minutos
    }).length || 0

    const withErrors = sources.filter((source: any) => source.fetch_error).length || 0

    return NextResponse.json({
      totalSources: sources.length,
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
