import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { supabase } from '@/integrations/supabase/client';
import { Package, FileText, Truck, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface DashboardStats {
  totalShipments: number;
  pendingBids: number;
  inTransit: number;
  completed: number;
}

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalShipments: 0,
    pendingBids: 0,
    inTransit: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [role]);

  const fetchStats = async () => {
    try {
      if (role === 'factory') {
        const { data: shipments } = await supabase
          .from('shipments')
          .select('status');

        if (shipments) {
          setStats({
            totalShipments: shipments.length,
            pendingBids: shipments.filter(s => s.status === 'open' || s.status === 'pending_bids').length,
            inTransit: shipments.filter(s => s.status === 'in_transit').length,
            completed: shipments.filter(s => s.status === 'completed').length
          });
        }
      } else if (role === 'driver') {
        const { data: bids } = await supabase
          .from('bids')
          .select('status');

        const { data: acceptedBids } = await supabase
          .from('bids')
          .select('shipment_id, shipments(status)')
          .eq('status', 'accepted');

        if (bids && acceptedBids) {
          setStats({
            totalShipments: bids.length,
            pendingBids: bids.filter(b => b.status === 'pending').length,
            inTransit: acceptedBids.filter(b => (b as any).shipments?.status === 'in_transit').length,
            completed: acceptedBids.filter(b => (b as any).shipments?.status === 'completed').length
          });
        }
      } else if (role === 'admin') {
        const { data: allShipments } = await supabase
          .from('shipments')
          .select('status');

        if (allShipments) {
          setStats({
            totalShipments: allShipments.length,
            pendingBids: allShipments.filter(s => s.status === 'open' || s.status === 'pending_bids').length,
            inTransit: allShipments.filter(s => s.status === 'in_transit').length,
            completed: allShipments.filter(s => s.status === 'completed').length
          });
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'مساء الخير';
    return 'مساء الخير';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}، {profile?.full_name || 'مستخدم'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'factory' 
              ? 'إدارة شحناتك ومتابعة العروض' 
              : role === 'driver' 
                ? 'تصفح الطلبات وإدارة رحلاتك'
                : 'لوحة تحكم المدير'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={role === 'driver' ? 'إجمالي العروض' : 'إجمالي الشحنات'}
            value={stats.totalShipments}
            icon={<Package className="h-6 w-6" />}
          />
          <StatsCard
            title={role === 'driver' ? 'عروض معلقة' : 'في انتظار العروض'}
            value={stats.pendingBids}
            icon={<Clock className="h-6 w-6" />}
          />
          <StatsCard
            title="قيد النقل"
            value={stats.inTransit}
            icon={<Truck className="h-6 w-6" />}
          />
          <StatsCard
            title="مكتملة"
            value={stats.completed}
            icon={<CheckCircle className="h-6 w-6" />}
          />
        </div>

        {/* Quick Actions for Factory */}
        {role === 'factory' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl font-bold mb-4">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a 
                href="/shipments/new"
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">إنشاء شحنة جديدة</p>
                  <p className="text-sm text-muted-foreground">أضف طلب نقل جديد</p>
                </div>
              </a>
              <a 
                href="/bids"
                className="flex items-center gap-4 p-4 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors border border-warning/20"
              >
                <div className="p-3 rounded-lg bg-warning text-warning-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">مراجعة العروض</p>
                  <p className="text-sm text-muted-foreground">اطلع على عروض السائقين</p>
                </div>
              </a>
              <a 
                href="/shipments"
                className="flex items-center gap-4 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors border border-success/20"
              >
                <div className="p-3 rounded-lg bg-success text-success-foreground">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">تتبع الشحنات</p>
                  <p className="text-sm text-muted-foreground">متابعة حالة الشحنات</p>
                </div>
              </a>
            </div>
          </div>
        )}

        {/* Quick Actions for Driver */}
        {role === 'driver' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl font-bold mb-4">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a 
                href="/open-requests"
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">تصفح الطلبات</p>
                  <p className="text-sm text-muted-foreground">اكتشف فرص النقل المتاحة</p>
                </div>
              </a>
              <a 
                href="/my-trips"
                className="flex items-center gap-4 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors border border-success/20"
              >
                <div className="p-3 rounded-lg bg-success text-success-foreground">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">رحلاتي</p>
                  <p className="text-sm text-muted-foreground">إدارة الرحلات المقبولة</p>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
