import { supabase } from "@/lib/supabase";
import { generateAndSavePDF, getVariableValue, AVAILABLE_VARIABLES } from "@/lib/pdfGenerator";

export const notificationService = {
  formatAmount(amount: any) {
    const value = Number(amount ?? 0);
    if (Number.isNaN(value)) {
      return 'RM 0.00';
    }
    return `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatBookingDetailsText(booking: any) {
    const items = (booking.booking_items || [])
      .map((item: any) => {
        const name = item.package?.name || 'Package';
        const qty = item.quantity || 1;
        return `${name} x${qty}`;
      })
      .join('\n');

    const amountToPay = booking.payment_type === 'deposit' ? booking.deposit_amount : booking.total_amount;

    const lines = [
      `Booking Reference: ${booking.booking_reference || ''}`,
      `Name: ${booking.customer?.name || ''}`,
      `Phone: ${booking.customer?.phone || ''}`,
      `Date: ${booking.flight_date || ''}`,
      `Time: ${booking.flight_time || ''}`,
      `Payment Type: ${booking.payment_type || ''}`,
      `Amount: ${this.formatAmount(amountToPay)}`
    ];

    if (items) {
      lines.push(`Items:\n${items}`);
    }

    return lines.join('\n');
  },

  async fetchBookingWithDetails(bookingId: string) {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        booking_items(
          *,
          package:packages(*)
        )
      `);

    // Check if bookingId is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    
    if (isUUID) {
      query = query.or(`booking_id.eq.${bookingId},booking_reference.eq.${bookingId}`);
    } else {
      query = query.eq('booking_reference', bookingId);
    }

    const { data: booking, error: bookingError } = await query.single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      return null;
    }

    return booking;
  },

  async sendPaymentSuccessNotifications(bookingId: string, textOnly: boolean = false) {
    console.log(`Processing payment success notifications for booking ${bookingId}${textOnly ? ' (Text Only)' : ''}`);

    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    // 2. Fetch Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'payment_success_document_type', 
        'payment_success_email_enabled',
        'payment_success_email_template', 
        'payment_success_whatsapp_enabled',
        'whatsapp_template_payment_success'
      ]);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, error: 'Settings fetch failed' };
    }

    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};

    const pdfUrls: { url: string, name: string }[] = [];

    // 3. Generate PDF if configured and NOT textOnly
    if (!textOnly) {
      const rawDocType = settings['payment_success_document_type'];
      let docTypes: string[] = [];
      
      if (rawDocType) {
        try {
          if (rawDocType.startsWith('[')) {
            docTypes = JSON.parse(rawDocType);
          } else if (rawDocType !== 'none') {
            docTypes = [rawDocType];
          }
        } catch (e) {
          console.error('Error parsing document types:', e);
        }
      }

      if (docTypes.length > 0) {
        for (const type of docTypes) {
          try {
            console.log(`Generating PDF for type: ${type}`);
            const result = await generateAndSavePDF(booking.booking_id, type);
            pdfUrls.push({ 
              url: result.publicUrl, 
              name: `${type.replace(/_/g, '-')}-${booking.booking_reference}.pdf` 
            });
            console.log('PDF generated:', result.publicUrl);
          } catch (e) {
            console.error(`PDF generation failed for ${type}:`, e);
          }
        }
      }
    } else {
      console.log('Skipping PDF generation as requested (textOnly=true)');
    }

    // 4. Send Email if configured
    const emailEnabled = settings['payment_success_email_enabled'] === 'true';
    const emailTemplateId = settings['payment_success_email_template'];
    if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
      await this.sendEmail(booking, emailTemplateId, pdfUrls);
    }

    // 5. Send WhatsApp if configured
    const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled';
    const whatsappTemplate = settings['whatsapp_template_payment_success'];
    
    if (whatsappEnabled && whatsappTemplate) {
      const waResult = await this.sendWhatsApp(booking, whatsappTemplate, pdfUrls.map(p => p.url));
      if (!waResult.success) {
        return { success: false, error: `WhatsApp Error: ${waResult.error}` };
      }
    }

    return { success: true };
  },

  async sendPendingApprovalNotifications(bookingId: string) {
    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['payment_success_whatsapp_enabled']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, error: 'Settings fetch failed' };
    }

    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};
    const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled';
    if (!whatsappEnabled) {
      return { success: false, error: 'WhatsApp notifications disabled' };
    }

    const message = `Your booking is pending by admin approval.\n\n${this.formatBookingDetailsText(booking)}`;
    const waResult = await this.sendWhatsApp(booking, message, []);
    if (!waResult.success) {
      return { success: false, error: `WhatsApp Error: ${waResult.error}` };
    }

    return { success: true };
  },

  async sendAdminApprovalNotifications(bookingId: string, testSource: 'vercel' | 'flyio' = 'vercel') {
    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['payment_success_whatsapp_enabled']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, error: 'Settings fetch failed' };
    }

    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};
    const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled';
    if (!whatsappEnabled) {
      return { success: false, error: 'WhatsApp notifications disabled' };
    }

    const docTypes = ['invoice_paid', 'booking_confirmation'];
    const pdfUrls: { url: string, name: string }[] = [];
    const failedDocs: string[] = [];

    for (const type of docTypes) {
      try {
        if (testSource === 'flyio') {
          const apiUrl = await this.resolveWhatsAppApiUrl();
          if (!apiUrl) throw new Error("WhatsApp API URL not configured for Fly.io test");
          
          console.log(`Generating ${type} via Fly.io...`);
          const response = await fetch(`${apiUrl}/api/generate-pdf/${booking.booking_id}/${type}`);
          if (!response.ok) {
            throw new Error(`Fly.io generation failed: ${response.statusText}`);
          }
          
          const fileName = `${type}_${booking.booking_id}.pdf`;
          const storagePath = `generated-docs/${booking.booking_id}/${fileName}`;
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath);
          
          pdfUrls.push({
            url: publicUrl,
            name: fileName
          });
        } else {
          const result = await generateAndSavePDF(booking.booking_id, type);
          pdfUrls.push({
            url: result.publicUrl,
            name: `${type.replace(/_/g, '-')}-${booking.booking_reference}.pdf`
          });
        }
      } catch (e) {
        console.error(`Error generating ${type} via ${testSource}:`, e);
        failedDocs.push(type);
      }
    }

    if (failedDocs.length > 0) {
      return { success: false, error: `Failed to generate via ${testSource}: ${failedDocs.join(', ')}` };
    }

    const message = `Admin approved booking (${testSource.toUpperCase()} TEST).\n\n${this.formatBookingDetailsText(booking)}`;
    const waResult = await this.sendWhatsApp(booking, message, pdfUrls.map(p => p.url));
    if (!waResult.success) {
      return { success: false, error: `WhatsApp Error: ${waResult.error}` };
    }

    return { success: true };
  },

  async sendEmail(booking: any, templateId: string, pdfUrls: { url: string, name: string }[]) {
    try {
      console.log(`Sending email using template ${templateId}`);
      // Fetch template
      const { data: template, error: templateError } = await supabase
        .from('message_settings')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        console.error('Email template not found');
        return;
      }

      // Fetch Brevo Config (from email_settings_mission or fallback)
       const { data: emailConfig } = await supabase
          .from('email_settings_mission')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();

      if (!emailConfig) {
        console.error('No active email configuration found');
        return;
      }

      const apiKey = emailConfig.smtp_password; // Assuming this maps to Brevo API Key as per Settings.tsx logic
      const senderEmail = emailConfig.from_email;
      const senderName = emailConfig.from_name || 'One Day Pilot';

      // Replace variables
      let subject = template.subject;
      let content = template.message_content;

      AVAILABLE_VARIABLES.forEach(category => {
        category.vars.forEach(variable => {
          const value = getVariableValue(variable, booking);
          // Use a regex that escapes special characters in the variable name
          const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedVariable, 'g');
          subject = subject.replace(regex, value);
          content = content.replace(regex, value);
        });
      });

      // Prepare attachment if PDF exists
      const attachment = pdfUrls.length > 0 ? pdfUrls : undefined;

      // Send via Brevo API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: booking.customer.email, name: booking.customer.name }],
          subject: subject,
          htmlContent: content,
          attachment: attachment,
          cc: template.cc_emails && template.cc_emails.length > 0 
            ? template.cc_emails.map((email: string) => ({ email })) 
            : undefined
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo API error:', err);
        
        // Log failure to DB
        await supabase.from('notification_queue').insert({
          type: 'email',
          booking_id: booking.booking_id,
          email: booking.customer.email,
          subject: subject,
          message: `Template: ${template.template_name}`,
          status: 'failed',
          media_urls: pdfUrls.map(p => p.url),
          error_message: JSON.stringify(err)
        });
        return { success: false, error: JSON.stringify(err) };
      } else {
        const data = await response.json();
        console.log('Email sent successfully', data);
        
        // Log success to DB
        await supabase.from('notification_queue').insert({
          type: 'email',
          booking_id: booking.booking_id,
          email: booking.customer.email,
          subject: subject,
          message: `Template: ${template.template_name}`,
          status: 'completed',
          media_urls: pdfUrls.map(p => p.url),
          error_message: data.messageId ? `Message ID: ${data.messageId}` : undefined
        });
        return { success: true };
      }

    } catch (e: any) {
      console.error('Error sending email:', e);
      // Log exception to DB
      try {
        await supabase.from('notification_queue').insert({
          type: 'email',
          booking_id: booking.booking_id,
          email: booking.customer?.email || 'unknown',
          subject: 'Error sending email',
          message: 'Error occurred before sending',
          status: 'failed',
          error_message: e.message
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
      return { success: false, error: e.message };
    }
  },

  async sendTestEmail(emailConfig: any, toEmail: string) {
    try {
      console.log(`Sending test email to ${toEmail}`);
      
      const apiKey = emailConfig.api_key;
      const senderEmail = emailConfig.from_email;
      const senderName = emailConfig.from_name || 'One Day Pilot';
      const subject = 'Test Email from One Day Pilot';
      const content = '<h1>Test Email</h1><p>This is a test email to verify your Brevo configuration.</p>';

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail, name: 'Test User' }],
          subject: subject,
          htmlContent: content
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo API error:', err);
        
        // Log failure to DB
        await supabase.from('notification_queue').insert({
          type: 'email',
          email: toEmail,
          subject: subject,
          message: 'Test Email',
          status: 'failed',
          error_message: JSON.stringify(err)
        });
        
        return { success: false, error: JSON.stringify(err) };
      } else {
        const data = await response.json();
        console.log('Test email sent successfully', data);
        
        // Log success to DB
        await supabase.from('notification_queue').insert({
          type: 'email',
          email: toEmail,
          subject: subject,
          message: 'Test Email',
          status: 'completed',
          error_message: data.messageId ? `Message ID: ${data.messageId}` : undefined
        });
        
        return { success: true, messageId: data.messageId };
      }
    } catch (e: any) {
      console.error('Error sending test email:', e);
      
      // Log exception to DB
      try {
        await supabase.from('notification_queue').insert({
          type: 'email',
          email: toEmail,
          subject: 'Test Email Error',
          message: 'Error occurred before sending',
          status: 'failed',
          error_message: e.message
        });
      } catch (logError) {
        console.error('Failed to log test email error:', logError);
      }
      
      return { success: false, error: e.message };
    }
  },

  formatWhatsAppMessage(booking: any, templateMessage: string) {
    let message = templateMessage;
    AVAILABLE_VARIABLES.forEach(category => {
      category.vars.forEach(variable => {
        const value = getVariableValue(variable, booking);
        const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedVariable, 'g');
        message = message.replace(regex, value);
      });
    });
    return message;
  },

  async resolveWhatsAppApiUrl() {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_api_url')
        .maybeSingle();
      return data?.value || import.meta.env.VITE_WHATSAPP_API_URL || '';
    } catch (e) {
      return import.meta.env.VITE_WHATSAPP_API_URL || '';
    }
  },

  async sendWhatsAppViaApi(booking: any, templateMessage: string, pdfUrls: string[]) {
    const apiUrl = await this.resolveWhatsAppApiUrl();
    if (!apiUrl) {
      return { success: false, error: 'WhatsApp API URL not configured' };
    }
    const message = this.formatWhatsAppMessage(booking, templateMessage);
    try {
      const response = await fetch(`${apiUrl}/api/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: booking.customer.phone,
          message,
          mediaUrls: pdfUrls
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return { success: false, error: errorBody.error || 'WhatsApp API error' };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async sendWhatsApp(booking: any, templateMessage: string, pdfUrls: string[]) {
    // 1. Try to use Edge Function to avoid CORS and RLS issues
    try {
      console.log('Attempting to send via Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('send-booking-notification', {
        body: { 
          booking_id: booking.booking_id,
          custom_message: this.formatWhatsAppMessage(booking, templateMessage),
          pdf_urls: pdfUrls
        }
      });

      if (!error) {
        console.log('Edge Function notification triggered successfully');
        return { success: true };
      }
      
      console.error('Edge Function failed, falling back to direct API:', error);
      
      // 2. Fallback: Direct API
      return await this.sendWhatsAppViaApi(booking, templateMessage, pdfUrls);
      
    } catch (e: any) {
      console.error('Edge Function call error, falling back to direct API:', e);
      // Fallback: Direct API
      return await this.sendWhatsAppViaApi(booking, templateMessage, pdfUrls);
    }
  },

  async queueWhatsApp(booking: any, templateMessage: string, pdfUrls: string[]) {
    try {
      console.log('Queueing WhatsApp message');
      const message = this.formatWhatsAppMessage(booking, templateMessage);

      const { error } = await supabase
        .from('notification_queue')
        .insert({
          phone: booking.customer.phone,
          message: message,
          media_urls: pdfUrls, // Use media_urls array column
          status: 'pending',
          attempts: 0,
          type: 'whatsapp',
          booking_id: booking.booking_id
        });

      if (error) throw error;
      console.log('WhatsApp message queued');
      return { success: true };

    } catch (e: any) {
      console.error('Error queueing WhatsApp:', e);
      return { success: false, error: e.message };
    }
  },
  async triggerReminderTest(bookingId: string) {
    const apiUrl = await this.resolveWhatsAppApiUrl();
    if (!apiUrl) {
      return { success: false, error: 'WhatsApp API URL not configured' };
    }

    try {
      const response = await fetch(`${apiUrl}/api/test-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookingId })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return { success: false, error: errorBody.error || 'Reminder test failed' };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};
