-- Migration: Remove category column from sources table
-- Created: 2025-11-18

-- Drop the index if exists
DROP INDEX IF EXISTS idx_sources_category;

-- Remove the category column from sources table
ALTER TABLE public.sources 
DROP COLUMN IF EXISTS category;
