"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Search, Settings, User, LogOut } from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SearchBar } from "@/components/search-bar"
import { LexoraLogo } from "@/components/lexora-logo"

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuth()

  const navItems = [
    { label: "Feed", href: "/", active: pathname === "/" },
    { label: "Sources", href: "/sources", active: pathname === "/sources" },
    { label: "Discover", href: "/discover", active: pathname === "/discover" },
    { label: "Archive", href: "/archive", active: pathname === "/archive" },
  ]

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
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <LexoraLogo href="/" />

          {/* Desktop Navigation */}
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

          {/* Right side actions */}
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

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="glass hover-lift-subtle"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 glass-card mt-2 rounded-lg hover-lift">
              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div className="px-3 py-2 border-b border-glass-border">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Nav items */}
                  {navItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`block px-3 py-2 text-base font-medium rounded-md transition-all duration-200 hover:-translate-y-0.5 ${
                        item.active
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}

                  {/* Actions */}
                  <div className="flex flex-col space-y-2 px-3 py-2 border-t border-glass-border">
                    <Button variant="ghost" size="sm" className="glass w-full justify-start hover-lift-subtle">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                    <Link href="/settings" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="glass w-full justify-start hover-lift-subtle">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="glass w-full justify-start hover-lift-subtle text-red-600"
                      onClick={(e) => {
                        e.preventDefault()
                        setIsMenuOpen(false)
                        handleLogout(e)
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Log out
                    </Button>
                  </div>
                </>
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
