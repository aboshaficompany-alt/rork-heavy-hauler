-- Create driver_locations table for real-time tracking
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  heading NUMERIC,
  speed NUMERIC,
  is_online BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);

-- Enable Row Level Security
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can insert/update their own location
CREATE POLICY "Drivers can manage their own location"
ON public.driver_locations
FOR ALL
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'driver'::app_role));

-- Factories can view online drivers' locations
CREATE POLICY "Factories can view online driver locations"
ON public.driver_locations
FOR SELECT
USING (is_online = true AND has_role(auth.uid(), 'factory'::app_role));

-- Admins can view all locations
CREATE POLICY "Admins can view all driver locations"
ON public.driver_locations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for driver_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- Create trigger for updated_at
CREATE TRIGGER update_driver_locations_updated_at
BEFORE UPDATE ON public.driver_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();