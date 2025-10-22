import ReadPageClient from "./page-client"

// Generate static paths for all available content IDs
// export function generateStaticParams() {
//   // Return all possible content IDs
//   return [
//     { id: '1' },
//     { id: '2' },
//     // Add more IDs here as you add more content
//   ]
// }

export default function ReadPage() {
  return <ReadPageClient />
}
