import { NotificationBell } from '@/components/notifications/NotificationBell';

export function TopHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 lg:right-72 h-16 bg-background/80 backdrop-blur-sm border-b border-border z-30 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 mr-12 lg:mr-0">
        <NotificationBell />
      </div>
      <div></div>
    </header>
  );
}
