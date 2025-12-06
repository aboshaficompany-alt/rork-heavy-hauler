export type AppRole = 'admin' | 'factory' | 'driver';

export type ShipmentStatus = 'open' | 'pending_bids' | 'bid_accepted' | 'in_transit' | 'completed' | 'cancelled';

export type BidStatus = 'pending' | 'accepted' | 'rejected';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Shipment {
  id: string;
  factory_id: string;
  equipment_type: string;
  weight: number;
  pickup_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_location: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_date: string;
  notes: string | null;
  status: ShipmentStatus;
  accepted_bid_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  shipment_id: string;
  driver_id: string;
  price: number;
  notes: string | null;
  status: BidStatus;
  created_at: string;
  updated_at: string;
  driver_profile?: Profile;
}

export interface ShipmentWithBids extends Shipment {
  bids: Bid[];
  bids_count?: number;
}
