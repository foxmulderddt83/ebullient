import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyChipSignature(rawBody: string, signature: string | null, secretKey: string | undefined): Promise<boolean> {
  if (!signature || !secretKey) return false;
  
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const bodyData = encoder.encode(rawBody);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    // signature is hex
    const sigArray = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    return await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      sigArray,
      bodyData
    );
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('X-Signature');
    const secretKey = Deno.env.get('CHIP_SECRET_KEY');

    // SECURITY: Verify webhook signature from CHIP
    if (secretKey) {
      const isValid = await verifyChipSignature(rawBody, signature, secretKey);
      if (!isValid) {
        console.error('[CHIP] ❌ Invalid signature received');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.log('[CHIP] ✅ Signature verified');
    } else {
      console.warn('[CHIP] ⚠️ CHIP_SECRET_KEY not set, skipping signature verification');
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const payment_id = payload?.id;
    const status = payload?.status;
    const reference = payload?.reference ?? payload?.booking_id ?? payload?.bookingId ?? payload?.registration_id ?? payload?.registrationId;
    // reference is either booking_id or registration_id

    console.log(`[CHIP] 📥 Webhook received for reference: ${reference}`);
    console.log(`[CHIP] 💳 Payment ID: ${payment_id}, Status: ${status}`);

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Missing payment reference in webhook payload' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (status === 'paid') {
      const paidAmount = payload.purchase?.total_paid ? payload.purchase.total_paid / 100 : 0;
      const paidAt = new Date().toISOString();
      
      // Attempt to extract the specific payment method from CHIP webhook payload
      const rawMethod = payload.transaction_data?.payment_method || payload.payment?.type || payload.transaction_data?.extra?.payment_method || '';
      const specificMethod = rawMethod ? `CHIP (${rawMethod.toUpperCase()})` : 'CHIP';

      // 1. Try to update BOOKINGS first
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('booking_id, payment_type')
        .eq('booking_id', reference)
        .maybeSingle();

      if (booking) {
        console.log(`[CHIP] Found booking ${reference}`);
        const newStatus = (booking.payment_type === 'deposit') ? 'pending_verification' : 'confirmed';
        
        await supabase
          .from('bookings')
          .update({ 
            payment_status: 'paid',
            status: newStatus,
            paid_amount: paidAmount,
            paid_at: paidAt,
            payment_method: specificMethod
          })
          .eq('booking_id', reference);
          
        console.log(`[CHIP] Booking ${reference} updated with method: ${specificMethod}`);
      } 
      else {
        // 2. Try to update EVENT REGISTRATIONS
        // Check if it exists first to be sure, or just update directly
        const { data: regById } = await supabase
          .from('event_registrations')
          .select('id, booking_id')
          .eq('id', reference)
          .maybeSingle();

        let reg = regById;
        if (!reg) {
          const { data: regByBookingId } = await supabase
            .from('event_registrations')
            .select('id, booking_id')
            .eq('booking_id', reference)
            .maybeSingle();
          reg = regByBookingId;
        }

        if (reg) {
          console.log(`[CHIP] Found event registration ${reference}`);
          
          await supabase
            .from('event_registrations')
            .update({ 
              payment_status: 'paid',
              paid_amount: paidAmount,
              payment_date: paidAt,
              payment_method: specificMethod
            })
            .eq('id', reg.id);

          console.log(`[CHIP] Event registration ${reg.id} updated with method: ${specificMethod}`);
        } else {
          console.warn(`[CHIP] ⚠️ Reference ${reference} not found in bookings or event_registrations.`);
        }
      }

    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
       // Handle failure for both
       const { error: bError } = await supabase
         .from('bookings')
         .update({ payment_status: 'failed', status: 'cancelled' })
         .eq('booking_id', reference);
         
       if (bError) {
          const { error: regErrorById } = await supabase
            .from('event_registrations')
            .update({ payment_status: 'failed' })
            .eq('id', reference);

          if (regErrorById) {
            await supabase
              .from('event_registrations')
              .update({ payment_status: 'failed' })
              .eq('booking_id', reference);
          }
       }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    });

  } catch (error) {
    const err = error as Error;
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});
