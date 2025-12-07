import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Truck, 
  Users, 
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: ('admin' | 'factory' | 'driver')[];
}

const navItems: NavItem[] = [
  { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'factory', 'driver'] },
  { label: 'الشحنات', href: '/shipments', icon: Package, roles: ['factory'] },
  { label: 'العروض', href: '/bids', icon: FileText, roles: ['factory'] },
  { label: 'الطلبات المفتوحة', href: '/open-requests', icon: Truck, roles: ['driver'] },
  { label: 'رحلاتي', href: '/my-trips', icon: Truck, roles: ['driver'] },
  { label: 'الإحصائيات', href: '/driver/stats', icon: BarChart3, roles: ['driver'] },
  { label: 'المستخدمين', href: '/admin/users', icon: Users, roles: ['admin'] },
  { label: 'جميع الشحنات', href: '/admin/shipments', icon: Package, roles: ['admin'] },
  { label: 'الإعدادات', href: '/settings', icon: Settings, roles: ['admin', 'factory', 'driver'] },
];

export function Sidebar() {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 h-full w-72 bg-sidebar text-sidebar-foreground z-40 transform transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <h1 className="text-2xl font-bold text-primary">اماس لوجستك</h1>
            <p className="text-sm text-sidebar-foreground/70 mt-1">منصة النقل الثقيل</p>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold">
                  {profile?.full_name?.charAt(0) || 'م'}
                </span>
              </div>
              <div>
                <p className="font-medium text-sm">{profile?.full_name || 'المستخدم'}</p>
                <p className="text-xs text-sidebar-foreground/70">
                  {role === 'admin' ? 'مدير' : role === 'factory' ? 'منشأة' : 'سائق'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              <span>تسجيل الخروج</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
