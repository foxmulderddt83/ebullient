import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
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
            paid_at: paidAt
          })
          .eq('booking_id', reference);
          
        console.log(`[CHIP] Booking ${reference} updated.`);
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
              payment_method: 'CHIP'
            })
            .eq('id', reg.id);

          console.log(`[CHIP] Event registration ${reg.id} updated.`);
        } else {
          console.warn(`[CHIP] ⚠️ Reference ${reference} not found in bookings or event_registrations.`);
        }
      }

    } else if (status === 'failed' || status === 'cancelled') {
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
