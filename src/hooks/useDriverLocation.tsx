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
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if geolocation is available
  const isGeolocationAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator;

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
    if (!isGeolocationAvailable) {
      const errorMsg = 'الموقع الجغرافي غير متاح في هذا المتصفح';
      setLocationError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsTracking(true);
    setLocationError(null);

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
        setLocationError(null);
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMessage = 'تعذر الحصول على الموقع';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'يرجى السماح بالوصول للموقع من إعدادات المتصفح';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'الموقع غير متاح حالياً - تأكد من تفعيل GPS';
            break;
          case error.TIMEOUT:
            errorMessage = 'انتهت مهلة تحديد الموقع - حاول مرة أخرى';
            break;
        }
        
        setLocationError(errorMessage);
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    // Update DB every 10 seconds
    updateIntervalRef.current = setInterval(() => {
      if (currentLocation && isOnline) {
        updateLocationInDB(currentLocation, isOnline);
      }
    }, 10000);
  }, [currentLocation, isOnline, updateLocationInDB, isGeolocationAvailable]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && isGeolocationAvailable) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    setIsTracking(false);
  }, [isGeolocationAvailable]);

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
    if (role === 'driver' && isGeolocationAvailable) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Initial location error:', error.message);
          let errorMessage = 'تعذر تحديد موقعك';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'يرجى السماح بالوصول للموقع';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'الموقع غير متاح - فعّل GPS';
              break;
            case error.TIMEOUT:
              errorMessage = 'انتهت مهلة تحديد الموقع';
              break;
          }
          
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  }, [role, isGeolocationAvailable]);

  // Retry getting location
  const retryLocation = useCallback(() => {
    if (!isGeolocationAvailable) {
      toast.error('الموقع الجغرافي غير مدعوم');
      return;
    }

    setLocationError(null);
    toast.info('جاري تحديد الموقع...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError(null);
        toast.success('تم تحديد الموقع بنجاح');
      },
      (error) => {
        let errorMessage = 'تعذر تحديد الموقع';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'يرجى السماح بالوصول للموقع من إعدادات المتصفح';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'الموقع غير متاح - تأكد من تفعيل GPS';
            break;
          case error.TIMEOUT:
            errorMessage = 'انتهت المهلة - حاول مرة أخرى';
            break;
        }
        setLocationError(errorMessage);
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [isGeolocationAvailable]);

  return {
    isOnline,
    toggleOnline,
    currentLocation,
    isTracking,
    locationError,
    isGeolocationAvailable,
    retryLocation
  };
}
