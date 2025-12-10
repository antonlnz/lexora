# Lexora: Digital Content Hub

Lexora is a modern platform to discover, organize, and consume digital content from various sources (RSS feeds, YouTube, podcasts, articles, etc.) in a unified and customizable experience.

## Main Features
- Discover and follow content sources (RSS, YouTube, podcasts, etc.)
- Reader, grid, and list view modes
- Archiving, folders, and favorites management
- Session and preferences synchronization
- Advanced filters and search
- Supabase integration for authentication and database
- Responsive UI and smooth animations

## Architecture
- **Frontend:** Next.js (React, Server Components, App Router)
- **Backend:** Next.js API Routes (Edge and Node), Supabase (PostgreSQL, Auth, Storage)
- **Global State:** Context API and custom hooks
- **Styling:** Tailwind CSS, CSS Modules, animations with GSAP
- **Authentication:** Supabase Auth (OAuth, magic links, email/password)
- **Storage:** Supabase Storage for images and files
- **Database:** PostgreSQL managed by Supabase
- **Integrations:**
  - RSS feeds (custom parser)
  - YouTube Data API
  - Podcasts (RSS and metadata)

## Tools and Libraries Used
- **Next.js:** React framework for SSR/SSG and API
- **Supabase:** Backend as a Service (DB, Auth, Storage)
- **Tailwind CSS:** Utility-first CSS for fast, responsive UI
- **Lucide React:** Modern SVG icons
- **GSAP:** Advanced animations and FLIP transitions
- **Zustand/Context:** Global state and settings
- **React Query:** (optional) for fetching and caching
- **Jest/Testing Library:** Component and logic testing

## Project Structure
```
app/           # Routes, pages, and API endpoints
components/    # Reusable UI components
contexts/      # Global contexts (auth, settings, etc.)
hooks/         # Custom hooks
lib/           # Business logic, services, utilities
public/        # Static assets (images, manifest, etc.)
styles/        # Global CSS files
supabase/      # SQL schema, migrations, and scripts
```

## How to Run the Project
1. Install dependencies: `pnpm install`
2. Set up environment variables (see `.env.example`)
3. Start the development server: `pnpm dev`
4. Go to `http://localhost:3000`

## Demo
http://lexora-jade.vercel.app/

![Demo gif](/public/demo-video.gif)
[Full video: Lexora demo video](/public/demo-video.mp4)

---

> **Disclaimer:** This README was generated with the assistance of AI and may require further review or edits for accuracy and completeness.