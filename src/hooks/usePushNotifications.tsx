import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('المتصفح لا يدعم الإشعارات');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        toast.success('تم تفعيل الإشعارات');
        return true;
      } else if (result === 'denied') {
        toast.error('تم رفض إذن الإشعارات');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        dir: 'rtl',
        lang: 'ar',
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission]);

  // Subscribe to shipments for drivers
  useEffect(() => {
    if (!user || permission !== 'granted') return;

    const channel = supabase
      .channel('push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipments'
        },
        (payload) => {
          const shipment = payload.new as { equipment_type: string; pickup_location: string };
          showNotification('شحنة جديدة متاحة!', {
            body: `${shipment.equipment_type} - ${shipment.pickup_location}`,
            tag: 'new-shipment'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bids',
          filter: `driver_id=eq.${user.id}`
        },
        (payload) => {
          const bid = payload.new as { status: string };
          if (bid.status === 'accepted') {
            showNotification('تم قبول عرضك!', {
              body: 'تهانينا! تم قبول عرضك على الشحنة',
              tag: 'bid-accepted'
            });
          } else if (bid.status === 'rejected') {
            showNotification('تم رفض عرضك', {
              body: 'للأسف تم رفض عرضك على الشحنة',
              tag: 'bid-rejected'
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const message = payload.new as { sender_id: string; content: string };
          if (message.sender_id !== user.id) {
            showNotification('رسالة جديدة', {
              body: message.content.substring(0, 100),
              tag: 'new-message'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, permission, showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification
  };
}
