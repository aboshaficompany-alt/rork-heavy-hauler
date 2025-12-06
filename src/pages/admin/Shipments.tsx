import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/ui/stats-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { Shipment, ShipmentStatus, Profile } from '@/types/database';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  DollarSign,
  MapPin,
  Calendar,
  Eye,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ShipmentWithDetails extends Shipment {
  factory_profile?: Profile;
  bids_count?: number;
  total_bids_value?: number;
}

export default function AdminShipments() {
  const [shipments, setShipments] = useState<ShipmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const { data: shipmentsData, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles and bids for each shipment
      const enrichedShipments = await Promise.all(
        (shipmentsData || []).map(async (shipment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', shipment.factory_id)
            .maybeSingle();

          const { data: bids } = await supabase
            .from('bids')
            .select('price')
            .eq('shipment_id', shipment.id);

          return {
            ...shipment,
            factory_profile: profile || undefined,
            bids_count: bids?.length || 0,
            total_bids_value: bids?.reduce((sum, b) => sum + Number(b.price), 0) || 0
          };
        })
      );

      setShipments(enrichedShipments);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: shipments.length,
    open: shipments.filter(s => s.status === 'open' || s.status === 'pending_bids').length,
    inTransit: shipments.filter(s => s.status === 'in_transit').length,
    completed: shipments.filter(s => s.status === 'completed').length,
    cancelled: shipments.filter(s => s.status === 'cancelled').length,
    totalBids: shipments.reduce((sum, s) => sum + (s.bids_count || 0), 0),
    avgBidsValue: shipments.length > 0 
      ? Math.round(shipments.reduce((sum, s) => sum + (s.total_bids_value || 0), 0) / Math.max(1, shipments.reduce((sum, s) => sum + (s.bids_count || 0), 0)))
      : 0
  };

  const filteredShipments = shipments.filter(s => {
    const matchesSearch = 
      s.equipment_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.pickup_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.delivery_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.factory_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.factory_profile?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">إدارة الشحنات</h1>
            <p className="text-muted-foreground mt-1">عرض وإدارة جميع الشحنات في المنصة</p>
          </div>
        </div>

        {/* Advanced Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatsCard title="إجمالي الشحنات" value={stats.total} icon={<Package className="h-5 w-5" />} />
          <StatsCard title="مفتوحة" value={stats.open} icon={<Clock className="h-5 w-5" />} />
          <StatsCard title="قيد النقل" value={stats.inTransit} icon={<Truck className="h-5 w-5" />} />
          <StatsCard title="مكتملة" value={stats.completed} icon={<CheckCircle className="h-5 w-5" />} />
          <StatsCard title="ملغية" value={stats.cancelled} icon={<XCircle className="h-5 w-5" />} />
          <StatsCard title="إجمالي العروض" value={stats.totalBids} icon={<TrendingUp className="h-5 w-5" />} />
          <StatsCard title="متوسط السعر" value={`${stats.avgBidsValue.toLocaleString()} ر.س`} icon={<DollarSign className="h-5 w-5" />} />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالمعدة، الموقع، أو اسم المصنع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {(['all', 'open', 'pending_bids', 'bid_accepted', 'in_transit', 'completed', 'cancelled'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="whitespace-nowrap"
              >
                {status === 'all' ? 'الكل' :
                 status === 'open' ? 'مفتوحة' :
                 status === 'pending_bids' ? 'في انتظار العروض' :
                 status === 'bid_accepted' ? 'تم القبول' :
                 status === 'in_transit' ? 'قيد النقل' :
                 status === 'completed' ? 'مكتملة' : 'ملغية'}
              </Button>
            ))}
          </div>
        </div>

        {/* Shipments Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-4 font-medium">المعدة</th>
                  <th className="text-right p-4 font-medium">المصنع</th>
                  <th className="text-right p-4 font-medium">من</th>
                  <th className="text-right p-4 font-medium">إلى</th>
                  <th className="text-right p-4 font-medium">التاريخ</th>
                  <th className="text-right p-4 font-medium">العروض</th>
                  <th className="text-right p-4 font-medium">الحالة</th>
                  <th className="text-right p-4 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      لا توجد شحنات مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map(shipment => (
                    <tr key={shipment.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{shipment.equipment_type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{shipment.weight} طن</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{shipment.factory_profile?.company_name || '-'}</p>
                        <p className="text-sm text-muted-foreground">{shipment.factory_profile?.full_name}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-success" />
                          <span className="text-sm">{shipment.pickup_location}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-destructive" />
                          <span className="text-sm">{shipment.delivery_location}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{format(new Date(shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm">
                          {shipment.bids_count} عرض
                        </span>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td className="p-4">
                        <Link to={`/shipments/${shipment.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 ml-1" />
                            عرض
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
