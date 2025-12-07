import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Truck, Crosshair, Loader2, AlertCircle } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useGPSLocation } from '@/hooks/useGPSLocation';

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
  
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  const { getCurrentLocation, loading: gpsLoading } = useGPSLocation();
  const [activeMarker, setActiveMarker] = useState<MarkerType>('pickup');

  const createMarkerElement = (type: MarkerType) => {
    const el = document.createElement('div');
    el.className = `${type}-marker`;
    const color = type === 'pickup' ? '#10B981' : '#EF4444';
    const icon = type === 'pickup' ? 'P' : 'D';
    el.innerHTML = `
      <div style="
        background-color: ${color};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
        cursor: grab;
        font-weight: bold;
        color: white;
        font-size: 16px;
      ">
        ${icon}
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
        if (map.current) {
          map.current.flyTo({
            center: [location.lng, location.lat],
            zoom: 14,
            duration: 1000
          });
        }
      } else {
        onDeliveryChange(location.lat, location.lng);
        if (map.current) {
          map.current.flyTo({
            center: [location.lng, location.lat],
            zoom: 14,
            duration: 1000
          });
        }
      }
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      // Default center (Saudi Arabia)
      const centerLng = 45.0;
      const centerLat = 24.0;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [centerLng, centerLat],
        zoom: 5,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
      
      // Add geolocate control
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      map.current.addControl(geolocate, 'top-left');

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
      });

      // Add logo overlay
      map.current.on('load', () => {
        if (!map.current) return;
        
        // Add custom logo control
        const logoContainer = document.createElement('div');
        logoContainer.className = 'map-logo-container';
        logoContainer.innerHTML = `
          <div style="
            position: absolute;
            bottom: 30px;
            right: 10px;
            background: rgba(255,255,255,0.95);
            padding: 8px 12px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 10;
          ">
            <div style="
              width: 24px;
              height: 24px;
              background: linear-gradient(135deg, #2563EB, #1D4ED8);
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <span style="font-size: 12px; font-weight: 600; color: #1E293B;">اماس لوجستك</span>
          </div>
        `;
        mapContainer.current?.appendChild(logoContainer);
      });

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
              if (lngLat) {
                onPickupChange(lngLat.lat, lngLat.lng);
              }
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
              if (lngLat) {
                onDeliveryChange(lngLat.lat, lngLat.lng);
              }
            });
          }
        }
      });

      // Add existing markers if coordinates exist
      if (pickupLat && pickupLng) {
        pickupMarker.current = new mapboxgl.Marker({
          element: createMarkerElement('pickup'),
          draggable: true
        })
          .setLngLat([pickupLng, pickupLat])
          .addTo(map.current);
        
        pickupMarker.current.on('dragend', () => {
          const lngLat = pickupMarker.current?.getLngLat();
          if (lngLat) {
            onPickupChange(lngLat.lat, lngLat.lng);
          }
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
          if (lngLat) {
            onDeliveryChange(lngLat.lat, lngLat.lng);
          }
        });
      }

    } catch (error) {
      console.error('Map initialization error:', error);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, tokenLoading]);

  // Update markers when coordinates change externally
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

  // Loading state
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

  // Error state
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">تحديد المواقع على الخريطة</h3>
        </div>
        
        {/* GPS Button */}
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
        انقر على الخريطة لتحديد {activeMarker === 'pickup' ? 'موقع الاستلام' : 'موقع التسليم'}، أو اضغط "موقعي الحالي" لاستخدام GPS
      </p>

      <div ref={mapContainer} className="h-72 rounded-lg overflow-hidden relative" />

      {/* Coordinates display */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <p className="font-medium text-success mb-1">موقع الاستلام</p>
          {pickupLat && pickupLng ? (
            <p className="text-muted-foreground font-mono" dir="ltr">
              {pickupLat.toFixed(6)}, {pickupLng.toFixed(6)}
            </p>
          ) : (
            <p className="text-muted-foreground">لم يتم التحديد</p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="font-medium text-destructive mb-1">موقع التسليم</p>
          {deliveryLat && deliveryLng ? (
            <p className="text-muted-foreground font-mono" dir="ltr">
              {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
            </p>
          ) : (
            <p className="text-muted-foreground">لم يتم التحديد</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
