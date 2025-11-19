import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  // Solo loguear errores reales, no "AuthSessionMissingError" que es un estado normal
  if (userError && userError.name !== 'AuthSessionMissingError') {
    console.error('Error getting user in middleware:', userError)
  }

  const pathname = request.nextUrl.pathname
  
  // Paths públicos que no requieren autenticación
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // Redirigir a home si ya está autenticado y trata de acceder a login/signup
  if (user && isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Proteger rutas privadas - redirigir a login si no hay usuario
  const protectedPaths = ['/', '/discover', '/archive', '/sources', '/settings', '/read', '/onboarding']
  const isProtectedPath = protectedPaths.some(path => 
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )
  
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Solo añadir redirectTo si no es la raíz
    if (pathname !== '/') {
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
