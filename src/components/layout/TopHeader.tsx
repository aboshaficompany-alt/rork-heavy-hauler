import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function TopHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('تم تسجيل الخروج بنجاح');
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:right-72 h-16 bg-background/80 backdrop-blur-sm border-b border-border z-30 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 mr-12 lg:mr-0">
        <PushNotificationToggle />
        <NotificationBell />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4 sm:ml-2" />
          <span className="hidden sm:inline">تسجيل الخروج</span>
        </Button>
      </div>
    </header>
  );
}
