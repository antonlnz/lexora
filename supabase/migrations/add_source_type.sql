-- Migration: Add source_type column to sources table
-- Created: 2025-11-18

-- Add source_type column to sources table
ALTER TABLE public.sources 
ADD COLUMN source_type text DEFAULT 'rss';

-- Add check constraint to ensure valid source types
ALTER TABLE public.sources
ADD CONSTRAINT check_source_type 
CHECK (source_type IN ('rss', 'youtube', 'twitter', 'instagram', 'tiktok', 'newsletter', 'website'));

-- Create index for better query performance
CREATE INDEX idx_sources_source_type ON public.sources(source_type);

-- Update existing sources to have a default type based on their URL
UPDATE public.sources
SET source_type = CASE
  WHEN url LIKE '%youtube.com%' OR url LIKE '%youtu.be%' THEN 'youtube'
  WHEN url LIKE '%twitter.com%' OR url LIKE '%x.com%' THEN 'twitter'
  WHEN url LIKE '%instagram.com%' THEN 'instagram'
  WHEN url LIKE '%tiktok.com%' THEN 'tiktok'
  WHEN category = 'Newsletters' THEN 'newsletter'
  ELSE 'rss'
END;
