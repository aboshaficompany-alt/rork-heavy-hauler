import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationSound } from '@/hooks/useNotificationSound';

export function useRealtimeNotifications() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { playAlert, playSuccess, playBidAccepted, playTripComplete } = useNotificationSound();

  useEffect(() => {
    if (!user?.id || !role) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Factory notifications - new bids on their shipments
    if (role === 'factory') {
      const factoryBidsChannel = supabase
        .channel('factory-bid-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bids',
          },
          async (payload) => {
            // Check if this bid is for a shipment owned by this factory
            const { data: shipment } = await supabase
              .from('shipments')
              .select('id, equipment_type')
              .eq('id', payload.new.shipment_id)
              .eq('factory_id', user.id)
              .single();

            if (shipment) {
              playAlert();
              toast({
                title: '🔔 عرض سعر جديد',
                description: `تم استلام عرض سعر جديد على شحنة ${shipment.equipment_type}`,
              });
              queryClient.invalidateQueries({ queryKey: ['factory-bids'] });
              queryClient.invalidateQueries({ queryKey: ['factory-shipments'] });
            }
          }
        )
        .subscribe();

      channels.push(factoryBidsChannel);

      // Shipment status updates with sounds
      const factoryShipmentsChannel = supabase
        .channel('factory-shipment-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'shipments',
            filter: `factory_id=eq.${user.id}`,
          },
          (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;

            if (oldStatus !== newStatus) {
              const statusMessages: Record<string, { title: string; sound: () => void }> = {
                in_transit: { 
                  title: '🚚 الشحنة في الطريق الآن', 
                  sound: () => playSuccess() 
                },
                completed: { 
                  title: '✅ تم تسليم الشحنة بنجاح!', 
                  sound: () => playTripComplete() 
                },
                cancelled: { 
                  title: '❌ تم إلغاء الشحنة', 
                  sound: () => playAlert() 
                },
              };

              const config = statusMessages[newStatus];
              if (config) {
                config.sound();
                toast({
                  title: config.title,
                  description: `شحنة ${payload.new.equipment_type}`,
                });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['factory-shipments'] });
          }
        )
        .subscribe();

      channels.push(factoryShipmentsChannel);
    }

    // Driver notifications - bid status updates
    if (role === 'driver') {
      const driverBidsChannel = supabase
        .channel('driver-bid-notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bids',
            filter: `driver_id=eq.${user.id}`,
          },
          async (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;

            if (oldStatus !== newStatus) {
              // Get shipment details
              const { data: shipment } = await supabase
                .from('shipments')
                .select('equipment_type')
                .eq('id', payload.new.shipment_id)
                .single();

              if (newStatus === 'accepted') {
                playBidAccepted();
                toast({
                  title: '🎉 تم قبول عرضك!',
                  description: `تم قبول عرضك على شحنة ${shipment?.equipment_type || ''}`,
                });
              } else if (newStatus === 'rejected') {
                playAlert();
                toast({
                  title: '❌ تم رفض العرض',
                  description: `تم رفض عرضك على شحنة ${shipment?.equipment_type || ''}`,
                  variant: 'destructive',
                });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['my-trips'] });
          }
        )
        .subscribe();

      channels.push(driverBidsChannel);

      // New open shipments
      const newShipmentsChannel = supabase
        .channel('new-shipments-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'shipments',
          },
          (payload) => {
            if (payload.new.status === 'open') {
              playAlert();
              toast({
                title: '🚚 شحنة جديدة متاحة',
                description: `شحنة ${payload.new.equipment_type} جديدة متاحة للتقديم`,
              });
              queryClient.invalidateQueries({ queryKey: ['open-shipments'] });
            }
          }
        )
        .subscribe();

      channels.push(newShipmentsChannel);
    }

    // Admin notifications
    if (role === 'admin') {
      const adminChannel = supabase
        .channel('admin-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'shipments',
          },
          () => {
            toast({
              title: '📦 شحنة جديدة',
              description: 'تم إنشاء طلب شحن جديد',
            });
            queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bids',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
          }
        )
        .subscribe();

      channels.push(adminChannel);
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user?.id, role, toast, queryClient]);
}
