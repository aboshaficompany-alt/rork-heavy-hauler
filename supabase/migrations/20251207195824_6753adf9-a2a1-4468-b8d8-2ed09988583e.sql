-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Drivers can view shipments with accepted bids" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can view shipments they bid on" ON public.shipments;

-- Create a security definer function to check if driver has bid on shipment
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

-- Create a security definer function to check if driver has accepted bid on shipment
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

-- Recreate policies using security definer functions (no recursion)
CREATE POLICY "Drivers can view shipments with accepted bids" 
ON public.shipments 
FOR SELECT 
USING (public.driver_has_accepted_bid_on_shipment(id, auth.uid()));

CREATE POLICY "Drivers can view shipments they bid on" 
ON public.shipments 
FOR SELECT 
USING (public.driver_has_bid_on_shipment(id, auth.uid()));