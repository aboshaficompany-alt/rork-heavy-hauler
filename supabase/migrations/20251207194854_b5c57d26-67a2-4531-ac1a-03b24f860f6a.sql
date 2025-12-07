-- Fix: Allow drivers to view shipments they have accepted bids on
CREATE POLICY "Drivers can view shipments with accepted bids" 
ON public.shipments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM bids 
    WHERE bids.shipment_id = shipments.id 
    AND bids.driver_id = auth.uid() 
    AND bids.status = 'accepted'
  )
);

-- Fix: Allow drivers to view shipments they have any bids on (for MyTrips page)
CREATE POLICY "Drivers can view shipments they bid on" 
ON public.shipments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM bids 
    WHERE bids.shipment_id = shipments.id 
    AND bids.driver_id = auth.uid()
  )
);