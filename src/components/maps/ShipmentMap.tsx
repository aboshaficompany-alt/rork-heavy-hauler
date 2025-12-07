import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Loader2, Navigation, Clock, Route, Car } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';

interface ShipmentMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupLocation?: string;
  deliveryLocation?: string;
  showAnimatedCar?: boolean;
}

const ShipmentMap = ({ 
  pickupLat, 
  pickupLng, 
  deliveryLat, 
  deliveryLng,
  pickupLocation,
  deliveryLocation,
  showAnimatedCar = true
}: ShipmentMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const carMarker = useRef<mapboxgl.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);

  const createCarElement = () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="car-marker-container">
        <div style="
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 25px rgba(37, 99, 235, 0.6);
          border: 4px solid white;
          animation: carGlow 2s ease-in-out infinite;
          position: relative;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          width: 20px;
          height: 20px;
          background: #10B981;
          border-radius: 50%;
          bottom: -2px;
          right: -2px;
          border: 3px solid white;
          animation: statusPulse 1s ease-in-out infinite;
        "></div>
      </div>
    `;
    return el;
  };

  const createPickupMarker = () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative;">
        <div style="
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
          border: 3px solid white;
          animation: markerFloat 3s ease-in-out infinite;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 12px solid #10B981;
        "></div>
      </div>
    `;
    return el;
  };

  const createDeliveryMarker = () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative;">
        <div style="
          background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
          border: 3px solid white;
          animation: markerFloat 3s ease-in-out infinite 0.5s;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 12px solid #EF4444;
        "></div>
      </div>
    `;
    return el;
  };

  // Animate car along route
  const animateCar = (coordinates: [number, number][]) => {
    if (!map.current || !showAnimatedCar || coordinates.length < 2) return;

    let currentIndex = 0;
    const totalPoints = coordinates.length;
    const duration = 30000; // 30 seconds for full route
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      currentIndex = Math.floor(progress * (totalPoints - 1));

      if (carMarker.current && coordinates[currentIndex]) {
        carMarker.current.setLngLat(coordinates[currentIndex]);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Create car marker
    carMarker.current = new mapboxgl.Marker({ element: createCarElement() })
      .setLngLat(coordinates[0])
      .addTo(map.current);

    animate();
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    let centerLng = 45.0;
    let centerLat = 24.0;
    let zoom = 5;

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
      new mapboxgl.Marker({ element: createPickupMarker() })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong style="color: #10B981;">موقع الاستلام</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${pickupLocation || ''}</p>
          </div>
        `))
        .addTo(map.current);
    }

    // Add delivery marker
    if (deliveryLat && deliveryLng) {
      new mapboxgl.Marker({ element: createDeliveryMarker() })
        .setLngLat([deliveryLng, deliveryLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong style="color: #EF4444;">موقع التسليم</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${deliveryLocation || ''}</p>
          </div>
        `))
        .addTo(map.current);
    }

    // Draw route between points
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      map.current.on('load', async () => {
        if (!map.current) return;

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
            // Store route coordinates for animation
            setRouteCoordinates(data.geometry.coordinates);

            // Add glow layer
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
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#2563EB',
                'line-width': 14,
                'line-opacity': 0.15,
                'line-blur': 4
              }
            });

            map.current.addLayer({
              id: 'route-outline',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#1D4ED8',
                'line-width': 8,
                'line-opacity': 0.7
              }
            });

            map.current.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#3B82F6',
                'line-width': 5,
                'line-opacity': 1
              }
            });

            setRouteInfo({
              distance: data.distanceText,
              duration: data.durationText
            });

            // Animate car along route
            if (showAnimatedCar) {
              animateCar(data.geometry.coordinates);
            }

            const bounds = new mapboxgl.LngLatBounds()
              .extend([pickupLng, pickupLat])
              .extend([deliveryLng, deliveryLat]);

            map.current.fitBounds(bounds, { padding: 80 });
          }
        } catch (error) {
          console.error('Error fetching route:', error);
        }
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      carMarker.current?.remove();
      map.current?.remove();
    };
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, mapboxToken, tokenLoading, pickupLocation, deliveryLocation, showAnimatedCar]);

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
      {/* CSS Animations */}
      <style>{`
        @keyframes carGlow {
          0%, 100% { box-shadow: 0 4px 25px rgba(37, 99, 235, 0.6); }
          50% { box-shadow: 0 4px 35px rgba(37, 99, 235, 0.9); }
        }
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes markerFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">الخريطة</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-success shadow-sm"></div>
            <span>الاستلام</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive shadow-sm"></div>
            <span>التسليم</span>
          </div>
          {showAnimatedCar && (
            <div className="flex items-center gap-1.5">
              <Car className="h-3 w-3 text-primary" />
              <span>الشاحنة</span>
            </div>
          )}
        </div>
      </div>

      <div ref={mapContainer} className="h-72 rounded-lg overflow-hidden shadow-lg" />
      
      {/* Route Info */}
      {routeInfo && (
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <Route className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">{routeInfo.distance}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 rounded-lg">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-semibold text-warning">{routeInfo.duration}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentMap;
