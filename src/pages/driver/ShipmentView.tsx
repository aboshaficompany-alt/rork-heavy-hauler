import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import DriverShipmentMap from '@/components/maps/DriverShipmentMap';
import { ShipmentChat } from '@/components/chat/ShipmentChat';
import { useAuth } from '@/hooks/useAuth';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAutoStatusUpdate } from '@/hooks/useAutoStatusUpdate';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Weight, 
  FileText,
  Loader2,
  Truck,
  MessageCircle,
  Navigation,
  CheckCircle,
  MapPinCheck
} from 'lucide-react';

interface ShipmentData {
  id: string;
  equipment_type: string;
  pickup_location: string;
  delivery_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_date: string;
  weight: number;
  notes: string | null;
  status: string;
  factory_id: string;
  created_at: string;
  accepted_bid_id: string | null;
}

interface BidData {
  id: string;
  price: number;
  status: string;
  driver_id: string;
}

export default function ShipmentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation } = useDriverLocation();
  const { playSuccess, playTripComplete } = useNotificationSound();
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [myBid, setMyBid] = useState<BidData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  // Auto status update based on location
  const { isNearPickup, isNearDelivery } = useAutoStatusUpdate({
    shipmentId: id || '',
    pickupLat: shipment?.pickup_lat || null,
    pickupLng: shipment?.pickup_lng || null,
    deliveryLat: shipment?.delivery_lat || null,
    deliveryLng: shipment?.delivery_lng || null,
    currentStatus: shipment?.status || '',
    driverLat: currentLocation?.lat || null,
    driverLng: currentLocation?.lng || null,
    enabled: myBid?.status === 'accepted'
  });

  useEffect(() => {
    if (id && user?.id) {
      fetchShipmentDetails();
    }
  }, [id, user?.id]);

  const fetchShipmentDetails = async () => {
    try {
      // Fetch shipment
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (shipmentError) throw shipmentError;
      setShipment(shipmentData);

      // Fetch driver's bid for this shipment
      const { data: bidData } = await supabase
        .from('bids')
        .select('*')
        .eq('shipment_id', id)
        .eq('driver_id', user?.id)
        .maybeSingle();

      setMyBid(bidData);
    } catch (error) {
      console.error('Error fetching shipment:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    try {
      await supabase
        .from('shipments')
        .update({ status: 'in_transit' })
        .eq('id', id);

      playSuccess();
      toast.success('تم بدء الرحلة بنجاح');
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error starting trip:', error);
      toast.error('حدث خطأ أثناء بدء الرحلة');
    }
  };

  const handleCompleteTrip = async () => {
    try {
      await supabase
        .from('shipments')
        .update({ status: 'completed' })
        .eq('id', id);

      playTripComplete();
      toast.success('تم تأكيد التسليم بنجاح! 🎉');
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error completing trip:', error);
      toast.error('حدث خطأ أثناء تأكيد التسليم');
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

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">الشحنة غير موجودة</p>
        </div>
      </DashboardLayout>
    );
  }

  const isAccepted = myBid?.status === 'accepted';
  const isInTransit = shipment.status === 'in_transit';
  const isCompleted = shipment.status === 'completed';
  const canTrack = isAccepted || isInTransit;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{shipment.equipment_type}</h1>
              <StatusBadge status={shipment.status as any} />
            </div>
            {myBid && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">عرضك:</span>
                <span className="font-bold text-primary">{myBid.price} ر.س</span>
                <StatusBadge status={myBid.status as any} />
              </div>
            )}
          </div>
        </div>

        {/* Map Section - Full width, prominent */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold">
                {canTrack ? 'خريطة الرحلة' : 'موقع الشحنة'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {canTrack 
                  ? 'يظهر موقعك الحالي مع مسار الاستلام والتسليم'
                  : 'مسار الاستلام والتسليم'
                }
              </p>
            </div>
          </div>
          
          <DriverShipmentMap
            pickupLat={shipment.pickup_lat}
            pickupLng={shipment.pickup_lng}
            deliveryLat={shipment.delivery_lat}
            deliveryLng={shipment.delivery_lng}
            pickupLocation={shipment.pickup_location}
            deliveryLocation={shipment.delivery_location}
            driverLat={canTrack && currentLocation ? currentLocation.lat : null}
            driverLng={canTrack && currentLocation ? currentLocation.lng : null}
            mode={canTrack ? 'active' : 'preview'}
            height="h-80"
            showRouteInfo={true}
          />
        </div>

        {/* Shipment Details */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">تفاصيل الشحنة</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <MapPin className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">موقع الاستلام</p>
                  <p className="font-medium">{shipment.pickup_location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <MapPin className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">موقع التسليم</p>
                  <p className="font-medium">{shipment.delivery_location}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">تاريخ الاستلام</p>
                  <p className="font-medium">{format(new Date(shipment.pickup_date), 'PPP', { locale: ar })}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Weight className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الوزن</p>
                  <p className="font-medium">{shipment.weight} طن</p>
                </div>
              </div>
            </div>
          </div>

          {shipment.notes && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ملاحظات</p>
                  <p className="font-medium">{shipment.notes}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons for Accepted Bids */}
        {isAccepted && shipment.status === 'bid_accepted' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">بدء الرحلة</h2>
                {isNearPickup && (
                  <div className="flex items-center gap-1 text-success text-sm">
                    <MapPinCheck className="h-4 w-4" />
                    <span>أنت قريب من موقع الاستلام!</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              عند الضغط على "بدء الرحلة" سيتم تحديث حالة الشحنة وسيتمكن العميل من تتبع موقعك.
            </p>
            <Button onClick={handleStartTrip} className="w-full gap-2">
              <Navigation className="h-4 w-4" />
              بدء الرحلة
            </Button>
          </div>
        )}

        {/* In Transit Actions */}
        {isInTransit && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">تأكيد التسليم</h2>
                {isNearDelivery && (
                  <div className="flex items-center gap-1 text-success text-sm">
                    <MapPinCheck className="h-4 w-4" />
                    <span>أنت قريب من موقع التسليم!</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              بعد تسليم الشحنة للعميل، اضغط على الزر أدناه لتأكيد إتمام الرحلة.
            </p>
            <Button onClick={handleCompleteTrip} className="w-full gap-2 bg-success hover:bg-success/90">
              <CheckCircle className="h-4 w-4" />
              تأكيد التسليم
            </Button>
          </div>
        )}

        {/* Completed Status */}
        {isCompleted && (
          <div className="bg-success/10 rounded-xl p-6 border border-success/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <h2 className="text-xl font-bold text-success">تم إكمال الرحلة</h2>
                <p className="text-muted-foreground">تم تسليم الشحنة بنجاح</p>
              </div>
            </div>
          </div>
        )}

        {/* Chat Section */}
        {canTrack && (
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-4 w-4" />
              {showChat ? 'إخفاء المحادثة' : 'فتح المحادثة مع المنشأة'}
            </Button>
            {showChat && (
              <ShipmentChat
                shipmentId={shipment.id}
                driverId={user?.id || ''}
                factoryId={shipment.factory_id}
              />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
