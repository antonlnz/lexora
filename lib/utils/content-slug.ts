/**
 * Utilidades para generar y parsear slugs de contenido
 * Formato: {id}--{title-slug}
 * Ejemplo: abc123--como-configurar-tu-feed-rss
 */

/**
 * Genera un slug a partir del ID y título del contenido
 */
export function generateContentSlug(id: string, title: string): string {
  // Limpiar el título para crear un slug legible
  const titleSlug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno solo
    .substring(0, 80) // Limitar longitud

  return `${id}--${titleSlug}`
}

/**
 * Extrae el ID del contenido de un slug
 * Retorna null si el slug no es válido
 */
export function parseContentSlug(slug: string): string | null {
  if (!slug) return null
  
  // El formato es: {id}--{title-slug}
  const separatorIndex = slug.indexOf('--')
  
  if (separatorIndex === -1) {
    // Si no tiene el separador, intentar usar el slug completo como ID
    // Esto permite compatibilidad con URLs simples que solo usan el ID
    return slug
  }
  
  const id = slug.substring(0, separatorIndex)
  return id || null
}
