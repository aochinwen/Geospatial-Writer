-- Migration: Make templates globally viewable
-- Date: 2025-12-31
-- Description: Updates RLS policies on feature_templates to allow all authenticated users to view all templates. Only owners can modify/delete.

-- Drop the restrictive view policy
DROP POLICY IF EXISTS "Users can view own templates" ON public.feature_templates;

-- Create the new permissible view policy
CREATE POLICY "Users can view all templates" ON public.feature_templates
  FOR SELECT USING (auth.role() = 'authenticated');
