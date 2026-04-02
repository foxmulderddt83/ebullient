import React, { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function NotificationLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm("Are you sure you want to clear all logs? This cannot be undone.")) return;
    
    setClearing(true);
    try {
      const { error } = await supabase
        .from('notification_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) throw error;
      toast.success("Logs cleared");
      fetchLogs();
    } catch (error: any) {
      console.error('Error clearing logs:', error);
      toast.error("Failed to clear logs");
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1"/> Sent</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1"/> Failed</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'processing': return <Badge variant="outline" className="border-primary text-primary"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Sending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-black/5 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-950 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Notification Audit Trail
          </h3>
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">Real-time logs of system-sent messages and emails.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            className="h-11 w-11 rounded-xl border-black/10 hover:bg-white shadow-sm transition-all active:scale-95" 
            onClick={fetchLogs} 
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="destructive" 
            className="h-11 px-6 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-widest gap-2 shadow-lg shadow-red-100 transition-all active:scale-95" 
            onClick={clearLogs} 
            disabled={clearing || logs.length === 0}
          >
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 shadow-sm overflow-hidden bg-white">
        <div className="md:hidden flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-slate-50 py-3 border-b border-black/5">
          <RefreshCw className="w-3 h-3 animate-pulse" />
          Scroll right to view all log details
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-black/5 hover:bg-transparent">
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Time</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Type</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Recipient</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Message/Subject</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Status</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900/60 h-12">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-900">Fetching logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Clock className="w-8 h-8 text-slate-900" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-900">No logs found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="border-black/5 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="whitespace-nowrap text-[11px] font-bold text-slate-900 py-4">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${log.type === 'email' ? 'bg-primary/5 text-primary/90 border-primary/20' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {log.type === 'email' ? 'Email' : 'WhatsApp'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs font-medium text-slate-900 py-4" title={log.email || log.phone}>
                      {log.type === 'email' ? log.email : log.phone}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-slate-900 py-4" title={log.subject || log.message}>
                      {log.type === 'email' ? log.subject : log.message}
                    </TableCell>
                    <TableCell className="py-4">{getStatusBadge(log.status)}</TableCell>
                    <TableCell className={`max-w-[200px] truncate text-[11px] font-mono py-4 ${log.status === 'failed' ? 'text-red-500' : 'text-slate-900'}`} title={log.error_message}>
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
