import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, MessageSquare, Info, ChevronLeft, ChevronRight, Search, Trash2, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import { AVAILABLE_VARIABLES } from "@/lib/pdfGenerator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WhatsAppSession {
  session_id: string;
  key: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export default function WhatsAppConfig() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variableSearch, setVariableSearch] = useState("");
  
  // Sessions State
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [filterSessionId, setFilterSessionId] = useState("");
  const pageSize = 10;

  // Memoized Filtered Variables
  const filteredVariables = React.useMemo(() => {
    if (!variableSearch) return AVAILABLE_VARIABLES;
    const search = variableSearch.toLowerCase();
    return AVAILABLE_VARIABLES.map(category => ({
      ...category,
      vars: category.vars.filter(v => v.toLowerCase().includes(search))
    })).filter(category => category.vars.length > 0);
  }, [variableSearch]);

  useEffect(() => {
    fetchSettings();
    fetchSessions();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_template_payment_success')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMessage(data.value);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp settings:', error);
      toast.error("Failed to load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      let query = supabase
        .from('whatsapp_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filterSessionId) {
        query = query.ilike('session_id', `%${filterSessionId}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching WhatsApp sessions:', error);
      toast.error("Failed to load WhatsApp sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const deleteSession = async (sessionId: string, key: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;

    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', sessionId)
        .eq('key', key);

      if (error) throw error;
      toast.success("Session deleted successfully");
      fetchSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(`Failed to delete session: ${error.message}`);
    }
  };

  const handleClearSessions = async (range: '7d' | '30d' | 'all') => {
    const confirmMessage = range === 'all' 
      ? "Are you sure you want to delete ALL WhatsApp sessions? This cannot be undone."
      : `Are you sure you want to delete sessions inactive for more than ${range === '7d' ? '1 week' : '1 month'}?`;

    if (!window.confirm(confirmMessage)) return;
    
    setLoadingSessions(true);
    try {
      let query = supabase.from('whatsapp_sessions').delete();
      
      if (range === '7d') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.lt('updated_at', date.toISOString());
      } else if (range === '30d') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.lt('updated_at', date.toISOString());
      } else {
        query = query.neq('session_id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) throw error;
      
      toast.success("Sessions cleared successfully");
      fetchSessions();
    } catch (error: any) {
      console.error('Error clearing sessions:', error);
      toast.error(`Failed to clear sessions: ${error.message}`);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Pagination Logic
  const paginatedSessions = React.useMemo(() => {
    const startIndex = (sessionPage - 1) * pageSize;
    return sessions.slice(startIndex, startIndex + pageSize);
  }, [sessions, sessionPage]);

  const totalPages = Math.ceil(sessions.length / pageSize);

  const handleSave = async () => {
    if (!message.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key: 'whatsapp_template_payment_success',
          value: message,
          category: 'whatsapp',
          description: 'WhatsApp message template for successful payment'
        });

      if (error) throw error;
      toast.success("WhatsApp template saved successfully");
      logActivity(supabase, 'update', 'site_settings', 'whatsapp_template_payment_success', { value: message });
    } catch (error: any) {
      console.error('Error saving WhatsApp settings:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 sm:gap-8 animate-in fade-in duration-700">
      <div className="lg:col-span-2 space-y-6 sm:space-y-8">
        <Card className="border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 pb-6 sm:pb-8 p-4 sm:p-8 bg-white/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                    WhatsApp Configuration
                  </CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary mt-1">
                    Manage automated WhatsApp notifications
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <Label className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                  Payment Success Message
                </Label>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5/50 rounded-full border border-primary/10/50">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary">Live Template</span>
                </div>
              </div>
              <div className="relative group/textarea">
                <Textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message here..."
                  className="min-h-[220px] sm:min-h-[350px] text-sm sm:text-base font-medium border-black/10 rounded-[2rem] bg-white/50 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all resize-none p-4 sm:p-8 leading-relaxed shadow-sm"
                />
                <div className="absolute bottom-4 right-4 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-white/80 px-3 py-1.5 rounded-full border border-slate-100 backdrop-blur-sm shadow-sm">
                    UTF-8 Supported
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-4 sm:p-6 rounded-3xl bg-amber-50/50 border border-amber-100/50 backdrop-blur-sm animate-in slide-in-from-top-2 duration-500">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-xs leading-relaxed text-amber-800 font-medium">
                  This message will be sent automatically when a payment is confirmed. Personalize it using variables from the cheat sheet. <span className="font-black border-b border-amber-200">Avoid using too many emojis</span> to ensure deliverability across all devices.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-black/5">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="w-full sm:w-auto h-12 sm:h-16 px-6 sm:px-10 gap-3 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-2xl group/btn"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="h-fit border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 bg-white/50 p-5 pb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary shadow-inner group-hover:rotate-12 transition-transform duration-500">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Variables
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mt-0.5">
                    Personalize your messages
                  </CardDescription>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900" />
                <Input
                  placeholder="Search variables..."
                  value={variableSearch}
                  onChange={(e) => setVariableSearch(e.target.value)}
                  className="pl-11 h-11 text-sm font-bold border-black/10 rounded-xl bg-white focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] lg:h-[750px] scrollbar-thin">
              <div className="px-4 sm:px-6 pt-3 pb-6 space-y-4">
                {/* Formulas Guide */}
                <div className="bg-primary/5/50 p-3 rounded-xl border border-primary/10/50 text-xs sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-black text-primary uppercase tracking-wide">
                    <Calculator className="w-4 h-4" />
                    <span>Formulas</span>
                  </div>
                  <p className="text-slate-900 font-bold leading-relaxed">
                    Use <span className="font-mono bg-white px-1 py-0.5 rounded border border-primary/10 text-primary/90">sum(...)</span> with <span className="text-primary font-black">+ - * /</span>
                  </p>
                  <div className="bg-white/50 p-2 rounded-lg border border-primary/10/50 font-mono text-[11px] sm:text-xs text-slate-900 font-bold">
                    Example: sum({"{total.paid}"} - {"{deposit}"})
                    <br/>
                    Result: 1000
                  </div>
                </div>

                {filteredVariables.map((category) => (
                  <div key={category.category} className="space-y-3">
                    <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-900 px-1 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary"></span>
                      {category.category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {category.vars.map((variable) => (
                        <button 
                          key={variable} 
                          className="w-full text-left bg-white/80 p-3 rounded-xl text-[11px] font-bold border border-black/5 flex justify-between items-center group/var cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-[0.98] shadow-sm"
                          onClick={() => {
                            navigator.clipboard.writeText(variable);
                            toast.success(`Copied ${variable}`);
                          }}
                        >
                          <span className="truncate mr-2 text-slate-900 group-hover/var:text-white transition-colors">{variable}</span>
                          <span className="shrink-0 opacity-0 group-hover/var:opacity-100 text-[9px] font-black uppercase tracking-widest text-primary bg-white px-2 py-1 rounded-lg shadow-sm transition-all duration-300">
                            Copy
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredVariables.length === 0 && (
                  <div className="text-center py-12 animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Search className="w-6 h-6 text-slate-900" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">No variables found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Sessions Management */}
      <div className="lg:col-span-3">
        <Card className="border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 bg-white/50 p-4 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform duration-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">WhatsApp Sessions</CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 mt-1">Manage active bot connections and metadata</CardDescription>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
                <div className="relative flex-1 w-full sm:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900" />
                  <Input
                    placeholder="Filter by Session ID..."
                    value={filterSessionId}
                    onChange={(e) => setFilterSessionId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchSessions();
                    }}
                    className="pl-11 h-11 text-sm font-bold border-black/10 rounded-xl bg-white focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button 
                    onClick={fetchSessions} 
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl border-black/10 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                  >
                    <Search className="w-5 h-5 text-slate-900" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="destructive" className="h-11 px-6 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-[0.2em] gap-2 shadow-lg shadow-red-200 active:scale-95 transition-all w-full sm:w-auto">
                        <Trash2 className="w-4 h-4" />
                        Clear
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-3xl border-black/5 shadow-2xl p-3 min-w-[240px] backdrop-blur-xl bg-white/95">
                      <DropdownMenuLabel className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 px-4 py-3">
                        Delete Options
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem onClick={() => handleClearSessions('7d')} className="text-red-600 cursor-pointer rounded-2xl p-4 text-[11px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
                        Older than 1 Week
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleClearSessions('30d')} className="text-red-600 cursor-pointer rounded-2xl p-4 text-[11px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
                        Older than 1 Month
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-black/5 mx-2" />
                      <DropdownMenuItem onClick={() => handleClearSessions('all')} className="text-white font-black cursor-pointer rounded-2xl p-4 text-[11px] sm:text-xs uppercase tracking-[0.2em] bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 m-1">
                        Delete All Sessions
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="md:hidden flex items-center justify-center gap-3 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 bg-slate-50/50 py-4 border-b border-black/5">
              <ChevronLeft className="w-3.5 h-3.5 animate-pulse" />
              Swipe to explore sessions
              <ChevronRight className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader className="bg-slate-50/30">
                    <TableRow className="border-black/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 h-12 sm:h-16 px-4 sm:px-8">Session ID</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 h-12 sm:h-16 px-4 sm:px-8">Key</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 h-12 sm:h-16 px-4 sm:px-8">Data</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 h-12 sm:h-16 px-4 sm:px-8">Last Updated</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 h-12 sm:h-16 px-4 sm:px-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSessions ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                            <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Syncing database...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-40 animate-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center">
                              <MessageSquare className="w-8 h-8 text-slate-900" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">No sessions available</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSessions.map((session, idx) => (
                        <TableRow key={`${session.session_id}-${session.key}`} className="border-black/5 hover:bg-white/50 transition-colors group/row animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                          <TableCell className="font-mono text-xs text-slate-900 font-bold py-4 sm:py-6 px-4 sm:px-8">
                            <span className="bg-slate-100/50 px-3 py-1.5 rounded-lg border border-slate-200/50">{session.session_id}</span>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-700 py-4 sm:py-6 px-4 sm:px-8 font-medium">{session.key}</TableCell>
                          <TableCell className="max-w-md truncate text-[11px] text-slate-900 py-4 sm:py-6 px-4 sm:px-8 font-medium" title={JSON.stringify(session.data)}>
                            {JSON.stringify(session.data)}
                          </TableCell>
                          <TableCell className="py-4 sm:py-6 px-4 sm:px-8">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{format(new Date(session.updated_at), "MMM d, HH:mm")}</span>
                              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Modified</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4 sm:py-6 px-4 sm:px-8">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteSession(session.session_id, session.key)}
                              className="h-10 w-10 sm:h-12 sm:w-12 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90 group-hover/row:scale-110"
                              title="Delete session"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 p-5 sm:p-8 border-t border-black/5 bg-white/50">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                  Page {sessionPage} of {Math.max(1, totalPages)} <span className="mx-2 opacity-20">•</span> {sessions.length} sessions
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                  disabled={sessionPage === 1}
                  className="h-10 px-4 rounded-xl border-black/10 hover:bg-white disabled:opacity-30 transition-all font-bold text-xs uppercase tracking-wider gap-2 flex-1 sm:flex-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(p => Math.min(totalPages, p + 1))}
                  disabled={sessionPage >= totalPages}
                  className="h-10 px-4 rounded-xl border-black/10 hover:bg-white disabled:opacity-30 transition-all font-bold text-xs uppercase tracking-wider gap-2 flex-1 sm:flex-none"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
