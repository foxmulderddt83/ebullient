import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Save, Mail, Plus, Trash2, X, Send, Info, Search, Calculator, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AVAILABLE_VARIABLES } from "@/lib/pdfGenerator";
import { notificationService } from "@/lib/notificationService";
import { logActivity } from "@/lib/activityLogger";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function EmailConfig({ onUpdate }: { onUpdate?: () => void }) {
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

  useEffect(() => {
    fetchTemplates();
    fetchBrevoConfig();
  }, []);

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
    setFormData(prev => ({ ...prev, message_content: prev.message_content + variable }));
  };

  const renderTemplateForm = () => {
    return (
      <div className="grid gap-8 p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Template Name</Label>
            <Input 
              value={formData.template_name} 
              onChange={e => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
              placeholder="e.g. Payment Success Notification"
              className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Subject Line</Label>
            <Input 
              value={formData.subject} 
              onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Booking Confirmation: {booking.reference}"
              className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">CC Emails</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addCC} 
              className="h-10 px-4 gap-2 bg-primary/5 text-primary/90 hover:bg-primary/10 border-primary/20 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add CC
            </Button>
          </div>
          
          <div className="space-y-3">
            {formData.cc_emails.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center bg-slate-50/30">
                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900">No CC recipients configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formData.cc_emails.map((email, index) => (
                  <div key={index} className="flex gap-2 group animate-in zoom-in-95 duration-300">
                    <Input 
                      value={email} 
                      onChange={e => updateCC(index, e.target.value)}
                      placeholder="cc@example.com"
                      className="border-black/10 h-14 text-[11px] sm:text-xs font-bold rounded-2xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => removeCC(index)} 
                      className="shrink-0 bg-red-50 text-red-600 hover:bg-red-100 border-red-200 h-10 w-10 rounded-xl transition-all"
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
          <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Message Content</Label>
          <div className="relative group">
            <Textarea 
              value={formData.message_content} 
              onChange={e => setFormData(prev => ({ ...prev, message_content: e.target.value }))}
              className="min-h-[350px] border-black/10 text-sm font-medium rounded-3xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm p-6 leading-relaxed"
              placeholder="Dear {customer.name}, ..."
            />
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 bg-white/80 px-3 py-1.5 rounded-full border border-slate-100 backdrop-blur-sm shadow-sm">
                Rich Text Enabled
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-black/5 mt-4">
          <Button 
            variant="outline"
            onClick={() => setIsCreating(false)}
            className="h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[11px] sm:text-xs border-black/10 hover:bg-slate-50 transition-all order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl gap-2 order-1 sm:order-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isCreating ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-2 space-y-8">
        <Card className="border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 p-6 bg-white/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                  Brevo Configuration
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary mt-1">
                  SMTP gateway and sender details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">From Name</Label>
                <Input
                  value={brevoConfig.from_name}
                  onChange={(e) => setBrevoConfig(prev => ({ ...prev, from_name: e.target.value }))}
                  placeholder="e.g. One Day Pilot"
                  className="border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">From Email</Label>
                <Input
                  value={brevoConfig.from_email}
                  onChange={(e) => setBrevoConfig(prev => ({ ...prev, from_email: e.target.value }))}
                  placeholder="e.g. bookings@onedaypilot.com"
                  className={`border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm ${['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'].some(d => brevoConfig.from_email.toLowerCase().includes(d)) ? "border-red-300 focus:ring-red-200 bg-red-50" : ""}`}
                />
                {['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'].some(d => brevoConfig.from_email.toLowerCase().includes(d)) && (
                  <p className="text-[11px] sm:text-xs text-red-600 font-black uppercase tracking-widest mt-2 bg-red-50/50 p-3 rounded-xl border border-red-100 flex gap-2 animate-in fade-in slide-in-from-top-2">
                    <span className="shrink-0 text-base">⚠️</span>
                    Warning: Public domains cause delivery errors. Use a custom domain.
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-900 ml-1">Brevo API Key</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={brevoConfig.api_key}
                    onChange={(e) => setBrevoConfig(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="xkeysib-..."
                    className="border-black/10 h-10 text-[11px] sm:text-xs font-bold rounded-xl focus:ring-4 focus:ring-primary/10 bg-white/50 focus:bg-white transition-all shadow-sm pr-10"
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

            <div className="pt-6 mt-2 border-t border-black/5 bg-primary/5/30 -mx-6 px-6 py-6 rounded-b-[2.5rem]">
              <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Send className="w-3.5 h-3.5" />
                </div>
                Test Configuration
              </h4>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-2 flex-1 w-full">
                  <Label className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-900 ml-1">Recipient Email</Label>
                  <Input 
                    placeholder="Enter email for test..." 
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="bg-white border-black/10 h-10 text-sm font-bold rounded-xl focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                  />
                </div>
                <Button 
                  onClick={handleTest} 
                  disabled={sendingTest} 
                  className="w-full sm:w-auto h-10 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl shadow-lg shadow-amber-200 active:scale-95 transition-all px-6"
                >
                  {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                  Send Test
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleSaveConfig} 
                disabled={savingConfig || loadingConfig} 
                className="w-full sm:w-auto h-10 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] sm:text-xs rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all px-8"
              >
                {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 shadow-xl shadow-primary/5 bg-white/70 backdrop-blur-md overflow-hidden rounded-[2.5rem] group hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-black/5 p-6 bg-white/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                    Email Templates
                  </CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-primary mt-1">
                    Automated notification content
                  </CardDescription>
                </div>
              </div>
              <Button 
                onClick={() => setIsCreating(true)} 
                size="sm" 
                className="w-full sm:w-auto h-10 gap-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-md"
              >
                <Plus className="w-4 h-4" /> New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 px-4 sm:px-6">
            {isCreating && (
              <div className="space-y-4 border rounded-2xl p-5 bg-primary/5/30 border-primary/10 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-primary/90 uppercase tracking-wide">
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
                <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-muted/5 border-dashed">
                <p className="text-slate-900 font-medium italic">No email templates found. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Template List</h4>
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
                      className="border border-black/5 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden px-0 bg-white/50 backdrop-blur-sm shadow-sm data-[state=open]:border-primary/30 data-[state=open]:shadow-xl data-[state=open]:shadow-primary/5 transition-all duration-300"
                    >
                      <AccordionTrigger className="hover:no-underline px-6 py-5 group transition-all">
                        <div className="flex items-center gap-4 text-left w-full">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${template.is_active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-900'}`}>
                            <Mail className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-900 truncate uppercase tracking-tight">{template.template_name}</p>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate uppercase tracking-[0.15em] mt-0.5">{template.subject}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 border-t border-black/5 pt-6 bg-white/80">
                        <div className="flex justify-end mb-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 border border-red-100 hover:bg-red-50 h-8 w-8 rounded-lg shadow-sm"
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

      <div className="lg:col-span-1 space-y-6">
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
                    Personalize your emails
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
    </div>
  );
}
