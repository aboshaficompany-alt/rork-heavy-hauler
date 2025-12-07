-- Drop problematic policies and recreate with proper access
DROP POLICY IF EXISTS "Drivers can view shipments they bid on" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can view shipments with accepted bids" ON public.shipments;

-- Create a simple policy that allows drivers to view shipments they have bid on
-- Using a direct subquery instead of function to avoid recursion
CREATE POLICY "Drivers can view shipments with their bids"
ON public.shipments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bids
    WHERE bids.shipment_id = shipments.id
    AND bids.driver_id = auth.uid()
  )
);