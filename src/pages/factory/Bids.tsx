import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bid, BidStatus, Profile, Shipment, ShipmentStatus } from '@/types/database';
import { FileText, Package, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface BidWithDetails extends Bid {
  shipment?: Shipment;
}

export default function Bids() {
  const { user } = useAuth();
  const [bids, setBids] = useState<BidWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBids();
    }
  }, [user]);

  const fetchBids = async () => {
    try {
      // Get all shipments for this factory
      const { data: shipments } = await supabase
        .from('shipments')
        .select('id')
        .eq('factory_id', user?.id);

      if (!shipments || shipments.length === 0) {
        setBids([]);
        setLoading(false);
        return;
      }

      const shipmentIds = shipments.map(s => s.id);

      // Get all bids for these shipments
      const { data: bidsData, error } = await supabase
        .from('bids')
        .select('*')
        .in('shipment_id', shipmentIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch shipment and driver details for each bid
      const bidsWithDetails: BidWithDetails[] = [];
      for (const bid of bidsData || []) {
        const { data: shipment } = await supabase
          .from('shipments')
          .select('*')
          .eq('id', bid.shipment_id)
          .single();

        const { data: driverProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', bid.driver_id)
          .single();

        bidsWithDetails.push({
          ...bid,
          status: bid.status as BidStatus,
          shipment: shipment ? { ...shipment, status: shipment.status as ShipmentStatus } : undefined,
          driver_profile: driverProfile as Profile | undefined
        });
      }

      setBids(bidsWithDetails);
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
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

  const pendingBids = bids.filter(b => b.status === 'pending');
  const processedBids = bids.filter(b => b.status !== 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">العروض</h1>
          <p className="text-muted-foreground mt-1">مراجعة عروض السائقين على شحناتك</p>
        </div>

        {/* Pending Bids */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning"></span>
            عروض معلقة ({pendingBids.length})
          </h2>

          {pendingBids.length === 0 ? (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد عروض معلقة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingBids.map((bid) => (
                <Link
                  key={bid.id}
                  to={`/shipments/${bid.shipment_id}`}
                  className="bg-card rounded-xl p-5 border border-border hover:border-warning/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <FileText className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <p className="font-semibold text-xl text-primary">{bid.price} ر.س</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bid.created_at), 'PPp', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={bid.status} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{bid.driver_profile?.full_name || 'سائق'}</span>
                    </div>
                    
                    {bid.shipment && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{bid.shipment.equipment_type}</span>
                      </div>
                    )}

                    {bid.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{bid.notes}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Processed Bids */}
        {processedBids.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
              عروض سابقة ({processedBids.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedBids.map((bid) => (
                <Link
                  key={bid.id}
                  to={`/shipments/${bid.shipment_id}`}
                  className="bg-card rounded-xl p-5 border border-border opacity-75 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-xl">{bid.price} ر.س</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bid.created_at), 'PPp', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={bid.status} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{bid.driver_profile?.full_name || 'سائق'}</span>
                    </div>
                    
                    {bid.shipment && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{bid.shipment.equipment_type}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
