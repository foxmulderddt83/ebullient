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
    if (!supabase) return true;
    try {
      // 1. Try Edge Function first (best way to handle CORS/RLS)
      try {
        const { data, error } = await supabase.functions.invoke('check-whatsapp-status');
        if (!error && data?.connected) return true;
      } catch (efError) {
        console.warn('Edge Function check failed, trying database/API fallback:', efError);
      }

      // 2. Check from DB status (updated by bot periodically)
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'whatsapp_bot_status').maybeSingle();
      if (data && data.value === 'connected') return true;

      // 3. Fallback: Direct API check
      const { data: apiUrlData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_api_url')
        .maybeSingle();

      const API_URL = apiUrlData?.value || import.meta.env.VITE_WHATSAPP_API_URL;
      
      if (API_URL) {
        const res = await fetch(`${API_URL}/api/status`).catch(() => null);
        if (res && res.ok) {
          const json = await res.json();
          return Boolean(json.connected);
        }
      }
      return false;
    } catch (e) {
      console.error('WhatsApp status check error:', e);
      return false;
    }
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
    }
  };

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"
  ];

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
        const { data, error } = await supabase
          .from('bookings')
          .select('flight_time')
          .eq('flight_date', selectedDate)
          .or('payment_status.eq.paid,status.eq.confirmed');
        
        if (data && !error) {
          const times = data.map(b => b.flight_time).filter(Boolean) as string[];
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

    const formData = new FormData(e.target as HTMLFormElement);
    const rawPhone = (formData.get("phone") as string) || "";
    const normalizedPhone = normalizeWhatsAppNumber(rawPhone);
    if (!normalizedPhone.isValid) {
      toast({
        title: "Invalid WhatsApp Number",
        description: normalizedPhone.message,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Ensure WhatsApp is connected before allowing booking
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        setIsProcessing(false);
        alert("WhatsApp bot disconnected. Please contact support to proceed with your booking.");
        return;
      }

      const name = formData.get("name") as string;
      const email = formData.get("email") as string;
      const phone = normalizedPhone.phone;
      const flightDate = formData.get("date") as string;

      // Check if slot is still available
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('booking_id')
        .eq('flight_date', flightDate)
        .eq('flight_time', selectedTime)
        .or('payment_status.eq.paid,status.eq.confirmed')
        .maybeSingle();

      if (existingBooking) {
        throw new Error("This time slot has already been booked. Please select another time.");
      }

      // 1. Create/Get Customer
      let customerId;
      
      try {
        const { data, error } = await supabase.rpc('get_or_create_customer', {
          p_email: email,
          p_name: name,
          p_phone: phone
        });

        if (error) throw error;
        customerId = data;
      } catch (err: any) {
        console.error('Customer RPC error:', err);
        // Fallback for older schema versions or if RPC fails
        // Try to find existing customer
        let existingCustomer = null;
        if (email) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('email', email)
            .maybeSingle(); // Use maybeSingle to avoid error if not found
          existingCustomer = data;
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: createError } = await supabase
            .from('customers')
            .insert({ name, email, phone })
            .select()
            .single();
          
          if (createError) throw new Error(`Customer creation failed: ${createError.message}`);
          customerId = newCustomer.id;
        }
      }

      // 2. Create Booking
      const bookingRef = await generateBookingReference(flightDate || undefined);
      const specialNotes = formData.get("notes") as string;
      
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: customerId,
          booking_reference: bookingRef,
          total_amount: total,
          payment_status: 'unpaid',
          payment_gateway: paymentMethod === 'online_banking' ? 'CHIP' : 'Manual',
          payment_method: paymentMethod,
          flight_date: flightDate,
          flight_time: selectedTime,
          notes: specialNotes,
          payment_type: paymentType,
          deposit_amount: paymentType === 'deposit' ? depositAmount : total,
          outstanding_balance: paymentType === 'full' ? 0 : (total - depositAmount),
          status: (paymentType === 'deposit' || paymentMethod === 'qr_pay') ? 'pending_verification' : 'pending'
        })
        .select()
        .single();

      if (bookingError) throw new Error(`Booking creation failed: ${bookingError.message}`);

      // 3. Create Booking Items
      // We assume item.id corresponds to package_id. 
      // If your cart has mixed items (packages/addons), you need to differentiate.
      const bookingItems = items.map(item => ({
        booking_id: booking.booking_id,
        package_id: item.id, 
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);

      if (itemsError) throw new Error(`Adding items failed: ${itemsError.message}`);

      // 4. Process Payment based on Method
      if (paymentMethod === 'qr_pay') {
        if (paymentProof.length > 0) {
          try {
            const uploadedUrls: string[] = [];
            
            for (let i = 0; i < paymentProof.length; i++) {
              const file = paymentProof[i];
              let processedFile = file;

              // Only apply watermark and compress if it's an image
              if (file.type.startsWith('image/')) {
                try {
                  const { file: watermarkedFile } = await applyWatermark(file);
                  processedFile = await compressFile(watermarkedFile);
                } catch (processError) {
                  console.warn("Watermarking/Compression failed, using original file:", processError);
                  processedFile = await compressFile(file);
                }
              } else {
                // For non-images (like PDFs), just check size via compressFile
                processedFile = await compressFile(file);
              }

              const fileExt = processedFile.name.split('.').pop();
              const fileName = `payment-proofs/${booking.booking_id}_${i}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, processedFile);
              
              if (uploadError) throw new Error(`Proof upload failed for file ${i + 1}: ${uploadError.message}`);

              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
                
              uploadedUrls.push(publicUrl);
            }

            // Update booking with payment proof URLs
            const { error: updateError } = await supabase
              .from('bookings')
              .update({ 
                payment_proof_url: uploadedUrls[0] || '',
                payment_proof_urls: uploadedUrls,
                payment_status: 'pending_verification',
                status: 'pending_verification'
              })
              .eq('booking_id', booking.booking_id);
              
            if (updateError) {
              console.error("Failed to update booking with proof URLs:", updateError);
              throw new Error(`Failed to update booking status: ${updateError.message}`);
            }
          } catch (error: any) {
             console.error("Payment proof processing error:", error);
             toast({
               title: "Upload Failed",
               description: `Failed to upload payment proof: ${error.message}`,
               variant: "destructive"
             });
             throw error; 
          }
        }

        try {
          await notificationService.sendPendingApprovalNotifications(booking.booking_id);
        } catch (e) {
          console.error("Failed to send frontend notifications:", e);
        }

        alert("Booking submitted successfully! Please check your WhatsApp for details.");
        clearCart();
        navigate('/');
        return;
      }

      // 5. Initiate Payment via Edge Function (Online Banking)
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('chip-payment-initiate', {
        body: { 
          booking_id: booking.booking_id,
          payment_type: paymentType
        }
      });

      if (paymentError) {
        console.error("Payment edge function error detail:", paymentError);
        // FunctionsHttpError often has the body available via .context
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
        window.location.href = paymentData.checkout_url;
      } else {
        throw new Error("No checkout URL returned from payment gateway.");
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "An error occurred during payment processing.",
        variant: "destructive"
      });
      setIsProcessing(false);
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
    // 1. Identify all items to remove (all other packages)
    const itemsToRemove = items.filter(item => {
      const isPackage = item.sort_order === 0 || (!item.parentPackageId && !item.category_id?.toLowerCase().includes('addon'));
      return isPackage && (item.id !== selectedItem.id || item.sort_order !== selectedItem.sort_order);
    });

    // 2. Remove them
    itemsToRemove.forEach(item => {
      if (removeItem) {
        removeItem(item.id, item.sort_order);
      }
    });

    // 3. If the selected item isn't sort_order 0, promote it
    if (selectedItem.sort_order !== 0) {
      // Remove the non-0 version
      if (removeItem) {
        removeItem(selectedItem.id, selectedItem.sort_order);
      }
      // Add as sort_order 0
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

  return (
    <div className="min-h-screen bg-slate-50/30 relative overflow-hidden">
      <BackgroundParticles variant="light" />
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl relative z-10">
        <Button 
          type="button"
          variant="ghost" 
          className="mb-6 md:mb-8 gap-2 text-muted-foreground hover:text-accent-foreground" 
          onClick={() => navigate(isRegistration ? '/events' : '/')}
        >
          <ArrowLeft className="w-4 h-4" /> {isRegistration ? 'Back to Events' : 'Back to Customisation'}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-slate-900">
              {isRegistration ? 'Complete Registration' : 'Checkout'}
            </h1>
            
            {hasMultiplePackages ? (
              <Card className="border-red-500 bg-red-50 shadow-lg border-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <CardHeader className="bg-red-500 text-white border-b-0 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl">Only One Package Allowed</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm space-y-3">
                    <p className="text-slate-700 leading-relaxed font-medium">
                      You have selected <strong className="text-red-600 underline">more than one package</strong>. Please choose the one you wish to proceed with. 
                    </p>
                    <p className="text-sm text-slate-500">
                      The other packages and their specific add-ons will be removed from your cart.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase tracking-wider text-slate-500">Choose your package:</Label>
                    <div className="grid gap-3">
                      {allPackages.map((item) => (
                        <div 
                          key={item.id} 
                          className="group flex items-center justify-between bg-white hover:bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
                          onClick={() => handleSetPrimary(item)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <ShoppingBagIcon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</h3>
                              <p className="text-xs font-bold text-slate-500">RM {item.price.toFixed(2)}</p>
                              {item.sort_order !== 0 && (
                                <p className="text-[10px] text-red-500 font-bold uppercase mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Needs Sort Order 0
                                </p>
                              )}
                            </div>
                          </div>
                          <Button 
                            type="button"
                            variant="outline"
                            className="rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary font-bold px-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimary(item);
                            }}
                          >
                            Select & Reorder
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-center">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="text-slate-400 hover:text-red-500 transition-colors gap-2"
                      onClick={() => navigate('/')}
                    >
                      <ArrowLeft className="w-4 h-4" /> Go Back to Shop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : isRegistration ? (
              <Card className="border-accent/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg">Registration Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {regData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Event</p>
                          <p className="font-bold text-primary">{regData.event?.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Attendee</p>
                          <p className="font-bold">{regData.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Email</p>
                          <p className="font-medium">{regData.email}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Phone</p>
                          <p className="font-medium">{regData.phone}</p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <Label className="text-base font-semibold mb-4 block">Payment Options</Label>
                        <RadioGroup 
                          value={paymentType} 
                          onValueChange={(v) => setPaymentType(v as 'full' | 'deposit')} 
                          className="space-y-3"
                        >
                          <div 
                            className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${paymentType === 'full' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-slate-50 border-slate-200'}`}
                            onClick={() => setPaymentType('full')}
                          >
                            <RadioGroupItem value="full" id="pt-full" />
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <Label htmlFor="pt-full" className="cursor-pointer font-bold">Full Payment</Label>
                                <span className="font-bold">RM {regData.event?.payment_amount?.toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Pay the full amount now to secure your spot.</p>
                            </div>
                          </div>

                          {regData.event?.enable_deposit && (
                            <div 
                              className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${paymentType === 'deposit' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-slate-50 border-slate-200'}`}
                              onClick={() => setPaymentType('deposit')}
                            >
                              <RadioGroupItem value="deposit" id="pt-deposit" />
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <Label htmlFor="pt-deposit" className="cursor-pointer font-bold">Pay Deposit</Label>
                                  <span className="font-bold">RM {regData.event?.deposit_amount?.toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Pay a deposit now and the balance later.</p>
                              </div>
                            </div>
                          )}
                        </RadioGroup>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-accent/10 shadow-sm">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" name="name" required placeholder="John Doe" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" required placeholder="john@example.com" className="bg-background" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" name="phone" type="tel" required placeholder="+60 12 345 6789" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date">Preferred Flight Date</Label>
                        <Input 
                          id="date" 
                          name="date" 
                          type="date" 
                          required 
                          min={today}
                          className="bg-background" 
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time">Preferred Time</Label>
                        <Select value={selectedTime} onValueChange={setSelectedTime} required>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((time) => {
                              const isBlocked = blockedTimes.includes(time);
                              const isInPast = isTimeInPast(time);
                              const isDisabled = isBlocked || isInPast;
                              
                              return (
                                <SelectItem key={time} value={time} disabled={isDisabled}>
                                  {time} {isBlocked ? '(Booked)' : isInPast ? '(Unavailable)' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Special Requests (Optional)</Label>
                      <Input id="notes" name="notes" placeholder="Any dietary requirements or special occasions?" className="bg-background" />
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <Label className="text-base font-semibold">Payment Method</Label>
                      <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'online_banking' | 'qr_pay')} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${paymentMethod === 'online_banking' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'hover:bg-slate-50 border-slate-200'}`} onClick={() => setPaymentMethod('online_banking')}>
                          <RadioGroupItem value="online_banking" id="pm-online" />
                          <div className="grid gap-0.5">
                            <Label htmlFor="pm-online" className="cursor-pointer font-medium">Online Banking</Label>
                            <span className="text-xs text-muted-foreground">Secure FPX payment</span>
                          </div>
                        </div>
                        <div 
                          className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${paymentMethod === 'qr_pay' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'hover:bg-slate-50 border-slate-200'}`}
                          onClick={() => setPaymentMethod('qr_pay')}
                        >
                          <RadioGroupItem value="qr_pay" id="pm-qr" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="pm-qr" className="cursor-pointer font-bold flex items-center gap-2">
                                <QrCode className="w-4 h-4" /> QR Pay / Manual
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">DuitNow QR or Bank Transfer</p>
                          </div>
                        </div>
                      </RadioGroup>

                      {paymentMethod === 'qr_pay' && (
                        <div className="mt-6 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                          <div className="bg-slate-50 border-2 border-black rounded-2xl p-4 md:p-8 space-y-6">
                            <div className="text-center space-y-2">
                              <h3 className="font-bold text-lg text-slate-900">Scan to Pay</h3>
                              <p className="text-sm text-slate-700 font-medium max-w-xs mx-auto">Please scan the QR code below to complete the payment.</p>
                            </div>
                            
                            {siteSettings.payment_qr_code_url && (
                              <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-2xl shadow-xl border-2 border-primary/5 max-w-[280px] w-full">
                                  <img 
                                    src={siteSettings.payment_qr_code_url} 
                                    alt="Payment QR" 
                                    className="w-full aspect-square object-contain mx-auto"
                                  />
                                  <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                                    <p className="text-[12px] uppercase tracking-[0.2em] font-black text-primary animate-pulse">Scan to Pay Now</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="bg-white rounded-xl border border-black divide-y divide-slate-100 overflow-hidden">
                              <div className="flex justify-between p-3 items-center">
                                <span className="text-xs font-black text-slate-900 uppercase">Bank Name</span>
                                <span className="text-sm font-bold">{siteSettings.payment_bank_name}</span>
                              </div>
                              <div className="flex justify-between p-3 items-center">
                                <span className="text-xs font-black text-slate-900 uppercase">Account Name</span>
                                <span className="text-sm font-bold">{siteSettings.payment_account_name}</span>
                              </div>
                              <div className="flex justify-between p-3 items-center">
                                <span className="text-xs font-black text-slate-900 uppercase">Account Number</span>
                                <span className="text-sm font-mono font-bold">{siteSettings.payment_account_number}</span>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <Label className="text-sm font-bold">Upload Payment Receipt</Label>
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
                                        const limit = isImage ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
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
                                  className="inline-flex items-center justify-center rounded-xl border border-primary bg-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-lg transition-all hover:brightness-110 cursor-pointer text-center"
                                >
                                  Upload receipt
                                </Label>
                                
                                <div className="flex flex-col gap-2">
                                  {paymentProof.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                      <span className="text-xs font-bold text-slate-700 truncate">
                                        {file.name}
                                      </span>
                                      <Button 
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPaymentProof(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  {paymentProof.length === 0 && (
                                    <span className="text-xs font-bold text-slate-500 italic text-center">
                                      No file chosen
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-700 font-bold text-center">Multiple files accepted. (Max 1MB for images, 5MB for PDF)</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-5">
            <h2 className="text-xl font-heading font-bold mb-6 lg:invisible">Order Summary</h2>
            <Card className="sticky top-24 border-accent/20 shadow-md">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {isRegistration ? (
                    regData ? (
                      <div className="flex justify-between items-start pb-4 border-b">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-slate-900 leading-tight">{regData.event?.name}</h4>
                          <p className="text-xs text-muted-foreground bg-muted w-fit px-2 py-0.5 rounded">Registration</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">RM {regData.event?.payment_amount?.toFixed(2)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-pulse space-y-4">
                        <div className="h-10 bg-muted rounded w-full"></div>
                        <div className="h-10 bg-muted rounded w-full"></div>
                      </div>
                    )
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start pb-4 border-b last:border-0">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-slate-900 leading-tight">{item.name}</h4>
                          <p className="text-xs text-muted-foreground bg-muted w-fit px-2 py-0.5 rounded">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">RM {(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-8 space-y-4 pt-6 border-t-2 border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Subtotal</span>
                    <span className="font-bold text-slate-900">RM {(isRegistration ? (regData?.event?.payment_amount || 0) : total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  {depositAmount > 0 && (isRegistration ? regData?.event?.enable_deposit : total > depositAmount) && (
                    <div className="pb-4 mb-4 border-b">
                      <Label className="text-base font-semibold mb-3 block">Payment Option</Label>
                      <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as 'full' | 'deposit')} className="space-y-3">
                        <div 
                          className={`flex items-center space-x-3 border rounded-xl p-3 cursor-pointer transition-all ${paymentType === 'full' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'hover:bg-slate-50 border-slate-200'}`}
                          onClick={() => setPaymentType('full')}
                        >
                          <RadioGroupItem value="full" id="full" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="full" className="cursor-pointer font-bold">Full Payment</Label>
                              <span className="font-bold">RM {(isRegistration ? (regData?.event?.payment_amount || 0) : total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                        <div 
                          className={`flex items-center space-x-3 border rounded-xl p-3 cursor-pointer transition-all ${paymentType === 'deposit' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'hover:bg-slate-50 border-slate-200'}`}
                          onClick={() => setPaymentType('deposit')}
                        >
                          <RadioGroupItem value="deposit" id="deposit" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="deposit" className="cursor-pointer font-bold">Pay Deposit</Label>
                              <span className="font-bold">RM {depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xl pt-2">
                    <span className="font-black text-slate-900 uppercase tracking-tighter">Total Payable</span>
                    <span className="font-black text-primary">
                      RM {(paymentType === 'deposit' ? depositAmount : (isRegistration ? (regData?.event?.payment_amount || 0) : total)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <Button 
                    type="button"
                    className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20 mt-4 rounded-xl active:scale-[0.98] transition-all" 
                    size="lg"
                    disabled={isProcessing || (isRegistration && !regData) || hasMultiplePackages}
                    onClick={(e) => {
                      if (hasMultiplePackages) {
                        toast({
                          title: "Action Required",
                          description: "Please select one package to keep before proceeding.",
                          variant: "destructive"
                        });
                        return;
                      }
                      if (isRegistration) {
                        initiateRegistrationPayment(registrationId!);
                      } else {
                        document.getElementById('checkout-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                      }
                    }}
                  >
                    {isProcessing ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                    ) : (
                      isRegistration ? "Proceed to Payment" : "Place Order"
                    )}
                  </Button>

                  {isRegistration && regData && !regData.event?.payment_required && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full text-muted-foreground hover:text-slate-900 font-medium"
                      onClick={() => {
                        toast({ 
                          title: "Registration Successful! 🎉", 
                          description: "Your registration has been saved. You can pay later if you wish.",
                        });
                        navigate("/events");
                      }}
                    >
                      Skip payment for now
                    </Button>
                  )}

                  <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Secure SSL Encrypted Payment
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
