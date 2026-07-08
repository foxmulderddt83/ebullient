import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Save, Mail, Plus, Trash2, X, Send, Info, Search, Calculator, Eye, EyeOff, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AVAILABLE_VARIABLES, getVariableValue } from "@/lib/pdfGenerator";
import { notificationService } from "@/lib/notificationService";
import { logActivity } from "@/lib/activityLogger";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { sanitizeHtml } from "@/lib/security";

interface EmailTemplate {
  id: string;
  template_name: string;
  subject: string;
  cc_emails: string[];
  message_content: string;
  email_to?: string;
  is_active: boolean;
  created_at?: string;
}

export default function EmailConfig({ onUpdate, canEdit = true }: { onUpdate?: () => void, canEdit?: boolean }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<EmailTemplate>({
    id: "",
    template_name: "",
    subject: "",
    cc_emails: [""],
    message_content: "",
    is_active: true
  });

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | undefined>(undefined);
  const [variableSearch, setVariableSearch] = useState("");

  // Memoized Filtered Variables
  const filteredVariables = React.useMemo(() => {
    if (!variableSearch) return AVAILABLE_VARIABLES;
    const search = variableSearch.toLowerCase();
    return AVAILABLE_VARIABLES.map(category => ({
      ...category,
      vars: category.vars.filter(v => v.toLowerCase().includes(search))
    })).filter(category => category.vars.length > 0);
  }, [variableSearch]);

  // Brevo Config State
  const [brevoConfig, setBrevoConfig] = useState({
    id: "",
    api_key: "",
    from_email: "",
    from_name: ""
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Test Email State
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [isBrevoGuidanceOpen, setIsBrevoGuidanceOpen] = useState(false);

  const [latestBookings, setLatestBookings] = useState<any[]>([]);
  const [previewBookingId, setPreviewBookingId] = useState("");
  const [selectedBookingData, setSelectedBookingData] = useState<any | null>(null);
  const [isLoadingBookingData, setIsLoadingBookingData] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");

  useEffect(() => {
    fetchTemplates();
    fetchBrevoConfig();
    fetchLatestBookings();
  }, []);

  const fetchLatestBookings = async () => {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('booking_id, booking_reference, created_at, flight_date, customer:customers(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      setLatestBookings((data || []) as any[]);
    } catch {
      setLatestBookings([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!previewBookingId) {
        setSelectedBookingData(null);
        return;
      }
      setIsLoadingBookingData(true);
      try {
        const booking = await notificationService.fetchBookingWithDetails(previewBookingId);
        setSelectedBookingData(booking);
      } finally {
        setIsLoadingBookingData(false);
      }
    };
    run();
  }, [previewBookingId]);

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const applyVariables = (template: string, booking: any) => {
    let output = template || "";
    const firstPassenger = booking?.booking_passengers?.[0];
    AVAILABLE_VARIABLES.forEach(category => {
      category.vars.forEach(variable => {
        const value = getVariableValue(variable, booking, firstPassenger);
        const regex = new RegExp(escapeRegex(variable), 'g');
        output = output.replace(regex, value);
      });
    });
    return output;
  };

  const handlePreview = async () => {
    if (!previewBookingId) {
      toast.error("Please select a booking first");
      return;
    }
    let booking = selectedBookingData;
    if (!booking) {
      setIsLoadingBookingData(true);
      try {
        booking = await notificationService.fetchBookingWithDetails(previewBookingId);
        setSelectedBookingData(booking);
      } finally {
        setIsLoadingBookingData(false);
      }
    }
    if (!booking) {
      toast.error("Booking not found");
      return;
    }

    setPreviewSubject(applyVariables(formData.subject || "", booking));
    setPreviewBody(applyVariables(formData.message_content || "", booking));
    setIsPreviewOpen(true);
  };

  const fetchBrevoConfig = async () => {
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from('email_settings_mission')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== '42P01') {
        console.error('Error fetching brevo config:', error);
      }

      if (data) {
        setBrevoConfig({
          id: data.id,
          api_key: data.smtp_password || "",
          from_email: data.from_email || "",
          from_name: data.from_name || ""
        });
      }
    } catch (error) {
      console.error('Error fetching brevo config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!brevoConfig.api_key || !brevoConfig.from_email) {
      toast.error("API Key and From Email are required");
      return;
    }

    setSavingConfig(true);
    try {
      const payload = {
        smtp_password: brevoConfig.api_key,
        from_email: brevoConfig.from_email,
        from_name: brevoConfig.from_name,
        smtp_host: 'smtp-relay.brevo.com', // Default
        smtp_port: 587, // Default
        smtp_username: brevoConfig.from_email, // Usually same as email
        is_active: true
      };

      if (brevoConfig.id) {
        // Update
        const { error } = await supabase
          .from('email_settings_mission')
          .update(payload)
          .eq('id', brevoConfig.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('email_settings_mission')
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Brevo configuration saved");
      logActivity(supabase, brevoConfig.id ? 'update' : 'insert', 'email_settings_mission', brevoConfig.id || 'new', payload);
      fetchBrevoConfig();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(`Failed to save config: ${error.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address for testing");
      return;
    }
    if (!brevoConfig.api_key || !brevoConfig.from_email) {
      toast.error("Please configure and save API Key and From Email first");
      return;
    }

    setSendingTest(true);
    try {
      // Use current config state, assuming it's up to date or saved
      const result = await notificationService.sendTestEmail(brevoConfig, testEmail);
      if (result.success) {
        // @ts-ignore
        toast.success(`Test email sent! Message ID: ${result.messageId || 'OK'}`);
      } else {
        toast.error(`Failed to send test email: ${result.error}`);
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    if (selectedTemplateId && !isCreating) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setFormData({
          ...template,
          cc_emails: template.cc_emails && template.cc_emails.length > 0 ? template.cc_emails : [""]
        });
      }
    } else if (isCreating) {
      setFormData({
        id: "",
        template_name: "",
        subject: "",
        cc_emails: [""],
        message_content: "",
        is_active: true
      });
    }
  }, [selectedTemplateId, isCreating, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Fetch from message_settings with error handling
      const { data, error } = await supabase
        .from('message_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') { // Table doesn't exist
          console.warn('message_settings table does not exist yet');
          setTemplates([]);
          return;
        }
        throw error;
      }
      
      setTemplates(data || []);
      
    } catch (error) {
      console.error('Error fetching email templates:', error);
      // Don't show toast if it's just a missing table (user will create it manually)
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.template_name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);
    try {
      const filteredCC = formData.cc_emails.filter(e => e.trim() !== "");
      
      const payload = {
        template_name: formData.template_name,
        subject: formData.subject,
        cc_emails: filteredCC,
        message_content: formData.message_content,
        is_active: true
      };

      let error;
      
      if (isCreating) {
        // Create new
        const { error: insertError } = await supabase
          .from('message_settings')
          .insert(payload);
        error = insertError;
      } else {
        // Update existing
        const { error: updateError } = await supabase
          .from('message_settings')
          .update(payload)
          .eq('id', selectedTemplateId);
        error = updateError;
      }

      if (error) throw error;

      toast.success(isCreating ? "Template created successfully" : "Template updated successfully");
      logActivity(supabase, isCreating ? 'insert' : 'update', 'message_settings', isCreating ? 'new' : selectedTemplateId, payload);
      setIsCreating(false);
      setExpandedTemplateId(isCreating ? "" : formData.id);
      await fetchTemplates();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from('message_settings')
        .delete()
        .eq('id', selectedTemplateId);

      if (error) throw error;

      toast.success("Template deleted");
      logActivity(supabase, 'delete', 'message_settings', selectedTemplateId);
      setSelectedTemplateId("");
      setExpandedTemplateId(undefined);
      await fetchTemplates();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const addCC = () => {
    setFormData(prev => ({ ...prev, cc_emails: [...prev.cc_emails, ""] }));
  };

  const updateCC = (index: number, value: string) => {
    const newCC = [...formData.cc_emails];
    newCC[index] = value;
    setFormData(prev => ({ ...prev, cc_emails: newCC }));
  };

  const removeCC = (index: number) => {
    const newCC = formData.cc_emails.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, cc_emails: newCC.length ? newCC : [""] }));
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      setFormData(prev => ({ ...prev, message_content: before + variable + after }));
      
      // Update selection after state update
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 10);
    } else {
      setFormData(prev => ({ ...prev, message_content: prev.message_content + variable }));
    }
  };

  const renderTemplateForm = () => {
    return (
      <fieldset disabled={!canEdit} className="grid gap-8 p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Template Name</Label>
            <Input 
              value={formData.template_name} 
              onChange={e => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
              placeholder="e.g. Payment Success Notification"
              className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Subject Line</Label>
            <Input 
              value={formData.subject} 
              onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Booking Confirmation: {booking.reference}"
              className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900">CC Emails</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addCC} 
              className="h-10 px-4 gap-2 bg-slate-50 text-slate-600/90 hover:bg-slate-700/10 border-slate-200 rounded-xl font-bold uppercase tracking-tight text-[11px] sm:text-xs transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add CC
            </Button>
          </div>
          
          <div className="space-y-3">
            {formData.cc_emails.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center bg-slate-50/30">
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900">No CC recipients configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formData.cc_emails.map((email, index) => (
                  <div key={index} className="flex gap-2 group animate-in zoom-in-95 duration-300">
                    <Input 
                      value={email} 
                      onChange={e => updateCC(index, e.target.value)}
                      placeholder="cc@example.com"
                      className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => removeCC(index)} 
                      className="shrink-0 bg-red-50 text-slate-600 hover:bg-red-100 border-red-200 h-10 w-10 rounded-xl transition-all"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Message Content</Label>
          <div className="relative group">
            <Textarea 
              value={formData.message_content} 
              onChange={e => setFormData(prev => ({ ...prev, message_content: e.target.value }))}
              className="min-h-[350px] border-black/10 text-sm font-medium rounded-3xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm p-6 leading-relaxed"
              placeholder="Dear {customer.name}, ..."
            />
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 bg-white/80 px-3 py-1.5 rounded-full border border-slate-100 backdrop-blur-sm shadow-sm">
                Rich Text Enabled
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-black/5 mt-4">
          <Button 
            variant="outline"
            onClick={() => setIsCreating(false)}
            className="h-10 px-6 rounded-xl font-bold uppercase tracking-tight text-[11px] sm:text-xs border-black/10 hover:bg-slate-50 transition-all order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="h-10 px-6 bg-slate-700 hover:bg-slate-700/90 text-white shadow-lg shadow-slate-200/50 transition-all duration-300 font-bold uppercase tracking-tight text-[11px] sm:text-xs rounded-xl gap-2 order-1 sm:order-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isCreating ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </fieldset>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-8 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-6 space-y-8">
        <Card className="border-black/5 shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 p-6 bg-white/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-white shadow-lg shadow-slate-200/50 group-hover:scale-110 transition-transform duration-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                    Brevo Configuration
                  </CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 mt-1 font-sans">
                    SMTP gateway and sender details
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBrevoGuidanceOpen(true)}
                className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 font-bold uppercase tracking-tight text-[10px] flex gap-2 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Info className="w-3.5 h-3.5" />
                How to Setup
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <fieldset disabled={!canEdit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">From Name</Label>
                  <Input
                    value={brevoConfig.from_name}
                    onChange={(e) => setBrevoConfig(prev => ({ ...prev, from_name: e.target.value }))}
                    placeholder="e.g. One Day Pilot"
                    className="border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">From Email</Label>
                  <Input
                    value={brevoConfig.from_email}
                    onChange={(e) => setBrevoConfig(prev => ({ ...prev, from_email: e.target.value }))}
                    placeholder="e.g. bookings@onedaypilot.com"
                    className={`border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm ${['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'].some(d => brevoConfig.from_email.toLowerCase().includes(d)) ? "border-red-300 focus:ring-red-200 bg-red-50" : ""}`}
                  />
                  {['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'].some(d => brevoConfig.from_email.toLowerCase().includes(d)) && (
                    <p className="text-[11px] sm:text-xs text-slate-600 font-bold uppercase tracking-tight mt-2 bg-red-50/50 p-3 rounded-xl border border-slate-200 flex gap-2 animate-in fade-in slide-in-from-top-2">
                      <span className="shrink-0 text-base">⚠️</span>
                      Warning: Public domains cause delivery errors. Use a custom domain.
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Brevo API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={brevoConfig.api_key}
                      onChange={(e) => setBrevoConfig(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder="xkeysib-..."
                      className="border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-indigo-100/10 bg-white/50 focus:bg-white transition-all shadow-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-2 border-t border-black/5 bg-slate-50/30 -mx-6 px-6 py-6 rounded-b-[2.5rem]">
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-slate-700/10 rounded-lg">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  Test Configuration
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="space-y-2 flex-1 w-full">
                    <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Recipient Email</Label>
                    <Input 
                      placeholder="Enter email for test..." 
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="bg-white border-black/10 h-10 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100/10 transition-all shadow-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleTest} 
                    disabled={sendingTest} 
                    className="w-full sm:w-auto h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-tight text-[11px] sm:text-xs rounded-xl shadow-lg shadow-amber-200 active:scale-95 transition-all px-6"
                  >
                    {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                    Send Test
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleSaveConfig} 
                  disabled={savingConfig || loadingConfig || !canEdit} 
                  className="w-full sm:w-auto h-10 bg-slate-700 hover:bg-slate-700/90 text-white font-bold uppercase tracking-tight text-[11px] sm:text-xs rounded-xl shadow-lg shadow-slate-200/50 active:scale-95 transition-all px-8"
                >
                  {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                  Save Configuration
                </Button>
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <div className="space-y-4 border border-black rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 bg-slate-50/50 backdrop-blur-md shadow-inner">
          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 ml-1">Preview Generation</Label>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 bg-white/60 p-3 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-black/5 sm:items-center backdrop-blur-sm">
            <Select value={previewBookingId} onValueChange={setPreviewBookingId}>
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
                          <span className="font-bold text-slate-600">{booking.booking_reference}</span>
                          <span className="font-medium text-slate-900">{booking.customer?.name || 'Unknown'}</span>
                        </div>
                        {booking.flight_date && (
                          <span className="text-[9px] font-bold uppercase tracking-tight">
                            <span className="text-slate-500">{format(new Date(booking.flight_date), "EEE").toUpperCase()}</span>
                            <span className="text-slate-500 ml-1">{format(new Date(booking.flight_date), "d MMM yyyy")}</span>
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={handlePreview}
              disabled={isLoadingBookingData || !previewBookingId}
              className="h-12 sm:h-11 px-6 w-full sm:w-auto shrink-0 rounded-lg sm:rounded-xl bg-slate-700 text-white hover:bg-slate-700/90 transition-all active:scale-[0.98] shadow-lg shadow-slate-200/50 text-[10px] sm:text-xs font-bold uppercase tracking-tight flex items-center justify-center gap-2 border-none"
            >
              {isLoadingBookingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              <span>PREVIEW</span>
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-900 ml-1 sm:ml-2 italic flex items-center gap-2">
            <Info className="w-3 h-3" />
            Select a booking to preview the rendered subject and message content.
          </p>
        </div>

        <Card className="overflow-hidden border-black/5 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-200/50 rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <CardHeader className="border-b border-black/5 bg-white/50 p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
              <Button 
                onClick={() => setIsCreating(true)} 
                size="sm" 
                disabled={!canEdit}
                className="w-full sm:w-auto h-10 gap-2 bg-slate-700 hover:bg-slate-700/90 text-white font-bold rounded-xl shadow-md"
              >
                <Plus className="w-4 h-4" /> New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 px-4 sm:px-6">
            {isCreating && (
              <div className="space-y-4 border rounded-2xl p-5 bg-slate-50/30 border-slate-200 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-slate-600/90 uppercase tracking-wide">
                    <Plus className="w-4 h-4" />
                    New Template
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="h-8 w-8 rounded-full">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {renderTemplateForm()}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600/20" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-muted/5 border-dashed">
                <p className="text-slate-900 font-medium italic">No email templates found. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-900 ml-1">Template List</h4>
                <Accordion 
                  type="single" 
                  collapsible 
                  value={expandedTemplateId} 
                  onValueChange={(id) => {
                    setExpandedTemplateId(id);
                    if (id) {
                      const template = templates.find(t => t.id === id);
                      if (template) {
                        setSelectedTemplateId(id);
                        setFormData({
                          ...template,
                          cc_emails: template.cc_emails && template.cc_emails.length > 0 ? template.cc_emails : [""]
                        });
                        setIsCreating(false);
                      }
                    }
                  }}
                  className="space-y-4"
                >
                  {templates.map((template) => (
                    <AccordionItem 
                      key={template.id} 
                      value={template.id} 
                      className="border border-black/5 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden px-0 bg-white/50 backdrop-blur-sm shadow-sm data-[state=open]:border-slate-700/30 data-[state=open]:shadow-xl data-[state=open]:shadow-slate-200/50 transition-all duration-300"
                    >
                      <AccordionTrigger className="hover:no-underline px-6 py-5 group transition-all">
                        <div className="flex items-center gap-4 text-left w-full">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${template.is_active ? 'bg-slate-700 text-white shadow-lg shadow-slate-200/50' : 'bg-slate-100 text-slate-900'}`}>
                            <Mail className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate uppercase tracking-tight">{template.template_name}</p>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate uppercase tracking-tight mt-0.5">{template.subject}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 border-t border-black/5 pt-6 bg-white/80">
                        <div className="flex justify-end mb-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-600 border border-slate-200 hover:bg-slate-50 h-8 w-8 rounded-lg shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete();
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {renderTemplateForm()}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:sticky lg:top-24 h-fit">
        <Card className="h-fit border-black/5 shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md overflow-hidden rounded-2xl sm:rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 bg-white/50 p-5 pb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 uppercase tracking-tight font-sans">
                    Variables
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-tight text-slate-900 mt-0.5 font-sans">
                    Personalize your emails
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900" />
                <Input
                  placeholder="Search variables..."
                  value={variableSearch}
                  onChange={(e) => setVariableSearch(e.target.value)}
                  className="pl-11 h-11 text-sm font-bold border-black/10 rounded-xl bg-white focus:ring-4 focus:ring-indigo-100/10 transition-all shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] lg:h-[750px] scrollbar-thin">
              <div className="px-4 sm:px-6 pt-3 pb-6 space-y-4">
                {/* Formulas Guide */}
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 text-xs sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-600 uppercase tracking-tight">
                    <Calculator className="w-4 h-4" />
                    <span>Formulas</span>
                  </div>
                  <p className="text-slate-900 font-bold leading-relaxed">
                    Use <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-600/90">sum(...)</span> with <span className="text-slate-600 font-bold">+ - * /</span>
                  </p>
                  <div className="bg-white/50 p-2 rounded-lg border border-slate-200/50 font-mono text-[11px] sm:text-xs text-slate-900 font-bold">
                    Example: sum({"{total.paid}"} - {"{deposit}"})
                    <br/>
                    Result: 1000
                  </div>
                </div>

                {filteredVariables.map((category) => {
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
                      <h4 className={`font-bold text-[10px] uppercase tracking-tight ${styles.text} px-1 flex items-center gap-2`}>
                        <span className={`w-1 h-1 rounded-full ${styles.dot}`}></span>
                        {category.category}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {category.vars.map((variable) => {
                          const firstPassenger = selectedBookingData?.booking_passengers?.[0];
                          const rawValue = selectedBookingData ? getVariableValue(variable, selectedBookingData, firstPassenger) : null;
                          const actualValue = typeof rawValue === 'string' ? rawValue.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() : rawValue;

                          return (
                            <button
                              key={variable}
                              draggable="true"
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', variable);
                              }}
                              className={`w-full text-left bg-white/90 p-3.5 sm:p-3 rounded-xl text-[11px] sm:text-[11px] font-bold border border-black/5 flex justify-between items-center group/var cursor-pointer transition-all active:scale-[0.98] shadow-sm ${styles.button} hover:text-white`}
                              onClick={() => {
                                insertVariable(variable);
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
                })}
                {filteredVariables.length === 0 && (
                  <div className="text-center py-12 animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Search className="w-6 h-6 text-slate-900" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-tight text-slate-900">No variables found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[980px] w-[95vw] sm:w-full max-h-[92vh] overflow-hidden p-0 gap-0 rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 border-b bg-slate-50/50">
            <DialogTitle className="text-lg sm:text-xl font-bold text-slate-950 uppercase tracking-tight">Email Preview</DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight">
              Rendered using the selected booking data
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-white">
            <div className="space-y-2">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 ml-1">Subject</Label>
              <div className="border border-black/10 rounded-xl p-3 bg-slate-50/30 font-mono text-[11px] sm:text-xs font-bold text-slate-900 break-words">
                {previewSubject || "(no subject)"}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-600 ml-1">Message</Label>
              {/<[^>]+>/.test(previewBody) ? (
                <div className="border border-black/10 rounded-xl p-4 bg-white shadow-sm">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewBody) }} />
                </div>
              ) : (
                <div className="border border-black/10 rounded-xl p-4 bg-white shadow-sm whitespace-pre-wrap text-[12px] sm:text-sm text-slate-900 font-medium">
                  {previewBody || "(no message)"}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brevo Setup Guidance Dialog */}
      <Dialog open={isBrevoGuidanceOpen} onOpenChange={setIsBrevoGuidanceOpen}>
        <DialogContent className="max-w-[800px] w-[95vw] max-h-[92vh] overflow-hidden p-0 gap-0 rounded-[2rem] border-black/5 shadow-2xl">
          <DialogHeader className="p-6 sm:p-8 border-b bg-white relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0092FF]/10 flex items-center justify-center text-[#0092FF]">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight font-sans">
                  How to get Brevo API Key
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-500 mt-1">
                  Step-by-step guide to configure your SMTP gateway
                </DialogDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsBrevoGuidanceOpen(false)}
              className="absolute right-6 top-6 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 sm:p-8 space-y-8 bg-slate-50/30">
              {/* Replicated Brevo UI from Image */}
              <div className="relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-black/5 bg-white shadow-2xl font-sans">
                {/* Brevo Mock Header */}
                <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#0092FF] rounded flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rotate-45" />
                      </div>
                      <span className="font-bold text-slate-900 text-sm">brevo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Usage and plan
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100" />
                  </div>
                </div>

                <div className="flex h-[450px]">
                  {/* Sidebar Mock */}
                  <div className="w-48 border-r border-slate-100 bg-white p-4 space-y-6 overflow-y-auto">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Personal settings</p>
                      <ul className="space-y-2 text-[11px] font-medium text-slate-600">
                        <li>Profile</li>
                        <li>General</li>
                        <li>Language</li>
                        <li>Individual email</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Organization settings</p>
                      <ul className="space-y-2 text-[11px] font-medium text-slate-600">
                        <li>Users</li>
                        <li>Senders, domains, IPs</li>
                        <li className="relative">
                          <div className="text-[#0092FF] bg-blue-50 -mx-4 px-4 py-1.5 border-r-2 border-[#0092FF]">SMTP & API</div>
                          {/* Red Highlight for Sidebar Item */}
                          <div className="absolute inset-0 -mx-1 border-2 border-red-500 rounded shadow-[0_0_15px_rgba(239,68,68,0.4)] pointer-events-none z-20" />
                        </li>
                        <li>Aura AI control center</li>
                        <li>Security</li>
                        <li>Localization</li>
                      </ul>
                    </div>
                  </div>

                  {/* Main Content Mock */}
                  <div className="flex-1 bg-[#f8f9fc] p-8 overflow-y-auto relative">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-bold text-slate-900">SMTP & API</h3>
                      
                      <div className="relative">
                        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg">
                          <Plus className="w-3.5 h-3.5" /> Generate API key
                        </button>
                        
                        {/* Red Highlight and Arrow for Button */}
                        <div className="absolute -inset-2 border-2 border-red-500 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] pointer-events-none z-20" />
                        <motion.div 
                          animate={{ x: [0, 10, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute -right-10 top-1/2 -translate-y-1/2 text-red-500 z-30 pointer-events-none"
                        >
                          <ArrowRight className="w-8 h-8 font-black" />
                        </motion.div>
                      </div>
                    </div>

                    <div className="flex gap-8 border-b border-slate-200 mb-6">
                      <div className="pb-3 text-slate-500 text-xs font-bold cursor-pointer">SMTP</div>
                      <div className="pb-3 text-[#0092FF] border-b-2 border-[#0092FF] text-xs font-bold cursor-pointer">API keys & MCP</div>
                    </div>

                    {/* Info Banner */}
                    <div className="bg-[#EEF2FF] border border-blue-100 rounded-xl p-4 mb-8 flex gap-4">
                      <div className="w-5 h-5 rounded-full bg-[#0092FF] text-white flex items-center justify-center text-[10px] font-bold shrink-0">i</div>
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold text-slate-800">Unauthorized IP addresses are not blocked for your API keys</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-xl">
                          To secure your account and API keys, activate blocking of unauthorized IP addresses for API keys to restrict API calls to authorized IP addresses only.
                        </p>
                        <button className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-bold">
                          Activate for API keys
                        </button>
                      </div>
                    </div>

                    {/* API Key Table Mock */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">Your API Keys</p>
                      </div>
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <div className="w-64 h-9 bg-white border border-slate-200 rounded-lg pl-9 pr-4 flex items-center text-[10px] text-slate-400">
                          Search your API keys
                        </div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-[10px]">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">API / MCP key</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Created on</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50">
                              <td className="px-4 py-4 font-mono text-slate-400">*********birgJ8</td>
                              <td className="px-4 py-4 font-bold text-slate-900">digitala_JUNE</td>
                              <td className="px-4 py-4">
                                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Active</span>
                              </td>
                              <td className="px-4 py-4 text-slate-500 font-medium">June 5, 2026</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step List */}
              <div className="space-y-4 px-2">
                <div className="flex items-start gap-5 group">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">1</div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-tight text-sm">Register or login at Brevo</p>
                    <a 
                      href="https://app.brevo.com" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 text-[#0092FF] font-black uppercase tracking-widest text-[11px] hover:underline"
                    >
                      app.brevo.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-5 group">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">2</div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-tight text-sm">Access SMTP & API Settings</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Click on your profile at the top right and go to <span className="text-slate-900">SMTP & API</span>.</p>
                  </div>
                </div>

                <div className="flex items-start gap-5 group">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">3</div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-tight text-sm">Generate your API Key</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Click <span className="text-slate-900">Generate a new API key</span>, name it (e.g., "OneDayPilot"), and copy the key here.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Pro Tip</p>
                  <p className="text-[11px] font-bold text-blue-700/80 leading-relaxed">
                    Make sure to verify your "From Email" domain in Brevo's "Senders & Domains" section to ensure high delivery rates.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-6 sm:p-8 bg-white border-t border-black/5 flex justify-end">
            <Button 
              onClick={() => setIsBrevoGuidanceOpen(false)}
              className="h-12 px-10 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all"
            >
              Close Guide
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
