import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Loader2, AlertCircle, Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DriverLocation {
  driver_id: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  is_online: boolean;
  updated_at: string;
}

interface DriverLocationMapProps {
  driverId: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

export default function DriverLocationMap({
  driverId,
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng
}: DriverLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();

  // Fetch initial driver location
  useEffect(() => {
    const fetchLocation = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('driver_id', driverId)
        .single();

      if (data) {
        setDriverLocation(data as DriverLocation);
        setIsOnline(data.is_online ?? false);
      }
    };

    fetchLocation();
  }, [driverId]);

  // Subscribe to real-time location updates
  useEffect(() => {
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`
        },
        (payload) => {
          if (payload.new) {
            const newLocation = payload.new as DriverLocation;
            setDriverLocation(newLocation);
            setIsOnline(newLocation.is_online ?? false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate center based on available points
    let centerLat = 24.7;
    let centerLng = 46.7;
    
    if (pickupLat && pickupLng) {
      centerLat = pickupLat;
      centerLng = pickupLng;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Add pickup marker
    if (pickupLat && pickupLng) {
      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setHTML('<p class="font-medium">موقع الاستلام</p>'))
        .addTo(map.current);
    }

    // Add delivery marker
    if (deliveryLat && deliveryLng) {
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([deliveryLng, deliveryLat])
        .setPopup(new mapboxgl.Popup().setHTML('<p class="font-medium">موقع التسليم</p>'))
        .addTo(map.current);
    }

    return () => {
      driverMarker.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, tokenLoading, pickupLat, pickupLng, deliveryLat, deliveryLng]);

  // Update driver marker when location changes
  useEffect(() => {
    if (!map.current || !driverLocation || !isOnline) return;

    // Remove existing marker
    driverMarker.current?.remove();

    // Create driver marker element with rotation based on heading
    const el = document.createElement('div');
    const rotation = driverLocation.heading || 0;
    el.innerHTML = `
      <div class="relative" style="transform: rotate(${rotation}deg);">
        <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg border-3 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-white animate-pulse"></div>
      </div>
    `;

    driverMarker.current = new mapboxgl.Marker(el)
      .setLngLat([driverLocation.lng, driverLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div class="p-2">
          <p class="font-medium">موقع السائق</p>
          ${driverLocation.speed ? `<p class="text-xs text-gray-500">السرعة: ${Math.round(driverLocation.speed)} كم/س</p>` : ''}
        </div>
      `))
      .addTo(map.current);

    // Fly to driver location if tracking is enabled
    if (isTracking) {
      map.current.flyTo({
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 14,
        duration: 1000
      });
    }
  }, [driverLocation, isOnline, isTracking]);

  // Center on driver
  const centerOnDriver = () => {
    if (map.current && driverLocation) {
      map.current.flyTo({
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 14,
        duration: 1000
      });
    }
  };

  // Loading state
  if (tokenLoading) {
    return (
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">جاري تحميل الخريطة...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (tokenError) {
    return (
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{tokenError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">موقع السائق</h3>
        <div className="flex items-center gap-3">
          {isOnline && driverLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={centerOnDriver}
              className="gap-2"
            >
              <Navigation2 className="h-4 w-4" />
              تتبع
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-sm text-muted-foreground">
              {isOnline ? 'متصل' : 'غير متصل'}
            </span>
          </div>
        </div>
      </div>
      <div ref={mapContainer} className="h-64 rounded-lg overflow-hidden" />
      {!isOnline && (
        <p className="text-sm text-muted-foreground text-center mt-2">
          السائق غير متصل حالياً. سيظهر موقعه عند اتصاله.
        </p>
      )}
      {isOnline && driverLocation && (
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>آخر تحديث: {new Date(driverLocation.updated_at).toLocaleTimeString('ar-SA')}</span>
          {driverLocation.speed && (
            <span>السرعة: {Math.round(driverLocation.speed)} كم/س</span>
          )}
        </div>
      )}
    </div>
  );
}
