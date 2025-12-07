import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface GPSLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface UseGPSLocationReturn {
  location: GPSLocation | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<GPSLocation | null>;
  watchLocation: (onUpdate: (location: GPSLocation) => void) => () => void;
}

export function useGPSLocation(): UseGPSLocationReturn {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<GPSLocation | null> => {
    if (!navigator.geolocation) {
      const errorMsg = 'المتصفح لا يدعم تحديد الموقع';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: GPSLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(newLocation);
          setLoading(false);
          toast.success('تم تحديد موقعك بنجاح');
          resolve(newLocation);
        },
        (err) => {
          let errorMsg = 'فشل في تحديد الموقع';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMsg = 'تم رفض إذن الوصول للموقع';
              break;
            case err.POSITION_UNAVAILABLE:
              errorMsg = 'معلومات الموقع غير متوفرة';
              break;
            case err.TIMEOUT:
              errorMsg = 'انتهت مهلة طلب الموقع';
              break;
          }
          setError(errorMsg);
          setLoading(false);
          toast.error(errorMsg);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, []);

  const watchLocation = useCallback((onUpdate: (location: GPSLocation) => void): (() => void) => {
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: GPSLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setLocation(newLocation);
        onUpdate(newLocation);
      },
      (err) => {
        console.error('Watch location error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    watchLocation
  };
}
