import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'new_bid' | 'bid_accepted' | 'bid_rejected' | 'shipment_update' | 'new_shipment';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !role) return;

    // Subscribe to realtime changes
    const shipmentChannel = supabase
      .channel('notification-shipments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && role === 'driver') {
            addNotification({
              type: 'new_shipment',
              title: 'شحنة جديدة',
              message: `شحنة جديدة متاحة: ${(payload.new as any).equipment_type}`
            });
          } else if (payload.eventType === 'UPDATE' && role === 'factory') {
            const oldStatus = (payload.old as any)?.status;
            const newStatus = (payload.new as any)?.status;
            if (oldStatus !== newStatus) {
              addNotification({
                type: 'shipment_update',
                title: 'تحديث الشحنة',
                message: `تم تحديث حالة الشحنة إلى: ${getStatusLabel(newStatus)}`
              });
            }
          }
        }
      )
      .subscribe();

    const bidChannel = supabase
      .channel('notification-bids')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && role === 'factory') {
            addNotification({
              type: 'new_bid',
              title: 'عرض جديد',
              message: `تم تقديم عرض جديد بقيمة ${(payload.new as any).price} ر.س`
            });
          } else if (payload.eventType === 'UPDATE' && role === 'driver') {
            const newStatus = (payload.new as any).status;
            if (newStatus === 'accepted') {
              addNotification({
                type: 'bid_accepted',
                title: 'تم قبول عرضك',
                message: 'تهانينا! تم قبول عرضك على الشحنة'
              });
            } else if (newStatus === 'rejected') {
              addNotification({
                type: 'bid_rejected',
                title: 'تم رفض عرضك',
                message: 'للأسف، تم رفض عرضك على الشحنة'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shipmentChannel);
      supabase.removeChannel(bidChannel);
    };
  }, [user, role]);

  const addNotification = (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    setNotifications(prev => [
      {
        ...notification,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date()
      },
      ...prev.slice(0, 19) // Keep max 20 notifications
    ]);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'open': 'مفتوحة',
      'pending_bids': 'بانتظار العروض',
      'bid_accepted': 'تم قبول العرض',
      'in_transit': 'قيد النقل',
      'completed': 'مكتملة',
      'cancelled': 'ملغاة'
    };
    return labels[status] || status;
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_bid':
        return '💰';
      case 'bid_accepted':
        return '✅';
      case 'bid_rejected':
        return '❌';
      case 'shipment_update':
        return '📦';
      case 'new_shipment':
        return '🚚';
      default:
        return '🔔';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              تحديد الكل كمقروء
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    setNotifications(prev =>
                      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                    );
                  }}
                >
                  <div className="flex gap-3">
                    <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(notification.createdAt, 'p', { locale: ar })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
