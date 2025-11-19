-- Migration: Fix Feed System
-- Date: 2024-11-19
-- Description: Adds proper RLS policies for articles and creates infrastructure for feed syncing

-- ============================================
-- STEP 1: Add RLS policies for articles table
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view articles from their sources" ON articles;
DROP POLICY IF EXISTS "Users can insert articles from their sources" ON articles;
DROP POLICY IF EXISTS "Users can update their own articles" ON articles;
DROP POLICY IF EXISTS "Users can delete their own articles" ON articles;

-- Enable RLS on articles table
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view articles from sources they follow
CREATE POLICY "Users can view articles from their sources"
ON articles
FOR SELECT
TO authenticated
USING (
  source_id IN (
    SELECT id FROM sources WHERE user_id = auth.uid()
  )
);

-- Policy: Allow inserting articles from user's sources
-- This is needed for the RSS sync service
CREATE POLICY "Users can insert articles from their sources"
ON articles
FOR INSERT
TO authenticated
WITH CHECK (
  source_id IN (
    SELECT id FROM sources WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update articles from their sources
CREATE POLICY "Users can update their own articles"
ON articles
FOR UPDATE
TO authenticated
USING (
  source_id IN (
    SELECT id FROM sources WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  source_id IN (
    SELECT id FROM sources WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete articles from their sources
CREATE POLICY "Users can delete their own articles"
ON articles
FOR DELETE
TO authenticated
USING (
  source_id IN (
    SELECT id FROM sources WHERE user_id = auth.uid()
  )
);

-- ============================================
-- STEP 2: Add index for better performance
-- ============================================

-- Index for fetching recent articles by source
CREATE INDEX IF NOT EXISTS idx_articles_source_published 
ON articles(source_id, published_at DESC);

-- Index for fetching articles by user (through sources)
CREATE INDEX IF NOT EXISTS idx_articles_created_at 
ON articles(created_at DESC);

-- ============================================
-- STEP 3: Add last_synced_at to sources table
-- ============================================

-- Add column to track when each source was last synced
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE sources ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- STEP 4: Create function to sync feeds
-- ============================================

-- This function will be called by the RSS service
-- It checks if a source needs syncing based on last_synced_at
CREATE OR REPLACE FUNCTION should_sync_source(source_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_sync TIMESTAMPTZ;
  sync_interval INTERVAL := '1 hour'; -- Sync every hour
BEGIN
  SELECT last_synced_at INTO last_sync
  FROM sources
  WHERE id = source_id_param;
  
  -- If never synced or synced more than interval ago, return true
  RETURN last_sync IS NULL OR (NOW() - last_sync) > sync_interval;
END;
$$;

-- ============================================
-- STEP 5: Create function to update last_synced_at
-- ============================================

CREATE OR REPLACE FUNCTION update_source_sync_time(source_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sources
  SET last_synced_at = NOW()
  WHERE id = source_id_param;
END;
$$;

-- ============================================
-- STEP 6: Grant necessary permissions
-- ============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION should_sync_source(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_source_sync_time(UUID) TO authenticated;

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Articles table now has proper RLS policies';
  RAISE NOTICE 'Sources table has last_synced_at column';
  RAISE NOTICE 'Helper functions created for feed syncing';
END $$;
