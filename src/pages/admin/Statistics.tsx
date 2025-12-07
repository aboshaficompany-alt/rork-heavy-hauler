import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Truck,
  Calendar,
  CheckCircle2,
  Users,
  Factory,
  Package,
  BarChart3,
  PieChart
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

type BidWithShipment = {
  id: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  driver_id: string;
  shipment: {
    id: string;
    equipment_type: string;
    status: string;
    pickup_date: string;
    factory_id: string;
  };
};

export default function AdminStatistics() {
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '12months'>('6months');

  // Fetch all bids
  const { data: bids, isLoading: bidsLoading } = useQuery({
    queryKey: ['admin-bids-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          price,
          status,
          created_at,
          driver_id,
          shipment:shipments(
            id,
            equipment_type,
            status,
            pickup_date,
            factory_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as BidWithShipment[];
    },
  });

  // Fetch users count
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id');
      const { data: roles } = await supabase.from('user_roles').select('role');
      
      const drivers = roles?.filter(r => r.role === 'driver').length || 0;
      const factories = roles?.filter(r => r.role === 'factory').length || 0;
      
      return {
        total: profiles?.length || 0,
        drivers,
        factories
      };
    },
  });

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    if (!bids) return [];
    
    const months = selectedPeriod === '6months' ? 6 : 12;
    const data = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));
      
      const monthBids = bids.filter(bid => {
        const bidDate = parseISO(bid.created_at);
        return bidDate >= monthStart && bidDate <= monthEnd;
      });
      
      const completedBids = monthBids.filter(b => 
        b.status === 'accepted' && b.shipment.status === 'completed'
      );
      
      const earnings = completedBids.reduce((sum, bid) => sum + bid.price, 0);
      
      data.push({
        month: format(monthStart, 'MMM', { locale: ar }),
        fullMonth: format(monthStart, 'MMMM yyyy', { locale: ar }),
        trips: completedBids.length,
        earnings,
        bids: monthBids.length,
        accepted: monthBids.filter(b => b.status === 'accepted').length,
        rejected: monthBids.filter(b => b.status === 'rejected').length,
        pending: monthBids.filter(b => b.status === 'pending').length,
      });
    }
    
    return data;
  }, [bids, selectedPeriod]);

  // Calculate equipment type distribution
  const equipmentData = useMemo(() => {
    if (!bids) return [];
    
    const completed = bids.filter(b => 
      b.status === 'accepted' && b.shipment.status === 'completed'
    );
    
    const typeCounts: Record<string, { count: number; earnings: number }> = {};
    
    completed.forEach(bid => {
      const type = bid.shipment.equipment_type.split(' - ')[0];
      if (!typeCounts[type]) {
        typeCounts[type] = { count: 0, earnings: 0 };
      }
      typeCounts[type].count++;
      typeCounts[type].earnings += bid.price;
    });
    
    return Object.entries(typeCounts).map(([name, data]) => ({
      name,
      value: data.count,
      earnings: data.earnings,
    }));
  }, [bids]);

  // Overall stats
  const stats = useMemo(() => {
    if (!bids) return {
      totalEarnings: 0,
      completedTrips: 0,
      totalBids: 0,
      acceptanceRate: 0,
      thisMonthEarnings: 0,
      lastMonthEarnings: 0,
      earningsGrowth: 0,
    };
    
    const completed = bids.filter(b => 
      b.status === 'accepted' && b.shipment.status === 'completed'
    );
    const accepted = bids.filter(b => b.status === 'accepted');
    
    const totalEarnings = completed.reduce((sum, bid) => sum + bid.price, 0);
    const acceptanceRate = bids.length > 0 
      ? Math.round((accepted.length / bids.length) * 100) 
      : 0;
    
    const thisMonthStart = startOfMonth(new Date());
    const thisMonthEnd = endOfMonth(new Date());
    const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
    const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
    
    const thisMonthCompleted = completed.filter(b => {
      const date = parseISO(b.created_at);
      return date >= thisMonthStart && date <= thisMonthEnd;
    });
    
    const lastMonthCompleted = completed.filter(b => {
      const date = parseISO(b.created_at);
      return date >= lastMonthStart && date <= lastMonthEnd;
    });
    
    const thisMonthEarnings = thisMonthCompleted.reduce((sum, bid) => sum + bid.price, 0);
    const lastMonthEarnings = lastMonthCompleted.reduce((sum, bid) => sum + bid.price, 0);
    
    const earningsGrowth = lastMonthEarnings > 0 
      ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
      : thisMonthEarnings > 0 ? 100 : 0;
    
    return {
      totalEarnings,
      completedTrips: completed.length,
      totalBids: bids.length,
      acceptanceRate,
      thisMonthEarnings,
      lastMonthEarnings,
      earningsGrowth,
    };
  }, [bids]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{payload[0]?.payload?.fullMonth || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()} {entry.name === 'الأرباح' ? 'ريال' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (bidsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-muted rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-muted rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-l from-primary/5 to-transparent rounded-2xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-primary" />
                إحصائيات المنصة
              </h1>
              <p className="text-muted-foreground mt-1">تحليل شامل لأداء المنصة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('6months')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === '6months'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                6 أشهر
              </button>
              <button
                onClick={() => setSelectedPeriod('12months')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === '12months'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                12 شهر
              </button>
            </div>
          </div>
        </div>

        {/* Users Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
                  <p className="text-2xl font-bold text-primary mt-1">{usersData?.total || 0}</p>
                </div>
                <Users className="h-8 w-8 text-primary/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">السائقون</p>
                  <p className="text-2xl font-bold text-success mt-1">{usersData?.drivers || 0}</p>
                </div>
                <Truck className="h-8 w-8 text-success/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">المنشآت</p>
                  <p className="text-2xl font-bold text-warning mt-1">{usersData?.factories || 0}</p>
                </div>
                <Factory className="h-8 w-8 text-warning/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">الرحلات المكتملة</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.completedTrips}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-success/20 via-success/10 to-transparent border-success/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-3xl font-bold text-success mt-1">
                    {stats.totalEarnings.toLocaleString()}
                  </p>
                  <p className="text-sm text-success/70">ريال</p>
                </div>
                <DollarSign className="h-10 w-10 text-success/40" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">هذا الشهر</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stats.thisMonthEarnings.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">ريال</p>
                </div>
                <Calendar className="h-10 w-10 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">نسبة النمو</p>
                  <div className="flex items-center gap-2 mt-1">
                    {stats.earningsGrowth >= 0 ? (
                      <>
                        <TrendingUp className="h-6 w-6 text-success" />
                        <span className="text-3xl font-bold text-success">+{stats.earningsGrowth}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-6 w-6 text-destructive" />
                        <span className="text-3xl font-bold text-destructive">{stats.earningsGrowth}%</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">مقارنة بالشهر السابق</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Chart */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                الإيرادات الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="earnings"
                      name="الإيرادات"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      fill="url(#earningsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trips Chart */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                الرحلات الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="trips" 
                      name="الرحلات"
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Equipment Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                توزيع أنواع المعدات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={equipmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {equipmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}