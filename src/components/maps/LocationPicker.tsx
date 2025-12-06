import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle, Navigation, Truck } from 'lucide-react';

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
  
  const [mapboxToken, setMapboxToken] = useState(() => 
    localStorage.getItem('mapbox_token') || ''
  );
  const [showTokenInput, setShowTokenInput] = useState(!mapboxToken);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<MarkerType>('pickup');

  const saveToken = () => {
    if (mapboxToken.trim()) {
      localStorage.setItem('mapbox_token', mapboxToken.trim());
      setShowTokenInput(false);
      setMapError(null);
    }
  };

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

  useEffect(() => {
    if (!mapContainer.current || showTokenInput || !mapboxToken) return;

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
        trackUserLocation: false,
        showUserHeading: false
      });
      map.current.addControl(geolocate, 'top-left');

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('خطأ في تحميل الخريطة. تحقق من صحة المفتاح.');
        setShowTokenInput(true);
        localStorage.removeItem('mapbox_token');
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
      setMapError('خطأ في تهيئة الخريطة');
    }

    return () => {
      map.current?.remove();
    };
  }, [showTokenInput, mapboxToken]);

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

  if (showTokenInput) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-bold">إعداد الخريطة</h3>
        </div>
        
        {mapError && (
          <div className="flex items-center gap-2 text-destructive mb-4 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{mapError}</span>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          لتحديد المواقع على الخريطة، أدخل مفتاح Mapbox العام. يمكنك الحصول عليه من{' '}
          <a 
            href="https://mapbox.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            mapbox.com
          </a>
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
            <Input
              id="mapbox-token"
              type="text"
              placeholder="pk.eyJ1..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              dir="ltr"
            />
          </div>
          <Button onClick={saveToken} disabled={!mapboxToken.trim()}>
            حفظ وعرض الخريطة
          </Button>
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
        انقر على الخريطة لتحديد {activeMarker === 'pickup' ? 'موقع الاستلام' : 'موقع التسليم'}، أو اسحب العلامة لتعديل الموقع
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
