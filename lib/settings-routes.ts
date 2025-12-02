/**
 * Configuración de rutas para la página de Settings.
 * Este archivo centraliza la definición de secciones y subsecciones
 * para facilitar el mantenimiento y la extensión del sistema de rutas.
 */

export const SETTINGS_SECTIONS = ["appearance", "subscription", "account"] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export interface SubsectionConfig {
  id: string
  label: string
  description?: string
}

export interface SectionConfig {
  id: SettingsSection
  label: string
  icon: string // nombre del icono de lucide-react
  subsections: SubsectionConfig[]
}

/**
 * Configuración completa de las secciones de Settings.
 * Para agregar una nueva sección o subsección, simplemente añádela aquí
 * y luego implementa el componente correspondiente en settings-content.tsx
 */
export const SETTINGS_CONFIG: SectionConfig[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: "Palette",
    subsections: [
      { id: "theme", label: "Theme", description: "Customize the visual appearance" },
      { id: "display", label: "Display", description: "Control how content is displayed" },
      { id: "reader", label: "Reader", description: "Customize the content viewer" },
    ],
  },
  {
    id: "subscription",
    label: "Subscription",
    icon: "CreditCard",
    subsections: [
      { id: "current-plan", label: "Current Plan", description: "Manage your subscription" },
      { id: "available-plans", label: "Available Plans", description: "View and change plans" },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: "User",
    subsections: [
      { id: "profile", label: "Profile", description: "Manage your account details" },
      { id: "security", label: "Security", description: "Manage your account security" },
      { id: "danger-zone", label: "Danger Zone", description: "Permanent actions" },
    ],
  },
]

/**
 * Obtiene la lista de subsecciones válidas para una sección dada
 */
export function getValidSubsections(section: SettingsSection): string[] {
  const config = SETTINGS_CONFIG.find((s) => s.id === section)
  return config?.subsections.map((sub) => sub.id) ?? []
}

/**
 * Valida si una sección es válida
 */
export function isValidSection(section: string): section is SettingsSection {
  return SETTINGS_SECTIONS.includes(section as SettingsSection)
}

/**
 * Valida si una subsección es válida para una sección dada
 */
export function isValidSubsection(section: SettingsSection, subsection: string): boolean {
  return getValidSubsections(section).includes(subsection)
}

/**
 * Genera los parámetros estáticos para las páginas de settings
 */
export function generateSettingsStaticParams() {
  const params: { section: string; subsection: string }[] = []

  for (const section of SETTINGS_CONFIG) {
    for (const subsection of section.subsections) {
      params.push({ section: section.id, subsection: subsection.id })
    }
  }

  return params
}

/**
 * Genera los parámetros estáticos solo para secciones (sin subsección)
 */
export function generateSectionStaticParams() {
  return SETTINGS_SECTIONS.map((section) => ({ section }))
}

/**
 * Construye la URL de una sección de settings
 */
export function buildSettingsUrl(section: SettingsSection, subsection?: string): string {
  if (subsection) {
    return `/settings/${section}/${subsection}`
  }
  return `/settings/${section}`
}
