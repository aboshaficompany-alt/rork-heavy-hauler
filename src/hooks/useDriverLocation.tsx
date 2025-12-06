import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LocationState {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export function useDriverLocation() {
  const { user, role } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update location in database
  const updateLocationInDB = useCallback(async (location: LocationState, online: boolean) => {
    if (!user || role !== 'driver') return;

    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: user.id,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading || null,
          speed: location.speed || null,
          is_online: online,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'driver_id'
        });

      if (error) {
        console.error('Error updating location:', error);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, [user, role]);

  // Start tracking location
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('الموقع الجغرافي غير مدعوم في هذا المتصفح');
      return;
    }

    setIsTracking(true);

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined
        };
        setCurrentLocation(newLocation);
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error('تعذر الحصول على الموقع');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    // Update DB every 10 seconds
    updateIntervalRef.current = setInterval(() => {
      if (currentLocation && isOnline) {
        updateLocationInDB(currentLocation, isOnline);
      }
    }, 10000);
  }, [currentLocation, isOnline, updateLocationInDB]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    setIsTracking(false);
  }, []);

  // Toggle online status
  const toggleOnline = useCallback(async (online: boolean) => {
    setIsOnline(online);

    if (online) {
      startTracking();
      if (currentLocation) {
        await updateLocationInDB(currentLocation, true);
      }
    } else {
      stopTracking();
      if (currentLocation) {
        await updateLocationInDB(currentLocation, false);
      }
    }
  }, [startTracking, stopTracking, currentLocation, updateLocationInDB]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Initial location fetch
  useEffect(() => {
    if (role === 'driver' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Initial location error:', error)
      );
    }
  }, [role]);

  return {
    isOnline,
    toggleOnline,
    currentLocation,
    isTracking
  };
}