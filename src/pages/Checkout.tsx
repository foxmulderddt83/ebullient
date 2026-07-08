import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, QrCode, CreditCard, Trash2, ShoppingBag as ShoppingBagIcon, Clock as ClockIcon, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BackgroundParticles } from "@/components/ui/BackgroundParticles";
import { notificationService } from "@/lib/notificationService";
import { applyWatermark } from "@/components/BookingWizard";
import { compressFile } from "@/utils/fileCompression";
import { useToast } from "@/hooks/use-toast";
import { generateBookingReference } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

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

export default function Checkout() {
  const { items, total, clearCart, removeItem, addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'online_banking' | 'qr_pay'>('online_banking');
  const [paymentProof, setPaymentProof] = useState<File[]>([]);
  const [registrationId, setRegistrationId] = useState<string | null>(location.state?.registrationId || null);
  const [eventId, setEventId] = useState<string | null>(location.state?.eventId || null);
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>(location.state?.paymentType || 'full');
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState<boolean>(location.state?.autoStart || false);
  const [regData, setRegData] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(location.state?.autoStart || false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1); // 1: Info, 2: Date/Time, 3: Payment
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '' });
  const [specialRequests, setSpecialRequests] = useState<string>('');

  useEffect(() => {
    trackEvent({
      action_type: 'view',
      entity_type: 'page',
      entity_id: '/checkout',
      entity_name: 'Checkout Page',
      source: 'Checkout'
    });
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showProgressOverlay) {
      timer = setInterval(() => {
        setProgressCount(prev => prev + 1);
      }, 1000);
    } else {
      setProgressCount(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showProgressOverlay]);

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener("resize", updateMobileView);
    return () => window.removeEventListener("resize", updateMobileView);
  }, []);

  const isRegistration = !!registrationId;

  // STRICT VALIDATION: Exactly one package with sort_order 0
  const allPackages = items.filter(item => {
    // A main package is anything with sort_order 0, or anything that isn't an addon
    const isExplicitPackage = item.sort_order === 0;
    const isAddon = item.parentPackageId || item.category_id?.toLowerCase().includes('addon') || item.sort_order === 1;
    return isExplicitPackage || !isAddon;
  });
  
  const mainPackages = items.filter(item => item.sort_order === 0);
  
  // Validation failure if:
  // 1. More than one package in total
  // 2. Not exactly one package with sort_order 0
  // 3. No package at all (if cart not empty)
  // 4. (Only if not registration and cart not empty)
  const hasMultiplePackages = !isRegistration && items.length > 0 && (
    allPackages.length !== 1 || 
    mainPackages.length !== 1
  );

  const today = new Date().toISOString().split('T')[0];

  const checkWhatsAppStatus = async () => {
    // ALWAYS return true to prevent blocking the user
    return true;
  };

  const normalizeWhatsAppNumber = (value: string) => {
    const compact = value.replace(/\s+/g, '');
    let sanitized = compact.replace(/[^+\d]/g, '').replace(/(?!^)\+/g, '');

    if (sanitized.startsWith('00')) {
      sanitized = `+${sanitized.slice(2)}`;
    } else if (sanitized.startsWith('0')) {
      sanitized = `+60${sanitized.slice(1)}`;
    }

    if (!sanitized.startsWith('+')) {
      return {
        isValid: false,
        phone: sanitized,
        message: "Please enter a valid WhatsApp number with country code (example: +60123456789)."
      };
    }

    if (!/^\+[1-9]\d{7,14}$/.test(sanitized)) {
      return {
        isValid: false,
        phone: sanitized,
        message: "Please enter a valid WhatsApp number including country code (example: +60123456789)."
      };
    }

    return { isValid: true, phone: sanitized, message: "" };
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (data && !error) {
        const settingsMap: Record<string, string> = {};
        data.forEach(s => {
          settingsMap[s.key] = s.value;
          if (s.key === 'payment_deposit_amount') {
            const amount = parseFloat(s.value);
            if (!isNaN(amount) && amount > 0) {
              setDepositAmount(amount);
            }
          }
        });
        setSiteSettings(settingsMap);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (registrationId) {
      const fetchReg = async () => {
        console.log("Fetching registration data for Checkout:", registrationId);
        const { data, error } = await supabase
          .from('event_registrations')
          .select('*, event:events(*)')
          .eq('id', registrationId)
          .single();
        
        if (data && !error) {
          setRegData(data);
          if (data.event?.deposit_amount) {
            setDepositAmount(Number(data.event.deposit_amount));
          }
          
          setIsInitialLoading(false); // Set to false once data is loaded

          // If autoStart is true, initiate payment immediately after data is fetched
          if (autoStart) {
            console.log("Auto-starting payment for registration:", registrationId);
            initiateRegistrationPayment(registrationId);
          }
        } else if (error) {
          console.error("Error fetching registration:", error);
          toast({ title: "Error", description: "Failed to load registration details.", variant: "destructive" });
          setIsInitialLoading(false);
        } else {
          // No data and no error - might happen if single() fails to find row
          setIsInitialLoading(false);
        }
      };
      fetchReg();
    } else {
      setIsInitialLoading(false);
    }
  }, [registrationId, toast, autoStart]);

  const initiateRegistrationPayment = async (regId: string) => {
    if (!regId) {
      toast({
        title: "Error",
        description: "Registration ID is missing. Please try registering again.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      setShowProgressOverlay(true);
      
      // Auto scroll to top to ensure the processing overlay is focused
      window.scrollTo({ top: 0, behavior: 'smooth' });

      console.log("Initiating payment for registration from Checkout:", regId, "Event ID:", eventId, "Type:", paymentType);
      
      const requestBody = {
        registration_id: regId,
        registrationId: regId,
        booking_id: regData?.booking_id || null,
        bookingId: regData?.booking_id || null,
        payment_type: paymentType,
        paymentType: paymentType,
        event_id: eventId || regData?.event_id,
        eventId: eventId || regData?.event_id
      };

      const { data, error } = await supabase.functions.invoke('chip-payment-initiate', {
        body: requestBody
      });

      if (error) {
        console.error("Payment edge function error detail:", error);
        // FunctionsHttpError often has the body available via .context
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (body && body.error) {
              // Throw a new error with the specific message from the edge function
              // This will be caught by the outer catch block and shown in the toast
              throw new Error(body.error);
            }
          } catch (parseError: any) {
            // If it's the error we just threw, re-throw it to the outer catch
            if (parseError instanceof Error && !parseError.message.startsWith('Failed to parse')) {
              throw parseError;
            }
            console.error("Failed to parse error body:", parseError);
          }
        }
        throw error;
      }

      if (data?.checkout_url) {
        // Trigger WhatsApp bot for registration
        if (regData?.booking_id) {
          notificationService.triggerFlyioAutoNotification(regData.booking_id).catch(e => console.error("Fly.io trigger failed:", e));
        }
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL returned from payment gateway.");
      }
    } catch (error: any) {
      console.error('Registration payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to start payment process",
        variant: "destructive"
      });
      setIsProcessing(false);
      setShowProgressOverlay(false);
    }
  };

  const timeSlots = (() => {
    const slots: string[] = [];
    const startMinutes = 9 * 60;
    const endMinutes = 18 * 60;
    const intervalMinutes = 30;

    for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
      const hours24 = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const ampm = hours24 >= 12 ? "PM" : "AM";
      const hours12 = hours24 % 12 || 12;
      slots.push(`${hours12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`);
    }

    return slots;
  })();

  const isTimeInPast = (timeStr: string) => {
    if (selectedDate !== today) return false;
    
    const now = new Date();
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    
    return slotTime <= now;
  };

  useEffect(() => {
    if (selectedDate) {
      const fetchBlockedTimes = async () => {
        // Query all bookings for this date, regardless of status, to prevent overlaps
        const { data, error } = await supabase
          .from('bookings')
          .select('flight_time')
          .eq('flight_date', selectedDate);

        if (!error && data) {
          const times = data
            .map((row) => formatFlightTime(row.flight_time))
            .filter(Boolean) as string[];
          setBlockedTimes(times);
        }
      };
      fetchBlockedTimes();
    } else {
      setBlockedTimes([]);
    }
  }, [selectedDate]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasMultiplePackages) {
      toast({
        title: "Too Many Packages",
        description: "Please choose only one package before proceeding.",
        variant: "destructive"
      });
      return;
    }
    
    if (!supabase) {
      alert("Supabase is not configured properly.");
      return;
    }

    // Amount Validation (CHIP / Standard MYR Gateway Limits)
    if (total < 1.01) {
      alert("Minimum payment amount is RM 1.01");
      return;
    }
    if (total > 50000) {
      alert("Maximum payment amount is RM 50,000.00");
      return;
    }

    if (paymentMethod === 'qr_pay' && paymentProof.length === 0) {
      toast({
        title: "Receipt Required",
        description: "Please upload at least one payment receipt for QR Pay.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setShowProgressOverlay(true);

    trackEvent({
      action_type: 'click',
      entity_type: 'page',
      entity_id: 'checkout_place_order',
      entity_name: `Place Order: ${paymentMethod}`,
      details: { payment_method: paymentMethod, total: total },
      source: 'Checkout'
    });
    
    // Auto scroll to top to ensure the processing overlay is focused and visible
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // Background check for WhatsApp status (non-blocking)
      checkWhatsAppStatus().then(isConnected => {
        if (!isConnected) {
          console.warn("WhatsApp bot might be disconnected, but proceeding with booking.");
        }
      });

      const name = contactInfo.name;
      const email = contactInfo.email;
      const rawPhone = contactInfo.phone;
      const normalizedPhone = normalizeWhatsAppNumber(rawPhone);
      if (!normalizedPhone.isValid) {
        throw new Error(normalizedPhone.message);
      }
      const phone = normalizedPhone.phone;
      const flightDate = selectedDate;

      // Check if slot is still available
      const { data: isTaken, error: isTakenError } = await supabase.rpc('is_timeslot_taken', {
        p_flight_date: flightDate,
        p_flight_time: selectedTime
      });

      if (isTakenError) {
        throw new Error(`Failed to validate timeslot: ${isTakenError.message}`);
      }

      if (isTaken) {
        throw new Error("This time slot has already been booked. Please select another time.");
      }

      // 1. Create/Get Customer
      let customerId;
      
      try {
        const { data, error } = await supabase.rpc('find_or_create_customer', {
          p_name: name,
          p_email: email,
          p_phone: phone
        });

        if (error) throw error;
        customerId = data;
      } catch (err: any) {
        console.error('Customer RPC error:', err);
        throw new Error(`Customer lookup failed: ${err?.message || String(err)}`);
      }

      // 2. Create Booking
      const bookingRef = await generateBookingReference(flightDate || undefined);
      const specialNotes = (e.target as any).notes?.value || "";
      
      if (!globalThis.crypto?.randomUUID) {
        throw new Error("Your browser does not support secure ID generation. Please update your browser.");
      }
      const bookingId = globalThis.crypto.randomUUID();
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          booking_id: bookingId,
          customer_id: customerId,
          booking_reference: bookingRef,
          total_amount: total,
          payment_status: 'unpaid',
          payment_gateway: paymentMethod === 'online_banking' ? 'CHIP' : 'Manual',
          payment_method: paymentMethod,
          flight_date: flightDate,
          flight_time: selectedTime,
          notes: specialRequests,
          payment_type: paymentType,
          deposit_amount: paymentType === 'deposit' ? depositAmount : total,
          outstanding_balance: paymentType === 'full' ? 0 : (total - depositAmount),
          status: (paymentType === 'deposit' || paymentMethod === 'qr_pay') ? 'pending_verification' : 'pending'
        });

      if (bookingError) throw new Error(`Booking creation failed: ${bookingError.message}`);

      // 3. Create Booking Items
      const bookingItems = items.map(item => ({
        booking_id: bookingId,
        package_id: item.id, 
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);

      if (itemsError) throw new Error(`Adding items failed: ${itemsError.message}`);

      // Send admin notification in background
      notificationService.sendAdminNewBookingNotification(bookingId).catch(e => console.error("Admin notification error:", e));

      // 4. Process Payment based on Method
      if (paymentMethod === 'qr_pay') {
        if (paymentProof.length > 0) {
          try {
            const uploadedUrls: string[] = [];
            
            for (let i = 0; i < paymentProof.length; i++) {
              const file = paymentProof[i];
              let processedFile = file;

              if (file.type.startsWith('image/')) {
                try {
                  const { file: watermarkedFile } = await applyWatermark(file);
                  processedFile = await compressFile(watermarkedFile);
                } catch (processError) {
                  console.warn("Watermarking/Compression failed, using original file:", processError);
                  processedFile = await compressFile(file);
                }
              } else {
                processedFile = await compressFile(file);
              }

              const fileExt = processedFile.name.split('.').pop();
              const fileName = `payment-proofs/${bookingId}_${i}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, processedFile, { upsert: true, cacheControl: '31536000' });
              
              if (uploadError) throw new Error(`Proof upload failed for file ${i + 1}: ${uploadError.message}`);

              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
                
              uploadedUrls.push(publicUrl);
            }

            const { error: updateError } = await supabase.rpc('submit_payment_proof', {
              p_booking_id: bookingId,
              p_proof_url: uploadedUrls[0] || ''
            });
              
            if (updateError) {
              console.error("Failed to submit payment proof:", updateError);
              throw new Error(`Failed to submit payment proof: ${updateError.message}`);
            }
          } catch (error: any) {
             console.error("Payment proof processing error:", error);
             throw error; 
          }
        }

        try {
          await notificationService.sendPendingApprovalNotifications(bookingId);
          notificationService.triggerFlyioAutoNotification(bookingId).catch(e => console.error("Fly.io trigger failed:", e));
        } catch (e) {
          console.error("Failed to send frontend notifications:", e);
        }

        setShowProgressOverlay(false);
        alert("Booking submitted successfully! Please check your WhatsApp for details.");
        clearCart();
        navigate('/');
        return;
      }

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('chip-payment-initiate', {
        body: { 
          booking_id: bookingId,
          payment_type: paymentType
        }
      });

      if (paymentError) {
        if (paymentError.context && typeof paymentError.context.json === 'function') {
          try {
            const body = await paymentError.context.json();
            if (body && body.error) {
              throw new Error(body.error);
            }
          } catch (parseError: any) {
            if (parseError instanceof Error && !parseError.message.startsWith('Failed to parse')) {
              throw parseError;
            }
          }
        }
        throw paymentError;
      }

      if (paymentData?.checkout_url) {
        clearCart();
        window.location.href = paymentData.checkout_url;
      } else {
        throw new Error("No checkout URL returned from payment gateway.");
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      let errorMessage = error.message || "An error occurred during payment processing.";
      
      if (errorMessage.includes('duplicate key value violates unique constraint') && errorMessage.includes('booking_reference')) {
        errorMessage = "A booking conflict occurred (duplicate reference for this date). Please try again.";
      }

      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsProcessing(false);
      setShowProgressOverlay(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-50/30 flex items-center justify-center relative overflow-hidden">
        <BackgroundParticles variant="light" />
        <div className="text-center space-y-4 relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Initiating Payment Gateway</h2>
          <p className="text-muted-foreground">Please wait while we redirect you to the secure payment page...</p>
        </div>
      </div>
    );
  }

  if (!registrationId && items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <Button type="button" onClick={() => navigate('/')}>Go back to Home</Button>
      </div>
    );
  }

  const handleSetPrimary = (selectedItem: any) => {
    const itemsToRemove = items.filter(item => {
      const isPackage = item.sort_order === 0 || (!item.parentPackageId && !item.category_id?.toLowerCase().includes('addon'));
      return isPackage && (item.id !== selectedItem.id || item.sort_order !== selectedItem.sort_order);
    });

    itemsToRemove.forEach(item => {
      if (removeItem) {
        removeItem(item.id, item.sort_order);
      }
    });

    if (selectedItem.sort_order !== 0) {
      if (removeItem) {
        removeItem(selectedItem.id, selectedItem.sort_order);
      }
      if (addItem) {
        const { quantity, ...itemData } = selectedItem;
        addItem({ ...itemData, sort_order: 0 });
      }
    }
    
    toast({
      title: "Package Selected",
      description: `${selectedItem.name} is now your primary package.`,
    });
  };

  const handleBack = () => {
    if (checkoutStep > 1) {
      setCheckoutStep((prev) => (prev - 1) as 1 | 2 | 3);
      return;
    }
    if (isRegistration) {
      navigate('/events');
    } else {
      localStorage.setItem('forceBookingStep', '2');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/30 relative overflow-hidden">
      {!isMobileView && <BackgroundParticles variant="light" />}
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {isRegistration ? 'Registration' : 'Checkout'}
          </h1>
          <Button 
            type="button"
            variant="ghost" 
            className="w-fit gap-2 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold uppercase tracking-wider" 
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" /> {isRegistration ? 'Back to Events' : 'Back to Passenger Info'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 mb-2 overflow-x-auto py-2 no-scrollbar">
              {[
                { step: 1, label: 'Contact' },
                { step: 2, label: 'Schedule' },
                { step: 3, label: 'Payment' }
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStep(s.step as 1 | 2 | 3);
                    }}
                    className="flex items-center gap-2 hover:opacity-80 transition-all focus:outline-none"
                  >
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${checkoutStep === s.step ? 'bg-[#CD5C5C] text-white' : checkoutStep > s.step ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {checkoutStep > s.step ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.step}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${checkoutStep === s.step ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                  </button>
                  {s.step < 3 && <div className="w-4 h-[1px] bg-slate-200 mx-1" />}
                </div>
              ))}
            </div>

            {hasMultiplePackages ? (
              <Card className="border-red-500 bg-red-50 shadow-lg border-2 animate-in fade-in slide-in-from-top-4">
                <CardHeader className="bg-red-500 text-white border-b-0 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6" />
                    <CardTitle className="text-xl">Only One Package Allowed</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-slate-700 font-medium">Please choose only one package to proceed.</p>
                  <div className="grid gap-2">
                    {allPackages.map((item) => (
                      <Button
                        key={`${item.id}-${item.sort_order}`}
                        variant="outline"
                        className="justify-between bg-white border-red-200 hover:bg-red-50"
                        onClick={() => handleSetPrimary(item)}
                      >
                        <span className="font-bold">{item.name}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : checkoutStep === 1 ? (
              <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                <CardHeader className="bg-slate-900 text-white py-4">
                  <CardTitle className="text-sm uppercase tracking-widest font-black">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Full Name</Label>
                      <Input 
                        id="name" 
                        value={contactInfo.name || ""}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, name: e.target.value }))}
                        required 
                        placeholder="John Doe" 
                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={contactInfo.email || ""}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                        required 
                        placeholder="john@example.com" 
                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-widest text-slate-500">WhatsApp Number</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      value={contactInfo.phone || ""}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                      required 
                      placeholder="+60 12 345 6789" 
                      className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1 h-12 rounded-xl border-slate-200 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                      Back
                    </Button>
                    <Button 
                      disabled={!contactInfo.name || !contactInfo.email || !contactInfo.phone}
                      onClick={() => setCheckoutStep(2)}
                      className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                    >
                      Continue to Schedule <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : checkoutStep === 2 ? (
              <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                <CardHeader className="bg-slate-900 text-white py-4">
                  <CardTitle className="text-sm uppercase tracking-widest font-black">Select Flight Schedule</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Preferred Flight Date</Label>
                      <Input 
                        id="date" 
                        name="date" 
                        type="date" 
                        required 
                        min={today}
                        value={selectedDate || ""}
                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" 
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Preferred Time</Label>
                      <Select value={selectedTime} onValueChange={setSelectedTime} required disabled={!selectedDate}>
                        <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold">
                          <SelectValue placeholder={selectedDate ? "Select time" : "Choose date first"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {timeSlots.map((time) => {
                            const formattedTime = formatFlightTime(time);
                            const isBlocked = blockedTimes.includes(formattedTime);
                            const isInPast = isTimeInPast(time);
                            const isDisabled = isBlocked || isInPast;
                            
                            return (
                              <SelectItem 
                                key={time} 
                                value={time} 
                                disabled={isDisabled}
                                className={isDisabled ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60" : "font-bold"}
                              >
                                <div className="flex items-center justify-between w-full gap-4">
                                  <span>{formattedTime}</span>
                                  {isBlocked && <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black">Reserved</span>}
                                  {isInPast && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black">Unavailable</span>}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Special Requests (Optional)</Label>
                    <Input 
                      id="notes" 
                      name="notes" 
                      placeholder="Any dietary requirements or special occasions?" 
                      className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      variant="outline"
                      onClick={() => setCheckoutStep(1)}
                      className="flex-1 h-12 rounded-xl border-slate-200 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                      Back
                    </Button>
                    <Button 
                      disabled={!selectedDate || !selectedTime}
                      onClick={() => setCheckoutStep(3)}
                      className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                    >
                      Continue to Payment <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                <CardHeader className="bg-slate-900 text-white py-4">
                  <CardTitle className="text-sm uppercase tracking-widest font-black">Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form id="checkout-form" onSubmit={handlePayment} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                        <div>
                          <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Scheduled Flight</p>
                          <p className="font-bold text-slate-900">{selectedDate} at {formatFlightTime(selectedTime)}</p>
                        </div>
                        <Button variant="link" size="sm" onClick={() => setCheckoutStep(2)} className="h-auto p-0 text-[#CD5C5C] font-bold text-xs uppercase tracking-wider">Change</Button>
                      </div>

                      <div className="space-y-4 pt-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Payment Method</Label>
                        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'online_banking' | 'qr_pay')} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`flex items-center space-x-3 border-2 rounded-2xl p-4 cursor-pointer transition-all ${paymentMethod === 'online_banking' ? 'bg-slate-50 border-slate-900' : 'hover:bg-slate-50 border-slate-100'}`} onClick={() => setPaymentMethod('online_banking')}>
                            <RadioGroupItem value="online_banking" id="pm-online" />
                            <div className="grid gap-0.5">
                              <Label htmlFor="pm-online" className="cursor-pointer font-black text-xs uppercase tracking-tight">Online Banking</Label>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">FPX / Bank Transfer</span>
                            </div>
                          </div>
                          <div 
                            className={`flex items-center space-x-3 border-2 rounded-2xl p-4 cursor-pointer transition-all ${paymentMethod === 'qr_pay' ? 'bg-slate-50 border-slate-900' : 'hover:bg-slate-50 border-slate-100'}`}
                            onClick={() => setPaymentMethod('qr_pay')}
                          >
                            <RadioGroupItem value="qr_pay" id="pm-qr" />
                            <div className="flex-1">
                              <Label htmlFor="pm-qr" className="cursor-pointer font-black text-xs uppercase tracking-tight flex items-center gap-2">
                                <QrCode className="w-3.5 h-3.5" /> QR Pay / Manual
                              </Label>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Scan DuitNow QR</p>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>

                      {paymentMethod === 'qr_pay' && (
                        <div className={`mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-6 space-y-6">
                            <div className="text-center space-y-2">
                              <h3 className="font-black text-sm uppercase tracking-widest text-slate-900">Scan to Pay</h3>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">DuitNow QR Payment</p>
                            </div>
                            
                            {siteSettings.payment_qr_code_url && (
                              <div className="flex justify-center">
                                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[500px] w-full">
                                  <img 
                                    src={siteSettings.payment_qr_code_url} 
                                    alt="Payment QR" 
                                    className="w-full aspect-square object-contain mx-auto"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                              <div className="flex justify-between p-3 items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Bank</span>
                                <span className="text-xs font-black uppercase tracking-tight">{siteSettings.payment_bank_name}</span>
                              </div>
                              <div className="flex justify-between p-3 items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Account</span>
                                <span className="text-xs font-black uppercase tracking-tight">{siteSettings.payment_account_number}</span>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex flex-col gap-3">
                                <Input 
                                  id="payment-proof"
                                  type="file" 
                                  accept="image/*,application/pdf" 
                                  multiple
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length > 0) {
                                      const validFiles: File[] = [];
                                      for (const file of files) {
                                        const isImage = file.type.startsWith('image/');
                                        const limit = isImage ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
                                        if (file.size > limit) {
                                          toast({
                                            title: "File too large",
                                            description: `File ${file.name} is too large.`,
                                            variant: "destructive"
                                          });
                                          continue;
                                        }
                                        validFiles.push(file);
                                      }
                                      setPaymentProof(prev => [...prev, ...validFiles]);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="hidden"
                                />
                                <Label
                                  htmlFor="payment-proof"
                                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-slate-800 cursor-pointer text-center"
                                >
                                  Upload Receipt
                                </Label>
                                
                                <div className="flex flex-col gap-2">
                                  {paymentProof.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                      <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                      <Button 
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPaymentProof(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => setCheckoutStep(2)}
                        className="flex-1 h-12 rounded-xl border-slate-200 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        Back
                      </Button>
                      <Button 
                        type="submit"
                        disabled={
                          isProcessing || 
                          !contactInfo.name || 
                          !contactInfo.email || 
                          !contactInfo.phone || 
                          !selectedDate || 
                          !selectedTime || 
                          (paymentMethod === 'qr_pay' && paymentProof.length === 0)
                        }
                        className="flex-[2] h-12 rounded-xl bg-[#CD5C5C] hover:bg-[#B54A4A] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-[#CD5C5C]/20 transition-all active:scale-[0.98]"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        Place Order
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="border-accent/10 shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="bg-slate-50 py-4 border-b border-slate-100">
                <CardTitle className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-500 flex items-center gap-2">
                  <ShoppingBagIcon className="w-4 h-4" /> Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-4 group">
                      <div className="space-y-1 flex-1">
                        <p className="font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">QTY: {item.quantity}</span>
                          {item.sort_order === 0 && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-black uppercase">Primary</span>}
                        </div>
                      </div>
                      <p className="font-bold text-slate-900">RM {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between text-slate-500 text-sm font-bold">
                    <span>Subtotal</span>
                    <span>RM {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-lg shadow-slate-200">
                    <span className="text-[10px] uppercase font-black tracking-widest">Total Payable</span>
                    <span className="text-xl font-black">RM {total.toFixed(2)}</span>
                  </div>
                </div>

                {paymentType === 'deposit' && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-2 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Paying Now (Deposit)</span>
                      <span className="font-black text-amber-900">RM {depositAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-amber-200/50">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Balance Due Later</span>
                      <span className="font-bold text-amber-700">RM {(total - depositAmount).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 text-center">
              <div className="inline-flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Secure & Encrypted Checkout
              </div>
              <p className="text-[9px] text-slate-400 uppercase font-bold leading-relaxed tracking-tighter">
                By placing this order, you agree to our <br/> Terms of Service and Cancellation Policy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showProgressOverlay && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-slate-100 rounded-full"></div>
            <div 
              className="absolute inset-0 border-4 border-[#CD5C5C] rounded-full border-t-transparent animate-spin"
              style={{ animationDuration: '1.5s' }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black text-[#CD5C5C]">{progressCount}s</span>
            </div>
          </div>
          <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Processing Your Order
          </h3>
          <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest animate-pulse">
            Connecting to secure gateway...
          </p>
        </div>
      )}
    </div>
  );
}
