/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Deshabilitado para producción - todos los errores deben resolverse
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      // Permitir imágenes de feeds RSS de cualquier origen
      // TODO: Restringir a dominios específicos si es posible
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
  // Configuración vacía para Turbopack (Next.js 16+)
  turbopack: {},
}

export default nextConfig
