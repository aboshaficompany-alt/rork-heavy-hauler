import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Truck, 
  Settings,
  Users,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: ('admin' | 'factory' | 'driver')[];
}

const navItems: NavItem[] = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'factory', 'driver'] },
  { label: 'الشحنات', href: '/shipments', icon: Package, roles: ['factory'] },
  { label: 'العروض', href: '/bids', icon: FileText, roles: ['factory'] },
  { label: 'الطلبات', href: '/open-requests', icon: Truck, roles: ['driver'] },
  { label: 'رحلاتي', href: '/my-trips', icon: Truck, roles: ['driver'] },
  { label: 'الإحصائيات', href: '/driver/stats', icon: BarChart3, roles: ['driver'] },
  { label: 'المستخدمين', href: '/admin/users', icon: Users, roles: ['admin'] },
  { label: 'الشحنات', href: '/admin/shipments', icon: Package, roles: ['admin'] },
  { label: 'الإعدادات', href: '/settings', icon: Settings, roles: ['admin', 'factory', 'driver'] },
];

export function MobileNav() {
  const { role } = useAuth();
  const location = useLocation();

  const filteredNavItems = navItems
    .filter(item => role && item.roles.includes(role))
    .slice(0, 5); // Show max 5 items in bottom nav

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-primary z-50 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-around h-16 px-2">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-3 py-2 transition-all duration-200 min-w-[60px]",
                isActive 
                  ? "text-primary-foreground" 
                  : "text-primary-foreground/60 hover:text-primary-foreground/80"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                isActive && "bg-primary-foreground/20"
              )}>
                <item.icon className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "font-bold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
