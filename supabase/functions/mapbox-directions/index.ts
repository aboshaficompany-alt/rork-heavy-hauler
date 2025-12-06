import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originLng, originLat, destLng, destLat } = await req.json();

    console.log('Calculating route from', originLat, originLng, 'to', destLat, destLng);

    if (!originLng || !originLat || !destLng || !destLat) {
      throw new Error('Missing coordinates');
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured');
    }

    // Call Mapbox Directions API
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
    
    console.log('Fetching directions from Mapbox...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox API error:', errorText);
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationMinutes = Math.round(route.duration / 60);
    const durationHours = Math.floor(durationMinutes / 60);
    const remainingMinutes = durationMinutes % 60;

    let durationText = '';
    if (durationHours > 0) {
      durationText = `${durationHours} ساعة`;
      if (remainingMinutes > 0) {
        durationText += ` و ${remainingMinutes} دقيقة`;
      }
    } else {
      durationText = `${durationMinutes} دقيقة`;
    }

    console.log('Route calculated:', distanceKm, 'km,', durationText);

    return new Response(
      JSON.stringify({
        distance: parseFloat(distanceKm),
        distanceText: `${distanceKm} كم`,
        duration: durationMinutes,
        durationText,
        geometry: route.geometry
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error calculating directions:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
})