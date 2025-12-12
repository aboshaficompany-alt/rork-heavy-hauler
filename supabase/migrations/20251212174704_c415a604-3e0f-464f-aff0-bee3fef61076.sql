-- Add dual confirmation columns for delivery
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS driver_confirmed_delivery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS factory_confirmed_delivery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS driver_confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS factory_confirmed_at timestamp with time zone;