import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { ShipmentWithBids, Bid, ShipmentStatus, BidStatus, Profile } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ShipmentMap from '@/components/maps/ShipmentMap';
import RealtimeDriverTracker from '@/components/maps/RealtimeDriverTracker';
import { RouteInfoCard } from '@/components/shipments/RouteInfoCard';
import { ShipmentChat } from '@/components/chat/ShipmentChat';
import { DriverRating, RatingDisplay } from '@/components/ratings/DriverRating';
import { useAuth } from '@/hooks/useAuth';
import { 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Weight, 
  FileText,
  User,
  Phone,
  Check,
  X,
  Loader2,
  Truck,
  MessageCircle
} from 'lucide-react';

export default function ShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shipment, setShipment] = useState<(ShipmentWithBids & { driver_confirmed_delivery?: boolean; factory_confirmed_delivery?: boolean }) | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingBid, setProcessingBid] = useState<string | null>(null);
  const [hasRated, setHasRated] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  useEffect(() => {
    if (id) {
      fetchShipmentDetails();
    }
  }, [id]);

  const fetchShipmentDetails = async () => {
    try {
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (shipmentError) throw shipmentError;

      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('shipment_id', id)
        .order('created_at', { ascending: false });

      if (bidsError) throw bidsError;

      // Fetch driver profiles for each bid
      const bidsWithProfiles: Bid[] = [];
      for (const bid of bidsData || []) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', bid.driver_id)
          .single();

        bidsWithProfiles.push({
          ...bid,
          status: bid.status as BidStatus,
          driver_profile: profileData as Profile | undefined
        });
      }

      // Check if already rated
      if (shipmentData.status === 'completed' && shipmentData.accepted_bid_id) {
        const acceptedBid = bidsWithProfiles.find(b => b.id === shipmentData.accepted_bid_id);
        if (acceptedBid) {
          const { data: ratingData } = await supabase
            .from('ratings')
            .select('id')
            .eq('shipment_id', id)
            .single();
          setHasRated(!!ratingData);
        }
      }

      setShipment({
        ...shipmentData,
        status: shipmentData.status as ShipmentStatus,
        bids: bidsWithProfiles
      });
      setBids(bidsWithProfiles);
    } catch (error) {
      console.error('Error fetching shipment:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    setProcessingBid(bidId);
    try {
      // Update bid status to accepted
      await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bidId);

      // Reject all other bids
      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('shipment_id', id)
        .neq('id', bidId);

      // Update shipment status
      await supabase
        .from('shipments')
        .update({ 
          status: 'bid_accepted',
          accepted_bid_id: bidId 
        })
        .eq('id', id);

      toast.success('تم قبول العرض بنجاح');
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error accepting bid:', error);
      toast.error('حدث خطأ أثناء قبول العرض');
    } finally {
      setProcessingBid(null);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    setProcessingBid(bidId);
    try {
      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('id', bidId);

      toast.success('تم رفض العرض');
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error rejecting bid:', error);
      toast.error('حدث خطأ أثناء رفض العرض');
    } finally {
      setProcessingBid(null);
    }
  };

  const handleUpdateStatus = async (newStatus: ShipmentStatus) => {
    try {
      await supabase
        .from('shipments')
        .update({ status: newStatus })
        .eq('id', id);

      toast.success('تم تحديث حالة الشحنة');
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleFactoryConfirmDelivery = async () => {
    setConfirmingDelivery(true);
    try {
      const updates: any = { 
        factory_confirmed_delivery: true,
        factory_confirmed_at: new Date().toISOString()
      };
      
      // If driver already confirmed, complete the shipment
      if (shipment?.driver_confirmed_delivery) {
        updates.status = 'completed';
      }

      await supabase
        .from('shipments')
        .update(updates)
        .eq('id', id);

      if (shipment?.driver_confirmed_delivery) {
        toast.success('تم تأكيد التسليم من الطرفين! 🎉');
      } else {
        toast.success('تم تأكيد التسليم من طرفك، في انتظار تأكيد السائق');
      }
      fetchShipmentDetails();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('حدث خطأ أثناء تأكيد التسليم');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!shipment) return;
    
    const confirmCancel = window.confirm('هل أنت متأكد من إلغاء هذه الشحنة؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!confirmCancel) return;

    try {
      // Reject all pending bids
      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('shipment_id', id)
        .eq('status', 'pending');

      // Update shipment status to cancelled
      await supabase
        .from('shipments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      toast.success('تم إلغاء الشحنة');
      navigate('/shipments');
    } catch (error) {
      console.error('Error cancelling shipment:', error);
      toast.error('حدث خطأ أثناء إلغاء الشحنة');
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
              <h1 className="text-3xl font-bold text-foreground">{shipment.equipment_type}</h1>
              <StatusBadge status={shipment.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              تم الإنشاء في {format(new Date(shipment.created_at), 'PPP', { locale: ar })}
            </p>
          </div>
          {/* Cancel Button for non-completed shipments */}
          {['open', 'pending_bids'].includes(shipment.status) && (
            <Button variant="destructive" size="sm" onClick={handleCancelShipment}>
              <X className="h-4 w-4 ml-2" />
              إلغاء الشحنة
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shipment Details */}
          <div className="lg:col-span-2 space-y-6">
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

              {/* Route Info - Distance & Duration */}
              <RouteInfoCard
                pickupLat={shipment.pickup_lat}
                pickupLng={shipment.pickup_lng}
                deliveryLat={shipment.delivery_lat}
                deliveryLng={shipment.delivery_lng}
                className="mt-6"
              />

              {/* Map Section */}
              <ShipmentMap
                pickupLat={shipment.pickup_lat}
                pickupLng={shipment.pickup_lng}
                deliveryLat={shipment.delivery_lat}
                deliveryLng={shipment.delivery_lng}
                pickupLocation={shipment.pickup_location}
                deliveryLocation={shipment.delivery_location}
              />
            </div>

            {/* Status Actions */}
            {shipment.status === 'bid_accepted' && (
              <div className="bg-card rounded-xl p-6 border border-border">
                <h2 className="text-xl font-bold mb-4">تحديث الحالة</h2>
                <div className="flex gap-4">
                  <Button onClick={() => handleUpdateStatus('in_transit')}>
                    بدء النقل
                  </Button>
                </div>
              </div>
            )}

            {shipment.status === 'in_transit' && (
              <>
                {/* Delivery Confirmation Section */}
                <div className="bg-card rounded-xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4">تأكيد التسليم</h2>
                  
                  {/* Confirmation Status */}
                  <div className="flex items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className={`flex items-center gap-2 ${shipment.driver_confirmed_delivery ? 'text-success' : 'text-muted-foreground'}`}>
                      {shipment.driver_confirmed_delivery ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Loader2 className="h-5 w-5" />
                      )}
                      <span className="text-sm">تأكيد السائق</span>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className={`flex items-center gap-2 ${shipment.factory_confirmed_delivery ? 'text-success' : 'text-muted-foreground'}`}>
                      {shipment.factory_confirmed_delivery ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Loader2 className="h-5 w-5" />
                      )}
                      <span className="text-sm">تأكيد المنشأة</span>
                    </div>
                  </div>

                  {!shipment.factory_confirmed_delivery ? (
                    <>
                      <p className="text-muted-foreground mb-4">
                        عند استلام الشحنة، اضغط على الزر لتأكيد التسليم. سيتم إكمال الشحنة عند تأكيد الطرفين.
                      </p>
                      <Button 
                        onClick={handleFactoryConfirmDelivery} 
                        className="w-full bg-success hover:bg-success/90"
                        disabled={confirmingDelivery}
                      >
                        {confirmingDelivery && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        <Check className="h-4 w-4 ml-2" />
                        تأكيد استلام الشحنة
                      </Button>
                    </>
                  ) : (
                    <div className="bg-success/10 p-4 rounded-lg border border-success/20">
                      <div className="flex items-center gap-2 text-success">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">
                          {shipment.driver_confirmed_delivery 
                            ? 'تم تأكيد التسليم من الطرفين' 
                            : 'تم تأكيد التسليم من طرفك، في انتظار تأكيد السائق'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Real-time Driver Tracking */}
                {shipment.accepted_bid_id && bids.find(b => b.id === shipment.accepted_bid_id) && (
                  <RealtimeDriverTracker
                    driverId={bids.find(b => b.id === shipment.accepted_bid_id)!.driver_id}
                    pickupLat={shipment.pickup_lat}
                    pickupLng={shipment.pickup_lng}
                    deliveryLat={shipment.delivery_lat}
                    deliveryLng={shipment.delivery_lng}
                    pickupLocation={shipment.pickup_location}
                    deliveryLocation={shipment.delivery_location}
                    showRoute={true}
                    height="h-96"
                  />
                )}
              </>
            )}

            {/* Rating Section for Completed Shipments */}
            {shipment.status === 'completed' && shipment.accepted_bid_id && !hasRated && (
              (() => {
                const acceptedBid = bids.find(b => b.id === shipment.accepted_bid_id);
                if (!acceptedBid || user?.id !== shipment.factory_id) return null;
                return (
                  <DriverRating
                    shipmentId={shipment.id}
                    driverId={acceptedBid.driver_id}
                    factoryId={shipment.factory_id}
                    onSuccess={() => setHasRated(true)}
                  />
                );
              })()
            )}

            {/* Chat Section for Accepted/In-Transit Shipments */}
            {(shipment.status === 'bid_accepted' || shipment.status === 'in_transit') && 
             shipment.accepted_bid_id && (
              (() => {
                const acceptedBid = bids.find(b => b.id === shipment.accepted_bid_id);
                if (!acceptedBid) return null;
                return (
                  <div className="space-y-4">
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => setShowChat(!showChat)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {showChat ? 'إخفاء المحادثة' : 'فتح المحادثة مع السائق'}
                    </Button>
                    {showChat && (
                      <ShipmentChat
                        shipmentId={shipment.id}
                        driverId={acceptedBid.driver_id}
                        factoryId={shipment.factory_id}
                      />
                    )}
                  </div>
                );
              })()
            )}
          </div>

          {/* Bids Section */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold mb-4">العروض ({bids.length})</h2>
              
              {bids.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد عروض بعد</p>
              ) : (
                <div className="space-y-4">
                  {bids.map((bid) => (
                    <div 
                      key={bid.id}
                      className="p-4 rounded-lg border border-border bg-background"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{bid.driver_profile?.full_name || 'سائق'}</p>
                            <p className="text-xs text-muted-foreground">{bid.driver_profile?.company_name}</p>
                            <RatingDisplay driverId={bid.driver_id} />
                          </div>
                        </div>
                        <StatusBadge status={bid.status} />
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">السعر</span>
                          <span className="text-xl font-bold text-primary">{bid.price} ر.س</span>
                        </div>
                        {bid.driver_profile?.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{bid.driver_profile.phone}</span>
                          </div>
                        )}
                        {bid.notes && (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            {bid.notes}
                          </p>
                        )}
                      </div>

                      {bid.status === 'pending' && (shipment.status === 'open' || shipment.status === 'pending_bids') && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 gap-1"
                            onClick={() => handleAcceptBid(bid.id)}
                            disabled={processingBid === bid.id}
                          >
                            {processingBid === bid.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            قبول
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 gap-1"
                            onClick={() => handleRejectBid(bid.id)}
                            disabled={processingBid === bid.id}
                          >
                            <X className="h-4 w-4" />
                            رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
