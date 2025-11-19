import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

interface ExtractedContent {
  title: string | null
  content: string | null
  textContent: string | null
  excerpt: string | null
  byline: string | null
  length: number
  siteName: string | null
}

interface ExtractOptions {
  /**
   * URL de la imagen destacada del artículo (del RSS)
   * Si se proporciona, se eliminará del contenido extraído para evitar duplicados
   */
  featuredImageUrl?: string | null
}

export class ContentExtractor {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  /**
   * Extrae el contenido limpio de una URL usando Readability
   */
  async extractFromUrl(url: string, options?: ExtractOptions): Promise<ExtractedContent | null> {
    try {
      // Fetch del HTML de la página
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        },
        // Timeout de 10 segundos
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
        return null
      }

      const html = await response.text()

      // Crear un DOM virtual con jsdom
      const dom = new JSDOM(html, {
        url: url,
      })

      // Usar Readability para extraer el contenido
      const reader = new Readability(dom.window.document)
      const article = reader.parse()

      if (!article) {
        console.error(`Readability failed to parse article from ${url}`)
        return null
      }

      // Limpiar contenido si se proporcionó una imagen destacada
      let cleanedContent = article.content ?? null
      if (cleanedContent && options?.featuredImageUrl) {
        cleanedContent = this.removeDuplicateFeaturedImage(cleanedContent, options.featuredImageUrl)
      }

      // Extraer excerpt del contenido si no está disponible
      const excerpt = article.excerpt || this.generateExcerpt(article.textContent || '')

