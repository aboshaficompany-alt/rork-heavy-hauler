import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, Navigation, Clock, Route, Car, MapPin } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';

interface DriverShipmentMapProps {
  // Shipment locations
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupLocation?: string;
  deliveryLocation?: string;
  // Driver current location (for accepted shipments)
  driverLat?: number | null;
  driverLng?: number | null;
  // Mode: 'preview' for open shipments, 'active' for accepted shipments
  mode?: 'preview' | 'active';
  // Optional height
  height?: string;
  // Show route info
  showRouteInfo?: boolean;
}

interface RouteSegment {
  distance: number;
  distanceText: string;
  duration: number;
  durationText: string;
  geometry: any;
}

const DriverShipmentMap = ({ 
  pickupLat, 
  pickupLng, 
  deliveryLat, 
  deliveryLng,
  pickupLocation,
  deliveryLocation,
  driverLat,
  driverLng,
  mode = 'preview',
  height = 'h-72',
  showRouteInfo = true
}: DriverShipmentMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  
  const [routeToPickup, setRouteToPickup] = useState<RouteSegment | null>(null);
  const [routeToDelivery, setRouteToDelivery] = useState<RouteSegment | null>(null);
  const [loading, setLoading] = useState(false);

  const createDriverMarker = useCallback(() => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative;">
        <div style="
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.5);
          border: 3px solid white;
          animation: driverPulse 2s ease-in-out infinite;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          width: 16px;
          height: 16px;
          background: #10B981;
          border-radius: 50%;
          bottom: 0;
          right: 0;
          border: 2px solid white;
        "></div>
      </div>
    `;
    return el;
  }, []);

  const createPickupMarker = useCallback(() => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative;">
        <div style="
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
          border: 3px solid white;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: white;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          color: #10B981;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        ">1</div>
      </div>
    `;
    return el;
  }, []);

  const createDeliveryMarker = useCallback(() => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative;">
        <div style="
          background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
          border: 3px solid white;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: white;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          color: #EF4444;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        ">2</div>
      </div>
    `;
    return el;
  }, []);

  const fetchRoute = useCallback(async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteSegment | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-directions', {
        body: { originLat, originLng, destLat, destLng }
      });
      
      if (error || data?.error) {
        console.error('Route fetch error:', error || data?.error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('Route fetch failed:', err);
      return null;
    }
  }, []);

  const addRouteLayer = useCallback((
    mapInstance: mapboxgl.Map,
    id: string,
    geometry: any,
    color: string,
    opacity: number = 0.8
  ) => {
    // Remove existing layers if present
    if (mapInstance.getLayer(`${id}-glow`)) mapInstance.removeLayer(`${id}-glow`);
    if (mapInstance.getLayer(`${id}-outline`)) mapInstance.removeLayer(`${id}-outline`);
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);

    mapInstance.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry
      }
    });

    // Glow effect
    mapInstance.addLayer({
      id: `${id}-glow`,
      type: 'line',
      source: id,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': 12,
        'line-opacity': 0.2,
        'line-blur': 3
      }
    });

    // Main line
    mapInstance.addLayer({
      id,
      type: 'line',
      source: id,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': 5,
        'line-opacity': opacity
      }
    });
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate initial center
    let centerLng = 46.7;
    let centerLat = 24.7;
    let zoom = 10;

    if (driverLat && driverLng && mode === 'active') {
      centerLng = driverLng;
      centerLat = driverLat;
      zoom = 12;
    } else if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      centerLng = (pickupLng + deliveryLng) / 2;
      centerLat = (pickupLat + deliveryLat) / 2;
      zoom = 9;
    } else if (pickupLat && pickupLng) {
      centerLng = pickupLng;
      centerLat = pickupLat;
      zoom = 12;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom,
      pitch: mode === 'active' ? 45 : 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.current.on('load', async () => {
      if (!map.current) return;
      setLoading(true);

      const bounds = new mapboxgl.LngLatBounds();
      let hasValidBounds = false;

      // Add pickup marker
      if (pickupLat && pickupLng) {
        new mapboxgl.Marker({ element: createPickupMarker() })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; text-align: right;">
              <strong style="color: #10B981;">📍 موقع الاستلام</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${pickupLocation || ''}</p>
            </div>
          `))
          .addTo(map.current);
        bounds.extend([pickupLng, pickupLat]);
        hasValidBounds = true;
      }

      // Add delivery marker
      if (deliveryLat && deliveryLng) {
        new mapboxgl.Marker({ element: createDeliveryMarker() })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; text-align: right;">
              <strong style="color: #EF4444;">🏁 موقع التسليم</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${deliveryLocation || ''}</p>
            </div>
          `))
          .addTo(map.current);
        bounds.extend([deliveryLng, deliveryLat]);
        hasValidBounds = true;
      }

      // Add driver marker for active mode
      if (mode === 'active' && driverLat && driverLng) {
        driverMarker.current = new mapboxgl.Marker({ element: createDriverMarker() })
          .setLngLat([driverLng, driverLat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; text-align: right;">
              <strong style="color: #2563EB;">🚚 موقعك الحالي</strong>
            </div>
          `))
          .addTo(map.current);
        bounds.extend([driverLng, driverLat]);
        hasValidBounds = true;
      }

      // Fetch and draw routes
      if (mode === 'active' && driverLat && driverLng && pickupLat && pickupLng) {
        // Route from driver to pickup
        const toPickupRoute = await fetchRoute(driverLat, driverLng, pickupLat, pickupLng);
        if (toPickupRoute?.geometry && map.current) {
          addRouteLayer(map.current, 'route-to-pickup', toPickupRoute.geometry, '#F59E0B');
          setRouteToPickup(toPickupRoute);
        }
      }

      if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
        // Route from pickup to delivery
        const toDeliveryRoute = await fetchRoute(pickupLat, pickupLng, deliveryLat, deliveryLng);
        if (toDeliveryRoute?.geometry && map.current) {
          addRouteLayer(map.current, 'route-to-delivery', toDeliveryRoute.geometry, '#2563EB');
          setRouteToDelivery(toDeliveryRoute);
        }
      }

      // Fit bounds
      if (hasValidBounds) {
        map.current.fitBounds(bounds, { 
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          maxZoom: 14
        });
      }

      setLoading(false);
    });

    return () => {
      driverMarker.current?.remove();
      map.current?.remove();
    };
  }, [
    pickupLat, pickupLng, deliveryLat, deliveryLng,
    driverLat, driverLng, mapboxToken, tokenLoading, mode,
    pickupLocation, deliveryLocation,
    createDriverMarker, createPickupMarker, createDeliveryMarker,
    fetchRoute, addRouteLayer
  ]);

  // Update driver marker position in real-time
  useEffect(() => {
    if (driverMarker.current && driverLat && driverLng) {
      driverMarker.current.setLngLat([driverLng, driverLat]);
    }
  }, [driverLat, driverLng]);

  const hasCoordinates = (pickupLat && pickupLng) || (deliveryLat && deliveryLng);

  if (tokenLoading) {
    return (
      <div className={`bg-card rounded-xl border border-border ${height} flex items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className={`bg-card rounded-xl border border-border ${height} flex items-center justify-center`}>
        <p className="text-destructive text-sm">{tokenError}</p>
      </div>
    );
  }

  if (!hasCoordinates) {
    return (
      <div className={`bg-card rounded-xl border border-border ${height} flex items-center justify-center`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">لا توجد إحداثيات متاحة</p>
        </div>
      </div>
    );
  }

  const totalDistance = (routeToPickup?.distance || 0) + (routeToDelivery?.distance || 0);
  const totalDuration = (routeToPickup?.duration || 0) + (routeToDelivery?.duration || 0);
  const totalHours = Math.floor(totalDuration / 60);
  const totalMinutes = totalDuration % 60;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* CSS Animations */}
      <style>{`
        @keyframes driverPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(37, 99, 235, 0.5); }
          50% { box-shadow: 0 4px 30px rgba(37, 99, 235, 0.8); }
        }
      `}</style>

      <div ref={mapContainer} className={height} />
      
      {/* Route Info */}
      {showRouteInfo && (routeToPickup || routeToDelivery) && (
        <div className="p-4 border-t border-border space-y-3">
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs">
            {mode === 'active' && routeToPickup && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-warning"></div>
                <span>إلى الاستلام</span>
              </div>
            )}
            {routeToDelivery && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-primary"></div>
                <span>إلى التسليم</span>
              </div>
            )}
          </div>

          {/* Route Details */}
          <div className="flex items-center justify-center gap-4">
            {mode === 'active' && routeToPickup && (
              <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 rounded-lg">
                <Navigation className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-warning">
                  {routeToPickup.distanceText} للاستلام
                </span>
              </div>
            )}
            {routeToDelivery && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                <Route className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {routeToDelivery.distanceText}
                </span>
              </div>
            )}
            {(routeToPickup || routeToDelivery) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {totalHours > 0 ? `${totalHours} ساعة ` : ''}{totalMinutes} دقيقة
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};

export default DriverShipmentMap;
