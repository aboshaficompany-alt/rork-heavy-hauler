import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, MapPin, Package, Navigation, Search, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openShipments, setOpenShipments] = useState<OpenShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<OpenShipment | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const userMarker = useRef<mapboxgl.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = 'pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbTk3ZXVxNWwwMjM0MmxzYWpxcHZjMG9wIn0.AQ-Ab8RN6JniiHHMdjiA_FHDnGztGzRISoBu3I__AqLzFCgbAe5RQ';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [46.7, 24.7], // Saudi Arabia center
      zoom: 10,
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

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 12,
              duration: 1500
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }

    return () => {
      markers.current.forEach(marker => marker.remove());
      userMarker.current?.remove();
      map.current?.remove();
    };
  }, []);

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

  // Add markers when shipments change
  useEffect(() => {
    if (!map.current || !openShipments.length) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add shipment markers
    openShipments.forEach((shipment) => {
      if (shipment.pickup_lat && shipment.pickup_lng) {
        const el = document.createElement('div');
        el.className = 'shipment-marker';
        el.innerHTML = `
          <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
          </div>
        `;
        
        el.addEventListener('click', () => {
          setSelectedShipment(shipment);
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat([shipment.pickup_lng, shipment.pickup_lat])
          .addTo(map.current!);

        markers.current.push(marker);
      }
    });
  }, [openShipments]);

  const handleOnlineToggle = (checked: boolean) => {
    setIsOnline(checked);
    if (checked) {
      toast.success('أنت الآن متصل ويمكنك استقبال الطلبات');
    } else {
      toast.info('تم إيقاف الاتصال');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

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
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}