import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RouteInfo {
  distance: number;
  distanceText: string;
  duration: number;
  durationText: string;
  geometry?: any;
}

export function useRouteCalculation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const calculateRoute = useCallback(async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mapbox-directions', {
        body: {
          originLat,
          originLng,
          destLat,
          destLng
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setRouteInfo(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate route';
      setError(errorMessage);
      console.error('Route calculation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRouteInfo(null);
    setError(null);
  }, []);

  return {
    calculateRoute,
    clearRoute,
    routeInfo,
    loading,
    error
  };
}