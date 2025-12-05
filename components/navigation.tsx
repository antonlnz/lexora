"use client"

import { useState, useRef, useLayoutEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Settings, LogOut, Home, Layers, Compass, Archive, Search, User } from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SearchBar } from "@/components/search-bar"
import { MobileSearch } from "@/components/mobile-search"
import { LexoraLogo } from "@/components/lexora-logo"

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuth()
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isFirstRender, setIsFirstRender] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const searchRef = useRef<HTMLButtonElement>(null)
  const profileRef = useRef<HTMLAnchorElement>(null)

  const isSearchActive = isMobileSearchOpen
  const isProfileActive = pathname.startsWith('/settings')
  
  // Determinar si algún nav item principal está activo (no search ni profile)
  const isAnyNavItemActive = pathname === "/" || pathname === "/sources" || pathname === "/discover" || pathname === "/archive"

  const navItems = [
    { label: "Feed", href: "/", active: pathname === "/", icon: Home },
    { label: "Sources", href: "/sources", active: pathname === "/sources", icon: Layers },
    { label: "Discover", href: "/discover", active: pathname === "/discover", icon: Compass },
    { label: "Archive", href: "/archive", active: pathname === "/archive", icon: Archive },
  ]

  // Calculate indicator position - use useLayoutEffect for instant updates
  useLayoutEffect(() => {
    const updateIndicator = () => {
      let targetElement: HTMLElement | null = null
      
      // Determinar qué elemento está activo
      if (isSearchActive && searchRef.current) {
        targetElement = searchRef.current
      } else if (isProfileActive && profileRef.current) {
        targetElement = profileRef.current
      } else {
        const activeIndex = navItems.findIndex(item => item.active)
        targetElement = itemRefs.current[activeIndex]
      }
      
      if (targetElement && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect()
        const itemRect = targetElement.getBoundingClientRect()
        
        setIndicatorStyle({
          left: itemRect.left - navRect.left,
          width: itemRect.width,
        })
      }
    }
    
    updateIndicator()
    
    // Disable transition on first render for instant positioning
    if (isFirstRender) {
      requestAnimationFrame(() => setIsFirstRender(false))
    }
    
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [pathname, isFirstRender, isSearchActive, isProfileActive])

  const handleLogout = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    try {
      await logout()
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  return (
    <>
      {/* Top Navigation Bar - Hidden on mobile for authenticated users */}
      <nav className={`fixed top-0 left-0 right-0 z-50 glass-card border-b ${isAuthenticated ? 'hidden md:block' : ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <LexoraLogo href="/" />

            {/* Desktop Navigation - Hidden on mobile */}
            {isAuthenticated && (
              <div className="hidden md:block">
                <div className="flex items-center space-x-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`text-sm font-medium transition-all duration-200 hover:text-primary hover:-translate-y-0.5 ${
                        item.active ? "text-foreground border-b-2 border-primary pb-1" : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop Right side actions */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <SearchBar />
                  
                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="glass hover-lift-subtle h-8 w-8 rounded-full p-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.avatar} alt={user?.name} />
                          <AvatarFallback>{userInitials}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user?.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault()
                          handleLogout(e)
                        }} 
                        className="cursor-pointer text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="glass hover-lift-subtle"
                    asChild
                  >
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button 
                    size="sm" 
                    className="hover-lift-subtle"
                    asChild
                  >
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Right side actions - Always visible on mobile */}
            <div className="flex md:hidden items-center space-x-2">
              {isAuthenticated && (
                <>
                  <SearchBar />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="glass hover-lift-subtle h-8 w-8 rounded-full p-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.avatar} alt={user?.name} />
                          <AvatarFallback>{userInitials}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user?.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault()
                          handleLogout(e)
                        }} 
                        className="cursor-pointer text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              {!isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="glass hover-lift-subtle"
                >
                  {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu for non-authenticated users */}
          {isMenuOpen && !isAuthenticated && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 glass-card mt-2 rounded-lg hover-lift">
                <div className="flex flex-col space-y-2 px-3 py-2">
                  <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="glass w-full hover-lift-subtle">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                    <Button size="sm" className="w-full hover-lift-subtle">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar - Uses CSS to hide on desktop, no JS check needed */}
      {isAuthenticated && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 hidden max-md:block pointer-events-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-3 mb-3 pointer-events-auto">
            <div 
              ref={navRef}
              className="mobile-bottom-nav rounded-[28px] px-2 py-1.5 flex items-center justify-around relative overflow-hidden"
            >
              {/* Liquid glass animated indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-[22px] mobile-nav-indicator"
                style={{
                  left: `${indicatorStyle.left}px`,
                  width: `${indicatorStyle.width}px`,
                  transition: isFirstRender ? 'none' : 'all 0.18s cubic-bezier(0.25, 0.1, 0.25, 1)',
                }}
              />
              
              {/* Search Button */}
              <Dialog open={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen}>
                <DialogTrigger asChild>
                  <button
                    ref={searchRef}
                    className={`
                      relative flex flex-col items-center justify-center px-3 py-2 rounded-[22px] z-10
                      transition-all duration-150 ease-out
                      ${isSearchActive 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                      }
                    `}
                  >
                    <Search 
                      className={`
                        h-[22px] w-[22px] transition-all duration-150 ease-out
                        ${isSearchActive ? "scale-110" : "scale-100"}
                      `}
                    />
                    <span 
                      className={`
                        text-[10px] font-semibold mt-0.5 transition-all duration-150 ease-out
                        ${isSearchActive ? "opacity-100" : "opacity-60"}
                      `}
                    >
                      Search
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent 
                  className="w-[calc(100%-2rem)] max-w-[500px] p-4 gap-0 glass-card border-0 mobile-search-dialog"
                  showCloseButton={false}
                  aria-describedby={undefined}
                >
                  <DialogTitle className="sr-only">Buscar contenido</DialogTitle>
                  <MobileSearch onClose={() => setIsMobileSearchOpen(false)} />
                </DialogContent>
              </Dialog>
              
              {/* Navigation Items */}
              {navItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    ref={(el) => { itemRefs.current[index] = el }}
                    className={`
                      relative flex flex-col items-center justify-center px-3 py-2 rounded-[22px] z-10
                      transition-all duration-150 ease-out
                      ${item.active 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                      }
                    `}
                  >
                    <Icon 
                      className={`
                        h-[22px] w-[22px] transition-all duration-150 ease-out
                        ${item.active ? "scale-110" : "scale-100"}
                      `}
                    />
                    <span 
                      className={`
                        text-[10px] font-semibold mt-0.5 transition-all duration-150 ease-out
                        ${item.active ? "opacity-100" : "opacity-60"}
                      `}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
              
              {/* Profile/Settings Button */}
              <Link
                href="/settings"
                ref={profileRef}
                className={`
                  relative flex flex-col items-center justify-center px-3 py-2 rounded-[22px] z-10
                  transition-all duration-150 ease-out
                  ${isProfileActive 
                    ? "text-foreground" 
                    : "text-muted-foreground"
                  }
                `}
              >
                <User 
                  className={`
                    h-[22px] w-[22px] transition-all duration-150 ease-out
                    ${isProfileActive ? "scale-110" : "scale-100"}
                  `}
                />
                <span 
                  className={`
                    text-[10px] font-semibold mt-0.5 transition-all duration-150 ease-out
                    ${isProfileActive ? "opacity-100" : "opacity-60"}
                  `}
                >
                  Profile
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
