import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const formatFlightTime = (time: string | null | undefined) => {
  if (!time) return "TBD";
  if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
    return time.toUpperCase();
  }
  try {
    if (!time.includes(':')) return time.toUpperCase();
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return time.toUpperCase();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.substring(0, 2).padStart(2, '0')} ${ampm}`;
  } catch (error) {
    return time.toUpperCase();
  }
};

serve(async (req: Request) => {
  console.log(`Incoming ${req.method} request to send-booking-notification`);
  
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const apiToken = Deno.env.get('API_AUTH_TOKEN');
    
    if (apiToken && (!authHeader || authHeader !== `Bearer ${apiToken}`)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse body carefully
    let body;
    try {
      body = await req.json();
      console.log('Request body:', JSON.stringify(body));
    } catch (e) {
      console.error('JSON parse error:', e);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { booking_id, custom_message, pdf_urls } = body;

    if (!booking_id) {
      console.error('Missing booking_id');
      return new Response(JSON.stringify({ error: "Booking ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ... (fetch booking details)
    console.log(`Fetching booking ${booking_id}...`);
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        items:booking_items(
          quantity,
          package:packages(name, price),
          addon:package_addons(
            addon_package:packages(name, price)
          )
        )
      `)
      .eq('booking_id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking fetch error:', bookingError);
      return new Response(JSON.stringify({ error: `Booking not found: ${bookingError?.message}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // construct message ... (no changes needed to message logic)
    let message = '';
    
    if (custom_message) {
      message = custom_message;
    } else {
      const isDeposit = booking.payment_type === 'deposit';
      const amountPaid = isDeposit ? booking.deposit_amount : booking.total_amount;
      const paymentStatus = isDeposit ? 'Deposit Payment' : 'Full Payment';
      const balance = isDeposit ? (booking.total_amount - booking.deposit_amount) : 0;
      
      message = `*New Booking Submitted*\n\n`;
      message += `*Ref:* ${booking.booking_reference}\n`;
      message += `*Status:* ${paymentStatus} Successful\n`;
      message += `*Amount Paid:* RM ${Number(amountPaid).toFixed(2)}\n`;
      if (isDeposit) {
        message += `*Balance Due:* RM ${Number(balance).toFixed(2)}\n`;
      }
      message += `\n*Customer Details:*\n`;
      message += `Name: ${booking.customer?.name || 'N/A'}\n`;
      message += `Phone: ${booking.customer?.phone || 'N/A'}\n`;
      message += `Email: ${booking.customer?.email || 'N/A'}\n`;
      
      message += `\n*Booking Details:*\n`;
      message += `Flight Date: ${booking.flight_date || 'N/A'}\n`;
      message += `Time: ${formatFlightTime(booking.flight_time)}\n`;
      if (booking.flight_slot) {
        message += `Slot: ${formatFlightTime(booking.flight_slot)}\n`;
      }
      
      if (booking.items && booking.items.length > 0) {
        message += `\n*Packages & Add-ons:*\n`;
        booking.items.forEach((item: any) => {
          const packageName = item.package?.name || item.addon?.addon_package?.name || 'Unknown Item';
          const qty = item.quantity || 1;
          message += `- ${packageName} (x${qty})\n`;
        });
      }

      if (booking.notes) {
        message += `\n*Notes:* ${booking.notes}\n`;
      }
    }

    // 3. Insert into Notification Queue
    const phone = booking.customer?.phone;
    
    if (phone) {
      console.log(`Inserting into notification_queue for phone ${phone}...`);
      const { error: queueError } = await supabase
        .from('notification_queue')
        .insert({
          booking_id: booking.booking_id,
          phone: phone,
          message: message,
          media_urls: pdf_urls || [],
          type: 'whatsapp',
          status: 'pending',
          subject: custom_message ? 'Admin Notification' : 'Booking Submission Confirmation'
        });

      if (queueError) {
        console.error('Queue insert error:', queueError);
        throw queueError;
      }
      console.log('Successfully inserted into notification_queue');
    } else {
      console.warn('No phone number found for booking, skipping queue insert');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
