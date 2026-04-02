import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface WhatsAppConnectorProps {
  apiUrl?: string;
}

export function WhatsAppConnector({ apiUrl }: WhatsAppConnectorProps) {
  // Use provided URL or fallback to env or default
  const API_URL = apiUrl || import.meta.env.VITE_WHATSAPP_API_URL || "";
  
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    // Supabase Fallback for Status
    const fetchSupabaseStatus = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'whatsapp_bot_status')
          .single();
        if (data) setIsConnected(data.value === 'connected');
      } catch (e) {
        console.error("Supabase status fallback error:", e);
      }
    };

    if (!API_URL) {
      await fetchSupabaseStatus();
      return;
    }
    
    try {
      // Try /api/status first
      let res = await fetch(`${API_URL}/api/status`);
      
      if (res.status === 404) {
        res = await fetch(`${API_URL}/`);
      }

      if (!res.ok) {
        await fetchSupabaseStatus();
        return;
      }

      const json = await res.json();
      setIsConnected(Boolean(json.connected));
      setError(null);
      if (json.connected) {
        setQr(null);
        setIsScanning(false);
      }
    } catch (e) {
      await fetchSupabaseStatus();
      setError("Bot API unreachable - using DB status");
    }
  }, [API_URL]);

  const pollQr = useCallback(async () => {
    // Supabase Fallback for QR
    const fetchSupabaseQr = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'whatsapp_bot_qr')
          .single();
        if (data?.value) setQr(data.value);
      } catch (e) {
        console.error("Supabase QR fallback error:", e);
      }
    };

    if (!API_URL) {
      await fetchSupabaseQr();
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/qr`);
      if (!res.ok) {
        await fetchSupabaseQr();
        return;
      }
      const json = await res.json();
      
      if (json.connected) {
        setIsConnected(true);
        setQr(null);
        setIsScanning(false);
        setError(null);
        return;
      }
      
      if (json.qr) {
        setQr(json.qr);
        setError(null);
      } else {
        await fetchSupabaseQr();
      }
    } catch (e) {
      await fetchSupabaseQr();
    }
  }, [API_URL]);

  const handleReconnect = async () => {
    setLoading(true);
    setIsScanning(true);
    setQr(null);
    try {
      // Always try to reset session first to ensure clean state
      const response = await fetch(`${API_URL}/api/reset-session`, { 
        method: "POST",
        headers: { 'Content-Type': 'application/json' }
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
        await fetch(`${API_URL}/api/soft-reconnect`, { method: "POST" });
        toast.info("Triggered soft reconnect...");
      } catch (e2) {
        toast.error("Failed to reset WhatsApp session. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Status polling
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // QR Polling when scanning
  useEffect(() => {
    if (isScanning && !isConnected) {
      pollQr();
      const interval = setInterval(pollQr, 2000);
      return () => clearInterval(interval);
    }
  }, [isScanning, isConnected, pollQr]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
          isConnected ? 'bg-green-100 text-green-800 border border-black' : 'bg-red-100 text-red-800 border border-black'
        }`}>
          {isConnected ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        
        <Button 
          size="sm" 
          variant={isConnected ? "outline" : "default"}
          onClick={handleReconnect}
          disabled={loading}
          className="shadow-sm gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {isConnected ? 'Reset & Re-scan QR' : (isScanning ? 'Reset & Retry' : 'Connect / Scan')}
        </Button>
      </div>

      {!isConnected && (isScanning || qr) && (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-black flex flex-col items-center">
          {qr ? (
            <div className="space-y-4 text-center">
              <div className="bg-white p-2 rounded">
                <QRCode 
                  value={qr} 
                  size={200}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox={`0 0 256 256`}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Open WhatsApp &gt; Linked Devices &gt; Link a Device
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-48 h-48">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Waiting for QR...</p>
            </div>
          )}
        </div>
      )}
      
      {!isConnected && !isScanning && !qr && (
        <div className="text-sm text-muted-foreground text-center p-4 border rounded-lg bg-slate-50 w-full">
          Bot is disconnected. Click "Connect" to pair.
        </div>
      )}
    </div>
  );
}
