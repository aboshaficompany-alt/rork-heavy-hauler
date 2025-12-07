import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from './useMapboxToken';

interface MapOptions {
  center?: [number, number];
  zoom?: number;
  style?: string;
  enableTracking?: boolean;
  enableHighAccuracy?: boolean;
}

interface UseOptimizedMapReturn {
  mapContainer: React.RefObject<HTMLDivElement>;
  map: mapboxgl.Map | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  flyTo: (center: [number, number], zoom?: number, options?: Partial<{ duration: number; essential: boolean }>) => void;
  addMarker: (id: string, lngLat: [number, number], element?: HTMLElement) => mapboxgl.Marker;
  removeMarker: (id: string) => void;
  updateMarkerPosition: (id: string, lngLat: [number, number], smooth?: boolean) => void;
  fitBounds: (bounds: mapboxgl.LngLatBoundsLike, options?: mapboxgl.FitBoundsOptions) => void;
  userLocation: { lat: number; lng: number } | null;
  geolocateControl: mapboxgl.GeolocateControl | null;
}

export function useOptimizedMap(options: MapOptions = {}): UseOptimizedMapReturn {
  const {
    center = [46.7, 24.7],
    zoom = 10,
    style = 'mapbox://styles/mapbox/streets-v12',
    enableTracking = false,
    enableHighAccuracy = true
  } = options;

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useMapboxToken();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || tokenLoading) return;

    mapboxgl.accessToken = mapboxToken;

    // Performance optimizations
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      center,
      zoom,
      attributionControl: false,
      preserveDrawingBuffer: false,
      antialias: true,
      refreshExpiredTiles: false,
      fadeDuration: 0,
      crossSourceCollisions: false,
      localIdeographFontFamily: "'Noto Sans Arabic', 'Arial Unicode MS', sans-serif"
    });

    mapRef.current = map;

    // Add controls
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // High-performance geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy,
        timeout: 10000,
        maximumAge: 0
      },
      trackUserLocation: enableTracking,
      showUserHeading: true,
      showAccuracyCircle: true
    });
    
    geolocateRef.current = geolocate;
    map.addControl(geolocate, 'top-left');

    // Track user location updates
    geolocate.on('geolocate', (e: any) => {
      setUserLocation({
        lat: e.coords.latitude,
        lng: e.coords.longitude
      });
    });

    map.on('load', () => {
      setIsLoaded(true);
      
      // Auto-trigger geolocation if tracking enabled
      if (enableTracking) {
        setTimeout(() => geolocate.trigger(), 500);
      }
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
    });

    return () => {
      // Cleanup markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, tokenLoading, style, enableTracking, enableHighAccuracy]);

  // Fly to location with smooth animation
  const flyTo = useCallback((
    targetCenter: [number, number], 
    targetZoom?: number,
    flyOptions?: Partial<{ duration: number; essential: boolean }>
  ) => {
    if (!mapRef.current) return;
    
    mapRef.current.flyTo({
      center: targetCenter,
      zoom: targetZoom || mapRef.current.getZoom(),
      duration: flyOptions?.duration ?? 1500,
      essential: flyOptions?.essential ?? true
    });
  }, []);

  // Add or update marker
  const addMarker = useCallback((
    id: string, 
    lngLat: [number, number], 
    element?: HTMLElement
  ): mapboxgl.Marker => {
    if (markersRef.current.has(id)) {
      const existing = markersRef.current.get(id)!;
      existing.setLngLat(lngLat);
      return existing;
    }

    const marker = new mapboxgl.Marker(element ? { element } : {})
      .setLngLat(lngLat);
    
    if (mapRef.current) {
      marker.addTo(mapRef.current);
    }
    
    markersRef.current.set(id, marker);
    return marker;
  }, []);

  // Remove marker
  const removeMarker = useCallback((id: string) => {
    const marker = markersRef.current.get(id);
    if (marker) {
      marker.remove();
      markersRef.current.delete(id);
    }
  }, []);

  // Update marker position with optional smooth animation
  const updateMarkerPosition = useCallback((
    id: string, 
    lngLat: [number, number], 
    smooth = true
  ) => {
    const marker = markersRef.current.get(id);
    if (!marker) return;

    if (smooth) {
      // Smooth animation using CSS transitions
      const el = marker.getElement();
      el.style.transition = 'transform 0.3s ease-out';
    }
    
    marker.setLngLat(lngLat);
  }, []);

  // Fit bounds with padding
  const fitBounds = useCallback((
    bounds: mapboxgl.LngLatBoundsLike, 
    fitOptions?: mapboxgl.FitBoundsOptions
  ) => {
    if (!mapRef.current) return;
    
    mapRef.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 150, left: 50, right: 50 },
      duration: 1000,
      ...fitOptions
    });
  }, []);

  return {
    mapContainer,
    map: mapRef.current,
    isLoaded,
    isLoading: tokenLoading,
    error: tokenError,
    flyTo,
    addMarker,
    removeMarker,
    updateMarkerPosition,
    fitBounds,
    userLocation,
    geolocateControl: geolocateRef.current
  };
}
