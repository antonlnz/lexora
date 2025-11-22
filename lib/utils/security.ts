import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitiza HTML para prevenir XSS attacks
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'figure', 'figcaption',
      'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'sub', 'sup'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height',
      'target', 'rel', 'data-*'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  })
}

/**
 * Rate limiting simple usando Map en memoria
 * En producción, usar Redis o Upstash para distribución
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Filtrar requests fuera de la ventana de tiempo
    const recentRequests = requests.filter(timestamp => now - timestamp < this.windowMs)
    
    if (recentRequests.length >= this.maxRequests) {
      return false
    }
    
    // Agregar el nuevo request
    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)
    
    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    const recentRequests = requests.filter(timestamp => now - timestamp < this.windowMs)
    return Math.max(0, this.maxRequests - recentRequests.length)
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }
}

// Rate limiter global: 100 requests por minuto por IP
export const rateLimiter = new RateLimiter(100, 60000)

/**
 * Obtiene el identificador del cliente para rate limiting
 */
export function getClientIdentifier(request: Request): string {
  // Intentar obtener IP del header X-Forwarded-For (Vercel)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  // Fallback a X-Real-IP
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Último recurso: usar un identificador genérico
  return 'unknown'
}

/**
 * Headers CORS seguros
 */
export function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 horas
  }
}

