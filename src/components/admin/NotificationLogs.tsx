import React, { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, ChevronLeft, ChevronRight, BellRing } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function NotificationLogs({ canEdit = true }: { canEdit?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  const fetchLogs = async (page = currentPage) => {
    setLoading(true);
    try {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Get logs for current page and total count
      const { data, error, count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      // Handle 416 Range Not Satisfiable (happens if page is too high)
      const isRangeError = error.code === 'PGRST103' || 
                          error.status === 416 || 
                          error.statusCode === 416 ||
                          (error.message && (
                            error.message.toLowerCase().includes('range not satisfiable') || 
                            error.message.toLowerCase().includes('out of bounds')
                          ));

      if (isRangeError) {
        if (page !== 1) {
          setCurrentPage(1);
          fetchLogs(1);
          return;
        } else {
          setLogs([]);
          setTotalCount(0);
          return;
        }
      }

      console.error('Error fetching logs:', error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchLogs(newPage);
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
      setCurrentPage(1);
      fetchLogs(1);
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

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-emerald-500 hover:bg-emerald-500 font-bold uppercase tracking-tight"><CheckCircle className="w-3 h-3 mr-1"/> Sent</Badge>;
      case 'failed': return <Badge variant="destructive" className="font-bold uppercase tracking-tight"><AlertCircle className="w-3 h-3 mr-1"/> Failed</Badge>;
      case 'pending': return <Badge variant="secondary" className="font-bold uppercase tracking-tight"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'processing': return <Badge variant="outline" className="border-slate-700 text-slate-600 font-bold uppercase tracking-tight"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Sending</Badge>;
      default: return <Badge variant="outline" className="font-bold uppercase tracking-tight">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 p-6 rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 p-2.5 rounded-2xl shadow-lg shadow-slate-200/50">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans text-slate-900 tracking-tight">Notification Logs</h1>
            <p className="text-[10px] font-bold font-sans text-slate-500 uppercase tracking-tight">Delivery status & History</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="icon"
            className="h-11 w-11 rounded-xl border-black/10 hover:bg-white shadow-sm transition-all active:scale-95" 
            onClick={() => handlePageChange(1)} 
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="destructive" 
            className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-tight gap-2 shadow-lg shadow-red-100 transition-all active:scale-95" 
            onClick={clearLogs} 
            disabled={clearing || logs.length === 0 || !canEdit}
          >
            <Trash2 className="w-4 h-4" /> Clear Logs
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 shadow-sm overflow-hidden bg-white">
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-black/5 hover:bg-transparent">
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Time</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Type</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Recipient</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Message/Subject</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Status</TableHead>
                <TableHead className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900/60 h-12">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                      <span className="text-xs font-bold uppercase tracking-tight text-slate-900">Fetching logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Clock className="w-8 h-8 text-slate-900" />
                      <span className="text-xs font-bold uppercase tracking-tight text-slate-900">No logs found</span>
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
                      <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${log.type === 'email' ? 'bg-slate-50 text-slate-600/90 border-slate-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
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
                    <TableCell className={`max-w-[200px] truncate text-[11px] font-mono py-4 ${log.status === 'failed' ? 'text-slate-500' : 'text-slate-900'}`} title={log.error_message}>
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="block sm:hidden p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="h-32 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
              <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900">Fetching logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 opacity-40">
              <Clock className="h-10 w-10 text-slate-900" />
              <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900">No logs found</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl border border-black/5 p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-900">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </span>
                    <Badge variant="outline" className={`w-fit rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight ${log.type === 'email' ? 'bg-slate-50 text-slate-600/90 border-slate-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {log.type === 'email' ? 'Email' : 'WhatsApp'}
                    </Badge>
                  </div>
                  <div className="shrink-0">{getStatusBadge(log.status)}</div>
                </div>
                
                <div className="bg-slate-50/50 p-3 rounded-xl border border-black/5 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-tight text-slate-900 opacity-40">Recipient</span>
                    <p className="text-[10px] font-bold text-slate-900 truncate" title={log.email || log.phone}>
                      {log.type === 'email' ? log.email : log.phone}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-tight text-slate-900 opacity-40">
                      {log.type === 'email' ? 'Subject' : 'Message'}
                    </span>
                    <p className="text-[10px] font-medium text-slate-700 break-words line-clamp-2" title={log.subject || log.message}>
                      {log.type === 'email' ? log.subject : log.message}
                    </p>
                  </div>

                  {log.error_message && (
                    <div className="space-y-1 pt-1 border-t border-black/5">
                      <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500/60">Error</span>
                      <p className="text-[9px] font-mono text-slate-500 break-words leading-tight">
                        {log.error_message}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-black/5 bg-slate-50/30">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-500 text-center sm:text-left">
              Showing <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="text-slate-900">{totalCount}</span> logs
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 p-0 rounded-lg border-black/10 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-40"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!canGoPrevious || loading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      className={`h-9 w-9 p-0 rounded-lg font-bold text-[11px] transition-all active:scale-95 ${
                        currentPage === pageNum 
                          ? "bg-slate-700 text-white shadow-md shadow-slate-200/50 border-slate-700" 
                          : "border-black/10 hover:bg-white text-slate-600"
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 p-0 rounded-lg border-black/10 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-40"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!canGoNext || loading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
