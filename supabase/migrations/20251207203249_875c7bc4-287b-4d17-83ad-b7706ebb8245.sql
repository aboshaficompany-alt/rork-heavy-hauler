-- Fix: Ratings table publicly readable without authentication
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view ratings" ON ratings;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view ratings" 
ON ratings FOR SELECT 
USING (auth.uid() IS NOT NULL);