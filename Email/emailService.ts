// Email service for sending notifications
// Uses Brevo API for email delivery

import { supabase, TABLES } from '../lib/supabase';
import { EmailData, MonthlyPaymentData, FullSettlementData } from '../types';
import { TemplateParser } from '../utils/templateParser';
import { formatDate } from '../utils/dateFormatter';
import { getPdfLayoutStyles } from '../styles/pdfLayout';

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}



export interface EmailConfig {
  provider: 'brevo';
  email: string;
  brevoApiKey: string;
}

class EmailService {
  async saveEmailConfig(config: EmailConfig, userId: string): Promise<boolean> {
    try {
      // First, deactivate all existing configurations
      await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .update({ is_active: false })
        .eq('is_active', true);
      
      // Prepare the data object for Brevo provider
      const emailData: any = {
        user_id: userId,
        provider: config.provider,
        email: config.email,
        is_active: true,
        brevo_api_key: config.brevoApiKey,
        // Clear other provider fields
        mailgun_api_key: null,
        password: null,
        smtp_host: null,
        smtp_port: null
      };
      
      // Check if any active record exists
      const { data: existingConfig } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      
      let error;
      
      if (existingConfig) {
        // Update existing active record
        const result = await supabase
          .from(TABLES.EMAIL_SETTINGS)
          .update(emailData)
          .eq('id', existingConfig.id);
        error = result.error;
      } else {
        // Insert new record
        const result = await supabase
          .from(TABLES.EMAIL_SETTINGS)
          .insert(emailData);
        error = result.error;
      }
      
      if (error) {
        console.error('Error saving email config:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error saving email config:', error);
      return false;
    }
  }

  async getEmailConfig(userId?: string): Promise<EmailConfig | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading email config:', error);
        return null;
      }
      
      if (!data) {
        console.log('No active email configuration found');
        return null;
      }
      
