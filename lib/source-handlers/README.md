# Source Handlers

Sistema extensible para manejar diferentes tipos de fuentes de contenido en Lexora.

## Arquitectura

El sistema de handlers sigue un patrón de Plugin/Strategy que permite añadir nuevos tipos de fuentes de manera sencilla sin modificar el código existente.

```
lib/source-handlers/
├── index.ts          # Registro central y servicio de sincronización (SOLO SERVIDOR)
├── client.ts         # Utilidades para componentes cliente (SAFE PARA NAVEGADOR)
├── types.ts          # Interfaces y tipos base
├── rss.ts            # Handler para RSS, newsletters y websites
├── youtube.ts        # Handler para YouTube (canales y videos)
├── podcast.ts        # Handler para Podcasts
└── README.md         # Esta documentación
```

## ⚠️ Importante: Cliente vs Servidor

Los handlers completos (`index.ts`, `rss.ts`, etc.) usan librerías de Node.js como `jsdom` y **NO pueden importarse en componentes del cliente**.

Para código que se ejecuta en el navegador, usar:

```typescript
// ✅ CORRECTO - Para componentes "use client"
import { detectSourceType, getYoutubeRssFeedUrl } from '@/lib/source-handlers/client'

// ❌ INCORRECTO - Causará errores de "Module not found: fs, child_process, etc."
import { detectSourceType } from '@/lib/source-handlers'
```

### ¿Cuándo usar cada uno?

| Archivo | Uso | Ejemplos |
|---------|-----|----------|
| `client.ts` | Componentes React del navegador | `add-source-dialog.tsx`, cualquier componente con `"use client"` |
| `index.ts` | Rutas API, Server Components, servicios | `api/feeds/refresh/route.ts`, `rss-service.ts` |

## Cómo añadir un nuevo tipo de fuente
Cómo añadir un nuevo tipo de fuente
Crear el handler en lib/source-handlers/nuevo-tipo.ts implementando SourceHandler
Registrarlo en index.ts
Añadir el tipo en database.ts si es nuevo
Opcionalmente crear tabla de contenido en Supabase

### 1. Crear el archivo del handler

Crea un nuevo archivo en `lib/source-handlers/` (ej: `twitter.ts`):

```typescript
import type { 
  SourceHandler, 
  HandlerOptions, 
  HandlerContext,
  FeedInfo, 
  SyncResult,
  DetectionResult 
} from './types'
import type { SourceType, ContentSource, UserSource } from '@/types/database'

export class TwitterHandler implements SourceHandler {
  // Tipo(s) de fuente que maneja este handler
  readonly type: SourceType = 'twitter'
  
  // Información para la UI
  readonly displayName = 'Twitter'
  readonly description = 'Twitter profiles and lists'
  readonly iconName = 'Twitter'  // Icono de lucide-react
  readonly colorClasses = 'bg-sky-500/10 text-sky-600 border-sky-500/20'
  
  // Patrones de URL que reconoce este handler
  readonly urlPatterns = [
    /twitter\.com\/@?[\w]+/,
    /x\.com\/@?[\w]+/,
  ]

  // Implementar métodos requeridos...
  async detectUrl(url: string): Promise<DetectionResult> {
    // Detectar si la URL pertenece a este handler
  }

  async fetchFeed(url: string, options?: HandlerOptions): Promise<FeedInfo | null> {
    // Obtener contenido de la fuente
  }

  async syncContent(context: HandlerContext): Promise<SyncResult> {
    // Sincronizar contenido reciente (últimas 24h)
  }

  async syncAllContent(context: HandlerContext): Promise<SyncResult> {
    // Sincronizar todo el contenido (sin filtro de tiempo)
  }

  isValidUrl(url: string): boolean {
    // Validar si una URL es válida para este handler
  }
}

export const twitterHandler = new TwitterHandler()
```

### 2. Registrar el handler

En `lib/source-handlers/index.ts`, importa y registra el handler:

```typescript
// Importar el handler
import { twitterHandler, TwitterHandler } from './twitter'

// En la función registerBuiltInHandlers():
function registerBuiltInHandlers(): void {
  registerHandler(youtubeHandler)
  registerHandler(podcastHandler)
  registerHandler(twitterHandler)  // <-- Añadir aquí
  registerHandler(rssHandler)      // RSS siempre al final como fallback
}

// Re-exportar para uso directo
export { twitterHandler, TwitterHandler } from './twitter'
```

### 3. Añadir el tipo en database.ts

Si es un tipo nuevo, añádelo en `types/database.ts`:

```typescript
export type SourceType = 
  | 'rss' 
  | 'youtube_channel' 
  | 'youtube_video' 
  | 'twitter'      // <-- Añadir aquí
  | 'instagram' 
  | 'tiktok' 
  | 'newsletter' 
  | 'website' 
  | 'podcast'
```

### 4. Crear la tabla de contenido (si es necesario)

Si el tipo de contenido necesita campos específicos, crea una nueva tabla en Supabase:

```sql
CREATE TABLE twitter_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  url TEXT NOT NULL,
  -- ... más campos específicos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Interfaz SourceHandler

Cada handler debe implementar la interfaz `SourceHandler`:

```typescript
interface SourceHandler {
  // Identificación
  readonly type: SourceType | SourceType[]
  readonly displayName: string
  readonly description: string
  readonly iconName: string
  readonly colorClasses: string
  readonly urlPatterns: RegExp[]

