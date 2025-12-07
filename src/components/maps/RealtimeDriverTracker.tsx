import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Loader2, AlertCircle, Navigation2, Gauge, Compass, MapPin, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DriverLocation {
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  is_online: boolean;
  updated_at: string;
}

interface RealtimeDriverTrackerProps {
  driverId: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupLocation?: string;
  deliveryLocation?: string;
  showRoute?: boolean;
  height?: string;
}

export default function RealtimeDriverTracker({
  driverId,
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  pickupLocation,
  deliveryLocation,
  showRoute = true,
  height = 'h-80'
}: RealtimeDriverTrackerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const markerElement = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousLocation = useRef<{ lat: number; lng: number } | null>(null);
  
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();

  // Create driver marker element
  const createDriverMarkerElement = useCallback((heading: number = 0) => {
    const el = document.createElement('div');
    el.className = 'driver-marker-container';
    el.innerHTML = `
      <style>
        .driver-marker-container {
          position: relative;
          cursor: pointer;
        }
        .driver-marker {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.5);
          border: 4px solid white;
          transition: transform 0.3s ease;
        }
        .driver-marker-arrow {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 12px solid #2563EB;
        }
        .driver-marker-pulse {
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.3);
          animation: pulse 2s ease-out infinite;
        }
        .driver-status-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 16px;
          height: 16px;
          background: #10B981;
          border-radius: 50%;
          border: 3px solid white;
          animation: statusPulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
      <div class="driver-marker-pulse"></div>
      <div class="driver-marker" style="transform: rotate(${heading}deg);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
      <div class="driver-status-dot"></div>
    `;
    return el;
  }, []);

  // Smooth animation for marker movement
  const animateMarker = useCallback((
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    duration: number = 1000
  ) => {
    if (!driverMarker.current) return;

    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentLat = startLat + (endLat - startLat) * eased;
      const currentLng = startLng + (endLng - startLng) * eased;
      
      driverMarker.current?.setLngLat([currentLng, currentLat]);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  }, []);

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
        setLastUpdate(new Date(data.updated_at));
        previousLocation.current = { lat: data.lat, lng: data.lng };
      }
    };

    fetchLocation();
  }, [driverId]);

  // Subscribe to real-time location updates
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-driver-${driverId}`)
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
            
            // Animate from previous position to new position
            if (previousLocation.current && driverMarker.current) {
              animateMarker(
                previousLocation.current.lat,
                previousLocation.current.lng,
                newLocation.lat,
                newLocation.lng,
                800 // Animation duration
              );
            }
            
            setDriverLocation(newLocation);
            setIsOnline(newLocation.is_online ?? false);
            setLastUpdate(new Date(newLocation.updated_at));
            
            // Update rotation based on heading
            if (markerElement.current && newLocation.heading !== null) {
              const markerDiv = markerElement.current.querySelector('.driver-marker') as HTMLElement;
              if (markerDiv) {
                markerDiv.style.transform = `rotate(${newLocation.heading}deg)`;
              }
            }
            
            previousLocation.current = { lat: newLocation.lat, lng: newLocation.lng };
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, animateMarker]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    let centerLat = 24.7;
    let centerLng = 46.7;
    let zoom = 10;
    
    if (driverLocation) {
      centerLat = driverLocation.lat;
      centerLng = driverLocation.lng;
      zoom = 14;
    } else if (pickupLat && pickupLng) {
      centerLat = pickupLat;
      centerLng = pickupLng;
      zoom = 12;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom,
      pitch: 45
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.current.on('load', async () => {
      if (!map.current) return;
      setMapReady(true);

      // Add pickup marker
      if (pickupLat && pickupLng) {
        const pickupEl = document.createElement('div');
        pickupEl.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            border: 3px solid white;
          ">
            <span style="color: white; font-weight: bold; font-size: 14px;">1</span>
          </div>
        `;
        
        new mapboxgl.Marker({ element: pickupEl })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; text-align: right;">
              <strong style="color: #10B981;">📍 موقع الاستلام</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${pickupLocation || ''}</p>
            </div>
          `))
          .addTo(map.current);
      }

      // Add delivery marker
      if (deliveryLat && deliveryLng) {
        const deliveryEl = document.createElement('div');
        deliveryEl.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
            border: 3px solid white;
          ">
            <span style="color: white; font-weight: bold; font-size: 14px;">2</span>
          </div>
        `;
        
        new mapboxgl.Marker({ element: deliveryEl })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; text-align: right;">
              <strong style="color: #EF4444;">🏁 موقع التسليم</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${deliveryLocation || ''}</p>
            </div>
          `))
          .addTo(map.current);
      }

      // Draw route if showRoute is enabled
      if (showRoute && pickupLat && pickupLng && deliveryLat && deliveryLng) {
        try {
          const { data } = await supabase.functions.invoke('mapbox-directions', {
            body: {
              originLat: pickupLat,
              originLng: pickupLng,
              destLat: deliveryLat,
              destLng: deliveryLng
            }
          });

          if (data?.geometry && map.current) {
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: data.geometry
              }
            });

            map.current.addLayer({
              id: 'route-glow',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#2563EB',
                'line-width': 10,
                'line-opacity': 0.2,
                'line-blur': 3
              }
            });

            map.current.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#3B82F6',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });
          }
        } catch (error) {
          console.error('Error fetching route:', error);
        }
      }
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      driverMarker.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, tokenLoading, pickupLat, pickupLng, deliveryLat, deliveryLng, showRoute, pickupLocation, deliveryLocation]);

  // Add/update driver marker when location changes
  useEffect(() => {
    if (!map.current || !mapReady || !driverLocation || !isOnline) return;

    if (!driverMarker.current) {
      markerElement.current = createDriverMarkerElement(driverLocation.heading || 0);
      driverMarker.current = new mapboxgl.Marker({ element: markerElement.current })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    }

    // Fly to driver if tracking
    if (isTracking && map.current) {
      map.current.easeTo({
        center: [driverLocation.lng, driverLocation.lat],
        duration: 1000
      });
    }
  }, [driverLocation, isOnline, mapReady, isTracking, createDriverMarkerElement]);

  // Center on driver
  const centerOnDriver = () => {
    if (map.current && driverLocation) {
      map.current.flyTo({
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 15,
        duration: 1500,
        pitch: 45
      });
      setIsTracking(true);
    }
  };

  // Get heading direction text
  const getHeadingDirection = (heading: number | null) => {
    if (heading === null) return 'غير محدد';
    const directions = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  // Format speed
  const formatSpeed = (speed: number | null) => {
    if (speed === null) return 0;
    // Convert m/s to km/h
    return Math.round(speed * 3.6);
  };

  // Time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdate) return '';
    const seconds = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000);
    if (seconds < 60) return `منذ ${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    return `منذ ${minutes} دقيقة`;
  };

  if (tokenLoading) {
    return (
      <div className={`bg-card rounded-xl border border-border ${height} flex items-center justify-center`}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">جاري تحميل الخريطة...</span>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className={`bg-card rounded-xl border border-border ${height} flex items-center justify-center`}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{tokenError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">تتبع السائق المباشر</h3>
            <p className="text-xs text-muted-foreground">
              {isOnline ? getTimeSinceUpdate() : 'السائق غير متصل'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && (
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
          <Badge variant={isOnline ? 'default' : 'secondary'} className={isOnline ? 'bg-success' : ''}>
            {isOnline ? 'متصل' : 'غير متصل'}
          </Badge>
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainer} className={height} />

      {/* Stats Footer */}
      {isOnline && driverLocation && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-center gap-6">
            {/* Speed */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gauge className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">السرعة</p>
                <p className="font-bold text-lg">{formatSpeed(driverLocation.speed)} <span className="text-xs font-normal">كم/س</span></p>
              </div>
            </div>

            {/* Heading */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Compass className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الاتجاه</p>
                <p className="font-bold">{getHeadingDirection(driverLocation.heading)}</p>
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <MapPin className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الإحداثيات</p>
                <p className="font-mono text-xs">
                  {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Message */}
      {!isOnline && (
        <div className="p-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            السائق غير متصل حالياً. سيظهر موقعه عند اتصاله.
          </p>
        </div>
      )}
    </div>
  );
}
