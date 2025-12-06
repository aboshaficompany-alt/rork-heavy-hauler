import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-mapbox-token');

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get Mapbox token';
        setError(errorMessage);
        console.error('Mapbox token error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, loading, error };
}
