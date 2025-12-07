import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useNativePushNotifications() {
  const { user } = useAuth();
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Check if push notifications are available
  useEffect(() => {
    const checkSupport = async () => {
      if (isNative) {
        try {
          const permStatus = await PushNotifications.checkPermissions();
          setIsSupported(true);
          if (permStatus.receive === 'granted') {
            setPermission('granted');
          } else if (permStatus.receive === 'denied') {
            setPermission('denied');
          }
        } catch {
          setIsSupported(false);
        }
      } else {
        // Fallback to web notifications
        setIsSupported('Notification' in window);
        if ('Notification' in window) {
          setPermission(Notification.permission as 'granted' | 'denied' | 'default');
        }
      }
    };
    checkSupport();
  }, [isNative]);

  // Register for push notifications
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('الإشعارات غير مدعومة');
      return false;
    }

    try {
      if (isNative) {
        const permStatus = await PushNotifications.requestPermissions();
        
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
          setPermission('granted');
          toast.success('تم تفعيل الإشعارات');
          return true;
        } else {
          setPermission('denied');
          toast.error('تم رفض إذن الإشعارات');
          return false;
        }
      } else {
        // Web fallback
        const result = await Notification.requestPermission();
        setPermission(result as 'granted' | 'denied' | 'default');
        if (result === 'granted') {
          toast.success('تم تفعيل الإشعارات');
          return true;
        }
        toast.error('تم رفض إذن الإشعارات');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('حدث خطأ أثناء طلب الإذن');
      return false;
    }
  }, [isSupported, isNative]);

  // Save FCM token to database
  const saveToken = useCallback(async (token: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: token,
          p256dh: 'native',
          auth: 'native'
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving FCM token:', error);
      }
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }, [user]);

  // Setup native push notification listeners
  useEffect(() => {
    if (!isNative || !isSupported) return;

    // On registration success
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setFcmToken(token.value);
      saveToken(token.value);
    });

    // On registration error
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      toast.error('فشل تسجيل الإشعارات');
    });

    // On push notification received (app in foreground)
    const pushReceivedListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      toast.info(notification.title || 'إشعار جديد', {
        description: notification.body
      });
    });

    // On push notification action performed (user tapped notification)
    const pushActionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed:', notification);
      // Handle navigation based on notification data
      const data = notification.notification.data;
      if (data?.type === 'shipment') {
        window.location.href = `/driver/shipment/${data.shipmentId}`;
      } else if (data?.type === 'message') {
        window.location.href = `/factory/shipment/${data.shipmentId}`;
      }
    });

    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      pushReceivedListener.then(l => l.remove());
      pushActionListener.then(l => l.remove());
    };
  }, [isNative, isSupported, saveToken]);

  // Show local notification (for both native and web)
  const showNotification = useCallback(async (title: string, body: string, data?: Record<string, string>) => {
    if (!isSupported || permission !== 'granted') return;

    try {
      if (isNative) {
        // For native, we use local notifications through the same channel
        // This requires additional setup but for now we use toast
        toast.info(title, { description: body });
      } else {
        // Web notification
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          dir: 'rtl',
          lang: 'ar',
          data
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission, isNative]);

  // Subscribe to Supabase realtime for notifications
  useEffect(() => {
    if (!user || permission !== 'granted') return;

    const channel = supabase
      .channel('native-push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipments'
        },
        (payload) => {
          const shipment = payload.new as { equipment_type: string; pickup_location: string; id: string };
          showNotification(
            'شحنة جديدة متاحة!',
            `${shipment.equipment_type} - ${shipment.pickup_location}`,
            { type: 'shipment', shipmentId: shipment.id }
          );
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
          const bid = payload.new as { status: string; shipment_id: string };
          if (bid.status === 'accepted') {
            showNotification(
              'تم قبول عرضك!',
              'تهانينا! تم قبول عرضك على الشحنة',
              { type: 'shipment', shipmentId: bid.shipment_id }
            );
          } else if (bid.status === 'rejected') {
            showNotification(
              'تم رفض عرضك',
              'للأسف تم رفض عرضك على الشحنة',
              { type: 'shipment', shipmentId: bid.shipment_id }
            );
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
          const message = payload.new as { sender_id: string; content: string; conversation_id: string };
          if (message.sender_id !== user.id) {
            showNotification(
              'رسالة جديدة',
              message.content.substring(0, 100),
              { type: 'message', conversationId: message.conversation_id }
            );
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
    isNative,
    permission,
    fcmToken,
    requestPermission,
    showNotification
  };
}
