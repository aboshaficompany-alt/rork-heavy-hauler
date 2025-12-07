-- Drop existing problematic policies
DROP POLICY IF EXISTS "Drivers can view shipments with accepted bids" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can view shipments they bid on" ON public.shipments;

-- Recreate functions with correct parameter order (shipment_id first, then driver_id)
CREATE OR REPLACE FUNCTION public.driver_has_bid_on_shipment(_shipment_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bids
    WHERE bids.shipment_id = _shipment_id
    AND bids.driver_id = _driver_id
  )
$$;

CREATE OR REPLACE FUNCTION public.driver_has_accepted_bid_on_shipment(_shipment_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bids
    WHERE bids.shipment_id = _shipment_id
    AND bids.driver_id = _driver_id
    AND bids.status = 'accepted'
  )
$$;

-- Create new RLS policies with correct function calls
CREATE POLICY "Drivers can view shipments they bid on" 
ON public.shipments 
FOR SELECT 
USING (driver_has_bid_on_shipment(id, auth.uid()));

CREATE POLICY "Drivers can view shipments with accepted bids" 
ON public.shipments 
FOR SELECT 
USING (driver_has_accepted_bid_on_shipment(id, auth.uid()));

-- Add UPDATE policy for drivers to update shipments with accepted bids
CREATE POLICY "Drivers can update shipments with accepted bids" 
ON public.shipments 
FOR UPDATE 
USING (driver_has_accepted_bid_on_shipment(id, auth.uid()));