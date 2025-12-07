import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNotificationSound } from './useNotificationSound';

interface UseAutoStatusUpdateProps {
  shipmentId: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  currentStatus: string;
  driverLat: number | null;
  driverLng: number | null;
  enabled?: boolean;
}

// Calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Threshold distance in meters (500m = 0.5km)
const PICKUP_THRESHOLD = 500;
const DELIVERY_THRESHOLD = 500;

export function useAutoStatusUpdate({
  shipmentId,
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  currentStatus,
  driverLat,
  driverLng,
  enabled = true
}: UseAutoStatusUpdateProps) {
  const { playSuccess, playAlert } = useNotificationSound();
  const [isNearPickup, setIsNearPickup] = useState(false);
  const [isNearDelivery, setIsNearDelivery] = useState(false);
  const lastNotifiedRef = useRef<string | null>(null);

  const checkProximity = useCallback(() => {
    if (!driverLat || !driverLng || !enabled) return;

    // Check proximity to pickup
    if (pickupLat && pickupLng && currentStatus === 'bid_accepted') {
      const distanceToPickup = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
      const nearPickup = distanceToPickup <= PICKUP_THRESHOLD;
      
      if (nearPickup && !isNearPickup && lastNotifiedRef.current !== 'pickup') {
        setIsNearPickup(true);
        lastNotifiedRef.current = 'pickup';
        playAlert();
        toast.info('📍 أنت قريب من موقع الاستلام!', {
          description: 'هل تريد بدء الرحلة؟',
          duration: 10000,
          action: {
            label: 'بدء الرحلة',
            onClick: async () => {
              try {
                await supabase
                  .from('shipments')
                  .update({ status: 'in_transit' })
                  .eq('id', shipmentId);
                playSuccess();
                toast.success('تم بدء الرحلة تلقائياً');
              } catch (error) {
                console.error('Error auto-starting trip:', error);
              }
            }
          }
        });
      } else if (!nearPickup) {
        setIsNearPickup(false);
        if (lastNotifiedRef.current === 'pickup') {
          lastNotifiedRef.current = null;
        }
      }
    }

    // Check proximity to delivery
    if (deliveryLat && deliveryLng && currentStatus === 'in_transit') {
      const distanceToDelivery = calculateDistance(driverLat, driverLng, deliveryLat, deliveryLng);
      const nearDelivery = distanceToDelivery <= DELIVERY_THRESHOLD;
      
      if (nearDelivery && !isNearDelivery && lastNotifiedRef.current !== 'delivery') {
        setIsNearDelivery(true);
        lastNotifiedRef.current = 'delivery';
        playAlert();
        toast.info('🎯 أنت قريب من موقع التسليم!', {
          description: 'هل تريد تأكيد التسليم؟',
          duration: 10000,
          action: {
            label: 'تأكيد التسليم',
            onClick: async () => {
              try {
                await supabase
                  .from('shipments')
                  .update({ status: 'completed' })
                  .eq('id', shipmentId);
                playSuccess();
                toast.success('تم تأكيد التسليم بنجاح! 🎉');
              } catch (error) {
                console.error('Error auto-completing trip:', error);
              }
            }
          }
        });
      } else if (!nearDelivery) {
        setIsNearDelivery(false);
        if (lastNotifiedRef.current === 'delivery') {
          lastNotifiedRef.current = null;
        }
      }
    }
  }, [
    driverLat, driverLng, pickupLat, pickupLng, deliveryLat, deliveryLng,
    currentStatus, shipmentId, enabled, isNearPickup, isNearDelivery,
    playAlert, playSuccess
  ]);

  useEffect(() => {
    checkProximity();
  }, [checkProximity]);

  return {
    isNearPickup,
    isNearDelivery
  };
}
