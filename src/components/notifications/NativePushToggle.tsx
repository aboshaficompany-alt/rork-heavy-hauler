import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface NativePushToggleProps {
  variant?: 'icon' | 'button';
  className?: string;
}

export function NativePushToggle({ variant = 'icon', className }: NativePushToggleProps) {
  const { isSupported, isNative, permission, requestPermission } = useNativePushNotifications();

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
    const prefix = isNative ? '(تطبيق أصلي) ' : '';
    switch (permission) {
      case 'granted':
        return prefix + 'الإشعارات مفعلة';
      case 'denied':
        return prefix + 'الإشعارات مرفوضة - فعلها من الإعدادات';
      default:
        return prefix + 'تفعيل الإشعارات';
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
        {isNative && (
          <Badge variant="outline" className="mr-2 text-xs">
            <Smartphone className="h-3 w-3 ml-1" />
            أصلي
          </Badge>
        )}
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
              'relative w-10 h-10 rounded-full flex items-center justify-center transition-all',
              permission === 'granted' 
                ? 'bg-success/10 text-success' 
                : permission === 'denied'
                ? 'bg-destructive/10 text-destructive cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
              className
            )}
          >
            {getIcon()}
            {isNative && (
              <span className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                <Smartphone className="h-2 w-2 text-primary-foreground" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
