import { supabase } from "@/lib/supabase";
import { generateAndSavePDF, getVariableValue, AVAILABLE_VARIABLES, autoLinkHtml, formatFlightTime } from "@/lib/pdfGenerator";

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
      `Time: ${formatFlightTime(booking.flight_time)}`,
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
        booking_passengers(*),
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

  async sendAdminNewBookingNotification(bookingId: string) {
    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('key', 'contact_phone')
      .single();

    if (settingsError || !settingsData?.value) {
      console.error('Admin contact_phone not found');
      return { success: false, error: 'Admin contact_phone not found' };
    }

    const adminPhone = settingsData.value;
    const message = `🔔 *NEW BOOKING RECEIVED*\n\n${this.formatBookingDetailsText(booking)}\n\nStatus: ${booking.status}`;
    
    // Create a pseudo-booking object to pass the admin phone number to sendWhatsAppViaApi
    const adminBooking = {
      customer: { phone: adminPhone }
    };

    return await this.sendWhatsAppViaApi(adminBooking, message, []);
  },

  async sendPaymentSuccessNotifications(bookingId: string, textOnly: boolean = false) {
    // console.log(`Processing payment success notifications for booking ${bookingId}${textOnly ? ' (Text Only)' : ''}`);

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
            // console.log(`Generating PDF for type: ${type}`);
            // Fetch default template settings for this type to ensure backend matches preview
            const { data: defaultTemplate } = await supabase
              .from('document_templates')
              .select('id, orientation, page_size, margins')
              .eq('document_type', type)
              .eq('is_default', true)
              .maybeSingle();

            const result = await generateAndSavePDF(
              booking.booking_id, 
              type, 
              undefined, 
              defaultTemplate?.orientation || 'portrait',
              defaultTemplate?.page_size || 'A4',
              defaultTemplate?.margins || 'Normal',
              defaultTemplate?.id
            );
            pdfUrls.push({ 
              url: result.publicUrl, 
              name: `${type.replace(/_/g, '-')}-${booking.booking_reference}.pdf` 
            });
            // console.log('PDF generated:', result.publicUrl);
          } catch (e) {
            console.error(`PDF generation failed for ${type}:`, e);
          }
        }
      }
    } else {
      console.log('Skipping PDF generation as requested (textOnly=true)');
    }

    // 4. Send Email if configured
    const emailEnabled = settings['payment_success_email_enabled'] === 'true' || settings['payment_success_email_enabled'] === 'enabled';
    const emailTemplateId = settings['payment_success_email_template'];
    if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
      try {
        await this.sendEmail(booking, emailTemplateId, pdfUrls);
      } catch (e) {
        console.error('Failed to send payment success email:', e);
      }
    }

    // 5. Send WhatsApp if configured
    const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled' || settings['payment_success_whatsapp_enabled'] === 'true';
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
    // console.log(`Processing pending approval notifications for booking ${bookingId}`);
    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    // Fetch Post-Payment Settings as fallback/default
    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'payment_success_email_enabled',
        'payment_success_email_template',
        'payment_success_whatsapp_enabled',
        'whatsapp_template_payment_success',
        'payment_success_document_type'
      ]);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, error: 'Settings fetch failed' };
    }

    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};
    
    const emailEnabled = settings['payment_success_email_enabled'] === 'true';
    const emailTemplateId = settings['payment_success_email_template'];
    const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled';
    const whatsappTemplate = settings['whatsapp_template_payment_success'];

    const pdfUrls: { url: string, name: string }[] = [];
    
    // Generate PDFs if configured (QR Pay submission is a good time to generate them)
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
          // Fetch default template settings for this type to ensure backend matches preview
          const { data: defaultTemplate } = await supabase
            .from('document_templates')
            .select('id, orientation, page_size, margins')
            .eq('document_type', type)
            .eq('is_default', true)
            .maybeSingle();

          const result = await generateAndSavePDF(
            booking.booking_id, 
            type, 
            undefined, 
            defaultTemplate?.orientation || 'portrait',
            defaultTemplate?.page_size || 'A4',
            defaultTemplate?.margins || 'Normal',
            defaultTemplate?.id
          );
          
          pdfUrls.push({ 
            url: result.publicUrl, 
            name: `${type.replace(/_/g, '-')}-${booking.booking_reference}.pdf` 
          });
        } catch (e) {
          console.error(`PDF generation failed for ${type}:`, e);
        }
      }
    }

    // 1. Send Email if configured
    if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
      try {
        await this.sendEmail(booking, emailTemplateId, pdfUrls);
      } catch (e) {
        console.error('Failed to send pending approval email:', e);
      }
    }

    // 2. Send WhatsApp if configured
    if (whatsappEnabled) {
      // For pending, we use a custom prefix but allow the template to follow
      const baseMessage = whatsappTemplate 
        ? `*Booking Submitted (Pending Verification)*\n\n${whatsappTemplate}`
        : `Your booking is pending by admin approval.\n\n${this.formatBookingDetailsText(booking)}`;
      
      const message = this.formatWhatsAppMessage(booking, baseMessage);
      const waResult = await this.sendWhatsApp(booking, message, pdfUrls.map(p => p.url));
      if (!waResult.success) {
        return { success: false, error: `WhatsApp Error: ${waResult.error}` };
      }
    }

    return { success: true };
  },

  async sendRefundNotifications(bookingId: string, testSource: 'vercel' | 'flyio' = 'vercel', customDocTypes?: string[]) {
    return this.sendManualNotifications(bookingId, 'refund', testSource, customDocTypes);
  },

  async sendAdminApprovalNotifications(bookingId: string, testSource: 'vercel' | 'flyio' = 'vercel', customDocTypes?: string[]) {
    return this.sendManualNotifications(bookingId, 'approval', testSource, customDocTypes);
  },

  async sendManualNotifications(bookingId: string, actionType: 'approval' | 'refund', testSource: 'vercel' | 'flyio' = 'vercel', customDocTypes?: string[]) {
    const booking = await this.fetchBookingWithDetails(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    const prefix = actionType === 'approval' ? 'payment_approval' : 'payment_refund';
    const waTemplateKey = actionType === 'approval' ? 'whatsapp_template_approval' : 'whatsapp_template_refund';

    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        `${prefix}_whatsapp_enabled`,
        `${prefix}_email_enabled`,
        `${prefix}_email_template`,
        `${prefix}_document_type`,
        waTemplateKey
      ]);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, error: 'Settings fetch failed' };
    }

    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || {};
    const whatsappEnabled = settings[`${prefix}_whatsapp_enabled`] === 'true' || settings[`${prefix}_whatsapp_enabled`] === 'enabled';
    const emailEnabled = settings[`${prefix}_email_enabled`] === 'true';
    const emailTemplateId = settings[`${prefix}_email_template`];
    const whatsappTemplate = settings[waTemplateKey];

    const docTypes = (() => {
      if (Array.isArray(customDocTypes) && customDocTypes.length > 0) {
        return customDocTypes;
      }

      const rawDocType = settings[`${prefix}_document_type`];
      let parsed: string[] = [];
      if (rawDocType) {
        try {
          if (rawDocType.startsWith('[')) {
            const arr = JSON.parse(rawDocType);
            if (Array.isArray(arr)) {
              parsed = arr.map(String).filter(Boolean);
            }
          } else if (rawDocType !== 'none') {
            parsed = [rawDocType];
          }
        } catch (e) {
          parsed = [];
        }
      }

      if (parsed.length === 0) {
        return actionType === 'approval' ? ['invoice_paid', 'booking_confirmation'] : ['refund_voucher'];
      }

      return parsed;
    })();

    const shouldSendEmail = emailEnabled && !!emailTemplateId && emailTemplateId !== 'none';
    if (!whatsappEnabled && !shouldSendEmail) {
      return { success: false, error: 'Notifications disabled' };
    }

    const pdfUrls: { url: string, name: string }[] = [];
    const failedDocs: string[] = [];

    for (const type of docTypes) {
      try {
        // Fetch default template settings for this type to ensure backend matches preview
        const { data: defaultTemplate } = await supabase
          .from('document_templates')
          .select('id, orientation, page_size, margins')
          .eq('document_type', type)
          .eq('is_default', true)
          .maybeSingle();

        const orientation = defaultTemplate?.orientation || 'portrait';
        const pageSize = defaultTemplate?.page_size || 'A4';
        const margins = defaultTemplate?.margins || 'Normal';
        const templateId = defaultTemplate?.id;

        if (testSource === 'flyio') {
          const { url: apiUrl, token: apiToken } = await this.resolveWhatsAppApiConfig();
          if (!apiUrl) throw new Error("WhatsApp API URL not configured for Fly.io test");
          
          console.log(`Generating ${type} via Fly.io...`);
          const headers: Record<string, string> = {};
          if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
          }

          const response = await fetch(`${apiUrl}/api/generate-pdf/${booking.booking_id}/${type}`, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fly.io generation failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
          }
          
          const fileName = `${type}_${booking.booking_id}.pdf`;
          // The Fly.io backend generates and uploads to storage, so we just get the public URL
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`generated-docs/${booking.booking_id}/${fileName}`);
          
          pdfUrls.push({
            url: publicUrl,
            name: fileName
          });
        } else {
            const result = await generateAndSavePDF(booking.booking_id, type, undefined, orientation, pageSize, margins, templateId);
            pdfUrls.push({
              url: result.publicUrl,
              name: `${type.replace(/_/g, '-')}-${booking.booking_reference}.pdf`
            });
          }
      } catch (e: any) {
        console.error(`Error generating ${type} via ${testSource}:`, e);
        failedDocs.push(`${type} (${e.message})`);
      }
    }

    if (failedDocs.length > 0) {
      return { success: false, error: `Failed to generate via ${testSource}: ${failedDocs.join(', ')}` };
    }

    if (whatsappEnabled) {
      const message = this.formatWhatsAppMessage(booking, whatsappTemplate || `Admin ${actionType === 'approval' ? 'approved' : 'refunded'} booking.\n\n${this.formatBookingDetailsText(booking)}`);
      
      const waResult = await this.sendWhatsApp(booking, message, pdfUrls.map(p => p.url));
      if (!waResult.success) {
        return { success: false, error: `WhatsApp Error: ${waResult.error}` };
      }
    }

    if (shouldSendEmail) {
      try {
        const emailResult: any = await this.sendEmail(booking, emailTemplateId, pdfUrls);
        if (emailResult && emailResult.success === false) {
          return { success: false, error: `Email Error: ${emailResult.error || 'Failed to send email'}` };
        }
      } catch (e: any) {
        return { success: false, error: `Email Error: ${e?.message || 'Failed to send email'}` };
      }
    }

    return { success: true };
  },

  async sendEmail(booking: any, templateId: string, pdfUrls: { url: string, name: string }[]) {
    try {
      // console.log(`Sending email using template ${templateId}`);
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

      const recipientEmail = booking.customer?.email || booking.customer_email || booking.email;
      const recipientName = booking.customer?.name || booking.customer_name || booking.name || 'Customer';

      if (!recipientEmail) {
        const errorMsg = `Recipient email is missing for booking ${booking.booking_id || booking.booking_reference}. Cannot send email.`;
        console.error(errorMsg, booking);
        return { success: false, error: errorMsg };
      }

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

      return await this.sendGenericEmail({
        toEmail: recipientEmail,
        toName: recipientName,
        subject: subject,
        htmlContent: autoLinkHtml(content),
        attachments: pdfUrls.length > 0 ? pdfUrls : undefined,
        cc: template.cc_emails && template.cc_emails.length > 0 
          ? template.cc_emails.map((email: string) => ({ email })) 
          : undefined,
        bookingId: booking.booking_id,
        templateName: template.template_name
      });
    } catch (e: any) {
      console.error('sendEmail Error:', e);
      return { success: false, error: e.message || 'Unknown error' };
    }
  },

  async sendGenericEmail(options: {
    toEmail: string,
    toName: string,
    subject: string,
    htmlContent: string,
    attachments?: { url: string, name: string }[],
    cc?: { email: string }[],
    bookingId?: string,
    templateName?: string
  }) {
    try {
      // Fetch Brevo Config (from email_settings_mission or fallback)
      const { data: emailConfig } = await supabase
          .from('email_settings_mission')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();

      if (!emailConfig) {
        const errorMsg = 'No active email configuration found in email_settings_mission';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      const apiKey = emailConfig.smtp_password; // Assuming this maps to Brevo API Key as per Settings.tsx logic
      if (!apiKey) {
        const errorMsg = 'SMTP API Key (smtp_password) is missing in email configuration';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
      }
      const senderEmail = emailConfig.from_email;
      const senderName = emailConfig.from_name || 'One Day Pilot';

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
          to: [{ 
            email: options.toEmail, 
            name: options.toName 
          }],
          subject: options.subject,
          htmlContent: options.htmlContent,
          attachment: options.attachments,
          cc: options.cc
        })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo API error:', err);
        
        // Log failure to DB
        await supabase.from('notification_queue').insert({
          type: 'email',
          booking_id: options.bookingId,
          email: options.toEmail,
          subject: options.subject,
          message: options.templateName ? `Template: ${options.templateName}` : 'Generic Email',
          status: 'failed',
          media_urls: options.attachments ? options.attachments.map(p => p.url) : [],
          error_message: JSON.stringify(err)
        });

        return { success: false, error: err.message || 'Brevo API Error' };
      }

      // Log success to DB
      await supabase.from('notification_queue').insert({
        type: 'email',
        booking_id: options.bookingId,
        email: options.toEmail,
        subject: options.subject,
        message: options.templateName ? `Template: ${options.templateName}` : 'Generic Email',
        status: 'sent',
        media_urls: options.attachments ? options.attachments.map(p => p.url) : []
      });

      return { success: true };
    } catch (e: any) {
      console.error('sendGenericEmail Error:', e);
      return { success: false, error: e.message || 'Unknown error' };
    }
  },

  async sendTestEmail(emailConfig: any, toEmail: string) {
    try {
      console.log(`Sending test email to ${toEmail}`);
      
      const apiKey = emailConfig?.api_key || emailConfig?.smtp_password;
      const senderEmail = emailConfig?.from_email;
      const senderName = emailConfig?.from_name || 'One Day Pilot';
      
      if (!apiKey || !senderEmail) {
        return { success: false, error: 'Brevo configuration is missing (apiKey/from_email).' };
      }
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
        const value = getVariableValue(variable, booking, undefined, { format: 'text' });
        const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedVariable, 'g');
        message = message.replace(regex, value);
      });
    });
    return message;
  },

  async resolveWhatsAppApiConfig() {
    try {
      const { data: urlData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_api_url')
        .maybeSingle();
      
      const { data: tokenData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'api_auth_token')
        .maybeSingle();

      return {
        url: urlData?.value || import.meta.env.VITE_WHATSAPP_API_URL || '',
        token: tokenData?.value || import.meta.env.VITE_API_AUTH_TOKEN || ''
      };
    } catch (e) {
      return {
        url: import.meta.env.VITE_WHATSAPP_API_URL || '',
        token: import.meta.env.VITE_API_AUTH_TOKEN || ''
      };
    }
  },

  async sendWhatsAppViaApi(booking: any, templateMessage: string, pdfUrls: string[]) {
    const { url: apiUrl, token: apiToken } = await this.resolveWhatsAppApiConfig();
    if (!apiUrl) {
      return { success: false, error: 'WhatsApp API URL not configured' };
    }
    const message = this.formatWhatsAppMessage(booking, templateMessage);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch(`${apiUrl}/api/send-whatsapp`, {
        method: 'POST',
        headers,
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
    // Direct API call
    // console.log('Sending WhatsApp via direct API...');
    return await this.sendWhatsAppViaApi(booking, templateMessage, pdfUrls);
  },

  async triggerFlyioAutoNotification(bookingId: string) {
    const { url: apiUrl, token: apiToken } = await this.resolveWhatsAppApiConfig();
    if (!apiUrl) {
      return { success: false, error: 'WhatsApp API URL not configured' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      console.log(`[NOTIF] 🚀 Triggering Fly.io auto-notification for booking: ${bookingId}`);
      const response = await fetch(`${apiUrl}/api/trigger-notification`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ bookingId })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error(`[NOTIF] ❌ Fly.io trigger failed:`, errorBody.error);
        return { success: false, error: errorBody.error || 'Notification trigger failed' };
      }

      console.log(`[NOTIF] ✅ Fly.io notification trigger successful`);
      return { success: true };
    } catch (e: any) {
      console.error(`[NOTIF] ❌ Fly.io trigger exception:`, e.message);
      return { success: false, error: e.message };
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
    const { url: apiUrl, token: apiToken } = await this.resolveWhatsAppApiConfig();
    if (!apiUrl) {
      return { success: false, error: 'WhatsApp API URL not configured' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch(`${apiUrl}/api/test-reminder`, {
        method: 'POST',
        headers,
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
  },

  async broadcastUpdate(type: string, details: any = {}) {
    console.log(`📡 Initiating broadcast update: ${type}`, details);
    const { url: apiUrl, token: apiToken } = await this.resolveWhatsAppApiConfig();
    if (!apiUrl) {
      console.warn('❌ WebSocket broadcast failed: API URL not configured');
      return { success: false, error: 'API URL not configured' };
    }

    try {
      let currentUrl = apiUrl;
      if (currentUrl && !currentUrl.startsWith('http')) {
        currentUrl = `https://${currentUrl}`;
      }
      const cleanUrl = currentUrl.replace(/\/$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      console.log(`📤 Sending POST request to ${cleanUrl}/api/broadcast-update`);
      const response = await fetch(`${cleanUrl}/api/broadcast-update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, details })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('❌ WebSocket broadcast error response:', errorBody);
        return { success: false, error: errorBody.error || 'Broadcast failed' };
      }

      console.log(`✅ WebSocket broadcast successfully sent: ${type}`);
      return { success: true };
    } catch (e: any) {
      console.error('❌ WebSocket broadcast exception:', e);
      return { success: false, error: e.message };
    }
  }
};
