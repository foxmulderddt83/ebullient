import nodemailerMock from '../lib/nodemailer-mock';
import sendgridMock from '../lib/sendgrid-mock';

// Use mock implementations in browser environment
const nodemailer = nodemailerMock;
const sgMail = sendgridMock;

interface EmailAccount {
  email: string;
  brevoApiKey: string;
  provider: 'brevo';
}

interface EmailSendResult {
  success: boolean;
  message: string;
  recipient?: string;
  account?: string;
}



// Brevo API configuration
const BREVO_API_CONFIG = {
  host: 'Brevo API',
  port: 'HTTPS',
  method: 'REST API'
};

const API_BASE = import.meta.env.VITE_API_BASE || '';
// Resolve API base to avoid cross-origin to fly.dev when hosted
const resolveApiBase = (): string => {
  const envBase = import.meta.env.VITE_API_BASE;
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isHosted = !hostname.includes('localhost');
      const isFlyBackend = typeof envBase === 'string' && envBase.includes('fly.dev');
      if (isHosted && isFlyBackend) return '';
    }
  } catch (_) {}
  return envBase || '';
};

// Send actual email using backend API
function sendRealEmail(
  account: EmailAccount,
  recipient: string,
  subject: string,
  message: string,
  attachments: string[]
): Promise<EmailSendResult> {
  return new Promise(async (resolve) => {
    try {
      // Use Brevo provider
      const provider = 'brevo';

      const response = await fetch(`${resolveApiBase()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailConfig: {
            email: account.email,
            brevoApiKey: account.brevoApiKey,
            provider: provider
          },
          emailData: {
            to: recipient,
            customerName: 'Customer',
            accountNumber: 'N/A',
            documentType: 'bulk_email',
            approvedAt: new Date().toISOString()
          },
          subject: subject,
          message: message,
          attachments: attachments
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        resolve({
          success: true,
          message: 'Email sent successfully',
          recipient,
          account: account.email
        });
      } else {
        resolve({
          success: false,
          message: result.error || 'Failed to send email',
          recipient,
          account: account.email
        });
      }
    } catch (error) {
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        recipient,
        account: account.email
      });
    }
  });
}

export class EmailSender {
  private static sendRealEmail = sendRealEmail;
}

export default EmailSender;