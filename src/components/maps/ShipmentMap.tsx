import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Loader2, Navigation, Clock } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';

interface ShipmentMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupLocation?: string;
  deliveryLocation?: string;
}

const ShipmentMap = ({ 
  pickupLat, 
  pickupLng, 
  deliveryLat, 
  deliveryLng,
  pickupLocation,
  deliveryLocation 
}: ShipmentMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    // Default center (Saudi Arabia)
    let centerLng = 45.0;
    let centerLat = 24.0;
    let zoom = 5;

    // Calculate center if we have coordinates
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      centerLng = (pickupLng + deliveryLng) / 2;
      centerLat = (pickupLat + deliveryLat) / 2;
      zoom = 6;
    } else if (pickupLat && pickupLng) {
      centerLng = pickupLng;
      centerLat = pickupLat;
      zoom = 10;
    } else if (deliveryLat && deliveryLng) {
      centerLng = deliveryLng;
      centerLat = deliveryLat;
      zoom = 10;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Add pickup marker
    if (pickupLat && pickupLng) {
      const pickupEl = document.createElement('div');
      pickupEl.innerHTML = `
        <div style="
          background-color: hsl(142.1 76.2% 36.3%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 3px solid white;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      new mapboxgl.Marker({ element: pickupEl })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>موقع الاستلام</strong><br/>${pickupLocation || ''}`))
        .addTo(map.current);
    }

    // Add delivery marker
    if (deliveryLat && deliveryLng) {
      const deliveryEl = document.createElement('div');
      deliveryEl.innerHTML = `
        <div style="
          background-color: hsl(0 84.2% 60.2%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 3px solid white;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      new mapboxgl.Marker({ element: deliveryEl })
        .setLngLat([deliveryLng, deliveryLat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>موقع التسليم</strong><br/>${deliveryLocation || ''}`))
        .addTo(map.current);
    }

    // Draw route between points
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      map.current.on('load', async () => {
        if (!map.current) return;

        try {
          // Fetch route from our edge function
          const { data } = await supabase.functions.invoke('mapbox-directions', {
            body: {
              originLat: pickupLat,
              originLng: pickupLng,
              destLat: deliveryLat,
              destLng: deliveryLng
            }
          });

          if (data?.geometry && map.current) {
            // Add route line
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: data.geometry
              }
            });

            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#2563EB',
                'line-width': 5,
                'line-opacity': 0.8
              }
            });

            // Set route info
            setRouteInfo({
              distance: data.distanceText,
              duration: data.durationText
            });

            // Fit bounds to show both markers
            const bounds = new mapboxgl.LngLatBounds()
              .extend([pickupLng, pickupLat])
              .extend([deliveryLng, deliveryLat]);

            map.current.fitBounds(bounds, {
              padding: 60
            });
          }
        } catch (error) {
          console.error('Error fetching route:', error);
          // Fallback to straight line if route fails
          map.current!.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [pickupLng, pickupLat],
                  [deliveryLng, deliveryLat]
                ]
              }
            }
          });

          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#2563EB',
              'line-width': 3,
              'line-dasharray': [2, 1]
            }
          });

          const bounds = new mapboxgl.LngLatBounds()
            .extend([pickupLng, pickupLat])
            .extend([deliveryLng, deliveryLat]);

          map.current!.fitBounds(bounds, {
            padding: 60
          });
        }
      });
    }

    return () => {
      map.current?.remove();
    };
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, mapboxToken, tokenLoading, pickupLocation, deliveryLocation]);

  const hasCoordinates = (pickupLat && pickupLng) || (deliveryLat && deliveryLng);

  if (tokenLoading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">الخريطة</h3>
        </div>
        <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-destructive" />
          <h3 className="font-bold">خطأ في الخريطة</h3>
        </div>
        <div className="h-48 flex items-center justify-center bg-destructive/10 rounded-lg">
          <p className="text-destructive text-sm">{tokenError}</p>
        </div>
      </div>
    );
  }

  if (!hasCoordinates) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-bold">الخريطة</h3>
        </div>
        <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
          <p className="text-muted-foreground text-sm">لا توجد إحداثيات متاحة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">الخريطة</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span>الاستلام</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <span>التسليم</span>
          </div>
        </div>
      </div>
      <div ref={mapContainer} className="h-64 rounded-lg overflow-hidden" />
      
      {/* Route Info */}
      {routeInfo && (
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="font-medium">{routeInfo.distance}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-medium">{routeInfo.duration}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentMap;
