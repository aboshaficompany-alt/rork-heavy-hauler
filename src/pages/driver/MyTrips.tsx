import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { 
  Package, 
  MapPin, 
  Calendar, 
  Weight,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

type BidWithShipment = {
  id: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  notes: string | null;
  created_at: string;
  shipment: {
    id: string;
    pickup_location: string;
    delivery_location: string;
    equipment_type: string;
    weight: number;
    pickup_date: string;
    status: string;
    notes: string | null;
  };
};

export default function MyTrips() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');

  // Fetch driver's bids with shipment details
  const { data: bids, isLoading } = useQuery({
    queryKey: ['my-trips', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          price,
          status,
          notes,
          created_at,
          shipment:shipments(
            id,
            pickup_location,
            delivery_location,
            equipment_type,
            weight,
            pickup_date,
            status,
            notes
          )
        `)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as BidWithShipment[];
    },
    enabled: !!user?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('my-trips-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `driver_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-trips'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-trips'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const filteredBids = bids?.filter(bid => {
    switch (activeTab) {
      case 'pending':
        return bid.status === 'pending';
      case 'accepted':
        return bid.status === 'accepted';
      case 'rejected':
        return bid.status === 'rejected';
      default:
        return true;
    }
  });

  const stats = {
    total: bids?.length || 0,
    pending: bids?.filter(b => b.status === 'pending').length || 0,
    accepted: bids?.filter(b => b.status === 'accepted').length || 0,
    rejected: bids?.filter(b => b.status === 'rejected').length || 0,
  };

  const getBidStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-warning" />;
      case 'accepted':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getBidStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'accepted':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      default:
        return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">رحلاتي</h1>
          <p className="text-muted-foreground">متابعة عروضك ورحلاتك</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العروض</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Package className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">قيد المراجعة</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-warning opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مقبولة</p>
                  <p className="text-2xl font-bold">{stats.accepted}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مرفوضة</p>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">قيد المراجعة ({stats.pending})</TabsTrigger>
            <TabsTrigger value="accepted">مقبولة ({stats.accepted})</TabsTrigger>
            <TabsTrigger value="rejected">مرفوضة ({stats.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-48" />
                  </Card>
                ))}
              </div>
            ) : filteredBids?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'لم تقدم أي عروض بعد'
                      : `لا توجد عروض ${getBidStatusText(activeTab)}`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredBids?.map((bid) => (
                  <Card key={bid.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Truck className="h-5 w-5 text-primary" />
                          {bid.shipment.equipment_type}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getBidStatusIcon(bid.status)}
                          <span className="text-sm font-medium">
                            {getBidStatusText(bid.status)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">من: </span>
                            {bid.shipment.pickup_location}
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">إلى: </span>
                            {bid.shipment.delivery_location}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Weight className="h-4 w-4" />
                          {bid.shipment.weight} طن
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(bid.shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span className="font-bold text-lg">{bid.price.toLocaleString()}</span>
                          <span className="text-sm text-muted-foreground">ريال</span>
                        </div>
                        <StatusBadge status={bid.shipment.status as 'open' | 'pending_bids' | 'bid_accepted' | 'in_transit' | 'completed' | 'cancelled'} />
                      </div>

                      {bid.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {bid.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
