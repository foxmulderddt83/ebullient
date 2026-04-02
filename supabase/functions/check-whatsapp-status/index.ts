import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-region',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req: Request) => {
  console.log(`Incoming ${req.method} request to check-whatsapp-status`);
  
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get WhatsApp API URL from site_settings
    const { data: apiUrlData, error: apiError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'whatsapp_api_url')
      .maybeSingle();

    if (apiError) throw apiError;
    
    const API_URL = apiUrlData?.value;
    
    if (!API_URL) {
      return new Response(JSON.stringify({ connected: false, error: "WhatsApp API URL not configured" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Check status from the WhatsApp API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const res = await fetch(`${API_URL}/api/status`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const json = await res.json();
        return new Response(JSON.stringify({ 
          connected: Boolean(json.connected),
          instance: json.instance || 'default'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
    }

    // 3. Fallback: Check if status was recently updated in DB by bot
    const { data: statusData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'whatsapp_bot_status')
      .maybeSingle();

    return new Response(JSON.stringify({ 
      connected: statusData?.value === 'connected',
      source: 'database_fallback'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
