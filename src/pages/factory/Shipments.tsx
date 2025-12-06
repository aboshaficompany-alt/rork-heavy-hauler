import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { ShipmentWithBids, ShipmentStatus } from '@/types/database';
import { Plus, Package, MapPin, Calendar, Weight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function Shipments() {
  const [shipments, setShipments] = useState<ShipmentWithBids[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ShipmentStatus | 'all'>('all');

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          bids(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shipmentsWithCount = (data || []).map(shipment => ({
        ...shipment,
        status: shipment.status as ShipmentStatus,
        bids: [],
        bids_count: (shipment as any).bids?.[0]?.count || 0
      }));

      setShipments(shipmentsWithCount);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = filter === 'all' 
    ? shipments 
    : shipments.filter(s => s.status === filter);

  const statusFilters: { value: ShipmentStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'open', label: 'مفتوح' },
    { value: 'pending_bids', label: 'في انتظار العروض' },
    { value: 'bid_accepted', label: 'تم قبول العرض' },
    { value: 'in_transit', label: 'قيد النقل' },
    { value: 'completed', label: 'مكتمل' },
  ];

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الشحنات</h1>
            <p className="text-muted-foreground mt-1">إدارة جميع طلبات الشحن الخاصة بك</p>
          </div>
          <Link to="/shipments/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              شحنة جديدة
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <Button
              key={status.value}
              variant={filter === status.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status.value)}
            >
              {status.label}
            </Button>
          ))}
        </div>

        {/* Shipments Grid */}
        {filteredShipments.length === 0 ? (
          <div className="bg-card rounded-xl p-12 border border-border text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">لا توجد شحنات</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإنشاء شحنة جديدة</p>
            <Link to="/shipments/new">
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إنشاء شحنة
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShipments.map((shipment) => (
              <Link
                key={shipment.id}
                to={`/shipments/${shipment.id}`}
                className="bg-card rounded-xl p-5 border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{shipment.equipment_type}</h3>
                      <p className="text-xs text-muted-foreground">
                        {shipment.bids_count} عروض
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={shipment.status} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-success" />
                    <span className="truncate">{shipment.pickup_location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-destructive" />
                    <span className="truncate">{shipment.delivery_location}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Weight className="h-4 w-4" />
                      <span>{shipment.weight} طن</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
