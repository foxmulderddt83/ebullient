import { supabase } from '../lib/supabase';
import { emailService } from './emailService';

export interface EmailTrackingRecord {
  id: string;
  scheduler_id: string;
  recipient_email: string;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'spam';
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  error_message?: string;
  retry_count: number;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export interface EmailTrackingStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  bounceRate: number;
}

class EmailTrackingService {
  // Get recent email activities (latest 15)
  async getRecentActivities(limit: number = 15): Promise<EmailTrackingRecord[]> {
    try {
      const { data, error } = await supabase
        .from('email_tracking_mission')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent email activities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentActivities:', error);
      return [];
    }
  }

  // Get all email tracking records with optional filters
  async getAllEmailTracking(filters?: {
    status?: string;
    dateRange?: 'today' | 'week' | 'month' | 'all';
    searchTerm?: string;
  }): Promise<EmailTrackingRecord[]> {
    try {
      let query = supabase
        .from('email_tracking_mission')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply date range filter
      if (filters?.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply search filter
      if (filters?.searchTerm) {
        query = query.or(`recipient_email.ilike.%${filters.searchTerm}%,subject.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching email tracking records:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllEmailTracking:', error);
      return [];
    }
  }

  // Get email tracking statistics
  async getEmailStats(dateRange?: 'today' | 'week' | 'month' | 'all'): Promise<EmailTrackingStats> {
    try {
      let query = supabase
        .from('email_tracking_mission')
        .select('status');

      // Apply date range filter
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching email stats:', error);
        return {
          total: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0,
          pending: 0,
          deliveryRate: 0,
          bounceRate: 0
        };
      }

      const records: Array<{ status: EmailTrackingRecord['status'] }> = (data as Array<{ status: EmailTrackingRecord['status'] }>) || [];
      const total = records.length;
      const sent = records.filter(r => ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(r.status)).length;
      const delivered = records.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length;
      const opened = records.filter(r => ['opened', 'clicked'].includes(r.status)).length;
      const clicked = records.filter(r => r.status === 'clicked').length;
      const bounced = records.filter(r => r.status === 'bounced').length;
      const failed = records.filter(r => r.status === 'failed').length;
      const pending = records.filter(r => r.status === 'pending').length;

      return {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
        pending,
        deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
        bounceRate: sent > 0 ? (bounced / sent) * 100 : 0
      };
    } catch (error) {
      console.error('Error in getEmailStats:', error);
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        bounceRate: 0
      };
    }
  }

  // Purge records older than N months from today (default: 3)
  async purgeOlderThanMonths(months: number = 3): Promise<{ deletedCount: number; error?: string }> {
    try {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - Math.max(1, months));
      const cutoffIso = cutoff.toISOString();

      // Count candidates (head-only) for reporting
      const { count: preCount, error: countError } = await supabase
        .from('email_tracking_mission')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoffIso);

      if (countError) {
        console.warn('Purge count error:', countError);
      }

      // Perform deletion
      const { error } = await supabase
        .from('email_tracking_mission')
        .delete()
        .lt('created_at', cutoffIso);

      if (error) {
        console.error('Error purging old email tracking records:', error);
        return { deletedCount: 0, error: error.message };
      }

      const deletedCount = typeof preCount === 'number' ? preCount : 0;
      return { deletedCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Unexpected purge error:', err);
      return { deletedCount: 0, error: message };
    }
  }

  // Get chart data for analytics
  async getChartData(days: number = 7): Promise<Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>> {
    try {
      const chartData = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('email_tracking_mission')
          .select('status')
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());

        if (error) {
          console.error('Error fetching chart data for date:', date, error);
          continue;
        }

        const records: Array<{ status: EmailTrackingRecord['status'] }> = (data as Array<{ status: EmailTrackingRecord['status'] }>) || [];
        chartData.push({
          date: date.toISOString().split('T')[0],
          sent: records.filter(r => ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(r.status)).length,
          delivered: records.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length,
          opened: records.filter(r => ['opened', 'clicked'].includes(r.status)).length,
          clicked: records.filter(r => r.status === 'clicked').length,
          bounced: records.filter(r => r.status === 'bounced').length
        });
      }

      return chartData;
    } catch (error) {
      console.error('Error in getChartData:', error);
      return [];
    }
  }

  // Fetch Brevo SMTP events via backend proxy (with direct Brevo fallback for preview/no-backend)
  async getBrevoEvents(filters?: {
    days?: number;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    limit?: number;
    offset?: number;
    email?: string;
    event?: string;
    tags?: string; // comma-separated
    messageId?: string;
    templateId?: number;
    sort?: 'asc' | 'desc';
    brevoApiKey?: string; // optional override
  }): Promise<{ success: boolean; data?: any; error?: string }>{
    try {
      // Resolve API base similar to emailSender patterns
      const envBase = import.meta.env.VITE_API_BASE || '';
      let apiBase = envBase;
      try {
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          const isHosted = !hostname.includes('localhost');
          const isFlyBackend = typeof envBase === 'string' && envBase.includes('fly.dev');
          if (isHosted && isFlyBackend) {
            apiBase = '';
          }
        }
      } catch (_) {}

      // Determine API key
      let apiKey = (filters && filters.brevoApiKey) ? filters.brevoApiKey : '';
      if (!apiKey) {
        const cfg = await emailService.getActiveEmailConfig();
        apiKey = (cfg?.brevoApiKey || '').trim();
      }
      // Fallback to environment variable in preview/local if DB config not available
      if (!apiKey) {
        const envKey = (import.meta as any)?.env?.VITE_BREVO_API_KEY || '';
        if (typeof envKey === 'string' && envKey.trim()) {
          apiKey = envKey.trim();
        }
      }
      if (!apiKey) {
        return { success: false, error: 'Brevo API key is not configured' };
      }

      // Try backend proxy first if available
      const body: any = { filters: { ...filters }, brevoApiKey: apiKey };
      const backendUrl = `${apiBase}/api/brevo-events`;

      const shouldUseBackend = Boolean(apiBase);
      if (shouldUseBackend) {
        try {
          const resp = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const json = await resp.json().catch(() => ({ success: false, error: `HTTP ${resp.status}` }));
          if (resp.ok) {
            return json;
          }
          // If backend returned structured error, propagate it; otherwise fall back to direct API
          if (json && (json.error || json.details)) {
            return { success: false, error: (json.details || json.error) };
          }
        } catch (_) {
          // Ignore and fall through to direct Brevo fetch
        }
      }

      // Direct Brevo fetch fallback (useful in Vite preview or when backend is unreachable)
      const f = filters || {};
      const params = new URLSearchParams();
      if (typeof f.days === 'number' && f.days > 0) {
        params.set('days', String(f.days));
      } else {
        if (typeof f.startDate === 'string' && f.startDate) {
          params.set('startDate', f.startDate);
        }
        if (typeof f.endDate === 'string' && f.endDate) {
          params.set('endDate', f.endDate);
        }
      }
      if (typeof f.limit === 'number') params.set('limit', String(Math.max(1, Math.min(5000, f.limit))));
      if (typeof f.offset === 'number') params.set('offset', String(Math.max(0, f.offset)));
      if (typeof f.email === 'string' && f.email) params.set('email', f.email);
      if (typeof f.event === 'string' && f.event) params.set('event', f.event);
      if (typeof f.tags === 'string' && f.tags) params.set('tags', f.tags);
      if (typeof f.messageId === 'string' && f.messageId) params.set('messageId', f.messageId);
      if (typeof f.templateId === 'number') params.set('templateId', String(f.templateId));
      if (typeof f.sort === 'string' && f.sort) params.set('sort', f.sort);

      const brevoUrl = `https://api.brevo.com/v3/smtp/statistics/events?${params.toString()}`;
      const response = await fetch(brevoUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'api-key': apiKey
        }
      });

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errorDetails = errJson?.message || errJson?.error || errorDetails;
        } catch {
          try {
            const errText = await response.text();
            errorDetails = errText || errorDetails;
          } catch {}
        }
        return { success: false, error: errorDetails };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching Brevo events:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const emailTrackingService = new EmailTrackingService();