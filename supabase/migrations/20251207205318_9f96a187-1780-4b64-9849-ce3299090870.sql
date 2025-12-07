-- Add driver_vehicles table to store driver vehicle information
CREATE TABLE public.driver_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL UNIQUE,
  vehicle_type text NOT NULL,
  plate_number text NOT NULL,
  vehicle_model text,
  vehicle_year integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Drivers can view their own vehicle" 
ON public.driver_vehicles FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own vehicle" 
ON public.driver_vehicles FOR UPDATE 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own vehicle" 
ON public.driver_vehicles FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can manage all vehicles" 
ON public.driver_vehicles FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_driver_vehicles_updated_at
BEFORE UPDATE ON public.driver_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();