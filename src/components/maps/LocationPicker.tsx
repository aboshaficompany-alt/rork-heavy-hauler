import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Truck, Crosshair, Loader2, AlertCircle, Route, Clock, Search } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useGPSLocation } from '@/hooks/useGPSLocation';
import { supabase } from '@/integrations/supabase/client';
import { PlaceSearch } from './PlaceSearch';

interface LocationPickerProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  onPickupChange: (lat: number, lng: number) => void;
  onDeliveryChange: (lat: number, lng: number) => void;
}

type MarkerType = 'pickup' | 'delivery';

const LocationPicker = ({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  onPickupChange,
  onDeliveryChange
}: LocationPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarker = useRef<mapboxgl.Marker | null>(null);
  const carMarker = useRef<mapboxgl.Marker | null>(null);
  
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  const { getCurrentLocation, loading: gpsLoading } = useGPSLocation();
  const [activeMarker, setActiveMarker] = useState<MarkerType>('pickup');
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const createMarkerElement = (type: MarkerType) => {
    const el = document.createElement('div');
    el.className = `${type}-marker`;
    const color = type === 'pickup' ? '#10B981' : '#EF4444';
    const icon = type === 'pickup' ? 'P' : 'D';
    el.innerHTML = `
      <div style="
        background-color: ${color};
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        border: 3px solid white;
        cursor: grab;
        font-weight: bold;
        color: white;
        font-size: 16px;
        animation: markerPulse 2s ease-in-out infinite;
      ">
        ${icon}
      </div>
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid ${color};
      "></div>
    `;
    return el;
  };

  const createCarElement = () => {
    const el = document.createElement('div');
    el.innerHTML = `
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
        animation: carPulse 1.5s ease-in-out infinite;
      ">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `;
    return el;
  };

  // Handle GPS location for active marker
  const handleGetGPSLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      if (activeMarker === 'pickup') {
        onPickupChange(location.lat, location.lng);
      } else {
        onDeliveryChange(location.lat, location.lng);
      }
      if (map.current) {
        map.current.flyTo({
          center: [location.lng, location.lat],
          zoom: 14,
          duration: 1000
        });
      }
    }
  };

  // Draw route between pickup and delivery
  const drawRoute = async () => {
    if (!map.current || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng) return;

    setIsLoadingRoute(true);

    try {
      // Remove existing route and car marker
      if (map.current.getLayer('route-line')) {
        map.current.removeLayer('route-line');
      }
      if (map.current.getLayer('route-outline')) {
        map.current.removeLayer('route-outline');
      }
      if (map.current.getLayer('route-glow')) {
        map.current.removeLayer('route-glow');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
      carMarker.current?.remove();

      const { data, error } = await supabase.functions.invoke('mapbox-directions', {
        body: {
          originLat: pickupLat,
          originLng: pickupLng,
          destLat: deliveryLat,
          destLng: deliveryLng
        }
      });

      if (error) throw error;

      if (data?.geometry && map.current) {
        // Add route source
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: data.geometry
          }
        });

        // Add glow effect layer
        map.current.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#2563EB',
            'line-width': 12,
            'line-opacity': 0.2,
            'line-blur': 3
          }
        });

        // Add outline layer
        map.current.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#1D4ED8',
            'line-width': 8,
            'line-opacity': 0.8
          }
        });

        // Add main route line
        map.current.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3B82F6',
            'line-width': 5,
            'line-opacity': 1
          }
        });

        // Add animated car at start of route
        const routeCoords = data.geometry.coordinates;
        if (routeCoords && routeCoords.length > 0) {
          const startPoint = routeCoords[Math.floor(routeCoords.length * 0.3)];
          carMarker.current = new mapboxgl.Marker({ element: createCarElement() })
            .setLngLat(startPoint)
            .addTo(map.current);
        }

        // Set route info
        setRouteInfo({
          distance: data.distanceText,
          duration: data.durationText
        });

        // Fit bounds
        const bounds = new mapboxgl.LngLatBounds()
          .extend([pickupLng, pickupLat])
          .extend([deliveryLng, deliveryLat]);

        map.current.fitBounds(bounds, { padding: 80 });
      }
    } catch (error) {
      console.error('Error drawing route:', error);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      const centerLng = 45.0;
      const centerLat = 24.0;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [centerLng, centerLat],
        zoom: 5,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
      
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
      });
      map.current.addControl(geolocate, 'top-left');

      map.current.on('error', (e) => console.error('Mapbox error:', e));

      // Handle map clicks
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        
        if (activeMarker === 'pickup') {
          onPickupChange(lat, lng);
          
          if (pickupMarker.current) {
            pickupMarker.current.setLngLat([lng, lat]);
          } else {
            pickupMarker.current = new mapboxgl.Marker({
              element: createMarkerElement('pickup'),
              draggable: true
            })
              .setLngLat([lng, lat])
              .addTo(map.current!);
            
            pickupMarker.current.on('dragend', () => {
              const lngLat = pickupMarker.current?.getLngLat();
              if (lngLat) onPickupChange(lngLat.lat, lngLat.lng);
            });
          }
        } else {
          onDeliveryChange(lat, lng);
          
          if (deliveryMarker.current) {
            deliveryMarker.current.setLngLat([lng, lat]);
          } else {
            deliveryMarker.current = new mapboxgl.Marker({
              element: createMarkerElement('delivery'),
              draggable: true
            })
              .setLngLat([lng, lat])
              .addTo(map.current!);
            
            deliveryMarker.current.on('dragend', () => {
              const lngLat = deliveryMarker.current?.getLngLat();
              if (lngLat) onDeliveryChange(lngLat.lat, lngLat.lng);
            });
          }
        }
      });

      // Add existing markers
      if (pickupLat && pickupLng) {
        pickupMarker.current = new mapboxgl.Marker({
          element: createMarkerElement('pickup'),
          draggable: true
        })
          .setLngLat([pickupLng, pickupLat])
          .addTo(map.current);
        
        pickupMarker.current.on('dragend', () => {
          const lngLat = pickupMarker.current?.getLngLat();
          if (lngLat) onPickupChange(lngLat.lat, lngLat.lng);
        });
      }

      if (deliveryLat && deliveryLng) {
        deliveryMarker.current = new mapboxgl.Marker({
          element: createMarkerElement('delivery'),
          draggable: true
        })
          .setLngLat([deliveryLng, deliveryLat])
          .addTo(map.current);
        
        deliveryMarker.current.on('dragend', () => {
          const lngLat = deliveryMarker.current?.getLngLat();
          if (lngLat) onDeliveryChange(lngLat.lat, lngLat.lng);
        });
      }

    } catch (error) {
      console.error('Map initialization error:', error);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, tokenLoading]);

  // Update markers when coordinates change
  useEffect(() => {
    if (pickupLat && pickupLng && pickupMarker.current) {
      pickupMarker.current.setLngLat([pickupLng, pickupLat]);
    }
  }, [pickupLat, pickupLng]);

  useEffect(() => {
    if (deliveryLat && deliveryLng && deliveryMarker.current) {
      deliveryMarker.current.setLngLat([deliveryLng, deliveryLat]);
    }
  }, [deliveryLat, deliveryLng]);

  // Auto-draw route when both points are set
  useEffect(() => {
    if (pickupLat && pickupLng && deliveryLat && deliveryLng && map.current) {
      const timer = setTimeout(() => {
        if (map.current?.isStyleLoaded()) {
          drawRoute();
        } else {
          map.current?.on('load', drawRoute);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  if (tokenLoading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">جاري تحميل الخريطة...</span>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{tokenError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border space-y-4">
      {/* CSS for animations */}
      <style>{`
        @keyframes markerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes carPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(37, 99, 235, 0.5); }
          50% { box-shadow: 0 4px 30px rgba(37, 99, 235, 0.8); }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">تحديد المواقع على الخريطة</h3>
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGetGPSLocation}
          disabled={gpsLoading}
          className="gap-2"
        >
          {gpsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
          موقعي الحالي
        </Button>
      </div>

      {/* Place Search */}
      <PlaceSearch
        placeholder={activeMarker === 'pickup' ? 'ابحث عن موقع الاستلام...' : 'ابحث عن موقع التسليم...'}
        onSelect={(place) => {
          if (activeMarker === 'pickup') {
            onPickupChange(place.lat, place.lng);
          } else {
            onDeliveryChange(place.lat, place.lng);
          }
          if (map.current) {
            map.current.flyTo({
              center: [place.lng, place.lat],
              zoom: 14,
              duration: 1000
            });
          }
        }}
      />

      {/* Marker selection buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={activeMarker === 'pickup' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveMarker('pickup')}
          className="flex-1 gap-2"
        >
          <Navigation className="h-4 w-4" />
          موقع الاستلام
          {pickupLat && pickupLng && <span className="text-xs opacity-70">✓</span>}
        </Button>
        <Button
          type="button"
          variant={activeMarker === 'delivery' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveMarker('delivery')}
          className="flex-1 gap-2"
        >
          <Truck className="h-4 w-4" />
          موقع التسليم
          {deliveryLat && deliveryLng && <span className="text-xs opacity-70">✓</span>}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        ابحث عن موقع أو انقر على الخريطة لتحديد {activeMarker === 'pickup' ? 'موقع الاستلام' : 'موقع التسليم'}
      </p>

      <div ref={mapContainer} className="h-80 rounded-lg overflow-hidden relative shadow-lg" />

      {/* Route Info */}
      {routeInfo && (
        <div className="flex items-center justify-center gap-6 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">{routeInfo.distance}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-semibold text-warning">{routeInfo.duration}</span>
          </div>
          {isLoadingRoute && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* Location Status Warning */}
      {(!pickupLat || !pickupLng || !deliveryLat || !deliveryLng) && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            {!pickupLat || !pickupLng 
              ? 'يرجى تحديد موقع الاستلام على الخريطة' 
              : 'يرجى تحديد موقع التسليم على الخريطة'}
          </p>
        </div>
      )}

      {/* Coordinates display */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className={`p-3 rounded-lg border ${pickupLat && pickupLng ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20'}`}>
          <p className={`font-medium mb-1 flex items-center gap-1 ${pickupLat && pickupLng ? 'text-success' : 'text-warning'}`}>
            <Navigation className="h-3 w-3" />
            موقع الاستلام *
          </p>
          {pickupLat && pickupLng ? (
            <p className="text-muted-foreground font-mono" dir="ltr">
              {pickupLat.toFixed(6)}, {pickupLng.toFixed(6)}
            </p>
          ) : (
            <p className="text-warning">مطلوب - انقر على الخريطة</p>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${deliveryLat && deliveryLng ? 'bg-destructive/10 border-destructive/20' : 'bg-warning/10 border-warning/20'}`}>
          <p className={`font-medium mb-1 flex items-center gap-1 ${deliveryLat && deliveryLng ? 'text-destructive' : 'text-warning'}`}>
            <Truck className="h-3 w-3" />
            موقع التسليم *
          </p>
          {deliveryLat && deliveryLng ? (
            <p className="text-muted-foreground font-mono" dir="ltr">
              {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
            </p>
          ) : (
            <p className="text-warning">مطلوب - انقر على الخريطة</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
