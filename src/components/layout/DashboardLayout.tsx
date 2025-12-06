import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { MobileHeader } from './MobileHeader';
import { MobileNav } from './MobileNav';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop */}
      <div className="hidden lg:block">
        <Sidebar />
        <TopHeader />
      </div>
      
      {/* Mobile */}
      <MobileHeader />
      <MobileNav />
      
      <main className="lg:mr-72 min-h-screen pt-16 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
