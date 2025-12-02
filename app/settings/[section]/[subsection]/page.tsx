import { Navigation } from "@/components/navigation"
import { SettingsContent } from "@/components/settings-content"
import { redirect } from "next/navigation"
import {
  isValidSection,
  isValidSubsection,
  generateSettingsStaticParams,
  type SettingsSection,
} from "@/lib/settings-routes"

interface SettingsSubsectionPageProps {
  params: Promise<{
    section: string
    subsection: string
  }>
}

export default async function SettingsSubsectionPage({ params }: SettingsSubsectionPageProps) {
  const { section, subsection } = await params
  const normalizedSection = section.toLowerCase()
  const normalizedSubsection = subsection.toLowerCase()

  // Validar sección
  if (!isValidSection(normalizedSection)) {
    redirect("/settings/appearance")
  }

  // Validar subsección
  if (!isValidSubsection(normalizedSection, normalizedSubsection)) {
    redirect(`/settings/${normalizedSection}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-playfair font-bold text-balance mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and customize your Lexora experience.
            </p>
          </div>

          <SettingsContent
            initialSection={normalizedSection as SettingsSection}
            initialSubsection={normalizedSubsection}
          />
        </div>
      </div>
    </div>
  )
}

// Generar rutas estáticas para mejor rendimiento
export function generateStaticParams() {
  return generateSettingsStaticParams()
}
