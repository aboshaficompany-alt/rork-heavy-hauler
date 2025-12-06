import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle } from 'lucide-react';

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
  const [mapboxToken, setMapboxToken] = useState(() => 
    localStorage.getItem('mapbox_token') || ''
  );
  const [showTokenInput, setShowTokenInput] = useState(!mapboxToken);
  const [mapError, setMapError] = useState<string | null>(null);

  const saveToken = () => {
    if (mapboxToken.trim()) {
      localStorage.setItem('mapbox_token', mapboxToken.trim());
      setShowTokenInput(false);
      setMapError(null);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || showTokenInput || !mapboxToken) return;

    try {
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

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('خطأ في تحميل الخريطة. تحقق من صحة المفتاح.');
        setShowTokenInput(true);
        localStorage.removeItem('mapbox_token');
      });

      // Add pickup marker
      if (pickupLat && pickupLng) {
        const pickupEl = document.createElement('div');
        pickupEl.className = 'pickup-marker';
        pickupEl.innerHTML = `
          <div style="
            background-color: #10B981;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 3px solid white;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
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
        deliveryEl.className = 'delivery-marker';
        deliveryEl.innerHTML = `
          <div style="
            background-color: #EF4444;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 3px solid white;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `;

        new mapboxgl.Marker({ element: deliveryEl })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>موقع التسليم</strong><br/>${deliveryLocation || ''}`))
          .addTo(map.current);
      }

      // Draw line between points
      if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
        map.current.on('load', () => {
          if (!map.current) return;
          
          map.current.addSource('route', {
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
              'line-width': 3,
              'line-dasharray': [2, 1]
            }
          });

          // Fit bounds to show both markers
          const bounds = new mapboxgl.LngLatBounds()
            .extend([pickupLng, pickupLat])
            .extend([deliveryLng, deliveryLat]);

          map.current.fitBounds(bounds, {
            padding: 60
          });
        });
      }

    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('خطأ في تهيئة الخريطة');
    }

    return () => {
      map.current?.remove();
    };
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, showTokenInput, mapboxToken, pickupLocation, deliveryLocation]);

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
          لعرض الخريطة، أدخل مفتاح Mapbox العام الخاص بك. يمكنك الحصول عليه من{' '}
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

  const hasCoordinates = (pickupLat && pickupLng) || (deliveryLat && deliveryLng);

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
    </div>
  );
};

export default ShipmentMap;
