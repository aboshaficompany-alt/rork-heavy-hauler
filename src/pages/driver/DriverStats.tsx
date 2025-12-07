import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Truck,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
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
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

type BidWithShipment = {
  id: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  shipment: {
    id: string;
    equipment_type: string;
    status: string;
    pickup_date: string;
  };
};

export default function DriverStats() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '12months'>('6months');

  const { data: bids, isLoading } = useQuery({
    queryKey: ['driver-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          price,
          status,
          created_at,
          shipment:shipments(
            id,
            equipment_type,
            status,
            pickup_date
          )
        `)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as BidWithShipment[];
    },
    enabled: !!user?.id,
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
      avgEarningsPerTrip: 0,
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
      avgEarningsPerTrip: completed.length > 0 ? Math.round(totalEarnings / completed.length) : 0,
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

  if (isLoading) {
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-primary" />
                الإحصائيات
              </h1>
              <p className="text-muted-foreground mt-1">تحليل أداءك وأرباحك</p>
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

        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-success/20 via-success/10 to-transparent border-success/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
                  <p className="text-2xl font-bold text-success mt-1">
                    {stats.totalEarnings.toLocaleString()}
                  </p>
                  <p className="text-xs text-success/70">ريال</p>
                </div>
                <DollarSign className="h-8 w-8 text-success/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">الرحلات المكتملة</p>
                  <p className="text-2xl font-bold text-primary mt-1">{stats.completedTrips}</p>
                  <p className="text-xs text-muted-foreground">رحلة</p>
                </div>
                <Truck className="h-8 w-8 text-primary/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">معدل القبول</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stats.acceptanceRate}%</p>
                  <p className="text-xs text-muted-foreground">من العروض</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">متوسط الربح</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stats.avgEarningsPerTrip.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">ريال/رحلة</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Comparison */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                مقارنة شهرية
              </CardTitle>
              <div className="flex items-center gap-2">
                {stats.earningsGrowth >= 0 ? (
                  <div className="flex items-center gap-1 text-success text-sm">
                    <TrendingUp className="h-4 w-4" />
                    <span>+{stats.earningsGrowth}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-destructive text-sm">
                    <TrendingDown className="h-4 w-4" />
                    <span>{stats.earningsGrowth}%</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground">مقارنة بالشهر السابق</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                <p className="text-sm text-muted-foreground">هذا الشهر</p>
                <p className="text-2xl font-bold text-success">
                  {stats.thisMonthEarnings.toLocaleString()} ريال
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">الشهر السابق</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.lastMonthEarnings.toLocaleString()} ريال
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Chart */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                الأرباح الشهرية
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
                      name="الأرباح"
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

          {/* Bid Status Distribution */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                توزيع حالة العروض
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: 'مقبولة', value: bids?.filter(b => b.status === 'accepted').length || 0 },
                        { name: 'مرفوضة', value: bids?.filter(b => b.status === 'rejected').length || 0 },
                        { name: 'قيد المراجعة', value: bids?.filter(b => b.status === 'pending').length || 0 },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'مقبولة', value: bids?.filter(b => b.status === 'accepted').length || 0 },
                        { name: 'مرفوضة', value: bids?.filter(b => b.status === 'rejected').length || 0 },
                        { name: 'قيد المراجعة', value: bids?.filter(b => b.status === 'pending').length || 0 },
                      ].filter(d => d.value > 0).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--warning))'][index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Equipment Type Distribution */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                توزيع أنواع المعدات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {equipmentData.length > 0 ? (
                <div className="space-y-4">
                  {equipmentData.map((item, index) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.value} رحلة • {item.earnings.toLocaleString()} ريال
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(item.value / Math.max(...equipmentData.map(d => d.value))) * 100}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  لا توجد بيانات كافية
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Details Table */}
        <Card>
          <CardHeader className="border-b border-border bg-muted/30">
            <CardTitle className="text-lg">تفاصيل الأشهر</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">الشهر</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">العروض</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">مقبولة</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">مرفوضة</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">الرحلات</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">الأرباح</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((month, index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-foreground">{month.fullMonth}</td>
                      <td className="p-4 text-center text-sm text-muted-foreground">{month.bids}</td>
                      <td className="p-4 text-center">
                        <span className="text-sm text-success font-medium">{month.accepted}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm text-destructive font-medium">{month.rejected}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm text-primary font-bold">{month.trips}</span>
                      </td>
                      <td className="p-4 text-left">
                        <span className="text-sm text-success font-bold">{month.earnings.toLocaleString()} ريال</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