  // Detección de URLs
  detectUrl(url: string): Promise<DetectionResult>
  transformUrl?(url: string): Promise<string | null>
  isValidUrl(url: string): boolean

  // Fetch de contenido
  fetchFeed(url: string, options?: HandlerOptions): Promise<FeedInfo | null>

  // Sincronización
  syncContent(context: HandlerContext): Promise<SyncResult>
  syncAllContent?(context: HandlerContext): Promise<SyncResult>

  // Auxiliares
  getFaviconUrl?(url: string): Promise<string | null>
}
```

## Tipos importantes

### DetectionResult

Resultado de detectar una URL:

```typescript
interface DetectionResult {
  detected: boolean           // Si la URL fue reconocida
  transformedUrl?: string     // URL transformada (ej: a RSS)
  sourceType?: SourceType     // Tipo detectado
  suggestedTitle?: string     // Título sugerido
  metadata?: Record<string, unknown>
}
```

### HandlerContext

Contexto pasado a los métodos de sincronización:

```typescript
interface HandlerContext {
  supabase: SupabaseClient    // Cliente de Supabase
  source: ContentSource & { user_source?: UserSource }
  onProgress?: (processed: number, total: number) => void
  onArticleProcessed?: () => void
}
```

### SyncResult

Resultado de la sincronización:

```typescript
interface SyncResult {
  success: boolean
  articlesAdded: number
  articlesUpdated: number
  error?: string
}
```

## Servicio de sincronización unificado

El `sourceSyncService` proporciona una API unificada para sincronizar cualquier tipo de fuente:

```typescript
import { sourceSyncService, getHandler } from '@/lib/source-handlers'

// Sincronizar una fuente (usa el handler apropiado automáticamente)
const result = await sourceSyncService.syncSource(source, supabase)

// Sincronizar múltiples fuentes
const results = await sourceSyncService.syncSources(sources, supabase, {
  fullSync: false,  // true para sincronizar todo sin filtro de tiempo
  onSourceComplete: (source, result) => {
    console.log(`Synced ${source.title}: +${result.articlesAdded}`)
  }
})

// Obtener handler para un tipo específico
const handler = getHandler('youtube_channel')
```

## Detección automática de tipo

El sistema puede detectar automáticamente el tipo de fuente a partir de una URL:

```typescript
import { detectSourceType } from '@/lib/source-handlers'

const result = await detectSourceType('https://youtube.com/@vercel')
// {
//   detected: true,
//   sourceType: 'youtube_channel',
//   transformedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=...',
//   suggestedTitle: 'vercel',
//   handler: YouTubeHandler
// }
```

## Buenas prácticas

1. **Orden de prioridad**: Los handlers más específicos deben registrarse antes que los genéricos (RSS al final)

2. **Manejo de errores**: Siempre captura errores en los métodos y devuelve resultados apropiados

3. **Timeout**: Usa timeouts en las peticiones HTTP para evitar bloqueos

4. **Logging**: Usa `console.error` para errores importantes que ayuden al debugging

5. **Transformación de URLs**: Si el tipo de fuente requiere transformar la URL (ej: YouTube a RSS), implementa `transformUrl()`

6. **Detección precisa**: Los `urlPatterns` deben ser específicos para evitar falsos positivos

## Ejemplo completo: Handler de Instagram (placeholder)

```typescript
// lib/source-handlers/instagram.ts
import type { 
  SourceHandler, 
  HandlerContext,
  FeedInfo, 
  SyncResult,
  DetectionResult 
} from './types'
import type { SourceType } from '@/types/database'

export class InstagramHandler implements SourceHandler {
  readonly type: SourceType = 'instagram'
  readonly displayName = 'Instagram'
  readonly description = 'Instagram profiles'
  readonly iconName = 'Instagram'
  readonly colorClasses = 'bg-pink-500/10 text-pink-600 border-pink-500/20'
  
  readonly urlPatterns = [
    /instagram\.com\/([\w.]+)/,
    /instagr\.am\/([\w.]+)/,
  ]

  async detectUrl(url: string): Promise<DetectionResult> {
    const match = this.urlPatterns.some(p => p.test(url))
    if (!match) return { detected: false }

    const usernameMatch = url.match(/(?:instagram\.com|instagr\.am)\/([\w.]+)/)
    
    return {
      detected: true,
      sourceType: 'instagram',
      suggestedTitle: usernameMatch ? `@${usernameMatch[1]}` : undefined,
    }
  }

  isValidUrl(url: string): boolean {
    return this.urlPatterns.some(p => p.test(url))
  }

  async fetchFeed(url: string): Promise<FeedInfo | null> {
    // Instagram requiere autenticación - implementar con API oficial
    console.warn('Instagram handler not fully implemented')
    return null
  }

  async syncContent(context: HandlerContext): Promise<SyncResult> {
    // Implementar sincronización con API de Instagram
    return {
      success: false,
      articlesAdded: 0,
      articlesUpdated: 0,
      error: 'Instagram sync not implemented',
    }
  }
}

export const instagramHandler = new InstagramHandler()
```
