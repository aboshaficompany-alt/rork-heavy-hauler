import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, WatchPositionCallback } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LocationState {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: number;
}

export function useNativeGeolocation() {
  const { user, role } = useAuth();
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(false);
  
  const watchIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check geolocation availability
  useEffect(() => {
    const checkAvailability = async () => {
      if (isNative) {
        try {
          const permStatus = await Geolocation.checkPermissions();
          setIsGeolocationAvailable(true);
          if (permStatus.location === 'granted' || permStatus.coarseLocation === 'granted') {
            // Already have permission
          }
        } catch {
          setIsGeolocationAvailable(false);
        }
      } else {
        setIsGeolocationAvailable('geolocation' in navigator);
      }
    };
    checkAvailability();
  }, [isNative]);

  // Request location permission
  const requestPermission = useCallback(async () => {
    try {
      if (isNative) {
        const permStatus = await Geolocation.requestPermissions();
        if (permStatus.location === 'granted' || permStatus.coarseLocation === 'granted') {
          toast.success('تم السماح بالوصول للموقع');
          return true;
        } else {
          toast.error('يرجى السماح بالوصول للموقع');
          return false;
        }
      } else {
        return new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              toast.success('تم السماح بالوصول للموقع');
              resolve(true);
            },
            () => {
              toast.error('يرجى السماح بالوصول للموقع');
              resolve(false);
            }
          );
        });
      }
    } catch (error) {
      console.error('Permission request error:', error);
      toast.error('حدث خطأ أثناء طلب الإذن');
      return false;
    }
  }, [isNative]);

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

  // Get current position
  const getCurrentPosition = useCallback(async (): Promise<LocationState | null> => {
    try {
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        });
        
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
      } else {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              });
            },
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 5000
            }
          );
        });
      }
    } catch (error) {
      console.error('Get position error:', error);
      return null;
    }
  }, [isNative]);

  // Start tracking location
  const startTracking = useCallback(async () => {
    if (!isGeolocationAvailable) {
      const errorMsg = 'الموقع الجغرافي غير متاح';
      setLocationError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsTracking(true);
    setLocationError(null);

    try {
      if (isNative) {
        // Native background location tracking
        const watchCallback: WatchPositionCallback = (position: Position | null, err?: any) => {
          if (err) {
            console.error('Watch position error:', err);
            setLocationError('تعذر تتبع الموقع');
            return;
          }
          
          if (position) {
            const newLocation: LocationState = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            };
            setCurrentLocation(newLocation);
            setLocationError(null);
          }
        };

        // Start watching position with background mode
        watchIdRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 3000
          },
          watchCallback
        );
      } else {
        // Web fallback
        webWatchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation: LocationState = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            };
            setCurrentLocation(newLocation);
            setLocationError(null);
          },
          (error) => {
            console.error('Watch position error:', error);
            let errorMessage = 'تعذر الحصول على الموقع';
            
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
            toast.error(errorMessage);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 3000
          }
        );
      }

      // Update DB every 5 seconds
      updateIntervalRef.current = setInterval(async () => {
        const loc = await getCurrentPosition();
        if (loc && isOnline) {
          setCurrentLocation(loc);
          updateLocationInDB(loc, true);
        }
      }, 5000);

    } catch (error) {
      console.error('Start tracking error:', error);
      setLocationError('تعذر بدء تتبع الموقع');
      toast.error('تعذر بدء تتبع الموقع');
    }
  }, [isGeolocationAvailable, isNative, isOnline, updateLocationInDB, getCurrentPosition]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    try {
      if (isNative && watchIdRef.current) {
        await Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }

      if (!isNative && webWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
        webWatchIdRef.current = null;
      }

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      setIsTracking(false);
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  }, [isNative]);

  // Toggle online status
  const toggleOnline = useCallback(async (online: boolean) => {
    setIsOnline(online);

    if (online) {
      await startTracking();
      const loc = await getCurrentPosition();
      if (loc) {
        setCurrentLocation(loc);
        await updateLocationInDB(loc, true);
      }
    } else {
      await stopTracking();
      if (currentLocation) {
        await updateLocationInDB(currentLocation, false);
      }
    }
  }, [startTracking, stopTracking, currentLocation, updateLocationInDB, getCurrentPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Initial location fetch
  useEffect(() => {
    const fetchInitialLocation = async () => {
      if (role === 'driver' && isGeolocationAvailable) {
        const loc = await getCurrentPosition();
        if (loc) {
          setCurrentLocation(loc);
        } else {
          setLocationError('تعذر تحديد موقعك');
        }
      }
    };
    fetchInitialLocation();
  }, [role, isGeolocationAvailable, getCurrentPosition]);

  // Retry getting location
  const retryLocation = useCallback(async () => {
    if (!isGeolocationAvailable) {
      toast.error('الموقع الجغرافي غير مدعوم');
      return;
    }

    setLocationError(null);
    toast.info('جاري تحديد الموقع...');

    const loc = await getCurrentPosition();
    if (loc) {
      setCurrentLocation(loc);
      setLocationError(null);
      toast.success('تم تحديد الموقع بنجاح');
    } else {
      setLocationError('تعذر تحديد الموقع');
      toast.error('تعذر تحديد الموقع');
    }
  }, [isGeolocationAvailable, getCurrentPosition]);

  return {
    isNative,
    isOnline,
    toggleOnline,
    currentLocation,
    isTracking,
    locationError,
    isGeolocationAvailable,
    retryLocation,
    requestPermission,
    getCurrentPosition
  };
}
