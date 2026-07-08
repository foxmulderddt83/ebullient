import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, MessageSquare, Info, ChevronLeft, ChevronRight, Search, Trash2, Calculator, Printer, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import { AVAILABLE_VARIABLES, getVariableValue } from "@/lib/pdfGenerator";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WhatsAppSession {
  session_id: string;
  key: string;
  data: any;
  created_at: string;
  updated_at: string;
}

interface WhatsAppConfigProps {
  selectedBookingData?: any;
  isLoadingBookingData?: boolean;
  isPreviewModalOpen?: boolean;
  setIsPreviewModalOpen?: (open: boolean) => void;
  canEdit?: boolean;
}

export function WhatsAppConfig({ 
  selectedBookingData, 
  isLoadingBookingData,
  isPreviewModalOpen: externalPreviewOpen,
  setIsPreviewModalOpen: setExternalPreviewOpen,
  canEdit = true
}: WhatsAppConfigProps) {
  const [activeTemplate, setActiveTemplate] = useState<'payment_success' | 'approval' | 'refund'>('payment_success');
  const [templates, setTemplates] = useState({
    payment_success: "",
    approval: "",
    refund: ""
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variableSearch, setVariableSearch] = useState("");

  const message = templates[activeTemplate];
  const setMessage = (val: string | ((prev: string) => string)) => {
    setTemplates(prev => ({
      ...prev,
      [activeTemplate]: typeof val === 'function' ? val(prev[activeTemplate]) : val
    }));
  };

  // Local state for when used independently, but overridden by props if provided
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const isPreviewModalOpen = externalPreviewOpen !== undefined ? externalPreviewOpen : internalPreviewOpen;
  const setIsPreviewModalOpen = setExternalPreviewOpen || setInternalPreviewOpen;

  // Sessions State
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [filterSessionId, setFilterSessionId] = useState("");
  const pageSize = 10;

  useEffect(() => {
    fetchSettings();
    fetchSessions();
  }, []);

  const renderPreviewContent = () => {
    if (!selectedBookingData) return null;
    
    let renderedMessage = message;
    const firstPassenger = selectedBookingData.booking_passengers?.[0];

    AVAILABLE_VARIABLES.forEach(cat => {
      cat.vars.forEach(variable => {
        const val = getVariableValue(variable, selectedBookingData, firstPassenger, { format: 'text' });
        const escapedVar = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        renderedMessage = renderedMessage.replace(new RegExp(escapedVar, 'g'), val || '');
      });
    });

    return (
      <div className="whitespace-pre-wrap font-sans text-sm sm:text-base text-slate-800 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-black/5 shadow-inner">
        {renderedMessage}
      </div>
    );
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['whatsapp_template_payment_success', 'whatsapp_template_approval', 'whatsapp_template_refund']);

      if (error) throw error;
      
      const newTemplates = {
        payment_success: "",
        approval: "",
        refund: ""
      };
      
      data?.forEach(item => {
        if (item.key === 'whatsapp_template_payment_success') newTemplates.payment_success = item.value;
        if (item.key === 'whatsapp_template_approval') newTemplates.approval = item.value;
        if (item.key === 'whatsapp_template_refund') newTemplates.refund = item.value;
      });

      setTemplates(newTemplates);
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

  // Memoized Filtered Variables
  const filteredVariables = React.useMemo(() => {
    if (!variableSearch) return AVAILABLE_VARIABLES;
    const search = variableSearch.toLowerCase();
    return AVAILABLE_VARIABLES.map(category => ({
      ...category,
      vars: category.vars.filter(v => v.toLowerCase().includes(search))
    })).filter(category => category.vars.length > 0);
  }, [variableSearch]);

  const handleSave = async () => {
    if (!message.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    setSaving(true);
    let key = '';
    let description = '';
    
    if (activeTemplate === 'payment_success') {
      key = 'whatsapp_template_payment_success';
      description = 'WhatsApp message template for successful payment';
    } else if (activeTemplate === 'approval') {
      key = 'whatsapp_template_approval';
      description = 'WhatsApp message template for manual approval';
    } else {
      key = 'whatsapp_template_refund';
      description = 'WhatsApp message template for manual refund';
    }
    
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key,
          value: message,
          category: 'whatsapp',
          description
        });

      if (error) throw error;
      toast.success("WhatsApp template saved successfully");
      logActivity(supabase, 'update', 'site_settings', key, { value: message });
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
    <div className="flex flex-col lg:grid lg:grid-cols-8 gap-4 sm:gap-8 animate-in fade-in duration-700 w-full min-w-0">
      <div className="lg:col-span-6 space-y-4 sm:space-y-8 min-w-0 w-full">
        <Tabs value={activeTemplate} onValueChange={(val: any) => setActiveTemplate(val)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-8 border border-black/20 p-1 h-12 sm:h-14 bg-white/50 backdrop-blur-md rounded-[1.25rem] sm:rounded-[2rem] shadow-xl shadow-slate-200/50">
            <TabsTrigger 
              value="payment_success" 
              className="border border-black/20 data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-[1.25rem] sm:rounded-[1.75rem] flex items-center justify-center gap-2 sm:gap-3 font-bold uppercase tracking-tight h-full text-[11px] sm:text-xs transition-all duration-300 data-[state=active]:shadow-lg data-[state=active]:shadow-slate-900/20"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Payment</span>
            </TabsTrigger>
            <TabsTrigger 
              value="approval" 
              className="border border-black/20 data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-[1.25rem] sm:rounded-[1.75rem] flex items-center justify-center gap-2 sm:gap-3 font-bold uppercase tracking-tight h-full text-[11px] sm:text-xs transition-all duration-300 data-[state=active]:shadow-lg data-[state=active]:shadow-slate-900/20"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Approval</span>
            </TabsTrigger>
            <TabsTrigger 
              value="refund" 
              className="border border-black/20 data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-[1.25rem] sm:rounded-[1.75rem] flex items-center justify-center gap-2 sm:gap-3 font-bold uppercase tracking-tight h-full text-[11px] sm:text-xs transition-all duration-300 data-[state=active]:shadow-lg data-[state=active]:shadow-slate-900/20"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Refund</span>
            </TabsTrigger>
          </TabsList>

          <Card className="border-black/5 shadow-lg sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-2xl sm:rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500 w-full">
            <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-8 min-w-0 pt-6 sm:pt-10">
              <fieldset disabled={!canEdit} className="space-y-4 sm:space-y-8 min-w-0">
                <div className="space-y-3 sm:space-y-4 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0"></span>
                      <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 truncate">
                      {activeTemplate === 'payment_success' ? 'Payment Success Message' : activeTemplate === 'approval' ? 'Manual Approval Message' : 'Manual Refund Message'}
                    </Label>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 w-fit shrink-0 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-600">Live Template</span>
                    </div>
                  </div>
                  <div className="relative group/textarea min-w-0">
                    <Textarea 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your message here..."
                      className="min-h-[180px] sm:min-h-[350px] text-[11px] sm:text-base font-medium border-black/10 rounded-xl sm:rounded-[2rem] bg-white/50 focus:bg-white focus:ring-4 focus:ring-indigo-100/10 transition-all resize-none p-3 sm:p-8 leading-relaxed shadow-sm w-full"
                    />
                  </div>
                  <div className="flex items-start gap-3 p-3 sm:p-6 rounded-xl sm:rounded-3xl bg-amber-50/50 border border-amber-100/50 backdrop-blur-sm animate-in slide-in-from-top-2 duration-500 min-w-0">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Info className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-600" />
                    </div>
                    <p className="text-[10px] sm:text-xs leading-relaxed text-amber-800 font-medium break-words">
                      {activeTemplate === 'payment_success' 
                        ? 'This message will be sent automatically when a payment is confirmed.' 
                        : activeTemplate === 'approval'
                        ? 'This message will be sent when you manually approve a booking in the admin panel.'
                        : 'This message will be sent when you manually refund a booking in the admin panel.'} Personalize it using variables from the cheat sheet.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 sm:pt-8 border-t border-black/5">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="w-full sm:w-auto h-11 sm:h-16 px-6 sm:px-10 gap-3 bg-slate-700 hover:bg-slate-700/90 text-white shadow-xl shadow-slate-200/50 transition-all duration-300 font-bold uppercase tracking-tight text-[9px] sm:text-xs rounded-xl sm:rounded-2xl group/btn"
                  >
                    {saving ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />}
                    Save Configuration
                  </Button>
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </Tabs>
      </div>

      <div className="lg:col-span-2 min-w-0 w-full lg:sticky lg:top-24 h-fit">
        <Card className="h-fit border-black/5 shadow-lg sm:shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-2xl sm:rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500 w-full">
          <CardHeader className="border-b border-black/5 bg-white/50 p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                    Variables
                  </CardTitle>
                  <CardDescription className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-slate-900 mt-0.5 opacity-60 font-sans">
                    Personalize your message
                  </CardDescription>
                  {isLoadingBookingData && (
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tight text-slate-600 animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Loading values...
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-900 opacity-50" />
                <Input
                  placeholder="Search variables..."
                  value={variableSearch}
                  onChange={(e) => setVariableSearch(e.target.value)}
                  className="pl-9 sm:pl-11 h-10 sm:h-11 text-xs sm:text-sm font-bold border-black/10 rounded-xl bg-white focus:ring-4 focus:ring-indigo-100/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] lg:h-[750px] scrollbar-thin">
              <div className="px-4 sm:px-6 pt-3 pb-6 space-y-4">
                {/* Formulas Guide */}
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 text-[11px] sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-600 uppercase tracking-tight">
                    <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Formulas</span>
                  </div>
                  <p className="text-slate-900 font-bold leading-relaxed">
                    Use <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-600/90">sum(...)</span> with <span className="text-slate-600 font-bold">+ - * /</span>
                  </p>
                  <div className="bg-white/50 p-2 rounded-lg border border-slate-200 font-mono text-[11px] sm:text-xs text-slate-900 font-bold">
                    Example: sum({'{total.paid}'} - {'{deposit}'})
                    <br/>
                    Result: 1000
                  </div>
                </div>

                {filteredVariables.length === 0 ? (
                  <div className="text-center py-12 animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Search className="w-6 h-6 text-slate-900" />
                    </div>
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900">No variables found matching "{variableSearch}"</p>
                  </div>
                ) : (
                  filteredVariables.map((category) => {
                    const styles = (() => {
                      switch (category.category) {
                        case "Customer": return { bg: "bg-indigo-50/50", text: "text-indigo-700", border: "border-indigo-100", dot: "bg-indigo-500", button: "hover:bg-indigo-600 hover:border-indigo-600" };
                        case "Booking": return { bg: "bg-emerald-50/50", text: "text-emerald-700", border: "border-emerald-100", dot: "bg-emerald-500", button: "hover:bg-emerald-600 hover:border-emerald-600" };
                        case "Package": return { bg: "bg-amber-50/50", text: "text-amber-700", border: "border-amber-100", dot: "bg-amber-500", button: "hover:bg-amber-600 hover:border-amber-600" };
                        case "Booking Item (First)": return { bg: "bg-orange-50/50", text: "text-orange-700", border: "border-orange-100", dot: "bg-orange-500", button: "hover:bg-orange-600 hover:border-orange-600" };
                        case "Passenger": return { bg: "bg-rose-50/50", text: "text-rose-700", border: "border-rose-100", dot: "bg-rose-500", button: "hover:bg-rose-600 hover:border-rose-600" };
                        case "Flight Operation": return { bg: "bg-sky-50/50", text: "text-sky-700", border: "border-sky-100", dot: "bg-sky-500", button: "hover:bg-sky-600 hover:border-sky-600" };
                        default: return { bg: "bg-slate-50/50", text: "text-slate-700", border: "border-slate-100", dot: "bg-slate-500", button: "hover:bg-slate-700 hover:border-slate-700" };
                      }
                    })();

                    return (
                      <div key={category.category} className={`space-y-3 p-3 rounded-2xl border ${styles.bg} ${styles.border}`}>
                        <h4 className={`font-bold text-[9px] sm:text-[10px] uppercase tracking-tight ${styles.text} px-1 flex items-center gap-2`}>
                          <span className={`w-1 h-1 rounded-full ${styles.dot}`}></span>
                          {category.category}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {category.vars.map((variable) => {
                             const firstPassenger = selectedBookingData?.booking_passengers?.[0];
                             const actualValue = selectedBookingData ? getVariableValue(variable, selectedBookingData, firstPassenger, { format: 'text' }) : null;
                             
                             return (
                              <button
                                key={variable}
                                draggable="true"
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', variable);
                                }}
                                className={`w-full text-left bg-white/90 p-3.5 sm:p-3 rounded-xl text-[11px] sm:text-[11px] font-bold border border-black/5 flex justify-between items-center group/var cursor-pointer transition-all active:scale-[0.98] shadow-sm ${styles.button} hover:text-white`}
                                onClick={() => {
                                  setMessage(prev => prev + variable);
                                  navigator.clipboard.writeText(variable);
                                  toast.success(`Added ${variable}`);
                                }}
                              >
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="truncate mr-2 text-slate-900 group-hover/var:text-white transition-colors">{variable}</span>
                                  {actualValue && (
                                    <span className={`text-[11px] ${styles.text} group-hover/var:text-white/80 font-bold truncate mt-1`}>
                                      = {actualValue}
                                    </span>
                                  )}
                                </div>
                                <span className="shrink-0 opacity-100 sm:opacity-0 group-hover/var:opacity-100 text-[9px] sm:text-[9px] font-bold uppercase tracking-tight text-slate-600 bg-white px-2 py-1 rounded shadow-sm transition-all duration-300">
                                  ADD
                                </span>
                              </button>
                             );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-6 sm:p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 animate-pulse">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white uppercase tracking-tight">WhatsApp Preview</DialogTitle>
                <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-tight mt-0.5">Payment Success Template</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsPreviewModalOpen(false)}
              className="rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="p-6 sm:p-10 bg-white">
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-400">Message Content</h4>
              </div>
              
              {renderPreviewContent()}

              <div className="pt-6 border-t border-black/5 flex justify-end">
                <Button 
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="h-12 px-8 bg-slate-900 text-white font-bold uppercase tracking-tight text-xs rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                >
                  Close Preview
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Sessions Management */}
      <div className="lg:col-span-8 min-w-0 w-full">
        <Card className="border-black/5 shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-2xl sm:rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500 w-full">
          <CardHeader className="border-b border-black/5 bg-white/50 p-4 sm:p-8 min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 min-w-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform duration-500 shrink-0">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xs sm:text-lg font-bold text-slate-900 uppercase tracking-tight truncate font-sans">WhatsApp Sessions</CardTitle>
                  <CardDescription className="text-[9px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-0.5 sm:mt-1 opacity-60 truncate font-sans">Manage bot connections</CardDescription>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900 opacity-40" />
                  <Input
                    placeholder="Search Session ID..."
                    value={filterSessionId}
                    onChange={(e) => setFilterSessionId(e.target.value)}
                    className="pl-10 h-12 text-[11px] font-bold border-black/10 rounded-2xl bg-white shadow-sm w-full focus:ring-4 focus:ring-indigo-100/5 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={fetchSessions} 
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-2xl border-black/10 hover:bg-slate-50 shadow-sm shrink-0 active:scale-95 transition-all"
                  >
                    <Search className="w-4.5 h-4.5 text-slate-900" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="destructive" className="flex-1 sm:flex-none h-12 px-6 rounded-2xl font-bold text-[10px] uppercase tracking-tight gap-2 shadow-lg shadow-red-200 active:scale-95 transition-all">
                        <Trash2 className="w-4 h-4" />
                        Clear Sessions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-black/5 shadow-2xl p-2 min-w-[200px] backdrop-blur-xl bg-white/95">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-tight text-slate-900 px-3 py-2">
                        Delete Sessions
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-black/5 mx-1" />
                      <DropdownMenuItem onClick={() => handleClearSessions('7d')} className="text-slate-600 cursor-pointer rounded-xl p-3 text-[10px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors">
                        Older than 1 Week
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleClearSessions('30d')} className="text-slate-600 cursor-pointer rounded-xl p-3 text-[10px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors">
                        Older than 1 Month
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-black/5 mx-1" />
                      <DropdownMenuItem onClick={() => handleClearSessions('all')} className="text-white font-bold cursor-pointer rounded-xl p-3 text-[10px] uppercase tracking-tight bg-slate-700 hover:bg-slate-800 shadow-lg shadow-red-200 m-1">
                        Delete All
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow className="border-black/5 hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold font-sans uppercase tracking-tight text-slate-900 h-16 px-8">Session ID</TableHead>
                    <TableHead className="text-[10px] font-bold font-sans uppercase tracking-tight text-slate-900 h-16 px-8">Key</TableHead>
                    <TableHead className="text-[10px] font-bold font-sans uppercase tracking-tight text-slate-900 h-16 px-8">Data</TableHead>
                    <TableHead className="text-[10px] font-bold font-sans uppercase tracking-tight text-slate-900 h-16 px-8">Last Updated</TableHead>
                    <TableHead className="text-right text-[10px] font-bold font-sans uppercase tracking-tight text-slate-900 h-16 px-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSessions ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                          <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-900">Syncing database...</span>
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
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-900">No sessions available</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSessions.map((session, idx) => (
                      <TableRow key={`${session.session_id}-${session.key}`} className="border-black/5 hover:bg-white/50 transition-colors group/row animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                        <TableCell className="font-mono text-xs text-slate-900 font-bold py-6 px-8">
                          <span className="bg-slate-100/50 px-3 py-1.5 rounded-lg border border-slate-200/50">{session.session_id}</span>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-700 py-6 px-8 font-medium">{session.key}</TableCell>
                        <TableCell className="max-w-md truncate text-[11px] text-slate-900 py-6 px-8 font-medium" title={JSON.stringify(session.data)}>
                          {JSON.stringify(session.data)}
                        </TableCell>
                        <TableCell className="py-6 px-8">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{format(new Date(session.updated_at), "MMM d, HH:mm")}</span>
                            <span className="text-[9px] font-bold text-slate-900 uppercase tracking-tight">Modified</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-6 px-8">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteSession(session.session_id, session.key)}
                            className="h-12 w-12 text-red-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all active:scale-90 group-hover/row:scale-110"
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

            {/* Mobile Card Layout */}
            <div className="block sm:hidden divide-y divide-black/5">
              {loadingSessions ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-slate-600" />
                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900">Syncing sessions...</p>
                </div>
              ) : paginatedSessions.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 opacity-40">
                  <MessageSquare className="h-12 w-12 text-slate-900" />
                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900">No sessions found</p>
                </div>
              ) : (
                paginatedSessions.map((session, idx) => (
                  <div 
                    key={`${session.session_id}-${session.key}`} 
                    className="p-4 space-y-4 bg-white/30 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"></span>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-900">Session ID</span>
                        </div>
                        <div className="relative group">
                          <code className="block text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 truncate font-mono">
                            {session.session_id}
                          </code>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteSession(session.session_id, session.key)}
                        className="h-12 w-12 text-red-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl shrink-0 border border-black/5 shadow-sm"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-black/5 space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">Key Type</span>
                        <p className="text-[10px] font-bold text-slate-700 truncate">{session.key}</p>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-black/5 space-y-1 text-right">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">Activity</span>
                        <p className="text-[10px] font-bold text-slate-900">
                          {format(new Date(session.updated_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">Payload Data</span>
                      </div>
                      <div className="text-[10px] font-medium text-slate-600 bg-black/5 p-4 rounded-2xl border border-black/5 break-all line-clamp-3 italic leading-relaxed">
                        {JSON.stringify(session.data)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-5 sm:p-8 border-t border-black/5 bg-white/50">
              <div className="flex items-center justify-center w-full sm:w-auto">
                <div className="text-[10px] font-bold uppercase tracking-tight text-slate-900 bg-slate-100/80 px-5 py-2.5 rounded-full border border-black/5 w-full sm:w-auto text-center">
                  Page {sessionPage} of {Math.max(1, totalPages)} <span className="mx-2 opacity-20 hidden sm:inline">•</span> <br className="sm:hidden" /> {sessions.length} sessions
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                  disabled={sessionPage === 1}
                  className="h-12 px-6 rounded-xl border-black/10 hover:bg-white disabled:opacity-30 transition-all font-bold text-[10px] uppercase tracking-tight gap-2 flex-1 sm:flex-none shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(p => Math.min(totalPages, p + 1))}
                  disabled={sessionPage >= totalPages}
                  className="h-12 px-6 rounded-xl border-black/10 hover:bg-white disabled:opacity-30 transition-all font-bold text-[10px] uppercase tracking-tight gap-2 flex-1 sm:flex-none shadow-sm"
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
