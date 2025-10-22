"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, Search, Settings, User } from "lucide-react"
import { usePathname } from "next/navigation"

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { label: "Feed", href: "/", active: pathname === "/" },
    { label: "Sources", href: "/sources", active: pathname === "/sources" },
    { label: "Discover", href: "/discover", active: pathname === "/discover" },
    { label: "Archive", href: "/archive", active: pathname === "/archive" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="text-2xl font-playfair font-bold text-foreground hover-lift-subtle">
              lexora.
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`text-sm font-medium transition-all duration-200 hover:text-primary hover:-translate-y-0.5 ${
                    item.active ? "text-foreground border-b-2 border-primary pb-1" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* Right side actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="glass hover-lift-subtle">
              <Search className="h-4 w-4" />
            </Button>
            <a href="/settings">
              <Button variant="ghost" size="sm" className="glass hover-lift-subtle">
                <Settings className="h-4 w-4" />
              </Button>
            </a>
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
              {navItems.map((item) => (
                <a
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
                </a>
              ))}
              <div className="flex items-center space-x-2 px-3 py-2">
                <Button variant="ghost" size="sm" className="glass flex-1 hover-lift-subtle">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <a href="/settings">
                  <Button variant="ghost" size="sm" className="glass hover-lift-subtle">
                    <Settings className="h-4 w-4" />
                  </Button>
                </a>
                <Button variant="ghost" size="sm" className="glass hover-lift-subtle">
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
