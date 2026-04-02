import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ChipProduct {
  name: string;
  price: number;
  quantity: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 2. Get booking_id OR registration_id from request
    const bodyText = await req.text();
    console.log("Raw request body:", bodyText);

    let body: any = {};
    try {
      body = JSON.parse(bodyText || '{}');
    } catch (e) {
      console.error("Failed to parse request body as JSON:", bodyText);
      body = {};
    }

    const payload = body && typeof body === 'object' && body.body && typeof body.body === 'object'
      ? body.body
      : body;

    const bookingId = payload.booking_id ?? payload.bookingId ?? payload.booking ?? null;
    const registrationId = payload.registration_id ?? payload.registrationId ?? payload.event_registration_id ?? payload.eventRegistrationId ?? null;
    const paymentType = payload.payment_type ?? payload.paymentType;
    const profileId = payload.profile_id ?? payload.profileId;
    const eventId = payload.event_id ?? payload.eventId;
    const bookingPaymentId = registrationId ? null : bookingId;

    if (!bookingId && !registrationId) {
      console.error("Missing payment target in request body:", payload);
      const errorMsg = 'Missing payment target (booking_id or registration_id).';
      return new Response(JSON.stringify({ error: errorMsg }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalAmount = 0;
    const products: ChipProduct[] = [];
    let customerEmail = 'no-email@example.com';
    let customerPhone = '+6000000000';
    let customerName = 'Guest';
    let referenceId = '';
    let successRedirect = '';
    let failureRedirect = '';
    let tableName = '';

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

    // --- SCENARIO A: BOOKING PAYMENT ---
    if (bookingPaymentId) {
      console.log("Processing booking payment for ID:", bookingPaymentId);
      referenceId = bookingPaymentId;
      tableName = 'bookings';
      successRedirect = `${frontendUrl}/booking/success?id=${bookingPaymentId}`;
      failureRedirect = `${frontendUrl}/booking/failed?id=${bookingPaymentId}`;

      // 3. FETCH BOOKING & ITEMS FROM DATABASE
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(name, email, phone),
          items:booking_items(
            quantity,
            package:packages(name, price)
          )
        `)
        .eq('booking_id', bookingPaymentId)
        .maybeSingle();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError, "for ID:", bookingPaymentId);
        throw new Error(`Booking not found. Please try again or contact support.`);
      }

      customerEmail = booking.customer?.email || customerEmail;
      customerPhone = booking.customer?.phone || customerPhone;
      customerName = booking.customer?.name || customerName;

      // 4. CALCULATE AMOUNT
      const effectivePaymentType = paymentType || booking.payment_type || 'full';
      console.log("Effective payment type for booking:", effectivePaymentType);

      if (effectivePaymentType === 'deposit' && booking.deposit_amount > 0) {
        totalAmount = Number(booking.deposit_amount);
        products.push({
          name: `Deposit Payment (${booking.booking_reference})`,
          price: Math.round(totalAmount * 100),
          quantity: 1,
        });
      } else {
        // Fallback to total_amount if items are missing
        if (booking.items && booking.items.length > 0) {
          booking.items.forEach((item: { quantity: number; package: { name: string; price: number } | null }) => {
            const price = item.package?.price || 0;
            const quantity = item.quantity || 1;
            totalAmount += price * quantity;

            products.push({
              name: item.package?.name || 'Unknown Item',
              price: Math.round(price * 100), // CHIP expects cents
              quantity: quantity,
            });
          });
        } else {
          totalAmount = Number(booking.total_amount) || 0;
          products.push({
            name: `Full Payment (${booking.booking_reference})`,
            price: Math.round(totalAmount * 100),
            quantity: 1,
          });
        }
      }
    } 
    // --- SCENARIO B: EVENT REGISTRATION PAYMENT ---
    else if (registrationId) {
      console.log("Processing registration payment for ID:", registrationId);
      referenceId = registrationId;
      tableName = 'event_registrations';
      successRedirect = `${frontendUrl}/event/success?id=${registrationId}`;
      failureRedirect = `${frontendUrl}/event/failed?id=${registrationId}`;

      // 3. FETCH REGISTRATION & EVENT DETAILS
      const { data: reg, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(name, payment_amount, deposit_amount, enable_deposit, price, promotion_price, event_profile_id)
        `)
        .eq('id', registrationId)
        .maybeSingle();

      if (regError || !reg) {
        console.error("Registration fetch error:", regError, "for ID:", registrationId);
        throw new Error('Registration not found. Please try again or contact support.');
      }

      customerEmail = reg.email || customerEmail;
      customerPhone = reg.phone || customerPhone;
      customerName = reg.name || customerName;

      // 4. CALCULATE AMOUNT
      let isDeposit = false;
      let amount = 0;
      let eventName = 'Event';

      let eventData = reg.event;
      
      // If event data not linked in registration, try fetching by event_id from body
      const resolvedEventId = eventId || profileId;
      
      if (!eventData && resolvedEventId) {
        console.log("No event data in registration, attempting to fetch by resolvedEventId:", resolvedEventId);
        // Try fetching as event first
        const { data: eData, error: eError } = await supabase
          .from('events')
          .select('name, payment_amount, deposit_amount, enable_deposit, price, promotion_price, event_profile_id')
          .eq('id', resolvedEventId)
          .maybeSingle(); // Use maybeSingle to avoid 406 error
          
        if (eData) {
          console.log("Found event data by resolvedEventId:", eData.name);
          eventData = eData;
        } else {
          console.log("Not found as event, attempting to fetch as profile by resolvedEventId:", resolvedEventId);
          // If not an event, try fetching as a profile
          const { data: profile, error: pError } = await supabase
            .from('event_profiles')
            .select('*')
            .eq('id', resolvedEventId)
            .maybeSingle(); // Use maybeSingle to avoid 406 error

          if (profile) {
            console.log("Found profile data by resolvedEventId:", profile.event_title);
            eventName = profile.event_title || eventName;
            const pPromo = Number(profile.event_promotion_price) || 0;
            const pBase = Number(profile.event_price) || 0;
            const pAmount = pPromo > 0 ? pPromo : pBase;

            let enableDeposit = false;
            let depositAmount = 0;
            if (profile.event_registration_template) {
              try {
                const template = typeof profile.event_registration_template === 'string' 
                  ? JSON.parse(profile.event_registration_template) 
                  : profile.event_registration_template;
                
                const dep = template.fieldsConfig?.enable_deposit;
                if (dep) enableDeposit = !!dep.required;
                
                const pReq = template.fieldsConfig?.payment_required;
                if (pReq) depositAmount = Number(pReq.deposit_amount) || 0;
              } catch (e) {
                console.error("Error parsing profile event template", e);
              }
            }

            isDeposit = paymentType === 'deposit' && enableDeposit;
            amount = isDeposit ? depositAmount : pAmount;
            
            // Set eventData to a mock object so the next block processes it correctly
            eventData = {
              name: eventName,
              payment_amount: pAmount,
              promotion_price: pPromo,
              price: pBase,
              deposit_amount: depositAmount,
              enable_deposit: enableDeposit
            };
          }
        }
      }

      if (eventData) {
        console.log("Processing eventData for amount calculation:", eventData.name);
        isDeposit = paymentType === 'deposit' && !!eventData.enable_deposit;
        
        let pAmount = Number(eventData.payment_amount) || 0;
        if (pAmount <= 0) {
          const promo = Number(eventData.promotion_price) || 0;
          const base = Number(eventData.price) || 0;
          pAmount = promo > 0 ? promo : base;
        }
        
        if (pAmount <= 0 && eventData.event_profile_id) {
          console.log("pAmount is still 0, attempting to fetch from event_profile_id:", eventData.event_profile_id);
          const { data: profile } = await supabase
            .from('event_profiles')
            .select('event_price, event_promotion_price')
            .eq('id', eventData.event_profile_id)
            .maybeSingle();
            
          if (profile) {
            const pPromo = Number(profile.event_promotion_price) || 0;
            const pBase = Number(profile.event_price) || 0;
            pAmount = pPromo > 0 ? pPromo : pBase;
            console.log("Found pAmount from profile:", pAmount);
          }
        }
        
        amount = isDeposit ? (Number(eventData.deposit_amount) || 0) : pAmount;
        eventName = eventData.name || eventName;
        console.log("Calculated amount:", amount, "for event:", eventName, "isDeposit:", isDeposit);
      } else {
        console.log("No eventData found, falling back to global site settings");
        // Fallback to global site settings for default event
        const { data: settingsData } = await supabase.from('site_settings').select('key, value');
        let enableDeposit = false;
        let depositAmount = 0;
        let paymentAmount = 0;

        if (settingsData && settingsData.length > 0) {
          const titleSetting = settingsData.find((s: any) => s.key === 'event_title');
          if (titleSetting) eventName = titleSetting.value;

          const templateSetting = settingsData.find((s: any) => s.key === 'event_registration_template');
          if (templateSetting) {
            try {
              const template = typeof templateSetting.value === 'string' 
                ? JSON.parse(templateSetting.value) 
                : templateSetting.value;
                
              const pReq = template.fieldsConfig?.payment_required;
              if (pReq) {
                paymentAmount = Number(pReq.payment_amount) || 0;
                depositAmount = Number(pReq.deposit_amount) || 0;
              }
              const dep = template.fieldsConfig?.enable_deposit;
              if (dep) {
                enableDeposit = !!dep.required;
              }
            } catch (e) {
              console.error("Error parsing default event template", e);
            }
          }
        } else {
          console.error("Critical: site_settings table is empty or inaccessible.");
          throw new Error("Payment failed: Site settings are missing. Please configure event settings in the admin panel.");
        }
        isDeposit = paymentType === 'deposit' && enableDeposit;
        amount = isDeposit ? depositAmount : paymentAmount;
      }
      
      totalAmount = amount;
      
      if (totalAmount <= 0) {
        let errorMsg = `Unable to determine payment amount for ${eventName}.`;
        if (eventData) {
          errorMsg += ` Event has price RM ${eventData.price || 0}, promotion price RM ${eventData.promotion_price || 0}.`;
        } else {
          errorMsg += " No event data or site settings prices found.";
        }
        throw new Error(errorMsg);
      }
      
      products.push({
        name: `${isDeposit ? 'Deposit' : 'Full Payment'} for ${eventName}`,
        price: Math.round(totalAmount * 100),
        quantity: 1,
      });
    }

    if (totalAmount <= 0) {
      return new Response(JSON.stringify({ error: `Invalid payment amount: RM ${totalAmount.toFixed(2)}. Please ensure the event price is set correctly.` }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enforce Transaction Limits (Min RM 1.01, Max RM 50,000)
    if (totalAmount < 1.01) {
      return new Response(JSON.stringify({ error: `Payment amount RM ${totalAmount.toFixed(2)} is too low. CHIP minimum is RM 1.01.` }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (totalAmount > 50000) {
      return new Response(JSON.stringify({ error: `Payment amount RM ${totalAmount.toFixed(2)} exceeds maximum limit of RM 50,000.00.` }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Convert to cents for CHIP
    const amountInCents = Math.round(totalAmount * 100);

    // 5. CALL CHIP API
    const chipSecretKey = Deno.env.get('CHIP_SECRET_KEY');
    const chipBrandId = Deno.env.get('CHIP_BRAND_ID');
    const chipEnvironment = Deno.env.get('CHIP_ENVIRONMENT') || 'production'; 
    
    const apiUrl = Deno.env.get('API_URL') || Deno.env.get('SUPABASE_URL');

    if (!chipSecretKey || !chipBrandId) {
      console.error('Missing CHIP configuration');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing CHIP_SECRET_KEY or CHIP_BRAND_ID' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chipApiBase = chipEnvironment.toLowerCase() === 'sandbox' 
      ? 'https://sandbox.gate.chip-in.asia/api/v1/purchases/'
      : 'https://gate.chip-in.asia/api/v1/purchases/';

    const chipResponse = await fetch(chipApiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chipSecretKey}`,
      },
      body: JSON.stringify({
        brand_id: chipBrandId,
        client: {
          email: customerEmail,
          phone: customerPhone,
          full_name: customerName,
        },
        purchase: {
          total: amountInCents,
          currency: 'MYR',
          products: products,
        },
        reference: referenceId,
        webhook_url: `${apiUrl}/functions/v1/chip-webhook`,
        success_redirect: successRedirect,
        failure_redirect: failureRedirect,
      }),
    });

    if (!chipResponse.ok) {
      const errorText = await chipResponse.text();
      console.error('CHIP API error body:', errorText);
      throw new Error(`CHIP API error: ${chipResponse.statusText} - ${errorText}`);
    }

    const chipData = await chipResponse.json();

    // 6. Update database with payment ID
    if (tableName === 'bookings') {
      await supabase
        .from('bookings')
        .update({ 
          payment_gateway: 'CHIP',
          payment_method: 'CHIP',
          payment_id: chipData.id,
          payment_status: 'pending_verification'
        })
        .eq('booking_id', referenceId);
    } else if (tableName === 'event_registrations') {
      await supabase
        .from('event_registrations')
        .update({ 
          payment_method: 'CHIP',
          payment_id: chipData.id,
          payment_status: 'pending_verification',
          payment_type: paymentType || 'full'
        })
        .eq('id', referenceId);
    }

    // 7. Return checkout URL to frontend
    return new Response(
      JSON.stringify({ 
        checkout_url: chipData.checkout_url 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const err = error as Error;
    console.error('Edge Function Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
