import { useState, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import airplaneServices from "@/assets/airplane-services.jpg";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2, X } from "lucide-react";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { compressFile } from "@/utils/fileCompression";

type LucideIconType = keyof typeof LucideIcons;

interface Service {
  id: string;
  title: string;
  description: string;
  label?: string;
  image_url?: string;
  image_path?: string;
}

interface Review {
  id: string;
  service_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  is_approved?: boolean;
  image_urls?: string[];
  image_paths?: string[];
}

export const ServicesSection = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceReviews, setServiceReviews] = useState<Record<string, Review[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  
  // Review Form State
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [reviewImages, setReviewImages] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // WhatsApp Verification State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [settings, setSettings] = useState({
    services_title: "Our Services",
    services_subtitle: "From romantic proposals to corporate events, we make every moment unforgettable",
    bg_gradient_services: ""
  });
  const [styles, setStyles] = useState<Record<string, any>>({});

  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.paused === 'boolean') {
        setIsGlobalPaused(detail.paused);
      }
    };
    window.addEventListener('toggle-animation-freeze', handleToggle);
    return () => window.removeEventListener('toggle-animation-freeze', handleToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-animation-freeze', { detail: { paused: !!selectedService } }));
  }, [selectedService]);

  // Auto-scroll to active service
  useEffect(() => {
    if (services.length === 0 || isPaused || selectedService || isGlobalPaused) return;
    
    const interval = setInterval(() => {
      setActiveServiceIndex((prev) => {
        const nextIndex = (prev + 1) % services.length;
        
        // Scroll logic
        if (scrollRef.current) {
          const container = scrollRef.current;
          const isMobile = window.innerWidth < 768;
          const itemWidth = isMobile ? 280 : 320; // w-[280px] md:w-[320px]
          const gap = 32; // gap-8
          const padding = 16; // px-4
          
          // Calculate center position
          const itemCenter = padding + (nextIndex * (itemWidth + gap)) + (itemWidth / 2);
          const scrollLeft = itemCenter - (container.clientWidth / 2);
          
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        }
        
        return nextIndex;
      });
    }, 8000); // Increased to 8000ms for even slower scroll
    
    return () => clearInterval(interval);
  }, [services.length, isPaused, selectedService]);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) {
        console.warn("Supabase client not initialized");
        setLoading(false);
        return;
      }

      const [servicesRes, settingsRes, reviewsRes] = await Promise.all([
        supabase.from('services').select('*').order('order', { ascending: true }),
        supabase.from('site_settings').select('key, value, style').in('key', ['services_title', 'services_subtitle', 'bg_gradient_services']),
        supabase.from('reviews').select('*').eq('is_approved', true).order('created_at', { ascending: false })
      ]);
      
      if (!servicesRes.error && servicesRes.data) {
        setServices(servicesRes.data);
      }
  
      if (!reviewsRes.error && reviewsRes.data) {
        const reviewsMap: Record<string, Review[]> = {};
        (reviewsRes.data as Review[]).forEach((review) => {
          if (!reviewsMap[review.service_id]) reviewsMap[review.service_id] = [];
          reviewsMap[review.service_id].push(review);
        });
        setServiceReviews(reviewsMap);
      }
  
      if (!settingsRes.error && settingsRes.data) {
        const newSettings = { ...settings };
        const newStyles: Record<string, any> = {};
        settingsRes.data.forEach((s) => {
          if (s.key === 'services_title') {
            newSettings.services_title = s.value;
            if (s.style) newStyles.services_title = s.style;
          }
          if (s.key === 'services_subtitle') {
            newSettings.services_subtitle = s.value;
            if (s.style) newStyles.services_subtitle = s.style;
          }
          if (s.key === 'bg_gradient_services') newSettings.bg_gradient_services = s.value;
        });
        setSettings(newSettings);
        setStyles(newStyles);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Auto-verify OTP when 4 digits are entered
  useEffect(() => {
    if (otpInput.length === 4 && otp && !isVerified) {
      if (otpInput === otp) {
        setIsVerified(true);
        toast.success("Phone number verified!");
        setIsVerifying(false);
      } else {
        toast.error("Invalid OTP. Please try again.");
        setOtpInput(''); // Clear for retry
      }
    }
  }, [otpInput, otp, isVerified]);

  const checkWhatsAppStatus = async () => {
    if (!supabase) return false;
    try {
      // 1. Check from DB status (updated by bot periodically)
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'whatsapp_bot_status')
        .maybeSingle();
      
      if (data && data.value === 'connected') return true;

      // 2. Fallback: Direct API check
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
      return false;
    }
  };

  const handleServiceClick = async (service: Service) => {
    setIsCheckingStatus(true);
    const isConnected = await checkWhatsAppStatus();
    setIsCheckingStatus(false);

    if (!isConnected) {
      toast.error("WhatsApp bot is currently offline. Please try again later when the bot is connected.");
      return;
    }

    setSelectedService(service);
    if (!supabase) return;
    // Log analytics
    await supabase.from('service_analytics').insert({
      service_id: service.id,
      action_type: 'click'
    });
  };

  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const validatePhone = (phone: string) => {
    // Basic validation: starts with + and has 10-15 digits
    const phoneRegex = /^\+[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
  };

  const handleSendOTP = async () => {
    if (!validatePhone(phoneNumber)) {
      toast.error("Please enter a valid WhatsApp number with country code (e.g. +60123456789)");
      return;
    }

    setIsSendingOtp(true);
    
    // Final check before sending OTP
    const isConnected = await checkWhatsAppStatus();
    if (!isConnected) {
      setIsSendingOtp(false);
      toast.error("WhatsApp bot disconnected. Please try again later.");
      setSelectedService(null); // Close dialog
      return;
    }

    const code = generateOTP();
    setOtp(code);

    try {
      // Create a plain text message for the WhatsApp bot
      const messageText = `*Verification Code*\n\nYour 4-digit verification code for OneDayPilot review is: *${code}*\n\nPlease enter this code in the website to verify your review submission.`;

      const { error } = await supabase
        .from('notification_queue')
        .insert({
          phone: phoneNumber,
          message: messageText,
          status: 'pending',
          type: 'whatsapp'
        });

      if (error) throw error;
      
      toast.success("OTP sent to your WhatsApp!");
      setIsVerifying(true);
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !supabase) return;

    if (!isVerified) {
      toast.error("Please verify your WhatsApp number first");
      return;
    }

    setIsSubmitting(true);

    // Final check before submission
    const isConnected = await checkWhatsAppStatus();
    if (!isConnected) {
      setIsSubmitting(false);
      toast.error("WhatsApp bot disconnected. Submission failed.");
      setSelectedService(null);
      return;
    }

    const image_urls: string[] = [];
    const image_paths: string[] = [];

    if (reviewImages && reviewImages.length > 0) {
      const bucketName = import.meta.env.VITE_SUPABASE_BUCKET || "media";
      
      for (let i = 0; i < reviewImages.length; i++) {
        const file = reviewImages[i];
        const compressedFile = await compressFile(file);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${i}.${fileExt}`;
        const filePath = `reviews/${selectedService.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, compressedFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Failed to upload image: ${file.name}. Please check storage permissions.`);
          setIsSubmitting(false);
          return; // Stop the process if an upload fails
        }

        const publicUrl = supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
        image_urls.push(publicUrl);
        image_paths.push(filePath);
      }
    }

    const { data, error } = await supabase.from('reviews').insert({
      service_id: selectedService.id,
      customer_name: reviewForm.name,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      image_urls: image_urls,
      image_paths: image_paths,
      phone_number: phoneNumber,
      is_approved: true // Automatically approved
    }).select().single();

    if (error) {
      toast.error("Failed to submit review");
    } else {
      toast.success("Review submitted!");
      
      if (data) {
        setServiceReviews(prev => ({
          ...prev,
          [selectedService.id]: [data as Review, ...(prev[selectedService.id] || [])]
        }));
      }

      setReviewForm({ name: '', rating: 5, comment: '' });
      setReviewImages(null);
      // Reset verification state
      setPhoneNumber('');
      setOtp('');
      setOtpInput('');
      setIsVerified(false);
      setIsVerifying(false);
    }
    setIsSubmitting(false);
  };



  if (loading) return null;
  if (services.length === 0) return null;

  return (
    <section 
      id="services" 
      className="relative overflow-hidden py-16 md:py-24"
      style={settings.bg_gradient_services ? { background: settings.bg_gradient_services } : { background: "#06091a" }}
    >
      <BackgroundParticles variant="dark" isPaused={!!selectedService} />
      <div className="absolute top-0 right-0 h-px w-1/3 bg-gradient-to-l from-[#ea580c] to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-[#ea580c] via-[#facc15]/50 to-transparent" />
      
      {/* Pilot & Stewardess Background Decoration */}
      <div className="absolute top-1/2 left-[60%] -translate-x-1/2 md:left-auto md:right-[-10%] md:translate-x-0 -translate-y-1/2 w-[600px] md:w-[1000px] opacity-[0.15] pointer-events-none z-0 select-none">
        <svg viewBox="0 0 520 480" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDDBB4"/>
              <stop offset="100%" stopColor="#F0C090"/>
            </linearGradient>
            <linearGradient id="pilotUniform" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a2a4a"/>
              <stop offset="100%" stopColor="#0d1a30"/>
            </linearGradient>
            <linearGradient id="stewUniform" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B1A2A"/>
              <stop offset="100%" stopColor="#5c0f1a"/>
            </linearGradient>
            <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3560"/>
              <stop offset="100%" stopColor="#0d1a30"/>
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD700"/>
              <stop offset="100%" stopColor="#C8A000"/>
            </linearGradient>
            <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f0f4f8"/>
              <stop offset="100%" stopColor="#dde4ec"/>
            </linearGradient>
            <linearGradient id="scarfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#cc2233"/>
              <stop offset="100%" stopColor="#991122"/>
            </linearGradient>
            <linearGradient id="skirtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B1A2A"/>
              <stop offset="100%" stopColor="#6a1020"/>
            </linearGradient>
            <linearGradient id="legSkin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDDBB4"/>
              <stop offset="100%" stopColor="#e8b880"/>
            </linearGradient>
            <linearGradient id="hairDark" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a1a0a"/>
              <stop offset="100%" stopColor="#1a0a00"/>
            </linearGradient>
            <linearGradient id="hairBun" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3a2010"/>
              <stop offset="100%" stopColor="#1a0a00"/>
            </linearGradient>
            <filter id="dropShadow">
              <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.18)"/>
            </filter>
          </defs>

          <g transform="translate(108,30)" filter="url(#dropShadow)">
            <rect x="28" y="310" width="22" height="90" rx="8" fill="#1a2a4a"/>
            <rect x="58" y="310" width="22" height="90" rx="8" fill="#1a2a4a"/>
            <line x1="39" y1="315" x2="39" y2="395" stroke="#0d1a30" strokeWidth="1.5" opacity="0.5"/>
            <line x1="69" y1="315" x2="69" y2="395" stroke="#0d1a30" strokeWidth="1.5" opacity="0.5"/>
            <ellipse cx="39" cy="398" rx="16" ry="8" fill="#1a1a1a"/>
            <ellipse cx="69" cy="398" rx="16" ry="8" fill="#1a1a1a"/>
            
            <rect x="14" y="190" width="80" height="130" rx="14" fill="url(#pilotUniform)"/>
            <path d="M 54,195 L 40,220 L 54,215 L 68,220 L 54,195 Z" fill="url(#shirtGrad)"/>
            <rect x="46" y="195" width="16" height="80" rx="3" fill="url(#shirtGrad)"/>
            <circle cx="54" cy="220" r="2.5" fill="#ccc"/>
            <circle cx="54" cy="232" r="2.5" fill="#ccc"/>
            <circle cx="54" cy="244" r="2.5" fill="#ccc"/>

            <path d="M 50,215 L 54,270 L 58,215 L 56,208 L 52,208 Z" fill="#0d1a30"/>
            <path d="M 52,268 L 54,278 L 56,268 Z" fill="#0d1a30"/>

            <rect x="10" y="192" width="26" height="10" rx="4" fill="url(#capGrad)"/>
            <line x1="14" y1="196" x2="32" y2="196" stroke="url(#goldGrad)" strokeWidth="2"/>
            <rect x="72" y="192" width="26" height="10" rx="4" fill="url(#capGrad)"/>
            <line x1="76" y1="196" x2="94" y2="196" stroke="url(#goldGrad)" strokeWidth="2"/>

            <g transform="translate(30,210)">
              <path d="M 24,5 Q 10,2 0,5 Q 8,8 24,7 Z" fill="url(#goldGrad)"/>
              <path d="M 24,5 Q 38,2 48,5 Q 40,8 24,7 Z" fill="url(#goldGrad)"/>
              <path d="M 20,2 L 28,2 L 30,10 L 24,13 L 18,10 Z" fill="url(#goldGrad)"/>
            </g>

            {/* Rank stripes */}
            <rect x="12" y="270" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="12" y="276" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="12" y="282" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="12" y="288" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="76" y="270" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="76" y="276" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="76" y="282" width="20" height="3" rx="1" fill="url(#goldGrad)"/>
            <rect x="76" y="288" width="20" height="3" rx="1" fill="url(#goldGrad)"/>

            {/* Animated Saluting Arm */}
            <motion.g
              animate={{ rotate: [0, -4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ originX: "12px", originY: "200px" }}
            >
              <path d="M 12,200 Q -15,185 -28,160" stroke="url(#pilotUniform)" strokeWidth="22" strokeLinecap="round" fill="none"/>
              <path d="M -28,160 Q -22,135 -10,120" stroke="url(#pilotUniform)" strokeWidth="20" strokeLinecap="round" fill="none"/>
              <ellipse cx="-10" cy="116" rx="12" ry="9" fill="url(#skinGrad)" transform="rotate(-30,-10,116)"/>
              <path d="M -30,158 Q -20,140 -15,130" stroke="url(#goldGrad)" strokeWidth="3" fill="none"/>
            </motion.g>

            <path d="M 95,205 Q 118,230 115,270" stroke="url(#pilotUniform)" strokeWidth="22" strokeLinecap="round" fill="none"/>
            <ellipse cx="114" cy="278" rx="12" ry="10" fill="url(#skinGrad)"/>
            <rect x="46" y="165" width="18" height="30" rx="7" fill="url(#skinGrad)"/>
            <ellipse cx="54" cy="148" rx="38" ry="42" fill="url(#skinGrad)"/>
            
            <path d="M 10,126 Q 54,118 98,126 L 96,134 Q 54,128 12,134 Z" fill="#0d1a30"/>
            <path d="M 14,130 Q 14,105 54,100 Q 94,105 94,130 Q 74,126 54,126 Q 34,126 14,130 Z" fill="url(#capGrad)"/>
            <rect x="14" y="124" width="80" height="6" rx="2" fill="url(#goldGrad)"/>
          </g>

          <g transform="translate(285,50)" filter="url(#dropShadow)">
            <rect x="28" y="290" width="19" height="85" rx="7" fill="url(#legSkin)"/>
            <rect x="55" y="290" width="19" height="85" rx="7" fill="url(#legSkin)"/>
            <path d="M 12,230 Q 10,280 14,295 Q 51,300 88,295 Q 92,280 90,230 Z" fill="url(#skirtGrad)"/>
            <rect x="14" y="148" width="74" height="90" rx="12" fill="url(#stewUniform)"/>
            <path d="M 51,155 L 36,178 L 51,172 L 66,178 L 51,155 Z" fill="url(#shirtGrad)"/>
            <rect x="44" y="155" width="14" height="65" rx="3" fill="url(#shirtGrad)"/>
            <path d="M 43,168 Q 51,185 59,168 Q 57,162 51,160 Q 45,162 43,168 Z" fill="url(#scarfGrad)"/>
            <ellipse cx="51" cy="167" rx="7" ry="5" fill="#cc2233"/>
            
            <path d="M 12,158 Q -8,175 -15,210" stroke="url(#stewUniform)" strokeWidth="20" strokeLinecap="round" fill="none"/>
            <path d="M -15,210 Q -18,235 -15,255" stroke="url(#stewUniform)" strokeWidth="18" strokeLinecap="round" fill="none"/>
            <ellipse cx="-13" cy="262" rx="10" ry="12" fill="url(#skinGrad)" transform="rotate(10,-13,262)"/>
            
            <path d="M 88,158 Q 110,180 108,225" stroke="url(#stewUniform)" strokeWidth="20" strokeLinecap="round" fill="none"/>
            <path d="M 108,225 Q 106,250 100,270" stroke="url(#stewUniform)" strokeWidth="18" strokeLinecap="round" fill="none"/>
            <ellipse cx="98" cy="278" rx="10" ry="12" fill="url(#skinGrad)"/>
            
            <rect x="42" y="130" width="18" height="25" rx="6" fill="url(#skinGrad)"/>
            <ellipse cx="51" cy="112" rx="34" ry="40" fill="url(#skinGrad)"/>
            <circle cx="51" cy="65" r="18" fill="url(#hairBun)"/>
            <path d="M 17,112 Q 17,80 51,75 Q 85,80 85,112" fill="url(#hairDark)"/>
            <path d="M 30,85 Q 51,78 72,85 L 70,95 Q 51,88 32,95 Z" fill="url(#stewUniform)"/>
          </g>
        </svg>
      </div>

      {isCheckingStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-semibold text-slate-700">Checking WhatsApp connection...</p>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-4xl text-center md:mb-14">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-[#ea580c]" />
            <span
              className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ea580c]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Aviation Services
            </span>
            <div className="h-[2px] w-10 bg-[#ea580c]" />
          </div>
          <h2 
            className="mb-4 text-4xl uppercase leading-none text-white md:text-6xl"
            style={{
              color: styles.services_title?.color || '#f8fafc',
              fontSize: styles.services_title?.fontSize,
              fontWeight: styles.services_title?.fontWeight,
              fontStyle: styles.services_title?.fontStyle,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "0.05em",
              textShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {settings.services_title}
          </h2>
          <p 
            className="mx-auto max-w-2xl text-sm font-semibold uppercase tracking-[0.18em] text-white/65 md:text-base"
            style={{
              color: styles.services_subtitle?.color || 'rgba(255,255,255,0.65)',
              fontSize: styles.services_subtitle?.fontSize,
              fontWeight: styles.services_subtitle?.fontWeight,
              fontStyle: styles.services_subtitle?.fontStyle,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {settings.services_subtitle}
          </p>
        </div>

        {/* Services Horizontal Scroll */}
        <div className="relative max-w-full mx-auto">
          <div 
            className="overflow-x-auto pt-10 pb-10 no-scrollbar touch-pan-x touch-pan-y"
            ref={scrollRef}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <motion.div 
              className="flex gap-8 min-w-max px-4"
            >
              {services.map((service, index) => {
                const reviews = serviceReviews[service.id] || [];
                const avgRating = reviews.length > 0 
                  ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                  : null;

                const isActive = index === activeServiceIndex;

                return (
                  <motion.div
                    key={`${service.id}-${index}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05
                    }}
                    onClick={() => handleServiceClick(service)}
                    className={`group flex h-full w-[280px] shrink-0 cursor-pointer flex-col border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:border-[#ea580c]/50 hover:bg-white/[0.07] hover:shadow-[0_24px_70px_-30px_rgba(234,88,12,0.45)] md:w-[320px] ${isActive ? "bg-white/[0.07] -translate-y-2 border-[#ea580c]/55" : ""}`}
                    style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))" }}
                  >
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-20 h-20 rounded-2xl bg-[#ea580c]/12 flex items-center justify-center group-hover:bg-[#ea580c]/18 transition-colors overflow-hidden border border-white/10">
                          {service.image_url && (
                            <img 
                              src={service.image_url} 
                              alt={service.title} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 saturate-180" 
                            />
                          )}
                        </div>
                        {service.label && (
                          <Badge className="bg-[#ea580c] text-white hover:bg-[#ea580c]/90 border-none shadow-sm text-[10px] px-2 py-0.5">
                            {service.label}
                          </Badge>
                        )}
                      </div>

                      <h3
                        className="mb-3 truncate text-2xl uppercase leading-none text-white transition-colors group-hover:text-[#ea580c]"
                        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                      >
                        {service.title}
                      </h3>
                      
                      <p className="text-sm text-[#f5f5f5] mb-4 line-clamp-3 group-hover:text-white transition-colors font-semibold leading-relaxed">
                        {service.description}
                      </p>

                      <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-sm text-yellow-400">
                            {avgRating ? (
                              <>
                                <Star className="w-4 h-4 fill-current" />
                                <span className="font-bold text-yellow-400">{avgRating}</span>
                                <span className="text-[#f5f5f5] text-[10px]">({reviews.length})</span>
                              </>
                            ) : (
                              <span className="text-[#f5f5f5] text-[10px]">No reviews yet</span>
                            )}
                          </div>
                        </div>

                        <Button 
                          className="w-full h-11 rounded-none text-white font-black uppercase tracking-[0.22em] text-[10px] shadow-[0_18px_50px_-18px_rgba(234,88,12,0.6)] transition-all active:scale-[0.98]"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            background: "#ea580c",
                            clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceClick(service);
                          }}
                        >
                          <Star className="w-3 h-3 mr-2" />
                          Write a Review
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
          <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] flex-col overflow-hidden border border-white/10 bg-[#08101f] p-0 shadow-[0_28px_90px_-30px_rgba(0,0,0,0.95)] sm:max-w-[500px]">
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0b1327]/90 p-4 backdrop-blur-md sm:p-6">
              <DialogHeader className="p-0 space-y-1 text-left">
                <DialogTitle
                  className="text-2xl uppercase leading-tight text-white sm:text-3xl"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                >
                  Review {selectedService?.title}
                </DialogTitle>
                <DialogDescription
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ea580c]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Customer Feedback & Submission
                </DialogDescription>
              </DialogHeader>
              <DialogClose className="rounded-full border border-white/15 p-2 text-white transition-colors hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 sm:p-6 space-y-8 pb-32">
                <div className="bg-slate-50/80 p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-inner">
                <h4 className="font-black text-slate-900 mb-5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    Customer Reviews
                  </span>
                  <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                    {selectedService ? serviceReviews[selectedService.id]?.length || 0 : 0}
                  </span>
                </h4>
                <div className="max-h-[40vh] sm:max-h-[500px] overflow-y-auto overflow-x-hidden space-y-6 custom-scrollbar pr-1 sm:pr-2 scroll-smooth">
                  {selectedService && serviceReviews[selectedService.id]?.length > 0 ? (
                    serviceReviews[selectedService.id].map((r, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3 w-full min-w-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-slate-900 truncate text-sm sm:text-base">{r.customer_name}</span>
                            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
                              {(() => {
                                const date = new Date(r.created_at);
                                const day = date.getDate();
                                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                                const year = date.getFullYear();
                                return `${day} ${month} ${year}`;
                              })()}
                            </span>
                          </div>
                          <div className="flex text-yellow-500 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100 shrink-0 shadow-sm">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star key={idx} className={`w-3 h-3 ${idx < r.rating ? 'fill-current' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-medium text-xs sm:text-sm break-words whitespace-pre-wrap">"{r.comment}"</p>
                        {r.image_urls && r.image_urls.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x pt-2">
                            {r.image_urls.map((url, idx) => (
                              <div key={idx} className="group relative rounded-xl overflow-hidden border-2 border-slate-100 w-20 h-20 sm:w-24 sm:h-24 shrink-0 snap-start shadow-sm bg-slate-200 transition-all hover:border-primary/50">
                                <img 
                                  src={url} 
                                  alt={`Review ${idx + 1}`} 
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
                                  onClick={() => window.open(url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-slate-200">
                      <Star className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 font-bold italic">No reviews yet. Be the first to share!</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-slate-100 border border-slate-200/60 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-xl text-slate-900 tracking-tight">Share Your Experience</h4>
                </div>

                <form onSubmit={submitReview} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Your Name</Label>
                      <Input 
                        id="name" 
                        value={reviewForm.name} 
                        onChange={e => setReviewForm({...reviewForm, name: e.target.value})} 
                        required 
                        placeholder="John Doe"
                        className="h-12 border-black rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Rating</Label>
                      <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-black h-12 items-center justify-center sm:justify-start w-full sm:w-fit px-4">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setReviewForm({...reviewForm, rating: star})}
                            className={`transition-all hover:scale-125 active:scale-95 ${reviewForm.rating >= star ? 'text-yellow-500' : 'text-slate-300'}`}
                          >
                            <Star className={`w-6 h-6 ${reviewForm.rating >= star ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Comment</Label>
                    <Textarea 
                      id="comment" 
                      value={reviewForm.comment} 
                      onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} 
                      required 
                      placeholder="How was your introductory flight experience?"
                      className="min-h-[120px] border-black rounded-2xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold resize-none p-4 placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="images" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Attach Photos (Optional - Max 1MB)</Label>
                    <div className="flex flex-col gap-3">
                      <div className="relative group">
                        <Input 
                          id="images" 
                          type="file" 
                          accept="image/*" 
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              const validFiles: File[] = [];
                              Array.from(files).forEach(file => {
                                if (file.size > 1 * 1024 * 1024) {
                                  toast.error(`File ${file.name} is too large. Max 1MB allowed.`);
                                } else {
                                  validFiles.push(file);
                                }
                              });
                              
                              if (validFiles.length > 0) {
                                const dt = new DataTransfer();
                                validFiles.forEach(file => dt.items.add(file));
                                setReviewImages(dt.files);
                              } else {
                                e.target.value = ''; // Reset if all files invalid
                                setReviewImages(null);
                              }
                            }
                          }} 
                          className="cursor-pointer border-dashed border-2 border-black hover:border-primary/50 file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary/90 transition-all h-auto py-3 px-4 rounded-2xl bg-slate-50/50"
                        />
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1 mt-1">Max 1MB per image</p>
                      {reviewImages && reviewImages.length > 0 && (
                        <div className="flex items-center gap-3 bg-green-50 p-4 rounded-2xl border border-black animate-in fade-in slide-in-from-left-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-xs font-black text-green-700">{reviewImages.length} photo(s) ready for takeoff</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Verification */}
                  <div className="space-y-4 pt-6 border-t border-black">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="phone" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp Verification</Label>
                      <p className="text-[10px] text-slate-400 font-bold ml-1">We'll send a code to ensure you're a real human explorer.</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {!isVerified ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <LucideIcons.Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                              id="phone" 
                              value={phoneNumber} 
                              onChange={e => setPhoneNumber(e.target.value)} 
                              placeholder="+60123456789"
                              disabled={isVerifying || isSendingOtp}
                              className="h-12 pl-11 border-black rounded-xl font-bold text-sm focus:ring-4 focus:ring-primary/5 transition-all w-full"
                            />
                          </div>
                          {!isVerifying && (
                            <Button 
                              type="button" 
                              onClick={handleSendOTP} 
                              disabled={isSendingOtp || !phoneNumber}
                              className="bg-green-600 hover:bg-green-700 text-white h-12 px-4 sm:px-8 font-black rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95 w-full sm:w-auto"
                            >
                              {isSendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify via WhatsApp"}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 bg-green-50 text-green-700 rounded-2xl border-2 border-black shadow-sm animate-in zoom-in-95">
                          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Verified Identity</span>
                            <span className="font-black text-base">{phoneNumber}</span>
                          </div>
                        </div>
                      )}

                      {isVerifying && !isVerified && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 bg-primary/5 p-5 rounded-2xl border-2 border-black shadow-xl">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="otp" className="text-xs font-black text-primary uppercase tracking-widest">Security Code</Label>
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin text-primary" />
                              <span className="text-[10px] text-primary font-black italic">Waiting for input...</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input 
                              id="otp" 
                              value={otpInput} 
                              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))} 
                              placeholder="0000"
                              maxLength={4}
                              className="flex-1 tracking-[0.8em] text-center font-black text-3xl h-16 border-2 border-black rounded-xl bg-white shadow-inner focus:ring-0"
                              autoFocus
                            />
                          </div>
                          <div className="flex justify-between items-center px-1">
                            <button 
                              type="button" 
                              onClick={() => {
                                setIsVerifying(false);
                                setOtpInput('');
                              }}
                              className="text-xs text-slate-500 hover:text-primary transition-colors font-black uppercase tracking-tighter flex items-center gap-1"
                            >
                              <LucideIcons.ArrowLeft className="w-3 h-3" /> Change Number
                            </button>
                            <button 
                              type="button" 
                              onClick={handleSendOTP}
                              className="text-xs text-primary hover:underline font-black uppercase tracking-tighter"
                            >
                              Resend Code
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

            <div className="sticky bottom-0 z-20 bg-white border-t border-slate-100 p-4 sm:p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] shrink-0">
              <Button 
                type="button"
                onClick={(e) => {
                  const form = (e.currentTarget.parentElement?.previousElementSibling as HTMLElement)?.querySelector('form');
                  if (form) form.requestSubmit();
                }}
                disabled={isSubmitting || !isVerified} 
                className={`w-full h-14 text-lg font-black rounded-2xl shadow-xl transition-all active:scale-95 ${
                  isVerified 
                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing Review...
                  </div>
                ) : isVerified ? (
                  <div className="flex items-center gap-2">
                    Submit My Experience
                    <LucideIcons.Send className="w-5 h-5" />
                  </div>
                ) : (
                  "Complete Verification First"
                )}
              </Button>
            </div>
          </DialogContent>
      </Dialog>
    </section>
  );
};
