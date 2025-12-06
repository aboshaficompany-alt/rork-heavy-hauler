import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { supabase } from '@/integrations/supabase/client';
import { Package, FileText, Truck, CheckCircle, Clock, TrendingUp, Users, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalShipments: number;
  pendingBids: number;
  inTransit: number;
  completed: number;
  totalBids?: number;
  acceptedBids?: number;
  totalUsers?: number;
  thisMonthShipments?: number;
  lastMonthShipments?: number;
  avgBidPrice?: number;
}

interface RecentActivity {
  id: string;
  type: 'shipment' | 'bid';
  title: string;
  description: string;
  time: string;
  status?: string;
}

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalShipments: 0,
    pendingBids: 0,
    inTransit: 0,
    completed: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, [role]);

  const fetchStats = async () => {
    try {
      if (role === 'factory') {
        const { data: shipments } = await supabase
          .from('shipments')
          .select('id, status, created_at');

        const shipmentIds = shipments?.map(s => s.id) || [];
        
        let bids: any[] = [];
        if (shipmentIds.length > 0) {
          const { data: bidsData } = await supabase
            .from('bids')
            .select('status, price, shipment_id')
            .in('shipment_id', shipmentIds);
          bids = bidsData || [];
        }

        const thisMonth = startOfMonth(new Date());
        const thisMonthShipments = shipments?.filter(s => new Date(s.created_at) >= thisMonth).length || 0;
        const lastMonth = startOfMonth(subDays(thisMonth, 1));
        const lastMonthEnd = endOfMonth(subDays(thisMonth, 1));
        const lastMonthShipments = shipments?.filter(s => {
          const date = new Date(s.created_at);
          return date >= lastMonth && date <= lastMonthEnd;
        }).length || 0;

        if (shipments) {
          setStats({
            totalShipments: shipments.length,
            pendingBids: shipments.filter(s => s.status === 'open' || s.status === 'pending_bids').length,
            inTransit: shipments.filter(s => s.status === 'in_transit').length,
            completed: shipments.filter(s => s.status === 'completed').length,
            totalBids: bids.length,
            acceptedBids: bids.filter(b => b.status === 'accepted').length,
            thisMonthShipments,
            lastMonthShipments,
            avgBidPrice: bids.length ? Math.round(bids.reduce((sum, b) => sum + Number(b.price), 0) / bids.length) : 0
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
          .select('status, created_at');

        const { data: allBids } = await supabase
          .from('bids')
          .select('status, price');

        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id');

        const thisMonth = startOfMonth(new Date());
        const thisMonthShipments = allShipments?.filter(s => new Date(s.created_at) >= thisMonth).length || 0;

        if (allShipments) {
          setStats({
            totalShipments: allShipments.length,
            pendingBids: allShipments.filter(s => s.status === 'open' || s.status === 'pending_bids').length,
            inTransit: allShipments.filter(s => s.status === 'in_transit').length,
            completed: allShipments.filter(s => s.status === 'completed').length,
            totalBids: allBids?.length || 0,
            acceptedBids: allBids?.filter(b => b.status === 'accepted').length || 0,
            totalUsers: allUsers?.length || 0,
            thisMonthShipments,
            avgBidPrice: allBids?.length ? Math.round(allBids.reduce((sum, b) => sum + Number(b.price), 0) / allBids.length) : 0
          });
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data: recentShipments } = await supabase
        .from('shipments')
        .select('id, equipment_type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = (recentShipments || []).map(s => ({
        id: s.id,
        type: 'shipment',
        title: `شحنة ${s.equipment_type}`,
        description: s.status === 'open' ? 'شحنة جديدة' : s.status === 'completed' ? 'تم التسليم' : 'قيد المعالجة',
        time: format(new Date(s.created_at), 'dd MMM yyyy', { locale: ar }),
        status: s.status
      }));

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error fetching activity:', error);
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

  const growthPercentage = stats.lastMonthShipments 
    ? Math.round(((stats.thisMonthShipments || 0) - stats.lastMonthShipments) / stats.lastMonthShipments * 100)
    : 0;

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
                : 'لوحة تحكم المدير - نظرة عامة على المنصة'}
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

        {/* Factory Extended Stats */}
        {role === 'factory' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي العروض المستلمة</p>
                    <p className="text-2xl font-bold mt-1">{stats.totalBids || 0}</p>
                    <p className="text-sm text-success mt-1">{stats.acceptedBids || 0} عرض مقبول</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">شحنات هذا الشهر</p>
                    <p className="text-2xl font-bold mt-1">{stats.thisMonthShipments || 0}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {growthPercentage >= 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      <span className={growthPercentage >= 0 ? 'text-sm text-success' : 'text-sm text-destructive'}>
                        {Math.abs(growthPercentage)}% عن الشهر الماضي
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <BarChart3 className="h-6 w-6 text-success" />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط سعر العروض</p>
                    <p className="text-2xl font-bold mt-1">{(stats.avgBidPrice || 0).toLocaleString()} ر.س</p>
                    <p className="text-sm text-muted-foreground mt-1">لكل شحنة</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10">
                    <DollarSign className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Admin Extended Stats */}
        {role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                  <p className="text-2xl font-bold mt-1">{stats.totalUsers || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العروض</p>
                  <p className="text-2xl font-bold mt-1">{stats.totalBids || 0}</p>
                  <p className="text-sm text-success mt-1">{stats.acceptedBids || 0} مقبول</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <FileText className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">شحنات هذا الشهر</p>
                  <p className="text-2xl font-bold mt-1">{stats.thisMonthShipments || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <BarChart3 className="h-6 w-6 text-warning" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">متوسط سعر العروض</p>
                  <p className="text-2xl font-bold mt-1">{(stats.avgBidPrice || 0).toLocaleString()} ر.س</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10">
                  <DollarSign className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {(role === 'factory' || role === 'admin') && recentActivity.length > 0 && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">آخر النشاطات</h2>
              <Link to="/shipments" className="text-sm text-primary hover:underline">
                عرض الكل
              </Link>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  to={`/shipments/${activity.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{activity.time}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions for Factory */}
        {role === 'factory' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl font-bold mb-4">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link 
                to="/shipments/new"
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">إنشاء شحنة جديدة</p>
                  <p className="text-sm text-muted-foreground">أضف طلب نقل جديد</p>
                </div>
              </Link>
              <Link 
                to="/bids"
                className="flex items-center gap-4 p-4 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors border border-warning/20"
              >
                <div className="p-3 rounded-lg bg-warning text-warning-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">مراجعة العروض</p>
                  <p className="text-sm text-muted-foreground">اطلع على عروض السائقين</p>
                </div>
              </Link>
              <Link 
                to="/shipments"
                className="flex items-center gap-4 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors border border-success/20"
              >
                <div className="p-3 rounded-lg bg-success text-success-foreground">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">تتبع الشحنات</p>
                  <p className="text-sm text-muted-foreground">متابعة حالة الشحنات</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Actions for Driver */}
        {role === 'driver' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl font-bold mb-4">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                to="/open-requests"
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">تصفح الطلبات</p>
                  <p className="text-sm text-muted-foreground">اكتشف فرص النقل المتاحة</p>
                </div>
              </Link>
              <Link 
                to="/my-trips"
                className="flex items-center gap-4 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors border border-success/20"
              >
                <div className="p-3 rounded-lg bg-success text-success-foreground">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">رحلاتي</p>
                  <p className="text-sm text-muted-foreground">إدارة الرحلات المقبولة</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Actions for Admin */}
        {role === 'admin' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl font-bold mb-4">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link 
                to="/admin/users"
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">إدارة المستخدمين</p>
                  <p className="text-sm text-muted-foreground">عرض وإدارة الحسابات</p>
                </div>
              </Link>
              <Link 
                to="/admin/shipments"
                className="flex items-center gap-4 p-4 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors border border-warning/20"
              >
                <div className="p-3 rounded-lg bg-warning text-warning-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">جميع الشحنات</p>
                  <p className="text-sm text-muted-foreground">مراقبة كل العمليات</p>
                </div>
              </Link>
              <Link 
                to="/settings"
                className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border"
              >
                <div className="p-3 rounded-lg bg-muted-foreground/10">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">الإعدادات</p>
                  <p className="text-sm text-muted-foreground">تخصيص المنصة</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}