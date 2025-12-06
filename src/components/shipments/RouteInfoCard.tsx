import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useRouteCalculation } from '@/hooks/useRouteCalculation';
import { Loader2, Navigation, Clock, MapPin } from 'lucide-react';

interface RouteInfoCardProps {
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  className?: string;
}

export function RouteInfoCard({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  className = ''
}: RouteInfoCardProps) {
  const { calculateRoute, routeInfo, loading, error } = useRouteCalculation();
  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    if (pickupLat && pickupLng && deliveryLat && deliveryLng && !hasCalculated) {
      calculateRoute(pickupLat, pickupLng, deliveryLat, deliveryLng);
      setHasCalculated(true);
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, calculateRoute, hasCalculated]);

  if (!pickupLat || !pickupLng || !deliveryLat || !deliveryLng) {
    return null;
  }

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">جاري حساب المسافة...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 ${className}`}>
        <p className="text-sm text-destructive text-center">تعذر حساب المسافة</p>
      </Card>
    );
  }

  if (!routeInfo) {
    return null;
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-around">
        <div className="flex items-center gap-2 text-center">
          <div className="p-2 rounded-lg bg-primary/10">
            <Navigation className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المسافة</p>
            <p className="font-bold text-foreground">{routeInfo.distanceText}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-border" />
        
        <div className="flex items-center gap-2 text-center">
          <div className="p-2 rounded-lg bg-warning/10">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الوقت المتوقع</p>
            <p className="font-bold text-foreground">{routeInfo.durationText}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}