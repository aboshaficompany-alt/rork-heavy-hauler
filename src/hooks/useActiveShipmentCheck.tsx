import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ActiveShipment {
  id: string;
  equipment_type: string;
  status: string;
  pickup_location: string;
  delivery_location: string;
}

export function useActiveShipmentCheck() {
  const { user, role } = useAuth();
  const [activeShipment, setActiveShipment] = useState<ActiveShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveShipment, setHasActiveShipment] = useState(false);

  const checkActiveShipment = useCallback(async () => {
    if (!user?.id || role !== 'driver') {
      setLoading(false);
      return;
    }

    try {
      // Get driver's accepted bids on non-completed shipments
      const { data: acceptedBids } = await supabase
        .from('bids')
        .select('shipment_id')
        .eq('driver_id', user.id)
        .eq('status', 'accepted');

      if (!acceptedBids || acceptedBids.length === 0) {
        setActiveShipment(null);
        setHasActiveShipment(false);
        setLoading(false);
        return;
      }

      const shipmentIds = acceptedBids.map(bid => bid.shipment_id);

      // Check if any of these shipments are active (not completed or cancelled)
      const { data: activeShipments } = await supabase
        .from('shipments')
        .select('id, equipment_type, status, pickup_location, delivery_location')
        .in('id', shipmentIds)
        .in('status', ['bid_accepted', 'in_transit']);

      if (activeShipments && activeShipments.length > 0) {
        setActiveShipment(activeShipments[0]);
        setHasActiveShipment(true);
      } else {
        setActiveShipment(null);
        setHasActiveShipment(false);
      }
    } catch (error) {
      console.error('Error checking active shipment:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, role]);

  useEffect(() => {
    checkActiveShipment();

    // Subscribe to bid and shipment changes
    const channel = supabase
      .channel('active-shipment-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `driver_id=eq.${user?.id}`
        },
        () => checkActiveShipment()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments'
        },
        () => checkActiveShipment()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkActiveShipment, user?.id]);

  return {
    activeShipment,
    hasActiveShipment,
    loading,
    refresh: checkActiveShipment
  };
}
