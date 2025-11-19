import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contentExtractor } from '@/lib/services/content-extractor'

/**
 * POST /api/articles/extract-content
 * Re-extrae el contenido de un artículo específico o de todos los artículos sin contenido
 */
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

    const body = await request.json()
    const { articleId } = body

    if (articleId) {
      // Re-extraer contenido de un artículo específico
      const { data: article, error: articleError } = await supabase
        .from('articles')
        .select('id, url, image_url, source_id, sources!inner(user_id)')
        .eq('id', articleId)
        .single()

      if (articleError || !article) {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        )
      }

      // Verificar que el artículo pertenece a una fuente del usuario
      if ((article.sources as any).user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      // Extraer contenido, pasando la imagen destacada para evitar duplicados
      const extractedContent = await contentExtractor.extractWithRetry(article.url, {
        featuredImageUrl: article.image_url
      })

      if (!extractedContent) {
        return NextResponse.json(
          { error: 'Failed to extract content' },
          { status: 500 }
        )
      }

      // Actualizar el artículo
      const readingTime = extractedContent.textContent 
        ? contentExtractor.calculateReadingTime(extractedContent.textContent)
        : null
      const wordCount = extractedContent.textContent
        ? contentExtractor.countWords(extractedContent.textContent)
        : null

      await supabase
        .from('articles')
        .update({
          content: extractedContent.content,
          excerpt: extractedContent.excerpt,
          author: extractedContent.byline,
          reading_time: readingTime,
          word_count: wordCount,
        })
        .eq('id', articleId)

      return NextResponse.json({
        success: true,
        articleId,
        extracted: true,
      })
    } else {
      // Re-extraer contenido de todos los artículos del usuario sin contenido o con contenido vacío
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, url, image_url, source_id, sources!inner(user_id)')
        .eq('sources.user_id', user.id)
        .or('content.is.null,content.eq.')
        .limit(50) // Limitar a 50 artículos por request para evitar timeouts

      if (articlesError || !articles) {
        return NextResponse.json(
          { error: 'Failed to fetch articles' },
          { status: 500 }
        )
      }

      let extracted = 0
      let failed = 0

      for (const article of articles) {
        try {
          // Pasar la imagen destacada para evitar duplicados
          const extractedContent = await contentExtractor.extractWithRetry(article.url, {
            featuredImageUrl: article.image_url
          })

          if (extractedContent) {
            const readingTime = extractedContent.textContent 
              ? contentExtractor.calculateReadingTime(extractedContent.textContent)
              : null
            const wordCount = extractedContent.textContent
              ? contentExtractor.countWords(extractedContent.textContent)
              : null

            await supabase
              .from('articles')
              .update({
                content: extractedContent.content,
                excerpt: extractedContent.excerpt,
                author: extractedContent.byline,
                reading_time: readingTime,
                word_count: wordCount,
              })
              .eq('id', article.id)

            extracted++
          } else {
            failed++
          }
        } catch (error) {
          console.error(`Failed to extract content for article ${article.id}:`, error)
          failed++
        }
      }

      return NextResponse.json({
        success: true,
        totalProcessed: articles.length,
        extracted,
        failed,
      })
    }
  } catch (error) {
    console.error('Error extracting content:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
