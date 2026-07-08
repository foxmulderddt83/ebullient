import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Upload, 
  Check, 
  XCircle, 
  ShieldCheck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventDetails } from "@/data/mockData";
import { RegistrationFormData } from "@/types/registration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "react-router-dom";
import { compressFile } from "@/utils/fileCompression";

const validatePhone = (phone: string) => {
  // Basic validation: starts with + and has 10-15 digits
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(phone);
};

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const formatFlightTime = (time: string | null | undefined) => {
    if (!time) return "TBD";
    if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
      return time.toUpperCase();
    }
    try {
      if (!time.includes(':')) return time.toUpperCase();
      const parts = time.split(':');
      const h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return time.toUpperCase();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${m.padStart(2, '0')} ${ampm}`;
    } catch (error) {
      return time.toUpperCase();
    }
  };
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState(eventDetails.timeSlots);
  const [templateConfig, setTemplateConfig] = useState<any>({
    steps: [
      { id: 1, title: "Select Date & Time", fields: ["date", "timeSlot"] },
      { id: 2, title: "Personal Information", fields: ["name", "email", "phone", "gender", "age", "address"] },
      { id: 3, title: "Documents & Notes", fields: ["document"] }
    ],
    labels: {
      continue_button: "Continue",
      submit_button: "Submit Registration",
      document_submission: "Upload Documents"
    }
  });
  const [eventData, setEventData] = useState<any>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null);
  const [registeredId, setRegisteredId] = useState<string | null>(null);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);

  // Helper function to format time
  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function for event countdown
  const getEventCountdown = () => {
    if (!eventData) return "";
    const eventDate = new Date(`${eventData.event_date}T${eventData.event_time}`);
    const now = new Date();
    const diff = eventDate.getTime() - now.getTime();
    
    if (diff <= 0) return "Event has started";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${mins}m remaining`;
  };

  useEffect(() => {
    if (testTimeLeft === null || testTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setTestTimeLeft(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [testTimeLeft]);

  useEffect(() => {
    const fetchEventAndSettings = async () => {
      const eid = params.get("eid");
      const expires = params.get("expires");
      const isTest = params.get("test") === "true";
      
      if (expires) {
        const expiryTime = parseInt(expires);
        const remaining = expiryTime - Date.now();
        if (remaining <= 0) {
          setIsExpired(true);
          return;
        }
        setTestTimeLeft(Math.floor(remaining / 1000));
      }

      if (!supabase) return;

      // Fetch settings first (only needed keys for performance)
      const { data: settingsData } = await supabase.from('site_settings').select('*').in('key', [
        'event_time_slots',
        'event_registration_template'
      ]);
      const settingsMap: Record<string, string> = {};
      if (settingsData) {
        settingsData.forEach(s => settingsMap[s.key] = s.value);
        
        if (settingsMap['event_time_slots']) {
          try { setTimeSlots(JSON.parse(settingsMap['event_time_slots'])); } catch(e) {}
        }
        if (settingsMap['event_registration_template']) {
          try { 
            const parsed = JSON.parse(settingsMap['event_registration_template']);
            if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
              setTemplateConfig(parsed); 
            }
          } catch(e) {}
        }
      }

      const applyPaymentConfig = (data: any, templateStr: string) => {
        try {
          if (!templateStr) return data;
          const parsed = JSON.parse(templateStr);
          console.log("Applying payment config from template:", parsed);
          if (parsed && parsed.fieldsConfig) {
            const pReq = parsed.fieldsConfig.payment_required;
            if (pReq) {
              data.payment_required = !!pReq.required;
              console.log("Payment required set to:", data.payment_required);
              if (pReq.payment_amount !== undefined) data.payment_amount = pReq.payment_amount;
              if (pReq.deposit_amount !== undefined) data.deposit_amount = pReq.deposit_amount;
            }
            if (parsed.fieldsConfig.enable_chip_payment) {
              data.enable_chip_payment = !!parsed.fieldsConfig.enable_chip_payment.required;
              console.log("Enable chip payment set to:", data.enable_chip_payment);
            }
            if (parsed.fieldsConfig.enable_deposit) data.enable_deposit = !!parsed.fieldsConfig.enable_deposit.required;
          }
        } catch(e) {
          console.error("Error applying payment config:", e);
        }
        return data;
      };

      // Fetch event data
      if (eid && eid !== 'default') {
        let eventData = null;
        const { data: byManualId } = await supabase.from('events').select('*').eq('event_id', eid).maybeSingle();
        if (byManualId) {
          eventData = byManualId;
        } else {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eid);
          if (isUuid) {
            const { data: byUuid } = await supabase.from('events').select('*').eq('id', eid).maybeSingle();
            eventData = byUuid;
          }
        }

        if (eventData) {
          setResolvedEventId(eventData.id);
          let updatedEventData: any = { ...eventData };
          const eventTime = new Date(`${eventData.event_date}T${eventData.event_time}`);
          if (!isTest && new Date() > eventTime) {
            setIsExpired(true);
          }
          
          // Override with Event Profile if available
          let fetchedProfileData: any = null;
          if (eventData.event_profile_id) {
            const { data: profileData } = await supabase
              .from('event_profiles')
              .select('*')
              .eq('id', eventData.event_profile_id)
              .maybeSingle();
              
            if (profileData) {
              fetchedProfileData = profileData;
              if (!eventData.event_time_slots && profileData.event_time_slots) {
                try { setTimeSlots(JSON.parse(profileData.event_time_slots)); } catch(e) {}
              }
              if (!eventData.event_registration_template && profileData.event_registration_template) {
                try { 
                  const parsed = JSON.parse(profileData.event_registration_template);
                  if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                    setTemplateConfig(parsed); 
                    updatedEventData = applyPaymentConfig(updatedEventData, profileData.event_registration_template);
                  }
                } catch(e) {}
              }
            }
          }
          
          // Event specific snapshots override profile
          if (eventData.event_time_slots) {
            try { setTimeSlots(JSON.parse(eventData.event_time_slots)); } catch(e) {}
          }
          if (eventData.event_registration_template) {
            try { 
              const parsed = JSON.parse(eventData.event_registration_template);
              if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                setTemplateConfig(parsed); 
                updatedEventData = applyPaymentConfig(updatedEventData, eventData.event_registration_template);
              }
            } catch(e) {}
          }
          
          // FORCE SYNC PAYMENT AMOUNT FROM EVENT OR PROFILE PRICES
          const ePromo = Number(eventData.promotion_price) || 0;
          const eBase = Number(eventData.price) || 0;
          const pPromo = eventData.event_profile_id && fetchedProfileData ? Number(fetchedProfileData.event_promotion_price) : 0;
          const pBase = eventData.event_profile_id && fetchedProfileData ? Number(fetchedProfileData.event_price) : 0;
          
          const finalPrice = ePromo > 0 ? ePromo : (eBase > 0 ? eBase : (pPromo > 0 ? pPromo : pBase));
          if (finalPrice > 0 && updatedEventData.payment_required) {
            updatedEventData.payment_amount = finalPrice;
          }
          
          setEventData(updatedEventData);
        } else {
          // If not an event, maybe it's an event profile?
          const { data: profileData } = await supabase
            .from('event_profiles')
            .select('*')
            .eq('id', eid)
            .maybeSingle();
            
          if (profileData) {
            setResolvedEventId(eid);
            let updatedEventData: any = {
              name: profileData.event_title || settingsMap['event_title'],
              location: profileData.event_location || settingsMap['event_location'],
            };
            if (profileData.event_time_slots) {
              try { setTimeSlots(JSON.parse(profileData.event_time_slots)); } catch(e) {}
            }
            if (profileData.event_registration_template) {
              try { 
                const parsed = JSON.parse(profileData.event_registration_template);
                if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                  setTemplateConfig(parsed); 
                  updatedEventData = applyPaymentConfig(updatedEventData, profileData.event_registration_template);
                }
              } catch(e) {}
            }
            
            // FORCE SYNC PAYMENT AMOUNT FROM PROFILE PRICES
            const pPromo = Number(profileData.event_promotion_price) || 0;
            const pBase = Number(profileData.event_price) || 0;
            const finalPrice = pPromo > 0 ? pPromo : pBase;
            if (finalPrice > 0 && updatedEventData.payment_required) {
              updatedEventData.payment_amount = finalPrice;
            }
            
            setEventData(updatedEventData);
          } else if (settingsMap['event_title']) {
            // Fallback to global settings if event/profile not found
            let defaultEvent: any = {
              name: settingsMap['event_title'],
              event_date: settingsMap['event_date'],
              event_time: settingsMap['event_time'],
              location: settingsMap['event_location']
            };
            if (settingsMap['event_registration_template']) {
               defaultEvent = applyPaymentConfig(defaultEvent, settingsMap['event_registration_template']);
            }
            setEventData(defaultEvent);
          }
        }
      } else if (settingsMap['event_title']) {
        // Use global settings for default event
        let defaultEvent: any = {
          name: settingsMap['event_title'],
          event_date: settingsMap['event_date'],
          event_time: settingsMap['event_time'],
          location: settingsMap['event_location']
        };
        if (settingsMap['event_registration_template']) {
           defaultEvent = applyPaymentConfig(defaultEvent, settingsMap['event_registration_template']);
        }
        setEventData(defaultEvent);
      }
    };
    fetchEventAndSettings();
  }, [params]);

  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    email: "",
    phone: "",
    gender: "Male",
    age: 25,
    weight: 70,
    address: "",
    selectedDate: undefined,
    selectedTimeSlot: "",
    notes: "",
    document: null,
    nric_confirmed: false,
    nric_number: "",
  });

  const checkWhatsAppStatus = async () => {
    // ALWAYS return true to prevent blocking the user
    return true;
  };

  const updateForm = <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type to determine limit
      const isImage = file.type.startsWith('image/');
      const limit = isImage ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
      const limitLabel = isImage ? "3MB" : "5MB";

      if (file.size > limit) {
        toast({ 
          title: "File too large", 
          description: `File size exceeds the ${limitLabel} limit.`,
          variant: "destructive"
        });
        e.target.value = ''; // Reset input
        return;
      }
      updateForm("document", file);
    }
  };

  const isFormValid = () => {
    if (!templateConfig || !templateConfig.steps) return false;
    
    // Check all fields across all steps
    const allRequiredFieldsMet = templateConfig.steps.every((s: any) => {
      return s.fields.every((fieldId: string) => {
        // These fields are display-only/config fields, not user inputs
        if (["payment_required", "enable_chip_payment", "enable_deposit"].includes(fieldId)) return true;

        const fieldConfig = templateConfig.fieldsConfig?.[fieldId];
        const isRequired = fieldConfig ? fieldConfig.required : (
          ["date", "timeSlot", "name", "email", "phone", "gender", "age", "address"].includes(fieldId)
        );

        if (!isRequired) return true;

        if (fieldId === "date") return !!formData.selectedDate;
        if (fieldId === "timeSlot") return !!formData.selectedTimeSlot;
        if (fieldId === "document") return !!formData.document;
        if (fieldId === "nric") return formData.nric_confirmed && !!formData.nric_number;
        
        const value = (formData as any)[fieldId];
        return value !== undefined && value !== null && value !== "";
      });
    });

    return allRequiredFieldsMet;
  };

  const isPaymentRequired = eventData?.payment_required;

  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({ 
        title: "Incomplete Form", 
        description: "Please fill in all required fields before submitting.",
        variant: "destructive"
      });
      return;
    }

    // If already registered and just pending payment, redirect to Checkout
    if (registeredId && (eventData?.payment_required || eventData?.enable_chip_payment)) {
      setIsSubmitting(true);
      console.log("Already registered, redirecting to Checkout:", registeredId);
      navigate("/checkout", { state: { registrationId: registeredId, eventId: resolvedEventId, paymentType: 'full', autoStart: true } });
      return;
    }

    setIsSubmitting(true);

    // 0. Format & Validate Phone Number
    const phoneConfig = templateConfig?.fieldsConfig?.phone;
    const isPhoneRequired = phoneConfig ? phoneConfig.required : true;
    
    let formattedPhone = formData.phone.replace(/[^\d+]/g, '');
    if (isPhoneRequired || formattedPhone.length > 0) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+6' + formattedPhone; // Default to Malaysia if starts with 0
      } else if (formattedPhone.length > 0 && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      if (isPhoneRequired && !validatePhone(formattedPhone)) {
        toast({ 
          title: "Invalid WhatsApp Number", 
          description: "Please enter a valid WhatsApp number with country code (e.g. +60123456789).",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
    }

    // 0.1 Check WhatsApp Bot Status - Only if phone is required
    if (isPhoneRequired) {
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        toast({ 
          title: "WhatsApp Bot Disconnected", 
          description: "WhatsApp bot is currently offline. Please contact OneDayPilot customer support at +603 9200 2998 for assistance.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
    }

    const eid = params.get("eid") || "default";
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      toast({ title: "Registration Successful! 🎉", description: "Saved locally. Supabase not configured." });
      setIsSubmitting(false);
      navigate("/event?" + params.toString());
      return;
    }
    let finalDocumentUrl = null;

    if (formData.document) {
      try {
        const compressedDocument = await compressFile(formData.document, true);
        const fileExt = compressedDocument.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${eid}/${fileName}`;

        // Try 'media' bucket first as it usually has public RLS policies
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .upload(`registrations/${filePath}`, compressedDocument, { upsert: true, cacheControl: '31536000' });

        if (uploadError) {
          console.error("Media bucket upload error:", uploadError);
          // Fallback to 'registrations' bucket
          const { data: regData, error: regError } = await supabase.storage
            .from('registrations')
            .upload(filePath, compressedDocument, { upsert: true, cacheControl: '31536000' });
          
          if (regError) {
            console.error("Registrations bucket upload error:", regError);
            throw regError;
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('registrations')
            .getPublicUrl(filePath);
          finalDocumentUrl = publicUrl;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(`registrations/${filePath}`);
          finalDocumentUrl = publicUrl;
        }
      } catch (error: any) {
        toast({ title: "Document upload failed", description: error.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formattedPhone,
      gender: formData.gender,
      age: formData.age,
      weight: formData.weight,
      address: formData.address,
      selected_date: formData.selectedDate ? formData.selectedDate.toISOString().split("T")[0] : null,
      selected_time_slot: formData.selectedTimeSlot,
      notes: formData.notes || "",
      document_url: finalDocumentUrl,
      nric_confirmed: formData.nric_confirmed,
      nric_number: formData.nric_number,
      event_id: resolvedEventId,
    };
    
    // Note: The schema in schemas.md shows 'event_registrations' table.
    // The columns match: name, email, phone, gender, age, weight, address, selected_date, selected_time_slot, notes, document_url
    
    const { data: newReg, error } = await supabase
      .from("event_registrations")
      .insert({
        ...payload,
        payment_status: 'unpaid',
        paid_amount: 0.00,
        payment_type: 'full'
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Submission failed", description: error.message });
      setIsSubmitting(false);
      return;
    }

    // Check if payment is required or enabled
    console.log("Event Data for payment check:", eventData);
    if (eventData && (eventData.payment_required || eventData.enable_chip_payment)) {
      setRegisteredId(newReg.id);
      
      // If payment is MANDATORY (payment_required = true), trigger payment immediately
      if (eventData.payment_required) {
        setIsSubmitting(true);
        console.log("Redirecting to Checkout for registration:", newReg.id);
        navigate("/checkout", { state: { registrationId: newReg.id, eventId: resolvedEventId, paymentType: 'full', autoStart: true } });
        return;
      } else if (eventData.enable_chip_payment) {
        // Payment is OPTIONAL (enable_chip_payment = true but payment_required = false)
        console.log("Redirecting to Checkout (Optional) for registration:", newReg.id);
        navigate("/checkout", { state: { registrationId: newReg.id, eventId: resolvedEventId, paymentType: 'full', autoStart: true } });
        return;
      }
    }

    toast({ title: "Registration Successful! 🎉", description: "Your registration has been saved." });
    setIsSubmitting(false);
    navigate("/event?" + params.toString());
  };

  const handlePayment = async (type: 'full' | 'deposit') => {
    if (!registeredId) return;
    
    console.log("Redirecting to Checkout from payment button:", registeredId, "Type:", type);
    navigate("/checkout", { state: { registrationId: registeredId, eventId: resolvedEventId, paymentType: type, autoStart: true } });
  };

  const canProceed = () => {
    if (!templateConfig || !templateConfig.steps || templateConfig.steps.length === 0) return false;

    const currentStepConfig = templateConfig.steps[step - 1];
    if (!currentStepConfig) return true;

    return currentStepConfig.fields.every((fieldId: string) => {
      // These fields are display-only/config fields, not user inputs
      if (["payment_required", "enable_chip_payment", "enable_deposit"].includes(fieldId)) return true;

      const fieldConfig = templateConfig.fieldsConfig?.[fieldId];
      const isRequired = fieldConfig ? fieldConfig.required : true;

      if (!isRequired) return true;

      if (fieldId === "date") return !!formData.selectedDate;
      if (fieldId === "timeSlot") return !!formData.selectedTimeSlot;
      if (fieldId === "document") return !!formData.document;
      if (fieldId === "nric") return formData.nric_confirmed && !!formData.nric_number;
      
      const value = (formData as any)[fieldId];
      return value !== undefined && value !== null && value !== "";
    });
  };

  const currentStepTitle = templateConfig?.steps?.[step - 1]?.title || 
    (step === 1 ? "Select Date & Time" : step === 2 ? "Personal Information" : "Documents & Notes");

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Event Expired</h1>
          <p className="text-muted-foreground">This registration link is no longer valid. The event has already passed or the link has expired.</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Test Mode Banner */}
      {params.get("test") === "true" && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold sticky top-0 z-[60] flex flex-col gap-1 shadow-md">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            <span>TEST MODE: Link expires in {testTimeLeft !== null ? formatTimeLeft(testTimeLeft) : '...'}</span>
          </div>
          {eventData && (
            <div className="text-[10px] opacity-90 border-t border-white/20 pt-1">
              Real Event: {getEventCountdown()}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className={`fixed ${params.get("test") === "true" ? 'top-12' : 'top-0'} left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border`}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate("/event?" + params.toString())}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">{currentStepTitle}</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Progress */}
      <div className={`fixed ${params.get("test") === "true" ? 'top-[104px]' : 'top-14'} left-0 right-0 z-40 bg-background px-4 py-3`}>
        <div className="max-w-lg mx-auto flex gap-2">
          {(templateConfig?.steps || []).map((_, i: number) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                (i + 1) <= step ? "bg-event-pink" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <main className={`max-w-lg mx-auto px-4 ${params.get("test") === "true" ? 'pt-40' : 'pt-28'} pb-28`}>
        <div className={`${isMobileView ? '' : 'animate-fade-in'} space-y-6`}>
          {templateConfig?.steps?.[step - 1]?.fields.map((fieldId: string) => (
            <FieldRenderer 
              key={fieldId} 
              fieldId={fieldId} 
              formData={formData} 
              updateForm={updateForm} 
              timeSlots={timeSlots} 
              templateConfig={templateConfig} 
              handleFileUpload={handleFileUpload} 
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              formatFlightTime={formatFlightTime}
              isMobileView={isMobileView}
            />
          ))}

          {/* Additional Notes (always at the end of the last configured step) */}
          {step === templateConfig?.steps?.length && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              {/* Summary */}
              <div className="bg-slate-50 border border-black rounded-2xl p-5 space-y-3 shadow-sm">
                <h3 className="font-bold text-slate-900">Registration Summary</h3>
                <div className="text-sm space-y-2">
                  {/* Dynamic Summary based on configured fields */}
                  {templateConfig.steps.flatMap((s: any) => s.fields).map((fieldId: string) => {
                    const fieldConfig = templateConfig.fieldsConfig?.[fieldId];
                    const label = fieldConfig?.label || (
                      fieldId === "date" ? "Date" :
                      fieldId === "timeSlot" ? "Time" :
                      fieldId === "name" ? "Full Name" :
                      fieldId === "email" ? "Email" :
                      fieldId === "phone" ? "Phone" :
                      fieldId === "gender" ? "Gender" :
                      fieldId === "age" ? "Age" :
                      fieldId === "weight" ? "Weight" :
                      fieldId === "address" ? "Address" :
                      fieldId === "nric" ? "NRIC / Passport" :
                      fieldId === "notes" ? "Notes" :
                      null
                    );

                    if (!label) return null;

                    let value = "";
                    if (fieldId === "date") value = formData.selectedDate?.toLocaleDateString() || "";
                    else if (fieldId === "timeSlot") value = formatFlightTime(formData.selectedTimeSlot) || "";
                    else if (fieldId === "nric") value = formData.nric_number || "";
                    else if (fieldId === "document") value = formData.document ? "Uploaded" : "";
                    else value = (formData as any)[fieldId]?.toString() || "";

                    if (!value) return null;

                    return (
                      <p key={fieldId} className="flex justify-between gap-4">
                        <span className="text-slate-500 shrink-0">{label}:</span> 
                        <span className="font-bold text-slate-900 text-right">{value}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Default fallback if no templateConfig */}
          {!templateConfig && (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Loading registration form...</p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-4 z-50">
        <div className="max-w-lg mx-auto">
          {step < (templateConfig?.steps?.length || 3) ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full gradient-event text-white font-bold py-7 rounded-2xl shadow-lg shadow-event-pink/20 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {templateConfig?.labels?.continue_button || "Continue"}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid()}
              className="w-full gradient-event text-white font-bold py-7 rounded-2xl shadow-lg shadow-event-pink/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : 
                (templateConfig?.labels?.submit_button || (isPaymentRequired ? "Pay & Register" : (eventData?.enable_chip_payment ? "Register & Pay" : "Submit Registration")))}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface FieldRendererProps {
  fieldId: string;
  formData: RegistrationFormData;
  updateForm: <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => void;
  timeSlots: string[];
  templateConfig: any;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  formatFlightTime: (time: string | null | undefined) => string;
  isMobileView: boolean;
}

const FieldRenderer = ({ 
  fieldId, 
  formData, 
  updateForm, 
  timeSlots, 
  templateConfig, 
  handleFileUpload, 
  onSubmit, 
  isSubmitting, 
  formatFlightTime,
  isMobileView
}: FieldRendererProps) => {
  const fieldConfig = templateConfig?.fieldsConfig?.[fieldId];
  const label = fieldConfig?.label || (
    fieldId === "date" ? "Select Date" :
    fieldId === "timeSlot" ? "Select Time Slot" :
    fieldId === "name" ? "Full Name" :
    fieldId === "email" ? "Email Address" :
    fieldId === "phone" ? "Phone Number" :
    fieldId === "gender" ? "Gender" :
    fieldId === "age" ? "Age" :
    fieldId === "weight" ? "Weight (kg)" :
    fieldId === "address" ? "Address" :
    fieldId === "document" ? (templateConfig?.labels?.document_submission || "Upload Documents") :
    fieldId
  );
  const isRequired = fieldConfig ? fieldConfig.required : (
    ["date", "timeSlot", "name", "email", "phone", "gender", "age", "address"].includes(fieldId)
  );

  switch (fieldId) {
    case "date":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">{label} {isRequired && <span className="text-event-pink">*</span>}</h2>
          <div className="bg-white rounded-3xl border border-black p-3 sm:p-4 shadow overflow-x-auto flex justify-center">
            <Calendar
              mode="single"
              selected={formData.selectedDate}
              onSelect={(date) => updateForm("selectedDate", date)}
              className="w-full max-w-full"
              disabled={(date) => date < new Date()}
            />
          </div>
        </div>
      );
    case "timeSlot":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">{label} {isRequired && <span className="text-event-pink">*</span>}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => updateForm("selectedTimeSlot", slot)}
                className={`px-4 py-4 rounded-2xl border-2 font-bold transition-all ${
                  formData.selectedTimeSlot === slot
                    ? "border-event-pink bg-event-pink/5 text-event-pink"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-event-pink/30"
                }`}
              >
                {formatFlightTime(slot)}
              </button>
            ))}
          </div>
        </div>
      );
    case "name":
      return (
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateForm("name", e.target.value)}
            placeholder={`Enter your ${label.toLowerCase()}`}
            className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm"
          />
        </div>
      );
    case "email":
      return (
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateForm("email", e.target.value)}
            placeholder="your@email.com"
            className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm"
          />
        </div>
      );
    case "phone":
      const isPhoneValid = validatePhone(formData.phone.startsWith('0') ? '+6' + formData.phone : formData.phone.startsWith('+') ? formData.phone : '+' + formData.phone);
      return (
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateForm("phone", e.target.value)}
            placeholder="+1 234 567 8900"
            className={`h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm ${
              formData.phone && !isPhoneValid ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
            }`}
          />
          <p className="text-[10px] text-slate-500 px-1 italic">
            Please include country code (e.g., +60 for Malaysia). Must be a valid WhatsApp number.
          </p>
          {formData.phone && !isPhoneValid && (
            <p className="text-[10px] text-red-500 px-1 font-bold">
              Invalid WhatsApp format. Use +[country_code][number].
            </p>
          )}
        </div>
      );
    case "gender":
      return (
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => updateForm("gender", value as "Male" | "Female" | "Other")}
          >
            <SelectTrigger className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "age":
      return (
        <div className="space-y-2">
          <Label htmlFor="age" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Input
            id="age"
            type="number"
            value={formData.age}
            onChange={(e) => updateForm("age", parseInt(e.target.value) || 0)}
            min={1}
            max={120}
            className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm"
          />
        </div>
      );
    case "weight":
      return (
        <div className="space-y-2">
          <Label htmlFor="weight" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Input
            id="weight"
            type="number"
            value={formData.weight}
            onChange={(e) => updateForm("weight", parseInt(e.target.value) || 0)}
            min={1}
            max={300}
            className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm"
          />
        </div>
      );
    case "address":
      return (
        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => updateForm("address", e.target.value)}
            placeholder="Enter your full address"
            className="min-h-[80px] sm:min-h-[100px] rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 text-sm"
          />
        </div>
      );
    case "nric":
      const isDocumentEnabled = templateConfig?.steps?.some((s: any) => s.fields.includes("document"));
      const docFieldConfig = templateConfig?.fieldsConfig?.["document"];
      const docLabel = docFieldConfig?.label || (templateConfig?.labels?.document_submission || "Upload Documents");
      const isDocRequired = docFieldConfig ? docFieldConfig.required : false;

      return (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
            <Checkbox
              id="nric_confirmed"
              checked={formData.nric_confirmed}
              onCheckedChange={(checked) => updateForm("nric_confirmed", !!checked)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="nric_confirmed"
                className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
              >
                {label.toUpperCase()} {isRequired && "*"}
              </label>
              <p className="text-[10px] sm:text-xs text-slate-500">
                I agree to provide my ID details for verification purposes.
              </p>
            </div>
          </div>
          
          {formData.nric_confirmed && (
            <div className={`space-y-4 sm:space-y-6 ${isMobileView ? '' : 'animate-in fade-in slide-in-from-top-2 duration-200'}`}>
              <div className="space-y-2">
                <Label htmlFor="nric_number" className="text-sm font-bold text-slate-700">NRIC / Passport Number {isRequired && "*"}</Label>
                <Input
                  id="nric_number"
                  value={formData.nric_number}
                  onChange={(e) => updateForm("nric_number", e.target.value.toUpperCase())}
                  placeholder="Enter NRIC / Passport Number"
                  className="h-12 sm:h-14 rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20 uppercase text-sm"
                />
              </div>

              {isDocumentEnabled && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-700">{docLabel} {isDocRequired && <span className="text-primary">*</span>}</h3>
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-sm text-center">
                    {formData.document ? (
                      <div className="space-y-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                          <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-slate-900">File Selected</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px] mx-auto">{formData.document.name}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateForm("document", null)}
                          className="h-8 sm:h-9 rounded-xl border-primary/20 text-primary hover:bg-primary/5 text-[10px] sm:text-xs"
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block space-y-2 sm:space-y-3 group">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 group-hover:bg-primary/5 text-slate-400 group-hover:text-primary rounded-full flex items-center justify-center mx-auto transition-colors">
                          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[10px] sm:text-xs uppercase tracking-widest">Click to Upload</p>
                          <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 italic">Support PDF (Max 5MB), JPG, PNG (Max 3MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                         />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    case "notes":
      return (
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-bold text-slate-700">{label} {isRequired && "*"}</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            placeholder="Enter any dietary requirements or special requests..."
            className="min-h-[120px] resize-none rounded-2xl border-slate-200 focus:border-event-pink focus:ring-event-pink/20"
          />
        </div>
      );
    case "document":
      const isNricEnabled = templateConfig?.steps?.some((s: any) => s.fields.includes("nric"));
      if (isNricEnabled) {
        return null; // Document upload is rendered inside the NRIC block if both are enabled
      }

      return (
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{label} {isRequired && <span className="text-primary">*</span>}</h2>
          <div className="bg-white rounded-3xl border border-black p-3 sm:p-8 shadow-sm text-center">
            {formData.document ? (
              <div className="space-y-4">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs sm:text-base">File Selected</p>
                  <p className="text-[10px] sm:text-sm text-slate-500">{formData.document.name}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => updateForm("document", null)}
                  className="h-9 sm:h-10 rounded-xl border-primary/20 text-primary hover:bg-primary/5 text-xs sm:text-sm"
                >
                  Change File
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block space-y-3 sm:space-y-4 group">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-50 group-hover:bg-primary/5 text-slate-400 group-hover:text-primary rounded-full flex items-center justify-center mx-auto transition-colors">
                  <Upload className="w-5 h-5 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-[10px] sm:text-xs uppercase tracking-widest">Click to Upload</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 italic">Support PDF (Max 5MB), JPG, PNG (Max 3MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>
        </div>
      );
    case "payment_required":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">{label} {isRequired && <span className="text-event-pink">*</span>}</h2>
          <button 
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full p-6 bg-event-pink/5 rounded-3xl border-2 border-dashed border-event-pink/20 flex flex-col items-center gap-4 transition-all hover:bg-event-pink/10 active:scale-[0.98] disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-event-pink/10 text-event-pink rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-slate-900 font-bold text-lg uppercase tracking-tight">
                RM {fieldConfig?.payment_amount?.toFixed(2) || '0.00'}
              </p>
              {fieldConfig?.deposit_amount ? (
                <p className="text-slate-500 text-xs font-medium">
                  Deposit option available: RM {fieldConfig.deposit_amount.toFixed(2)}
                </p>
              ) : null}
              {fieldConfig?.payment_description && (
                <p className="text-slate-400 text-[10px] italic max-w-[200px] mx-auto mt-2 leading-relaxed">
                  "{fieldConfig.payment_description}"
                </p>
              ) || (
                <p className="text-slate-400 text-[10px] italic max-w-[200px] mx-auto mt-2 leading-relaxed">
                  "Click to register and proceed to payment gateway"
                </p>
              )}
            </div>
            <div className="px-6 py-3 bg-event-pink text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-event-pink/20">
              {isSubmitting ? "Processing..." : "Pay & Register"}
            </div>
          </button>
        </div>
      );
    default:
      return null;
  }
};


export default Register;
