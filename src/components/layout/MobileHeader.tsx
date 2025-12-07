import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { Truck } from 'lucide-react';

export function MobileHeader() {
  const { profile, role } = useAuth();

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return 'مدير';
      case 'factory': return 'منشأة';
      case 'driver': return 'سائق';
      default: return '';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:hidden h-16 bg-primary z-50 px-4 flex items-center justify-between safe-area-top shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
          <Truck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-bold text-primary-foreground">اماس لوجستك</h1>
          <p className="text-xs text-primary-foreground/70">{getRoleLabel()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <NotificationBell className="text-primary-foreground" />
        <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center border-2 border-primary-foreground/30">
          <span className="text-primary-foreground font-bold text-sm">
            {profile?.full_name?.charAt(0) || 'م'}
          </span>
        </div>
      </div>
    </header>
  );
}
