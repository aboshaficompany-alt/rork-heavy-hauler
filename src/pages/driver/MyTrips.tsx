import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { 
  Package, 
  MapPin, 
  Calendar, 
  Weight,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Eye,
  Navigation,
  ArrowLeft
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
      
      // First get the bids
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('id, price, status, notes, created_at, shipment_id')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (bidsError) {
        console.error('Error fetching bids:', bidsError);
        throw bidsError;
      }

      if (!bidsData || bidsData.length === 0) return [];

      // Get unique shipment IDs
      const shipmentIds = [...new Set(bidsData.map(b => b.shipment_id))];
      
      // Fetch shipments separately
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('id, pickup_location, delivery_location, equipment_type, weight, pickup_date, status, notes')
        .in('id', shipmentIds);

      if (shipmentsError) {
        console.error('Error fetching shipments:', shipmentsError);
      }

      // Map shipments to bids
      const shipmentsMap = new Map(shipmentsData?.map(s => [s.id, s]) || []);
      
      return bidsData.map(bid => ({
        ...bid,
        shipment: shipmentsMap.get(bid.shipment_id) || {
          id: bid.shipment_id,
          pickup_location: 'غير متوفر',
          delivery_location: 'غير متوفر',
          equipment_type: 'غير محدد',
          weight: 0,
          pickup_date: new Date().toISOString(),
          status: 'open',
          notes: null
        }
      })) as unknown as BidWithShipment[];
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
      case 'active':
        return bid.status === 'accepted' && ['bid_accepted', 'in_transit'].includes(bid.shipment.status);
      default:
        return true;
    }
  });

  // Calculate earnings from completed trips
  const completedTrips = bids?.filter(b => 
    b.status === 'accepted' && b.shipment.status === 'completed'
  ) || [];
  
  const totalEarnings = completedTrips.reduce((sum, bid) => sum + bid.price, 0);

  const stats = {
    total: bids?.length || 0,
    pending: bids?.filter(b => b.status === 'pending').length || 0,
    accepted: bids?.filter(b => b.status === 'accepted').length || 0,
    rejected: bids?.filter(b => b.status === 'rejected').length || 0,
    active: bids?.filter(b => b.status === 'accepted' && ['bid_accepted', 'in_transit'].includes(b.shipment.status)).length || 0,
    completed: completedTrips.length,
    earnings: totalEarnings,
  };

  const getBidStatusConfig = (status: string, shipmentStatus?: string) => {
    if (status === 'accepted' && shipmentStatus === 'in_transit') {
      return {
        icon: <Navigation className="h-5 w-5" />,
        text: 'في الطريق',
        bgColor: 'bg-primary/10',
        textColor: 'text-primary',
        borderColor: 'border-primary/20'
      };
    }
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5" />,
          text: 'قيد المراجعة',
          bgColor: 'bg-warning/10',
          textColor: 'text-warning',
          borderColor: 'border-warning/20'
        };
      case 'accepted':
        return {
          icon: <CheckCircle2 className="h-5 w-5" />,
          text: 'مقبول',
          bgColor: 'bg-success/10',
          textColor: 'text-success',
          borderColor: 'border-success/20'
        };
      case 'rejected':
        return {
          icon: <XCircle className="h-5 w-5" />,
          text: 'مرفوض',
          bgColor: 'bg-destructive/10',
          textColor: 'text-destructive',
          borderColor: 'border-destructive/20'
        };
      default:
        return {
          icon: null,
          text: status,
          bgColor: 'bg-muted',
          textColor: 'text-muted-foreground',
          borderColor: 'border-border'
        };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-l from-primary/5 to-transparent rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-foreground">رحلاتي</h1>
          <p className="text-muted-foreground mt-1">متابعة عروضك ورحلاتك النشطة</p>
        </div>

        {/* Earnings Card */}
        <Card className="bg-gradient-to-br from-success/20 via-success/10 to-transparent border-success/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الأرباح</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-bold text-success">{stats.earnings.toLocaleString()}</span>
                  <span className="text-lg text-success/70">ريال</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  من {stats.completed} رحلة مكتملة
                </p>
              </div>
              <div className="p-4 rounded-full bg-success/20">
                <DollarSign className="h-10 w-10 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">الإجمالي</p>
                  <p className="text-2xl font-bold text-primary">{stats.total}</p>
                </div>
                <Package className="h-8 w-8 text-primary/40" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">نشطة</p>
                  <p className="text-2xl font-bold text-success">{stats.active}</p>
                </div>
                <Navigation className="h-8 w-8 text-success/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">قيد المراجعة</p>
                  <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-warning/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">مقبولة</p>
                  <p className="text-2xl font-bold text-success">{stats.accepted}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">مرفوضة</p>
                  <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all" className="text-xs sm:text-sm">الكل</TabsTrigger>
            <TabsTrigger value="active" className="text-xs sm:text-sm">نشطة</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm">قيد المراجعة</TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs sm:text-sm">مقبولة</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs sm:text-sm">مرفوضة</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-40" />
                  </Card>
                ))}
              </div>
            ) : filteredBids?.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-lg">
                    {activeTab === 'all' 
                      ? 'لم تقدم أي عروض بعد'
                      : activeTab === 'active'
                      ? 'لا توجد رحلات نشطة حالياً'
                      : `لا توجد عروض ${activeTab === 'pending' ? 'قيد المراجعة' : activeTab === 'accepted' ? 'مقبولة' : 'مرفوضة'}`
                    }
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/driver">
                      <Package className="h-4 w-4 ml-2" />
                      استعرض الشحنات المتاحة
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBids?.map((bid) => {
                  const statusConfig = getBidStatusConfig(bid.status, bid.shipment.status);
                  const isActive = bid.status === 'accepted' && ['bid_accepted', 'in_transit'].includes(bid.shipment.status);
                  
                  return (
                    <Card 
                      key={bid.id} 
                      className={`overflow-hidden transition-all hover:shadow-lg ${
                        isActive ? 'border-primary/30 bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="p-0">
                        {/* Status Header */}
                        <div className={`px-4 py-3 ${statusConfig.bgColor} border-b ${statusConfig.borderColor}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={statusConfig.textColor}>
                                {statusConfig.icon}
                              </div>
                              <span className={`font-medium ${statusConfig.textColor}`}>
                                {statusConfig.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(bid.created_at), 'dd MMM', { locale: ar })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Main Content */}
                        <div className="p-4">
                          {/* Equipment Type and Price */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Truck className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-bold text-foreground">{bid.shipment.equipment_type}</h3>
                                <p className="text-sm text-muted-foreground">{bid.shipment.weight} طن</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-1 justify-end">
                                <DollarSign className="h-4 w-4 text-primary" />
                                <span className="text-xl font-bold text-primary">{bid.price.toLocaleString()}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">ريال</span>
                            </div>
                          </div>

                          {/* Locations */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-success" />
                              <span className="text-sm text-foreground truncate flex-1">{bid.shipment.pickup_location}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-destructive" />
                              <span className="text-sm text-foreground truncate flex-1">{bid.shipment.delivery_location}</span>
                            </div>
                          </div>

                          {/* Meta Info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(bid.shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}
                            </div>
                            <StatusBadge status={bid.shipment.status as any} />
                          </div>

                          {bid.notes && (
                            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-4">
                              {bid.notes}
                            </p>
                          )}

                          {/* Action Button for Accepted/Active Bids */}
                          {bid.status === 'accepted' && (
                            <Button asChild className="w-full gap-2" variant={isActive ? 'default' : 'outline'}>
                              <Link to={`/driver/shipment/${bid.shipment.id}`}>
                                {isActive ? (
                                  <>
                                    <Navigation className="h-4 w-4" />
                                    متابعة الرحلة
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4" />
                                    عرض التفاصيل
                                  </>
                                )}
                                <ArrowLeft className="h-4 w-4 mr-auto" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}