      return {
        title: article.title ?? null,
        content: cleanedContent,
        textContent: article.textContent ?? null,
        excerpt: excerpt,
        byline: article.byline ?? null,
        length: article.length ?? 0,
        siteName: article.siteName ?? null,
      }
    } catch (error) {
      if (error instanceof Error) {
        // Diferenciar entre errores de timeout y otros errores
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          console.error(`Timeout fetching content from ${url}`)
        } else {
          console.error(`Error extracting content from ${url}:`, error.message)
        }
      } else {
        console.error(`Unknown error extracting content from ${url}`)
      }
      return null
    }
  }

  /**
   * Elimina la primera imagen del contenido HTML si coincide con la imagen destacada
   */
  private removeDuplicateFeaturedImage(content: string, featuredImageUrl: string): string {
    try {
      // Crear un DOM temporal para manipular el contenido
      const dom = new JSDOM(content)
      const doc = dom.window.document

      // Función para extraer el nombre base del archivo de una URL
      const getImageFilename = (url: string): string => {
        try {
          const urlObj = new URL(url, 'http://example.com')
          const pathname = urlObj.pathname
          // Obtener solo el nombre del archivo sin parámetros
          const filename = pathname.split('/').pop() || ''
          // Eliminar extensión para comparar
          return filename.replace(/\.(jpg|jpeg|png|gif|webp|svg)$/i, '').toLowerCase()
        } catch {
          return url.toLowerCase().trim()
        }
      }

      // Función para normalizar URLs
      const normalizeUrl = (url: string): string => {
        try {
          const urlObj = new URL(url, 'http://example.com')
          // Eliminar parámetros de query y fragmentos
          const pathname = urlObj.pathname.toLowerCase()
          // Eliminar posibles variantes de tamaño (ej: -300x200, _thumb, etc)
          return pathname.replace(/[-_](thumb|small|medium|large|[0-9]+x[0-9]+)\.(jpg|jpeg|png|gif|webp)/i, '.$2')
        } catch {
          return url.toLowerCase().trim()
        }
      }

      const normalizedFeaturedUrl = normalizeUrl(featuredImageUrl)
      const featuredFilename = getImageFilename(featuredImageUrl)

      // Buscar todas las imágenes en el contenido
      const images = doc.querySelectorAll('img')
      
      // Si hay imágenes, intentar encontrar la que coincida
      for (const img of Array.from(images)) {
        const imgSrc = img.getAttribute('src') || ''
        const imgSrcSet = img.getAttribute('srcset') || ''
        
        if (!imgSrc && !imgSrcSet) continue

        const normalizedImgSrc = normalizeUrl(imgSrc)
        const imgFilename = getImageFilename(imgSrc)

        // Múltiples estrategias de comparación
        let isMatch = false

        // 1. Comparación exacta de URLs normalizadas
        if (normalizedImgSrc === normalizedFeaturedUrl) {
          isMatch = true
        }

        // 2. Comparación por nombre de archivo (sin extensión)
        if (featuredFilename && imgFilename && featuredFilename === imgFilename && featuredFilename.length > 5) {
          isMatch = true
        }

        // 3. Una URL contiene a la otra (para CDNs que agregan prefijos)
        if (normalizedImgSrc.includes(normalizedFeaturedUrl) || normalizedFeaturedUrl.includes(normalizedImgSrc)) {
          // Verificar que la coincidencia sea significativa (más de 20 caracteres)
          const matchLength = Math.min(normalizedImgSrc.length, normalizedFeaturedUrl.length)
          if (matchLength > 20) {
            isMatch = true
          }
        }

        // 4. Comparar también el srcset (para imágenes responsive)
        if (!isMatch && imgSrcSet) {
          const srcsetUrls = imgSrcSet.split(',').map(s => s.trim().split(' ')[0])
          for (const srcsetUrl of srcsetUrls) {
            const normalizedSrcsetUrl = normalizeUrl(srcsetUrl)
            if (normalizedSrcsetUrl === normalizedFeaturedUrl || 
                normalizedSrcsetUrl.includes(normalizedFeaturedUrl) ||
                normalizedFeaturedUrl.includes(normalizedSrcsetUrl)) {
              isMatch = true
              break
            }
          }
        }

        // 5. Comparación por similitud de path (útil para diferentes versiones de la misma imagen)
        if (!isMatch && featuredFilename && imgFilename) {
          // Verificar si los nombres son muy similares (ej: "image" vs "image-scaled")
          const similarity = this.calculateStringSimilarity(featuredFilename, imgFilename)
          if (similarity > 0.8 && featuredFilename.length > 5) {
            isMatch = true
          }
        }

        // Si encontramos una coincidencia, eliminar la imagen
        if (isMatch) {
          // Eliminar la imagen y su contenedor si es solo eso lo que contiene
          const parent = img.parentElement
          
          if (parent) {
            // Si el padre solo contiene la imagen (o la imagen con espacios), eliminar el padre
            const parentText = parent.textContent?.trim() || ''
            if (parentText === '' || parent.children.length === 1) {
              parent.remove()
            } else {
              // Solo eliminar la imagen
              img.remove()
            }
          } else {
            img.remove()
          }
          
          // Solo eliminar la primera coincidencia
          break
        }
      }

      return doc.body.innerHTML
    } catch (error) {
      console.error('Error removing duplicate featured image:', error)
      return content
    }
  }

  /**
   * Calcula la similitud entre dos strings (0 = diferentes, 1 = idénticos)
   * Usa el algoritmo de Levenshtein simplificado
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calcula la distancia de Levenshtein entre dos strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Genera un excerpt a partir del texto completo
   */
  private generateExcerpt(text: string, maxLength: number = 300): string {
    const cleanText = text.trim().replace(/\s+/g, ' ')
    if (cleanText.length <= maxLength) {
      return cleanText
    }
    return cleanText.substring(0, maxLength - 3) + '...'
  }

  /**
   * Calcula el tiempo de lectura estimado en minutos
   */
  calculateReadingTime(textContent: string, wordsPerMinute: number = 250): number {
    const words = textContent.trim().split(/\s+/).length
    return Math.ceil(words / wordsPerMinute)
  }

  /**
   * Cuenta las palabras en un texto
   */
  countWords(textContent: string): number {
    return textContent.trim().split(/\s+/).length
  }

  /**
   * Extrae el contenido con reintentos
   */
  async extractWithRetry(url: string, options?: ExtractOptions, maxRetries: number = 2): Promise<ExtractedContent | null> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Esperar un poco antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
        
        const result = await this.extractFromUrl(url, options)
        if (result) {
          return result
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
      }
    }
    
    console.error(`Failed to extract content from ${url} after ${maxRetries + 1} attempts`, lastError)
    return null
  }
}

export const contentExtractor = new ContentExtractor()
