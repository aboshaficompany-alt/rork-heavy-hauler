
-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'factory', 'driver');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create shipment status enum
CREATE TYPE public.shipment_status AS ENUM ('open', 'pending_bids', 'bid_accepted', 'in_transit', 'completed', 'cancelled');

-- Create bid status enum
CREATE TYPE public.bid_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create shipments table
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  equipment_type TEXT NOT NULL,
  weight DECIMAL NOT NULL,
  pickup_location TEXT NOT NULL,
  pickup_lat DECIMAL,
  pickup_lng DECIMAL,
  delivery_location TEXT NOT NULL,
  delivery_lat DECIMAL,
  delivery_lng DECIMAL,
  pickup_date DATE NOT NULL,
  notes TEXT,
  status shipment_status NOT NULL DEFAULT 'open',
  accepted_bid_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL NOT NULL,
  notes TEXT,
  status bid_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, driver_id)
);

-- Add foreign key for accepted_bid after bids table is created
ALTER TABLE public.shipments ADD CONSTRAINT fk_accepted_bid FOREIGN KEY (accepted_bid_id) REFERENCES public.bids(id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Shipments policies
CREATE POLICY "Factories can view their own shipments"
ON public.shipments FOR SELECT
TO authenticated
USING (auth.uid() = factory_id);

CREATE POLICY "Drivers can view open shipments"
ON public.shipments FOR SELECT
TO authenticated
USING (status = 'open' OR status = 'pending_bids');

CREATE POLICY "Factories can create shipments"
ON public.shipments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = factory_id AND public.has_role(auth.uid(), 'factory'));

CREATE POLICY "Factories can update their shipments"
ON public.shipments FOR UPDATE
TO authenticated
USING (auth.uid() = factory_id);

CREATE POLICY "Admins can manage all shipments"
ON public.shipments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Bids policies
CREATE POLICY "Drivers can view their own bids"
ON public.bids FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

CREATE POLICY "Factories can view bids on their shipments"
ON public.bids FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shipments 
  WHERE shipments.id = bids.shipment_id 
  AND shipments.factory_id = auth.uid()
));

CREATE POLICY "Drivers can create bids"
ON public.bids FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = driver_id AND public.has_role(auth.uid(), 'driver'));

CREATE POLICY "Drivers can update their pending bids"
ON public.bids FOR UPDATE
TO authenticated
USING (auth.uid() = driver_id AND status = 'pending');

CREATE POLICY "Factories can update bids on their shipments"
ON public.bids FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shipments 
  WHERE shipments.id = bids.shipment_id 
  AND shipments.factory_id = auth.uid()
));

CREATE POLICY "Admins can manage all bids"
ON public.bids FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bids_updated_at
BEFORE UPDATE ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, company_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data ->> 'role')::app_role
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
