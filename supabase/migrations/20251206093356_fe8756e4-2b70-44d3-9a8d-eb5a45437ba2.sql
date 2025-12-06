-- Create ratings table for driver reviews
CREATE TABLE public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  factory_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate ratings
ALTER TABLE public.ratings ADD CONSTRAINT unique_shipment_rating UNIQUE (shipment_id);

-- Enable RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ratings
CREATE POLICY "Factories can create ratings for their completed shipments"
ON public.ratings FOR INSERT
WITH CHECK (
  auth.uid() = factory_id AND
  has_role(auth.uid(), 'factory'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.shipments 
    WHERE id = shipment_id 
    AND factory_id = auth.uid() 
    AND status = 'completed'
  )
);

CREATE POLICY "Users can view ratings"
ON public.ratings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all ratings"
ON public.ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  factory_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shipment_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Participants can view their conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = driver_id OR auth.uid() = factory_id);

CREATE POLICY "Participants can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = driver_id OR auth.uid() = factory_id);

CREATE POLICY "Admins can manage all conversations"
ON public.conversations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for messages
CREATE POLICY "Participants can view messages in their conversations"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND (driver_id = auth.uid() OR factory_id = auth.uid())
  )
);

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND (driver_id = auth.uid() OR factory_id = auth.uid())
  )
);

CREATE POLICY "Participants can update read status"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND (driver_id = auth.uid() OR factory_id = auth.uid())
  )
);

CREATE POLICY "Admins can manage all messages"
ON public.messages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push subscriptions
CREATE POLICY "Users can manage their own subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();