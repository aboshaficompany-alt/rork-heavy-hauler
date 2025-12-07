-- Fix infinite recursion in RLS policies between shipments and bids tables
-- The problem: policies on shipments query bids, and policies on bids query shipments

-- Step 1: Create a security definer function to check if factory owns a shipment
CREATE OR REPLACE FUNCTION public.factory_owns_shipment(_shipment_id uuid, _factory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shipments
    WHERE id = _shipment_id
    AND factory_id = _factory_id
  )
$$;

-- Step 2: Drop the problematic policies on bids table
DROP POLICY IF EXISTS "Factories can view bids on their shipments" ON bids;
DROP POLICY IF EXISTS "Factories can update bids on their shipments" ON bids;

-- Step 3: Recreate policies using the security definer function (no direct query to shipments)
CREATE POLICY "Factories can view bids on their shipments" 
ON bids FOR SELECT 
USING (factory_owns_shipment(shipment_id, auth.uid()));

CREATE POLICY "Factories can update bids on their shipments" 
ON bids FOR UPDATE 
USING (factory_owns_shipment(shipment_id, auth.uid()));

-- Step 4: Drop the problematic policy on shipments table
DROP POLICY IF EXISTS "Drivers can view shipments with their bids" ON shipments;

-- Step 5: Recreate policy using existing security definer function (no direct query to bids)
CREATE POLICY "Drivers can view shipments with their bids" 
ON shipments FOR SELECT 
USING (driver_has_bid_on_shipment(id, auth.uid()));