      // Map fields to Brevo config
      const config: EmailConfig = {
        provider: data.provider,
        email: data.email,
        brevoApiKey: data.brevo_api_key || ''
      };

      
      return config;
    } catch (error) {
      console.error('Error loading email config:', error);
      return null;
    }
  }

  private getBrevoApiConfig(apiKey: string) {
    return {
      apiKey: apiKey,
      baseUrl: 'https://api.brevo.com/v3'
    };
  }

  private generateDocumentApprovedTemplate(data: EmailData): EmailTemplate {
    // Use custom subject from template if provided, otherwise use default
    const subject = data.subject || `Document Approved - Account ${data.accountNumber}`;
    
    // Use custom message content if provided, otherwise generate default HTML
    const htmlContent = data.messageContent ? 
      this.generateCustomMessageHtml(data.messageContent, data) : 
      this.generateDefaultDocumentHtml(data);
    
    const textContent = data.messageContent || `
Document Approved - Account ${data.accountNumber}

Dear ${data.customerName},

We are pleased to inform you that your document has been approved.

Document Details:
Account Number: ${data.accountNumber}
Document Type: ${data.documentType.replace('_', ' ')}
Approved Date: ${formatDate(data.approvedAt)}

Your document has been processed and is now available in your account. If you have any questions or need further assistance, please don't hesitate to contact our support team.

Thank you for your cooperation.

Best regards,
Debt Collection Team

---
This is an automated message. Please do not reply to this email.
If you need assistance, please contact our support team.
    `;

    return { subject, htmlContent, textContent };
  }

  private generateCustomMessageHtml(messageContent: string, data: EmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Document Notification</title>
        <style>
          ${getPdfLayoutStyles()}
          .email-container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; }
          .message-content { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="message-content">${messageContent}</div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDefaultDocumentHtml(data: EmailData): string {
    // Generate document HTML content based on document type
    const documentHtml = this.generateDocumentHtml(data);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Document Approved</title>
        <style>
          ${getPdfLayoutStyles()}
          .email-container { max-width: 800px; margin: 0 auto; background: white; }
          .document-content { background: white; padding: 32px; font-family: sans-serif; font-size: 14px; line-height: 1.5; max-width: 1024px; margin: 0 auto; }
          .highlight { background-color: #fef3c7; padding: 8px; font-weight: bold; }
          .bg-yellow-50 { background-color: #fffbeb; padding: 16px; border-radius: 4px; border-left: 4px solid #f59e0b; }
          .bg-red-50 { background-color: #fef2f2; padding: 16px; border-radius: 4px; border-left: 4px solid #ef4444; }
          .space-y-4 > * + * { margin-top: 16px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .ml-8 { margin-left: 32px; }
          .mb-2 { margin-bottom: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .mb-6 { margin-bottom: 24px; }
          .mb-8 { margin-bottom: 32px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .underline { text-decoration: underline; }
          .italic { font-style: italic; }
          .text-xs { font-size: 12px; }
          .text-sm { font-size: 14px; }
          .text-base { font-size: 16px; }
          .text-lg { font-size: 18px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; text-align: center; }
          th { background-color: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="email-container">
          ${documentHtml}
        </div>
      </body>
      </html>
    `;
  }

  private generateDocumentHtml(data: EmailData): string {
    const documentData = data.documentData;
    
    if (!documentData) {
      return '<div class="document-content"><p>Document content not available.</p></div>';
    }
    
    const company = documentData.company || 'AEON';
    const userPhone = documentData.staffPhone;

    if (data.documentType === 'monthly_payment') {
      const dataWithDocumentFields = {
        ...documentData as MonthlyPaymentData,
        name: data.documentName,
        phone: data.documentPhone
      };
      return TemplateParser.parseMonthlyPaymentTemplate(
        dataWithDocumentFields,
        company,
        undefined, // topBannerBase64
        undefined, // bottomBannerBase64
        userPhone
      );
    } else if (data.documentType === 'full_settlement') {
      const dataWithDocumentFields = {
        ...documentData as FullSettlementData,
        name: data.documentName,
        phone: data.documentPhone
      };
      return TemplateParser.parseFullSettlementTemplate(
        dataWithDocumentFields,
        company,
        undefined, // topBannerBase64
        undefined, // bottomBannerBase64
        userPhone
      );
    }

    return '<div class="document-content"><p>Document content not available.</p></div>';
  }





  private async sendBrevoEmail(config: EmailConfig, template: EmailTemplate, to: string, cc?: string[], pdfAttachment?: { filename: string; content: Blob }): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // Use Brevo API instead of SMTP
      const apiKey = (config.brevoApiKey || '').trim();
      if (!apiKey) {
        return { success: false, error: 'Brevo API key is required' };
      }

      const emailData: any = {
        sender: { name: 'Debt Collection Team', email: config.email },
        to: [{ email: to }],
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent
      };
      
      // Add CC recipients if provided
      if (cc && cc.length > 0) {
        emailData.cc = cc.map((email: string) => ({ email }));
      }
      
      // Add PDF attachment if provided
      if (pdfAttachment) {
        // Check PDF size before processing (25MB limit for most email providers)
        const maxSizeBytes = 15 * 1024 * 1024; // 15MB to account for base64 encoding overhead
        if (pdfAttachment.content.size > maxSizeBytes) {
          console.error('PDF attachment too large:', pdfAttachment.content.size, 'bytes. Maximum allowed:', maxSizeBytes, 'bytes');
          return { success: false, error: `PDF attachment is too large (${(pdfAttachment.content.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB.` };
        }
        
        const arrayBuffer = await pdfAttachment.content.arrayBuffer();
        // Use a more efficient base64 encoding to avoid stack overflow with large files
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        const chunkSize = 8192; // Process in chunks to avoid stack overflow
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Content = btoa(binaryString);
        console.log('PDF attachment size:', pdfAttachment.content.size, 'bytes, Base64 size:', base64Content.length, 'characters');
        
        emailData.attachment = [{
          name: pdfAttachment.filename,
          content: base64Content
        }];
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('=== BREVO API EMAIL SENT ===>'); 
        console.log('To:', to);
        console.log('From:', config.email);
        console.log('Subject:', template.subject);
        console.log('Message ID:', result.messageId);
        console.log('Status: Success');
        console.log('========================');
        
        return { success: true, messageId: result.messageId };
      } else {
        const errorData = await response.json();
        console.error('Brevo API error:', errorData);
        return { success: false, error: `Brevo API error: ${errorData.message || errorData.error || 'Unknown error'}` };
      }

    } catch (error) {
      console.error('Error sending Brevo API email:', error);
      return { success: false, error: `Failed to send email via Brevo API: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }



  async sendDocumentApprovedEmail(data: EmailData): Promise<boolean> {
    try {
      console.log('=== EMAIL SERVICE: Starting sendDocumentApprovedEmail ===');
      console.log('Email data received:', {
        to: data.to,
        subject: data.subject,
        attachments: data.attachments?.map(att => ({ 
          filename: att.filename, 
          hasContent: !!(att as any).content,
          hasPath: !!(att as any).path 
        }))
      });
      
      const emailConfig = await this.getEmailConfig();
      if (!emailConfig) {
        console.warn('No active email configuration found. Email not sent.');
        return false;
      }

      const template = this.generateDocumentApprovedTemplate(data);
      
      // Check for PDF attachment
      let pdfAttachment: { filename: string; content: Blob } | undefined;
      console.log('Checking for attachments...');
      if (data.attachments && data.attachments.length > 0) {
        console.log('Found attachments:', data.attachments.length);
        const attachment = data.attachments[0] as any;
        
        // Check if attachment has content (blob) directly
        if (attachment.content && attachment.content instanceof Blob) {
          console.log('Using PDF blob directly, size:', attachment.content.size, 'bytes');
          pdfAttachment = {
            filename: attachment.filename,
            content: attachment.content
          };
          console.log('PDF attachment prepared for email:', attachment.filename);
        } else if (attachment.path) {
          // Fallback: fetch from URL if path is provided
          try {
            console.log('Attempting to fetch PDF from URL:', attachment.path);
            const pdfResponse = await fetch(attachment.path);
            console.log('PDF fetch response status:', pdfResponse.status, pdfResponse.statusText);
            
            if (pdfResponse.ok) {
              const pdfBlob = await pdfResponse.blob();
              console.log('PDF blob size:', pdfBlob.size, 'bytes');
              pdfAttachment = {
                filename: attachment.filename,
                content: pdfBlob
              };
              console.log('PDF attachment prepared for email:', attachment.filename);
            } else {
              console.error('Failed to fetch PDF attachment from URL:', attachment.path);
              console.error('Response status:', pdfResponse.status, pdfResponse.statusText);
              console.error('Email will not be sent due to PDF attachment failure');
              return false;
            }
          } catch (fetchError) {
            console.error('Error fetching PDF attachment:', fetchError);
            console.error('Email will not be sent due to PDF attachment failure');
            return false;
          }
        } else {
          console.error('Attachment has neither content blob nor path');
          console.error('Email will not be sent due to invalid attachment');
          return false;
        }
      } else {
        console.log('No attachments found in email data');
      }
      
      // Use Brevo API
      const result = await this.sendBrevoEmail(emailConfig, template, data.to, data.cc, pdfAttachment);
      return result.success;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Method to test email configuration
  async testEmailConfiguration(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate required fields
      if (!config.email || !config.provider) {
        return { success: false, error: 'Email and provider are required' };
      }

      // Validate Brevo API key
      if (!config.brevoApiKey) {
        return { success: false, error: 'Brevo API key is required' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error testing email configuration:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Method to get active email configuration for admin dashboard
  async getActiveEmailConfig(userId?: string): Promise<EmailConfig | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading active email config:', error);
        return null;
      }
      
      if (!data) {
        console.log('No active email configuration found');
        return null;
      }
      
      // Map fields to Brevo config
      const config: EmailConfig = {
        provider: data.provider,
        email: data.email,
        brevoApiKey: data.brevo_api_key || ''
      };
      
      return config;
    } catch (error) {
      console.error('Error loading active email config:', error);
      return null;
    }
  }

  // Method to test email service with specific configuration and recipient
  async testEmailService(config: EmailConfig, testEmail: string, subject?: string, message?: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('=== TEST EMAIL SERVICE STARTED ===');
      console.log('Config:', {
        provider: config.provider,
        email: config.email,
        hasApiKey: !!config.brevoApiKey,
        apiKeyLength: config.brevoApiKey?.length || 0
      });
      console.log('Test Email Recipient:', testEmail);
      console.log('Subject:', subject || 'Test Email - Brevo API Configuration');
      console.log('Custom Message:', message || 'None');
      
      const testTemplate: EmailTemplate = {
        subject: subject || 'Test Email - Brevo API Configuration',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">Brevo API Test</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666;">This is a test email to verify your Brevo API configuration.</p>
              ${message ? `<p style="margin: 10px 0 0 0; color: #333; font-weight: bold;">Custom Message:</p><p style="margin: 5px 0 0 0; color: #666;">${message}</p>` : ''}
            </div>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">Sent from Debt Management System via Brevo API</p>
            </div>
          </div>
        `,
        textContent: `Brevo API Test\n\nThis is a test email to verify your Brevo API configuration.${message ? `\n\nCustom Message: ${message}` : ''}\n\nSent from Debt Management System via Brevo API`
      };

      console.log('Template created, calling sendBrevoEmail...');
      
      // Use Brevo API
      const result = await this.sendBrevoEmail(config, testTemplate, testEmail);
      
      console.log('sendBrevoEmail result:', result);
      console.log('=== TEST EMAIL SERVICE COMPLETED ===');
      
      return result;
    } catch (error) {
      console.error('=== ERROR IN TEST EMAIL SERVICE ===');
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('=== END ERROR LOG ===');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Method to test email service using active configuration
  async testActiveEmailService(testEmail: string, subject?: string, message?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const activeConfig = await this.getActiveEmailConfig();
      if (!activeConfig) {
        return { success: false, error: 'No active email configuration found' };
      }
      
      return await this.testEmailService(activeConfig, testEmail, subject, message);
    } catch (error) {
      console.error('Error testing active email service:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Method to send scheduler emails with PDF attachments using active configuration
  async sendSchedulerEmail(
    schedulerId: string | undefined,
    recipientEmail: string, 
    subject: string, 
    message: string, 
    pdfAttachment?: { filename: string; content: Blob },
    ccEmails?: string[]
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      console.log('=== SCHEDULER EMAIL SERVICE STARTED ===');
      console.log('Scheduler ID:', schedulerId);
      console.log('Recipient:', recipientEmail);
      console.log('Subject:', subject);
      console.log('Has PDF Attachment:', !!pdfAttachment);
      
      const activeConfig = await this.getActiveEmailConfig();
      if (!activeConfig) {
        return { success: false, error: 'No active email configuration found' };
      }
      
      // Preserve paragraph formatting similar to DynamicDataTable: escape HTML and convert newlines to <br/>
      const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const messageHtml = escapeHtml(message || '').replace(/\r\n|\n/g, '<br/>');
      
      const emailTemplate: EmailTemplate = {
        subject: subject,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;"> </h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <div style="white-space: pre-wrap; color: #666;">${messageHtml}</div>
              ${pdfAttachment ? '<p style="margin: 10px 0 0 0; color: #333; font-weight: bold;">Please find the document attached to this email.</p>' : ''}
            </div>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">Sent from Scheduler System</p>
            </div>
          </div>
        `,
        textContent: `Dear Recipient,\n\n${message}\n\n${pdfAttachment ? 'Please find the document attached to this email.\n\n' : ''}Sent from Scheduler System`
      };

      console.log('Template created, calling sendBrevoEmail...');
      
      // Use Brevo API with or without PDF attachment, propagate CC
      const result = await this.sendBrevoEmail(activeConfig, emailTemplate, recipientEmail, ccEmails || [], pdfAttachment);
      
      console.log('sendBrevoEmail result:', result);

      // Log into email_delivery_events table
      try {
        const nowIso = new Date().toISOString();
        if (result.success) {
          await supabase
            .from('email_delivery_events')
            .insert({
              scheduler_id: schedulerId || null,
              recipient_email: recipientEmail,
              subject: subject,
              status: 'sent',
              message_id: result.messageId || null,
              sent_at: nowIso,
              created_at: nowIso
            });
        } else {
          await supabase
            .from('email_delivery_events')
            .insert({
              scheduler_id: schedulerId || null,
              recipient_email: recipientEmail,
              subject: subject,
              status: 'failed',
              error_message: result.error || 'Unknown error',
              created_at: nowIso
            });
        }
      } catch (logErr) {
        console.warn('Failed to insert email_delivery_events:', logErr);
      }

      console.log('=== SCHEDULER EMAIL SERVICE COMPLETED ===');
      
      return result;
    } catch (error) {
      console.error('=== ERROR IN SCHEDULER EMAIL SERVICE ===');
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Attempt to log failure
      try {
        await supabase
          .from('email_delivery_events')
          .insert({
            scheduler_id: null,
            recipient_email: recipientEmail,
            subject: subject,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            created_at: new Date().toISOString()
          });
      } catch (_) {}

      console.error('=== END ERROR LOG ===');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }



  // Method to get pending emails
  getPendingEmails(): any[] {
    try {
      return JSON.parse(localStorage.getItem('pendingEmails') || '[]');
    } catch (error) {
      console.error('Error loading pending emails:', error);
      return [];
    }
  }

  // Method to clear pending emails
  clearPendingEmails(): void {
    localStorage.removeItem('pendingEmails');
  }

  // Method to store pending emails
  private storePendingEmail(emailData: any): void {
    try {
      const pendingEmails = JSON.parse(localStorage.getItem('pendingEmails') || '[]');
      pendingEmails.push({
        ...emailData,
        status: 'pending'
      });
      localStorage.setItem('pendingEmails', JSON.stringify(pendingEmails));
    } catch (error) {
      console.error('Error storing pending email:', error);
    }
  }

  // Method to get all email settings
  async getAllEmailSettings(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading all email settings:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error loading all email settings:', error);
      return [];
    }
  }

  // Method to set active email configuration
  async setActiveEmailConfig(configId: string): Promise<boolean> {
    try {
      // First, deactivate all configurations
      const { error: deactivateError } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .update({ is_active: false })
        .gte('created_at', '1900-01-01'); // This ensures we update all records
      
      if (deactivateError) {
        console.error('Error deactivating all email configs:', deactivateError);
        return false;
      }
      
      // Then activate the selected configuration
      const { error: activateError } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .update({ is_active: true })
        .eq('id', configId);
      
      if (activateError) {
        console.error('Error setting active email config:', activateError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error setting active email config:', error);
      return false;
    }
  }

  // Method to delete email configuration
  async deleteEmailConfig(configId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .delete()
        .eq('id', configId);
      
      if (error) {
        console.error('Error deleting email config:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting email config:', error);
      return false;
    }
  }

  // Method to get daily email usage for a specific email configuration
  async getDailyEmailUsage(configId: string): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // Get email config to find the sender email
      const { data: config } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('email')
        .eq('id', configId)
        .single();

      if (!config) return 0;

      // Count emails sent today from this email configuration
      const { data, error } = await supabase
        .from('email_tracking_mission')
        .select('id', { count: 'exact' })
        .eq('sender_email', config.email)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString());

      if (error) {
        console.error('Error fetching daily email usage:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error in getDailyEmailUsage:', error);
      return 0;
    }
  }

  // Method to get monthly email usage for a specific email configuration
  async getMonthlyEmailUsage(configId: string): Promise<number> {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Get email config to find the sender email
      const { data: config } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('email')
        .eq('id', configId)
        .single();

      if (!config) return 0;

      // Count emails sent this month from this email configuration
      const { data, error } = await supabase
        .from('email_tracking_mission')
        .select('id', { count: 'exact' })
        .eq('sender_email', config.email)
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', endOfMonth.toISOString());

      if (error) {
        console.error('Error fetching monthly email usage:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error in getMonthlyEmailUsage:', error);
      return 0;
    }
  }

  // Method to get email limits and usage for a specific configuration
  async getEmailLimitsAndUsage(configId: string): Promise<{
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsage: number;
    monthlyUsage: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    brevoMonthlyRemaining?: number;
    brevoPlanName?: string;
  }> {
    try {
      // Get email configuration
      const { data: config } = await supabase
        .from(TABLES.EMAIL_SETTINGS)
        .select('*')
        .eq('id', configId)
        .single();

      if (!config) {
        return {
          dailyLimit: 0,
          monthlyLimit: 0,
          dailyUsage: 0,
          monthlyUsage: 0,
          dailyRemaining: 0,
          monthlyRemaining: 0
        };
      }

      // Defaults (fallback if Brevo account info is unavailable)
      let dailyLimit = 300; // default daily limit
      let monthlyLimit = 9000; // default monthly limit

      // Get actual usage from tracking table
      const dailyUsage = await this.getDailyEmailUsage(configId);
      const monthlyUsage = await this.getMonthlyEmailUsage(configId);

      // Try to fetch dynamic limits from Brevo account via server-side proxy
      let brevoMonthlyRemaining: number | undefined;
      let brevoPlanName: string | undefined;
      try {
        const apiKey: string | undefined = (config.brevo_api_key || config.brevoApiKey || '').trim();
        if (apiKey) {
          const resp = await fetch('/api/brevo-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brevoApiKey: apiKey })
          });
          if (resp.ok) {
            const account = await resp.json();
            // Attempt to infer remaining monthly credits from various possible shapes
            const credits = account?.credits || account?.plan?.credits || account?.data?.credits || null;
            const emailCredits = credits?.emails || credits?.email || credits?.smtp || null;
            const available = typeof emailCredits?.available === 'number' ? emailCredits.available
              : (typeof emailCredits?.remaining === 'number' ? emailCredits.remaining : undefined);
            if (typeof available === 'number' && available >= 0) {
              brevoMonthlyRemaining = available;
            }
            // Attempt to infer plan name from various possible shapes
            brevoPlanName = account?.plan?.type || account?.plan?.name || account?.plan?.planType 
              || account?.data?.plan?.type || account?.data?.plan?.name || account?.data?.plan?.planType;
          } else {
            // Non-200 response; keep fallbacks
            // Optionally log in development
            console.warn('brevo-account endpoint returned non-OK status:', resp.status);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Brevo account info:', e);
      }

      // If we were able to determine monthly remaining from Brevo, adjust monthly limit accordingly
      if (typeof brevoMonthlyRemaining === 'number') {
        // Set monthly limit so that remaining = brevoMonthlyRemaining
        monthlyLimit = monthlyUsage + brevoMonthlyRemaining;
        // Cap daily limit by remaining monthly credits when near depletion
        const dailyRemainingByMonthly = Math.max(0, monthlyLimit - monthlyUsage);
        dailyLimit = Math.max(dailyUsage, Math.min(dailyLimit, dailyUsage + dailyRemainingByMonthly));
      }

      return {
        dailyLimit,
        monthlyLimit,
        dailyUsage,
        monthlyUsage,
        dailyRemaining: Math.max(0, dailyLimit - dailyUsage),
        monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsage),
        brevoMonthlyRemaining,
        brevoPlanName
      };
    } catch (error) {
      console.error('Error in getEmailLimitsAndUsage:', error);
      return {
        dailyLimit: 0,
        monthlyLimit: 0,
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyRemaining: 0,
        monthlyRemaining: 0
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;