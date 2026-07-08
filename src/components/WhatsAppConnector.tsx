import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { RefreshCw, CheckCircle2, XCircle, Printer, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface WhatsAppConnectorProps {
  apiUrl?: string;
  testBookingId?: string;
  onBookingChange?: (id: string) => void;
  onPreview?: () => void;
  canEdit?: boolean;
}

export function WhatsAppConnector({ apiUrl, testBookingId, onBookingChange, onPreview, canEdit = true }: WhatsAppConnectorProps) {
  // Use provided URL or fallback to env or default
  const API_URL = apiUrl || import.meta.env.VITE_WHATSAPP_API_URL || "";
  
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestBookings, setLatestBookings] = useState<any[]>([]);
  const [apiToken, setApiToken] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestBookings();
    fetchApiToken();
  }, []);

  const fetchApiToken = async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'api_auth_token')
        .maybeSingle();
      
      setApiToken(data?.value || import.meta.env.VITE_API_AUTH_TOKEN || null);
    } catch (e) {
      console.error('Error fetching API token:', e);
    }
  };

  const fetchLatestBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_id, booking_reference, customer:customers(name), flight_date')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setLatestBookings(data || []);
    } catch (error) {
      console.error('Error fetching latest bookings:', error);
    }
  };

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_bot_status')
        .maybeSingle();
      if (data) {
        const connected = data.value === 'connected';
        setIsConnected(connected);
        if (connected) {
          setQr(null);
          setIsScanning(false);
        }
      }
      setError(null);
    } catch (e) {
      setError("Unable to read bot status");
    }
  }, [API_URL]);

  const pollQr = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_bot_qr')
        .maybeSingle();
      if (data?.value) setQr(data.value);
      setError(null);
    } catch (e) {
      setError("Unable to read QR from database");
    }
  }, [API_URL]);

  const handleReconnect = async () => {
    setLoading(true);
    setIsScanning(true);
    setQr(null);
    try {
      // Always try to reset session first to ensure clean state
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

      const response = await fetch(`${API_URL}/api/reset-session`, { 
        method: "POST",
        headers
      });
      
      if (!response.ok) throw new Error("Reset failed");
      
      toast.info("WhatsApp session reset. Generating new QR code...");
      
      // Wait a bit before starting to poll for the new QR
      setTimeout(() => {
        pollQr();
      }, 3000);
      
    } catch (e) {
      console.error("Reset failed, trying soft reconnect", e);
      try {
        const headers: Record<string, string> = {};
        if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

        await fetch(`${API_URL}/api/soft-reconnect`, { 
          method: "POST",
          headers
        });
        toast.info("Triggered soft reconnect...");
      } catch (e2) {
        toast.error("Failed to reset WhatsApp session. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    pollQr();

    const statusChannel = supabase
      .channel('admin:whatsapp-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.whatsapp_bot_status' },
        (payload: any) => {
          const connected = payload?.new?.value === 'connected';
          setIsConnected(connected);
          if (connected) {
            setQr(null);
            setIsScanning(false);
          }
        }
      )
      .subscribe();

    const qrChannel = supabase
      .channel('admin:whatsapp-qr')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.whatsapp_bot_qr' },
        (payload: any) => {
          const nextQr = payload?.new?.value;
          if (nextQr) {
            setQr(nextQr);
            setError(null);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(statusChannel);
      } catch {}
      try {
        supabase.removeChannel(qrChannel);
      } catch {}
    };
  }, [checkStatus, pollQr]);

  return (
    <div className="flex flex-col items-center gap-6 w-full min-w-0 overflow-hidden py-2">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-sm transition-all duration-500 ${
          isConnected 
            ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
            : 'bg-red-500/10 text-red-600 border border-red-500/20'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        
        <Button 
          size="lg" 
          variant={isConnected ? "outline" : "default"}
          onClick={handleReconnect}
          disabled={loading || !canEdit}
          className={`w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all duration-300 shadow-xl gap-3 ${
            isConnected 
              ? 'border-black/10 hover:bg-slate-50 text-slate-900 shadow-slate-200/50' 
              : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-180`} />
          )}
          {isConnected ? 'Reset & Re-scan' : (isScanning ? 'Reset & Retry' : 'Connect Bot')}
        </Button>
      </div>

      {!isConnected && (isScanning || qr) && (
        <div className="w-full max-w-[280px] sm:max-w-md animate-in zoom-in-95 fade-in duration-700">
          <div className="p-6 sm:p-10 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-black/5 border border-black/5 flex flex-col items-center gap-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50"></div>
            
            {qr ? (
              <div className="space-y-6 text-center relative z-10 w-full">
                <div className="bg-white p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-inner border border-black/5 flex items-center justify-center">
                  <div className="w-full aspect-square max-w-[200px] sm:max-w-[240px]">
                    <QRCode 
                      value={qr} 
                      size={256}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 256 256`}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                    Scan QR Code
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                    Open WhatsApp → Settings → Linked Devices
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 gap-4 relative z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2.5rem] bg-primary/5 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-primary" />
                </div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary animate-pulse">Generating QR...</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!isConnected && !isScanning && !qr && (
        <div className="w-full p-6 sm:p-8 border border-dashed border-black/10 rounded-2xl sm:rounded-[2.5rem] bg-slate-50/50 text-center animate-in fade-in duration-700">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 opacity-40">
            Bot is currently offline
          </p>
        </div>
      )}

      {/* Preview Generation Block */}
      {onBookingChange && (
        <div className="w-full space-y-4 pt-4 border border-black rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 bg-slate-50/50 backdrop-blur-md shadow-inner mt-4">
          <Label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-600 ml-1">Preview Generation</Label>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 bg-white/60 p-3 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-black/5 sm:items-center backdrop-blur-sm">
            <Select value={testBookingId} onValueChange={onBookingChange} disabled={!canEdit}>
              <SelectTrigger className="flex-1 h-12 sm:h-11 border-black rounded-lg sm:rounded-xl bg-white focus:ring-2 focus:ring-indigo-100 shadow-sm font-bold text-slate-700 text-[10px] sm:text-xs">
                <SelectValue placeholder="Select Booking" />
              </SelectTrigger>
              <SelectContent className="rounded-xl sm:rounded-2xl border-black shadow-2xl">
                {latestBookings.length === 0 ? (
                  <SelectItem value="none" disabled className="text-[10px] sm:text-xs">No bookings found</SelectItem>
                ) : (
                  latestBookings.map((booking) => (
                    <SelectItem key={booking.booking_id} value={booking.booking_reference} className="rounded-xl py-2.5 sm:py-3 text-[10px] sm:text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-600">{booking.booking_reference}</span>
                          <span className="font-medium text-slate-900">{booking.customer?.name || 'Unknown'}</span>
                        </div>
                        {booking.flight_date && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {format(new Date(booking.flight_date), "EEE, d MMM yyyy").toUpperCase()}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={onPreview}
              disabled={!testBookingId}
              className="h-12 sm:h-11 px-6 w-full sm:w-auto shrink-0 rounded-lg sm:rounded-xl bg-slate-700 text-white hover:bg-slate-700/90 transition-all active:scale-[0.98] shadow-lg shadow-slate-200/50 text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-none"
            >
              <Printer className="w-4 h-4" />
              <span>PREVIEW</span>
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-900 ml-1 sm:ml-2 italic flex items-center gap-2">
            <Info className="w-3 h-3" />
            Select a booking to preview your message with real data.
          </p>
        </div>
      )}
    </div>
  );
}
