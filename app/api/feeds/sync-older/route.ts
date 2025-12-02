import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sourceSyncService, getHandler } from '@/lib/source-handlers'
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

    // Crear instancia del servicio de fuentes con el cliente del servidor
    const sourceServiceWithServerClient = new SourceService(supabase)
    
    // Obtener fuentes usando el servicio
    const allSources = await sourceServiceWithServerClient.getUserSources(true)
    
    // Filtrar solo fuentes con handler disponible
    let sources = allSources.filter(s => getHandler(s.source_type))
    
    if (sourceId) {
      // Sincronizar solo una fuente específica
      sources = sources.filter(s => s.id === sourceId)
      
      if (sources.length === 0) {
        console.error('Sync older: Source not found', { requestedSourceId: sourceId })
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        )
      }
    }

    if (sources.length === 0) {
      console.error('Sync older: No sources found')
      return NextResponse.json(
        { error: 'No sources found' },
        { status: 404 }
      )
    }

    // Sincronizar usando el servicio unificado con fullSync=true
    const result = await sourceSyncService.syncSources(sources, supabase, { fullSync: true })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error syncing older feeds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
