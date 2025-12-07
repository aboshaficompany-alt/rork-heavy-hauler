import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PushNotificationToggleProps {
  variant?: 'icon' | 'button';
  className?: string;
}

export function PushNotificationToggle({ variant = 'icon', className }: PushNotificationToggleProps) {
  const { isSupported, permission, requestPermission } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  const handleClick = async () => {
    if (permission === 'default') {
      await requestPermission();
    }
  };

  const getIcon = () => {
    switch (permission) {
      case 'granted':
        return <BellRing className="h-5 w-5" />;
      case 'denied':
        return <BellOff className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getTooltipText = () => {
    switch (permission) {
      case 'granted':
        return 'الإشعارات مفعلة';
      case 'denied':
        return 'الإشعارات مرفوضة - فعلها من إعدادات المتصفح';
      default:
        return 'تفعيل الإشعارات';
    }
  };

  const getButtonText = () => {
    switch (permission) {
      case 'granted':
        return 'الإشعارات مفعلة';
      case 'denied':
        return 'الإشعارات مرفوضة';
      default:
        return 'تفعيل الإشعارات';
    }
  };

  if (variant === 'button') {
    return (
      <Button
        onClick={handleClick}
        disabled={permission !== 'default'}
        variant={permission === 'granted' ? 'secondary' : 'default'}
        className={cn('gap-2', className)}
      >
        {getIcon()}
        <span>{getButtonText()}</span>
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={permission !== 'default'}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all',
              permission === 'granted' 
                ? 'bg-success/10 text-success' 
                : permission === 'denied'
                ? 'bg-destructive/10 text-destructive cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
              className
            )}
          >
            {getIcon()}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
