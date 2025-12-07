import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from 'sonner';

export function useDriverNotifications() {
  const { user, role } = useAuth();
  const { playAlert, playBidAccepted, playBidRejected, initAudioContext } = useNotificationSound();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!user || role !== 'driver') return;

    // Subscribe to new shipments
    const channel = supabase
      .channel('driver-shipment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipments'
        },
        (payload) => {
          console.log('New shipment received:', payload);
          
          // Play alert sound
          playAlert();
          
          // Show toast notification
          toast.info('🚚 شحنة جديدة متاحة!', {
            description: `نوع المعدة: ${(payload.new as any).equipment_type}`,
            duration: 5000,
            action: {
              label: 'عرض',
              onClick: () => {
                window.location.href = '/open-requests';
              }
            }
          });
        }
      )
      .subscribe();

    // Subscribe to bid status changes
    const bidChannel = supabase
      .channel('driver-bid-status-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bids',
          filter: `driver_id=eq.${user.id}`
        },
        async (payload) => {
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;

          if (newStatus !== oldStatus) {
            // Get shipment details for better notification
            const { data: shipment } = await supabase
              .from('shipments')
              .select('equipment_type, pickup_location, delivery_location')
              .eq('id', (payload.new as any).shipment_id)
              .single();

            if (newStatus === 'accepted') {
              playBidAccepted();
              toast.success('🎉 تم قبول عرضك!', {
                description: shipment 
                  ? `شحنة ${shipment.equipment_type} من ${shipment.pickup_location}`
                  : 'تهانينا! يمكنك الآن البدء بالرحلة',
                duration: 10000,
                action: {
                  label: 'عرض التفاصيل',
                  onClick: () => {
                    window.location.href = `/driver/shipment/${(payload.new as any).shipment_id}`;
                  }
                }
              });
            } else if (newStatus === 'rejected') {
              playBidRejected();
              toast.error('تم رفض عرضك', {
                description: 'للأسف، لم يتم قبول عرضك على هذه الشحنة',
                duration: 5000
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(bidChannel);
    };
  }, [user, role, playAlert, playBidAccepted, playBidRejected]);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInitializedRef.current) {
        initAudioContext();
        hasInitializedRef.current = true;
      }
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initAudioContext]);
}