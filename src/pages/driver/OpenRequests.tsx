import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ShipmentFiltersSheet, ShipmentFilters, defaultFilters } from '@/components/shipments/ShipmentFilters';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useActiveShipmentCheck } from '@/hooks/useActiveShipmentCheck';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Package, 
  MapPin, 
  Calendar, 
  Weight,
  Truck,
  Search,
  Send,
  Bell,
  BellOff,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function OpenRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<ShipmentFilters>(defaultFilters);
  const { permission, requestPermission, isSupported } = usePushNotifications();
  const { hasActiveShipment, activeShipment } = useActiveShipmentCheck();

  // Fetch open shipments
  const { data: shipments, isLoading } = useQuery({
    queryKey: ['open-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .in('status', ['open', 'pending_bids'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch user's existing bids
  const { data: userBids } = useQuery({
    queryKey: ['user-bids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bids')
        .select('shipment_id')
        .eq('driver_id', user.id);

      if (error) throw error;
      return data.map(b => b.shipment_id);
    },
    enabled: !!user?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('open-shipments-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['open-shipments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Submit bid mutation
  const submitBidMutation = useMutation({
    mutationFn: async ({ shipmentId, price, notes }: { shipmentId: string; price: number; notes: string }) => {
      const { error } = await supabase.from('bids').insert({
        shipment_id: shipmentId,
        driver_id: user?.id,
        price,
        notes,
        status: 'pending',
      });

      if (error) throw error;

      // Update shipment status to pending_bids if it's open
      await supabase
        .from('shipments')
        .update({ status: 'pending_bids' })
        .eq('id', shipmentId)
        .eq('status', 'open');
    },
    onSuccess: () => {
      toast({
        title: 'تم إرسال العرض',
        description: 'تم إرسال عرض السعر بنجاح',
      });
      queryClient.invalidateQueries({ queryKey: ['open-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['user-bids'] });
      setDialogOpen(false);
      setBidPrice('');
      setBidNotes('');
      setSelectedShipment(null);
    },
    onError: (error) => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إرسال العرض',
        variant: 'destructive',
      });
      console.error('Bid error:', error);
    },
  });

  const handleSubmitBid = () => {
    if (!selectedShipment || !bidPrice) return;
    submitBidMutation.mutate({
      shipmentId: selectedShipment,
      price: parseFloat(bidPrice),
      notes: bidNotes,
    });
  };

  const filteredShipments = shipments?.filter(shipment => {
    // Text search
    const matchesSearch = 
      shipment.pickup_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.equipment_type.toLowerCase().includes(searchTerm.toLowerCase());

    // Equipment type filter
    const matchesEquipment = filters.equipmentType === 'all' || 
      shipment.equipment_type.toLowerCase().includes(filters.equipmentType.toLowerCase());

    // Weight filter
    const matchesWeight = shipment.weight >= filters.minWeight && shipment.weight <= filters.maxWeight;

    // Pickup location filter
    const matchesLocation = !filters.pickupLocation || 
      shipment.pickup_location.toLowerCase().includes(filters.pickupLocation.toLowerCase());

    return matchesSearch && matchesEquipment && matchesWeight && matchesLocation;
  });

  const hasExistingBid = (shipmentId: string) => userBids?.includes(shipmentId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">الطلبات المفتوحة</h1>
          <p className="text-muted-foreground">تصفح طلبات الشحن المتاحة وقدم عروضك</p>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالموقع أو نوع المعدات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <ShipmentFiltersSheet filters={filters} onFiltersChange={setFilters} />
          {isSupported && (
            <Button
              variant={permission === 'granted' ? 'secondary' : 'outline'}
              size="icon"
              onClick={requestPermission}
              title={permission === 'granted' ? 'الإشعارات مفعلة' : 'تفعيل الإشعارات'}
            >
              {permission === 'granted' ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Active Shipment Warning */}
        {hasActiveShipment && activeShipment && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-warning">لديك شحنة نشطة</p>
                  <p className="text-sm text-muted-foreground">
                    لا يمكنك تقديم عروض جديدة حتى إكمال الشحنة الحالية: {activeShipment.equipment_type}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate(`/driver/shipment/${activeShipment.id}`)}
                >
                  عرض الشحنة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-64" />
              </Card>
            ))}
          </div>
        ) : filteredShipments?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد طلبات شحن متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredShipments?.map((shipment) => (
              <Card key={shipment.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      {shipment.equipment_type}
                    </CardTitle>
                    <StatusBadge status={shipment.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground">من: </span>
                        {shipment.pickup_location}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground">إلى: </span>
                        {shipment.delivery_location}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Weight className="h-4 w-4" />
                      {shipment.weight} طن
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}
                    </div>
                  </div>

                  {shipment.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {shipment.notes}
                    </p>
                  )}

                  <Dialog open={dialogOpen && selectedShipment === shipment.id} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setSelectedShipment(null);
                      setBidPrice('');
                      setBidNotes('');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full"
                        disabled={hasExistingBid(shipment.id) || hasActiveShipment}
                        onClick={() => setSelectedShipment(shipment.id)}
                      >
                        {hasActiveShipment ? (
                          <>
                            <AlertTriangle className="h-4 w-4 ml-2" />
                            لديك شحنة نشطة
                          </>
                        ) : hasExistingBid(shipment.id) ? (
                          'تم تقديم عرض'
                        ) : (
                          <>
                            <Send className="h-4 w-4 ml-2" />
                            تقديم عرض سعر
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>تقديم عرض سعر</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        {/* عرض تفاصيل الطلب */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Truck className="h-4 w-4 text-primary" />
                            <span>{shipment.equipment_type}</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
                            <div>
                              <span className="text-muted-foreground">من: </span>
                              {shipment.pickup_location}
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <span className="text-muted-foreground">إلى: </span>
                              {shipment.delivery_location}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
                            <div className="flex items-center gap-1">
                              <Weight className="h-4 w-4" />
                              {shipment.weight} طن
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(shipment.pickup_date), 'dd MMM yyyy', { locale: ar })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">السعر (ريال)</label>
                          <Input
                            type="number"
                            placeholder="أدخل السعر المقترح"
                            value={bidPrice}
                            onChange={(e) => setBidPrice(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                          <Textarea
                            placeholder="أي ملاحظات إضافية..."
                            value={bidNotes}
                            onChange={(e) => setBidNotes(e.target.value)}
                          />
                        </div>
                        <Button 
                          className="w-full"
                          onClick={handleSubmitBid}
                          disabled={!bidPrice || submitBidMutation.isPending}
                        >
                          {submitBidMutation.isPending ? 'جاري الإرسال...' : 'إرسال العرض'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
