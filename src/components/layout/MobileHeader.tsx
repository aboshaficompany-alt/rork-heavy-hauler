import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { Truck } from 'lucide-react';

export function MobileHeader() {
  const { profile, role } = useAuth();

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return 'مدير';
      case 'factory': return 'مصنع';
      case 'driver': return 'سائق';
      default: return '';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:hidden h-16 bg-background/95 backdrop-blur-md border-b border-border z-50 px-4 flex items-center justify-between safe-area-top">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">اماس لوجستك</h1>
          <p className="text-[10px] text-muted-foreground">{getRoleLabel()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">
            {profile?.full_name?.charAt(0) || 'م'}
          </span>
        </div>
      </div>
    </header>
  );
}
