import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MobileNav } from '@/components/layout/MobileNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Package, Search, Menu, X, Volume2, VolumeX, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useDriverNotifications } from '@/hooks/useDriverNotifications';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useRouteCalculation } from '@/hooks/useRouteCalculation';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface OpenShipment {
  id: string;
  equipment_type: string;
  pickup_location: string;
  delivery_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  weight: number;
}

export default function DriverHome() {
  const { profile } = useAuth();
  const { isOnline, toggleOnline, currentLocation } = useDriverLocation();
  const [loading, setLoading] = useState(true);
  const [openShipments, setOpenShipments] = useState<OpenShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<OpenShipment | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  
  // Get Mapbox token from backend
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();
  
  // Initialize notifications and route calculation
  useDriverNotifications();
  const { toggleSound, playSuccess } = useNotificationSound();
  const { calculateRoute, routeInfo, loading: routeLoading } = useRouteCalculation();

  // Calculate route when shipment is selected
  useEffect(() => {
    if (selectedShipment && currentLocation && selectedShipment.pickup_lat && selectedShipment.pickup_lng) {
      calculateRoute(
        currentLocation.lat,
        currentLocation.lng,
        selectedShipment.pickup_lat,
        selectedShipment.pickup_lng
      );
    }
  }, [selectedShipment, currentLocation, calculateRoute]);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [46.7, 24.7],
      zoom: currentLocation ? 12 : 10,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-left'
    );

    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-left'
    );

    map.current.on('load', () => {
      setMapReady(true);
    });

    return () => {
      markers.current.forEach(marker => marker.remove());
      userMarker.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, tokenLoading]);

  // Fly to current location when it updates
  useEffect(() => {
    if (currentLocation && map.current && mapReady) {
      // Update or create user marker
      if (userMarker.current) {
        userMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `
          <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-3 border-white animate-pulse">
            <div class="w-3 h-3 bg-white rounded-full"></div>
          </div>
        `;
        userMarker.current = new mapboxgl.Marker(el)
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map.current);
      }
    }
  }, [currentLocation, mapReady]);

  // Fetch open shipments
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const { data, error } = await supabase
          .from('shipments')
          .select('id, equipment_type, pickup_location, delivery_location, pickup_lat, pickup_lng, delivery_lat, delivery_lng, weight')
          .in('status', ['open', 'pending_bids'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOpenShipments(data || []);
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, []);

  // Add markers and route when shipments change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Remove existing route layer and source
    if (map.current.getLayer('shipment-route')) {
      map.current.removeLayer('shipment-route');
    }
    if (map.current.getSource('shipment-route')) {
      map.current.removeSource('shipment-route');
    }

    // Add shipment markers
    openShipments.forEach((shipment) => {
      // Pickup marker
      if (shipment.pickup_lat && shipment.pickup_lng) {
        const pickupEl = document.createElement('div');
        pickupEl.innerHTML = `
          <div class="w-10 h-10 bg-success rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
          </div>
        `;
        
        pickupEl.addEventListener('click', () => {
          setSelectedShipment(shipment);
        });

        const pickupMarker = new mapboxgl.Marker(pickupEl)
          .setLngLat([shipment.pickup_lng, shipment.pickup_lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>الاستلام:</strong> ${shipment.pickup_location}`))
          .addTo(map.current!);

        markers.current.push(pickupMarker);
      }

      // Delivery marker
      if (shipment.delivery_lat && shipment.delivery_lng) {
        const deliveryEl = document.createElement('div');
        deliveryEl.innerHTML = `
          <div class="w-10 h-10 bg-destructive rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
              <circle cx="12" cy="9" r="2.5"></circle>
            </svg>
          </div>
        `;
        
        deliveryEl.addEventListener('click', () => {
          setSelectedShipment(shipment);
        });

        const deliveryMarker = new mapboxgl.Marker(deliveryEl)
          .setLngLat([shipment.delivery_lng, shipment.delivery_lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>التسليم:</strong> ${shipment.delivery_location}`))
          .addTo(map.current!);

        markers.current.push(deliveryMarker);
      }
    });
  }, [openShipments, mapReady]);

  // Draw route for selected shipment
  useEffect(() => {
    if (!map.current || !mapReady || !selectedShipment) return;

    const drawRoute = async () => {
      if (!selectedShipment.pickup_lat || !selectedShipment.pickup_lng || 
          !selectedShipment.delivery_lat || !selectedShipment.delivery_lng) return;

      // Remove existing route
      if (map.current!.getLayer('selected-route')) {
        map.current!.removeLayer('selected-route');
      }
      if (map.current!.getSource('selected-route')) {
        map.current!.removeSource('selected-route');
      }

      try {
        // Fetch route from Mapbox Directions API via our edge function
        const { data } = await supabase.functions.invoke('mapbox-directions', {
          body: {
            originLat: selectedShipment.pickup_lat,
            originLng: selectedShipment.pickup_lng,
            destLat: selectedShipment.delivery_lat,
            destLng: selectedShipment.delivery_lng
          }
        });

        if (data?.geometry && map.current) {
          map.current.addSource('selected-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: data.geometry
            }
          });

          map.current.addLayer({
            id: 'selected-route',
            type: 'line',
            source: 'selected-route',
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

          // Fit bounds to show the route
          const bounds = new mapboxgl.LngLatBounds()
            .extend([selectedShipment.pickup_lng, selectedShipment.pickup_lat])
            .extend([selectedShipment.delivery_lng, selectedShipment.delivery_lat]);

          map.current.fitBounds(bounds, {
            padding: { top: 150, bottom: 200, left: 50, right: 50 }
          });
        }
      } catch (error) {
        console.error('Error drawing route:', error);
      }
    };

    drawRoute();

    return () => {
      if (map.current?.getLayer('selected-route')) {
        map.current.removeLayer('selected-route');
      }
      if (map.current?.getSource('selected-route')) {
        map.current.removeSource('selected-route');
      }
    };
  }, [selectedShipment, mapReady]);

  const handleOnlineToggle = (checked: boolean) => {
    toggleOnline(checked);
    if (checked) {
      playSuccess();
      toast.success('أنت الآن متصل ويمكنك استقبال الطلبات');
    } else {
      toast.info('تم إيقاف الاتصال');
    }
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    toggleSound(newValue);
    toast.info(newValue ? 'تم تفعيل الصوت' : 'تم إيقاف الصوت');
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Token Error Message */}
      {tokenError && (
        <div className="absolute inset-0 z-0 bg-muted flex items-center justify-center">
          <div className="text-center p-6">
            <p className="text-destructive font-medium">خطأ في تحميل الخريطة</p>
            <p className="text-muted-foreground text-sm mt-2">{tokenError}</p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 safe-area-top">
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 bg-card/95 backdrop-blur-md rounded-full shadow-lg flex items-center px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground ml-2" />
            <input
              type="text"
              placeholder="ابحث عن موقع..."
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>
          
          {/* Sound Toggle */}
          <button 
            onClick={handleSoundToggle}
            className="w-12 h-12 bg-card/95 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center"
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-primary" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {/* Menu Button */}
          <button className="w-12 h-12 bg-card/95 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Online Toggle */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10">
        <div 
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-full shadow-lg transition-all duration-300",
            isOnline 
              ? "bg-success text-success-foreground" 
              : "bg-card/95 backdrop-blur-md text-foreground"
          )}
        >
          <div className={cn(
            "w-3 h-3 rounded-full",
            isOnline ? "bg-white animate-pulse" : "bg-muted-foreground"
          )} />
          <span className="font-medium text-sm">
            {isOnline ? 'متصل' : 'غير متصل'}
          </span>
          <Switch
            checked={isOnline}
            onCheckedChange={handleOnlineToggle}
            className="data-[state=checked]:bg-white/20"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {isOnline && (
        <div className="absolute top-40 left-4 right-4 z-10">
          <div className="flex gap-3 justify-center">
            <div className="bg-card/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg text-center min-w-[100px]">
              <p className="text-2xl font-bold text-foreground">{openShipments.length}</p>
              <p className="text-xs text-muted-foreground">شحنات متاحة</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet - Selected Shipment or Shipments List */}
      <div className="absolute bottom-20 left-0 right-0 z-10 px-4 safe-area-bottom">
        {selectedShipment ? (
          <Card className="bg-card/95 backdrop-blur-md p-4 rounded-2xl shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {selectedShipment.equipment_type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedShipment.weight} طن
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-foreground truncate">{selectedShipment.pickup_location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-foreground truncate">{selectedShipment.delivery_location}</span>
                  </div>
                </div>

                {/* Route Info */}
                {routeInfo && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Navigation className="h-4 w-4 text-primary" />
                      <span className="text-foreground font-medium">{routeInfo.distanceText}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-warning" />
                      <span className="text-foreground font-medium">{routeInfo.durationText}</span>
                    </div>
                  </div>
                )}
                {routeLoading && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">جاري حساب المسافة...</span>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedShipment(null)}
                className="p-2 hover:bg-muted rounded-full"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button asChild className="flex-1">
                <Link to={`/shipments/${selectedShipment.id}`}>
                  عرض التفاصيل
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/open-requests`}>
                  تقديم عرض
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {openShipments.slice(0, 3).map((shipment) => (
              <Card 
                key={shipment.id}
                className="bg-card/95 backdrop-blur-md p-4 rounded-2xl shadow-xl min-w-[280px] flex-shrink-0 cursor-pointer hover:shadow-2xl transition-shadow"
                onClick={() => setSelectedShipment(shipment)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{shipment.equipment_type}</p>
                    <p className="text-sm text-muted-foreground truncate">{shipment.pickup_location}</p>
                    <p className="text-xs text-muted-foreground">{shipment.weight} طن</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Loading Overlay */}
      {(loading || tokenLoading) && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
