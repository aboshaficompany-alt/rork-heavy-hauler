import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, country = 'SA', limit = 10 } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Encode query for URL
    const encodedQuery = encodeURIComponent(query)
    
    // Build Mapbox Geocoding API URL with Saudi Arabia focus
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?` +
      `access_token=${mapboxToken}` +
      `&country=${country}` +
      `&limit=${limit}` +
      `&language=ar` +
      `&types=place,locality,neighborhood,address,poi` +
      `&proximity=46.7,24.7` // Riyadh coordinates for better Saudi results

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`)
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: unknown) {
    console.error('Geocode error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to search places'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
