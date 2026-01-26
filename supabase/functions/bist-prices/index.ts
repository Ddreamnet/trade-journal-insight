import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache to reduce upstream calls (and avoid RapidAPI 429).
// Note: Edge Functions may cold start; cache is best-effort per warm instance.
const CACHE_TTL_MS = 55_000; // slightly less than the client polling interval
let lastSuccessfulPayload: unknown | null = null;
let lastSuccessfulAt = 0;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Serve cached snapshot if it's still fresh.
    const now = Date.now();
    if (lastSuccessfulPayload && now - lastSuccessfulAt < CACHE_TTL_MS) {
      return jsonResponse(lastSuccessfulPayload, {
        status: 200,
        headers: {
          'X-Cache': 'HIT',
        },
      });
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = "https://bist100-stock-data-15-minutes-late-live.p.rapidapi.com/bist100/prices";
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'bist100-stock-data-15-minutes-late-live.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    // Handle rate limit specifically
    // NOTE: We return 200 here (with an explicit payload) so the frontend can
    // gracefully fall back to cached data without surfacing a runtime error UI.
    if (response.status === 429) {
      console.error('BIST API rate limited (429)');

      // If we have a previous good snapshot, serve it.
      if (lastSuccessfulPayload) {
        return jsonResponse(lastSuccessfulPayload, {
          status: 200,
          headers: {
            'X-Cache': 'STALE',
            'X-Rate-Limited': 'true',
          },
        });
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'rate_limited', retryAfter: 60 }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Rate-Limited': 'true',
          },
        }
      );
    }

    if (!response.ok) {
      console.error(`BIST API error: ${response.status}`);

      // Best-effort fallback to last known good payload.
      if (lastSuccessfulPayload) {
        return jsonResponse(lastSuccessfulPayload, {
          status: 200,
          headers: {
            'X-Cache': 'STALE',
            'X-Upstream-Error': String(response.status),
          },
        });
      }

      return jsonResponse({ error: `BIST API error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();

     // Update cache
     lastSuccessfulPayload = data;
     lastSuccessfulAt = Date.now();
    
    console.log('BIST API connected - data received');

    return jsonResponse(data, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Edge function error:', errorMessage);

    // Best-effort fallback to last known good payload.
    if (lastSuccessfulPayload) {
      return jsonResponse(lastSuccessfulPayload, {
        status: 200,
        headers: {
          'X-Cache': 'STALE',
          'X-Edge-Error': 'true',
        },
      });
    }

    return jsonResponse({ error: errorMessage }, { status: 500 });
  }
});
