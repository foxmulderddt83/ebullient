import { useState, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import { motion, useAnimation, useScroll, useTransform, useSpring } from "framer-motion";
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
import { Star, Loader2, CheckCircle2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { BackgroundParticles } from "./ui/BackgroundParticles";
import { trackEvent } from "@/lib/analytics";
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
  const [showReviewForm, setShowReviewForm] = useState(false);
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

  const [settings, setSettings] = useState({
    services_title: "Our Services",
    services_subtitle: "From romantic proposals to corporate events, we make every moment unforgettable",
    bg_gradient_services: ""
  });
  const [styles, setStyles] = useState<Record<string, any>>({});

  const [isPaused, setIsPaused] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const controls = useAnimation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    setIsDragging(true);
    setIsPaused(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
    document.body.style.userSelect = 'none';
    const images = scrollRef.current.querySelectorAll('img');
    images.forEach(img => img.setAttribute('draggable', 'false'));
  };

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.userSelect = '';
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        if (window.innerWidth < 768 || !scrollRef.current?.matches(':hover')) {
          setIsPaused(false);
        }
      }, 2000);
    }
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Scroll-driven animation logic
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Create different bobbing patterns for even and odd cards
   const yEven = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0, -25, 25, -25, 25, 0]);
   const yOdd = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0, 25, -25, 25, -25, 0]);
  
  // Smooth the scroll values
  const smoothYEven = useSpring(yEven, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const smoothYOdd = useSpring(yOdd, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    if (isGlobalPaused || services.length === 0 || selectedService) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % services.length);
    }, 4000); // Change highlight every 4 seconds

    return () => clearInterval(interval);
  }, [isGlobalPaused, services.length, selectedService]);

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      setIsPaused(true);
      
      const container = scrollRef.current;
      const isMobile = window.innerWidth < 768;
      const itemWidth = isMobile ? 260 : 420;
      const gap = 16;
      const scrollAmount = direction === 'left' ? -(itemWidth + gap) : (itemWidth + gap);
      
      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });

      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }

      resumeTimeoutRef.current = setTimeout(() => {
        if (window.innerWidth < 768 || !container.matches(':hover')) {
          setIsPaused(false);
        }
      }, 2000);
    }
  };

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
    if (!selectedService) {
      setShowReviewForm(false);
    }
  }, [selectedService]);

  // Continuous smooth auto-scroll (Marquee)
  useEffect(() => {
    if (services.length === 0 || isGlobalPaused || selectedService) {
      controls.stop();
      return;
    }

    if (isPaused) {
      controls.stop();
      return;
    }

    const startMarquee = async () => {
      if (!scrollRef.current) return;
      
      const scrollWidth = scrollRef.current.scrollWidth;
      const singleSetWidth = scrollWidth / 2; // Because we duplicate the items

      // Reset native scroll when starting/resuming marquee to avoid offset conflict
      if (scrollRef.current.scrollLeft !== 0) {
        scrollRef.current.scrollTo({ left: 0 });
      }

      await controls.start({
        x: [0, -singleSetWidth],
        transition: {
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: services.length * 10, // Adjust speed based on number of items
            ease: "linear",
          },
        },
      });
    };

    startMarquee();
  }, [services.length, isPaused, selectedService, isGlobalPaused, controls]);

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
    setSelectedService(service);
    if (!supabase) return;

    // Log analytics
    trackEvent({
      action_type: 'click',
      entity_type: 'service',
      entity_id: service.id,
      entity_name: `Service Detail: ${service.title}`,
      source: 'ServicesSection'
    });

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
      setShowReviewForm(false);
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
      ref={sectionRef}
      className="relative overflow-hidden pt-4 pb-2 md:pt-8 md:pb-4"
      style={settings.bg_gradient_services ? { background: settings.bg_gradient_services } : { background: "#FFFFFF" }}
    >
      <div className="absolute inset-0 z-0 opacity-20 mix-blend-multiply pointer-events-none overflow-hidden">
        <picture>
          <source srcSet="/bg-experience.webp" type="image/webp" />
          <img
            src="/bg-experience.png"
            alt=""
            loading="lazy"
            decoding="async"
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
      </div>
      <BackgroundParticles variant="light" isPaused={!!selectedService} />
      <div className="w-full relative z-10 px-2 lg:px-4">
        <div className="max-w-[1900px] mx-auto">
          <div className="mx-auto mb-10 max-w-4xl text-center md:mb-14">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-[2px] w-10 bg-[#CD5C5C]" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CD5C5C] font-condensed">
                Aviation Services
              </span>
              <div className="h-[2px] w-10 bg-[#CD5C5C]" />
            </div>
            <h2 
              className="mb-4 text-4xl uppercase leading-none text-gray-900 md:text-7xl font-title tracking-[0.05em]"
              style={{
                color: styles.services_title?.color || '#ffffff',
                fontSize: styles.services_title?.fontSize || 'clamp(2.5rem, 8vw, 5rem)',
                fontWeight: styles.services_title?.fontWeight,
                fontStyle: styles.services_title?.fontStyle,
              }}
            >
              {settings.services_title}
            </h2>
            <p 
              className="mx-auto max-w-2xl text-sm font-semibold uppercase tracking-[0.18em] text-white md:text-lg font-condensed"
              style={{
                color: styles.services_subtitle?.color || '#ffffff',
                fontSize: styles.services_subtitle?.fontSize || 'clamp(0.9rem, 1.5vw, 1.125rem)',
                fontWeight: styles.services_subtitle?.fontWeight,
                fontStyle: styles.services_subtitle?.fontStyle,
              }}
            >
              {settings.services_subtitle}
            </p>
          </div>

          {/* Services Horizontal Scroll */}
          <div className="relative max-w-full mx-auto group/scroll-container">
          {/* Left Scroll Button */}
          <button
            onClick={() => handleManualScroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-40 bg-white hover:bg-gray-50 text-gray-900 p-2 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 flex items-center justify-center border-2 border-[#CD5C5C] shadow-lg"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* Right Scroll Button */}
          <button
            onClick={() => handleManualScroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-40 bg-white hover:bg-gray-50 text-gray-900 p-2 rounded-full transition-all duration-300 opacity-0 group-hover/scroll-container:opacity-100 flex items-center justify-center border-2 border-[#CD5C5C] shadow-lg"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div 
            className="overflow-x-auto pt-10 pb-10 no-scrollbar touch-auto cursor-grab active:cursor-grabbing select-none"
            ref={scrollRef}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') {
                setIsPaused(true);
                if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
              }
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse' && !isDragging) {
                if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
                resumeTimeoutRef.current = setTimeout(() => {
                  setIsPaused(false);
                }, 2000);
              }
            }}
            onTouchStart={() => {
              setIsPaused(true);
              if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
            }}
            onTouchEnd={() => {
              if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
              resumeTimeoutRef.current = setTimeout(() => {
                setIsPaused(false);
              }, 2000);
            }}
            onTouchCancel={() => {
              if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
              resumeTimeoutRef.current = setTimeout(() => {
                setIsPaused(false);
              }, 2000);
            }}
          >
            <motion.div 
              className="flex gap-4 min-w-max px-4"
              animate={controls}
            >
              {[...services, ...services].map((service, index) => {
                const reviews = serviceReviews[service.id] || [];
                const avgRating = reviews.length > 0 
                  ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                  : null;
                const isActive = activeIndex === (index % services.length) && !isGlobalPaused && !selectedService;

                return (
                    <motion.div
                      key={`${service.id}-${index}`}
                      style={{ y: index % 2 === 0 ? smoothYEven : smoothYOdd }}
                      className="h-full w-[260px] shrink-0 md:w-[420px]"
                    >
                      <motion.div
                        onClick={() => handleServiceClick(service)}
                        initial={{ opacity: 0, scale: 0.9, y: 20, rotate: 0 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0, rotate: index % 2 === 0 ? -2.5 : 2.5 }}
                        animate={isActive ? {
                          scale: 1.04,
                          translateY: -12,
                          rotate: index % 2 === 0 ? -4 : 4,
                          boxShadow: "0 45px 110px -30px rgba(205, 92, 92, 0.45)",
                          borderColor: "#CD5C5C",
                          borderWidth: "2px"
                        } : {
                          scale: 1,
                          translateY: 0,
                          rotate: index % 2 === 0 ? -2.5 : 2.5,
                          boxShadow: "0 35px 80px -20px rgba(0,0,0,0.95)",
                          borderColor: "rgba(0,0,0,0.1)",
                          borderWidth: "1px"
                        }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ 
                          duration: 0.6, 
                          ease: "easeOut",
                          scale: { type: "spring", stiffness: 260, damping: 20 }
                        }}
                        onMouseEnter={() => {
                          if (!isGlobalPaused) setActiveIndex(index % services.length);
                        }}
                        className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden bg-white border-t-[3px] border-t-[#CD5C5C] backdrop-blur-md transition-all duration-500 rounded-2xl md:rounded-3xl"
                        style={{ 
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`,
                          backgroundSize: '28px 49px',
                          marginTop: index % 2 === 0 ? '3rem' : '0',
                          marginBottom: index % 2 !== 0 ? '3rem' : '0',
                        }}
                      >
                      {/* Animated Shine Effect */}
                      <motion.div
                        animate={!isGlobalPaused ? {
                          left: ["-150%", "200%"],
                        } : {}}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "linear",
                          repeatDelay: 2 + index // Staggered shine
                        }}
                        className="absolute top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-[-25deg] pointer-events-none z-10"
                      />
                      <motion.div 
                        className="relative z-10 flex flex-col h-full"
                        animate={!isGlobalPaused ? {
                          y: [0, -8, 0],
                        } : { y: 0 }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.2
                        }}
                      >
                        <div className="relative h-48 md:h-56 w-full shrink-0 overflow-hidden bg-[#CC1F1F]/12 border-b border-gray-200">
                          {service.image_url && (
                            <img 
                              loading="lazy"
                              src={service.image_url} 
                              alt={service.title} 
                              decoding="async"
                              width={420}
                              height={280}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 saturate-150" 
                            />
                          )}
                          {service.label && (
                            <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
                              <Badge className="bg-[#CC1F1F] text-white hover:bg-[#CC1F1F]/90 border-none shadow-[0_4px_10px_rgba(0,0,0,0.5)] text-[9px] md:text-[10px] px-2 py-0.5 md:px-2.5 md:py-1 font-bold uppercase tracking-wider">
                                {service.label}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col flex-1 p-4 md:p-6">
                          <h3 className="mb-2 md:mb-3 truncate text-xl md:text-2xl uppercase leading-none text-zinc-900 transition-colors group-hover:text-[#CC1F1F] font-title tracking-[0.04em]">
                            {service.title}
                          </h3>
                          
                          <p className="text-xs md:text-sm text-zinc-700 mb-3 md:mb-4 line-clamp-3 transition-colors font-sans leading-relaxed">
                            {service.description}
                          </p>

                          <div className="flex flex-col gap-2 md:gap-3 mt-auto pt-3 md:pt-4 border-t border-gray-200">
                            {reviews.length > 0 && (
                              <div className="mb-3 md:mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                                  <motion.span 
                                    animate={{ 
                                      opacity: [1, 0.4, 1],
                                      textShadow: [
                                        "0 0 0px rgba(204, 31, 31, 0)",
                                        "0 0 10px rgba(204, 31, 31, 0.8)",
                                        "0 0 0px rgba(204, 31, 31, 0)"
                                      ]
                                    }}
                                    transition={{ 
                                      duration: 0.6, 
                                      repeat: Infinity, 
                                      ease: "easeInOut" 
                                    }}
                                    className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-[#CD5C5C]"
                                  >
                                    Latest Review
                                  </motion.span>
                                  <div className="h-px flex-1 bg-gradient-to-r from-[#CD5C5C]/20 to-transparent" />
                                </div>
                                <div className="bg-gray-50/50 p-2 md:p-3 rounded-xl border border-gray-100 relative">
                                  <div className="flex gap-2 md:gap-3">
                                    {reviews[0].image_urls && reviews[0].image_urls.length > 0 && (
                                      <div className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <img
                                          src={reviews[0].image_urls[0]}
                                          alt="Customer review"
                                          className="w-full h-full object-cover"
                                          width={56}
                                          height={56}
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[12px] md:text-[14px] text-zinc-600 italic line-clamp-2 font-semibold leading-relaxed">
                                        "{reviews[0].comment}"
                                      </p>
                                      <div className="mt-1.5 md:mt-2 flex items-center justify-between">
                                        <span className="text-[10px] md:text-[11px] font-bold text-zinc-400">— {reviews[0].customer_name}</span>
                                        <div className="flex text-yellow-500 gap-0.5">
                                          {Array.from({ length: 5 }).map((_, idx) => (
                                            <Star key={idx} className={`w-2 h-2 ${idx < reviews[0].rating ? 'fill-current' : 'text-zinc-200'}`} />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs md:text-sm text-yellow-400">
                                {avgRating ? (
                                  <>
                                    <Star className="w-3 h-3 md:w-4 md:h-4 fill-current" />
                                    <span className="font-bold text-yellow-400">{avgRating}</span>
                                    <span className="text-zinc-500 text-[9px] md:text-[10px]">({reviews.length})</span>
                                  </>
                                ) : (
                                  <span className="text-zinc-500 text-[9px] md:text-[10px]">No reviews yet</span>
                                )}
                              </div>
                            </div>

                            <Button 
                              className="w-full h-9 md:h-11 text-white font-black uppercase tracking-[0.22em] text-[10px] md:text-[12px] shadow-[0_18px_50px_-18px_rgba(205, 92, 92, 0.6)] transition-all active:scale-[0.98] rounded-full"
                              style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                background: "#CD5C5C",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleServiceClick(service);
                              }}
                            >
                              <Star className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1.5 md:mr-2" />
                              View More Review
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                </motion.div>
              );
            })}
            </motion.div>
          </div>
        </div>
      </div>
    </div>

    <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
          <DialogContent 
            className="flex max-h-[92vh] w-[calc(100%-2rem)] flex-col overflow-hidden border border-gray-200 bg-white border-t-[3px] border-t-[#CC1F1F] p-0 shadow-[0_45px_120px_-40px_rgba(0,0,0,0.95)] sm:max-w-[500px] rounded-2xl md:rounded-3xl"
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89l-11-6.35-11 6.35z'/%3E%3C/svg%3E")`,
              backgroundSize: '28px 49px'
            }}
          >
            {/* Animated Shine Effect */}
            <motion.div
              animate={!isGlobalPaused ? {
                left: ["-150%", "200%"],
              } : {}}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 3
              }}
              className="absolute top-0 h-full w-48 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-[-25deg] pointer-events-none z-[15]"
            />
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 p-4 backdrop-blur-md sm:p-6">
              <DialogHeader className="p-0 space-y-1 text-left">
                <DialogTitle
                  className="text-2xl uppercase leading-tight text-gray-900 sm:text-3xl"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                >
                  Review {selectedService?.title}
                </DialogTitle>
                <DialogDescription
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-[#CC1F1F]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Customer Feedback & Submission
                </DialogDescription>
              </DialogHeader>
              <DialogClose className="rounded-full border border-gray-300 p-2 text-white transition-colors hover:bg-white/10">
                <X className="w-5 h-5 text-gray-900" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 sm:p-6 space-y-8 pb-32">
                <div className="bg-gray-100/50 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-inner">
                <h4 className="font-black text-zinc-800 mb-5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    Customer Reviews
                  </span>
                  <span className="text-xs font-black bg-[#CD5C5C]/20 text-[#CD5C5C] px-3 py-1 rounded-full border border-[#CD5C5C]/20">
                    {selectedService ? serviceReviews[selectedService.id]?.length || 0 : 0}
                  </span>
                </h4>
                <div className="max-h-[40vh] sm:max-h-[500px] overflow-y-auto overflow-x-hidden space-y-6 custom-scrollbar pr-1 sm:pr-2 scroll-smooth">
                  {selectedService && serviceReviews[selectedService.id]?.length > 0 ? (
                    serviceReviews[selectedService.id].map((r, i) => (
                      <div key={i} className="bg-gray-100/80 p-4 rounded-xl shadow-[0_15px_40px_-15px_rgba(0,0,0,0.8)] border border-gray-200 space-y-3 w-full min-w-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-zinc-900 truncate text-sm sm:text-base">{r.customer_name}</span>
                            <span className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">
                              {(() => {
                                const date = new Date(r.created_at);
                                const day = date.getDate();
                                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                                const year = date.getFullYear();
                                return `${day} ${month} ${year}`;
                              })()}
                            </span>
                          </div>
                          <div className="flex text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 shrink-0 shadow-sm">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star key={idx} className={`w-3 h-3 ${idx < r.rating ? 'fill-current' : 'text-zinc-600'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-zinc-600 leading-relaxed font-medium text-xs sm:text-sm break-words whitespace-pre-wrap">"{r.comment}"</p>
                        {r.image_urls && r.image_urls.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x pt-2">
                            {r.image_urls.map((url, idx) => (
                              <div key={idx} className="group relative rounded-2xl overflow-hidden border-2 border-gray-200 w-28 h-28 sm:w-32 sm:h-32 shrink-0 snap-start shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] bg-white transition-all hover:border-[#CC1F1F]/50">
                                <img
                                  src={url}
                                  alt={`Review image ${idx + 1}`}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
                                  width={128}
                                  height={128}
                                  loading="lazy"
                                  decoding="async"
                                  onClick={() => window.open(url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-[#CC1F1F]/0 group-hover:bg-[#CC1F1F]/5 transition-colors pointer-events-none" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-gray-200">
                      <Star className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 font-bold italic">No reviews yet. Be the first to share!</p>
                    </div>
                  )}
                </div>
              </div>

              {showReviewForm && (
                <div id="review-form-container" className="mt-8 p-4 sm:p-6 rounded-2xl bg-white/60 border border-gray-200 shadow-inner animate-in slide-in-from-bottom-8 fade-in duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#CD5C5C]/10 flex items-center justify-center text-[#CD5C5C] shadow-sm">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="font-black text-xl text-zinc-900 tracking-tight">Share Your Experience</h4>
                  </div>

                <form onSubmit={submitReview} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Your Name</Label>
                      <Input 
                        id="name" 
                        value={reviewForm.name} 
                        onChange={e => setReviewForm({...reviewForm, name: e.target.value})} 
                        required 
                        placeholder="John Doe"
                        className="h-12 border-gray-300 bg-gray-50 rounded-xl focus:ring-4 focus:ring-[#CD5C5C]/5 transition-all text-sm font-bold text-zinc-900 placeholder:text-zinc-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Rating</Label>
                      <div className="flex gap-2 bg-gray-50 p-2 rounded-xl border border-gray-300 h-12 items-center justify-center sm:justify-start w-full sm:w-fit px-4">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setReviewForm({...reviewForm, rating: star})}
                            className={`transition-all hover:scale-125 active:scale-95 ${reviewForm.rating >= star ? 'text-yellow-500' : 'text-zinc-600'}`}
                          >
                            <Star className={`w-6 h-6 ${reviewForm.rating >= star ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Comment</Label>
                    <Textarea 
                      id="comment" 
                      value={reviewForm.comment} 
                      onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} 
                      required 
                      placeholder="How was your introductory flight experience?"
                      className="min-h-[120px] border-gray-300 bg-gray-50 rounded-2xl focus:ring-4 focus:ring-[#CD5C5C]/5 transition-all text-sm font-bold text-zinc-900 resize-none p-4 placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="images" className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Attach Photos (Optional - Max 3MB)</Label>
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
                                if (file.size > 3 * 1024 * 1024) {
                                  toast.error(`File ${file.name} is too large. Max 3MB allowed.`);
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
                          className="cursor-pointer border-dashed border-2 border-gray-300 hover:border-[#CD5C5C]/50 file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#CD5C5C] file:text-white hover:file:bg-[#CD5C5C]/90 transition-all h-auto py-3 px-4 rounded-2xl bg-gray-50"
                        />
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-gray-500 ml-1 mt-1">Max 3MB per image</p>
                      {reviewImages && reviewImages.length > 0 && (
                        <div className="flex items-center gap-3 bg-green-900/20 p-4 rounded-2xl border border-green-500/30 animate-in fade-in slide-in-from-left-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-xs font-black text-green-500">{reviewImages.length} photo(s) ready for takeoff</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Verification */}
                  <div className="space-y-4 pt-6 border-t border-gray-200">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="phone" className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">WhatsApp Verification</Label>
                      <p className="text-[10px] text-gray-500 font-bold ml-1">We'll send a code to ensure you're a real human explorer.</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {!isVerified ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <LucideIcons.Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input 
                              id="phone" 
                              value={phoneNumber} 
                              onChange={e => setPhoneNumber(e.target.value)} 
                              placeholder="+60123456789"
                              disabled={isVerifying || isSendingOtp}
                              className="h-12 pl-11 border-gray-300 bg-gray-50 rounded-xl font-bold text-sm text-zinc-900 focus:ring-4 focus:ring-[#CD5C5C]/5 transition-all w-full placeholder:text-zinc-400"
                            />
                          </div>
                          {!isVerifying && (
                            <Button 
                              type="button" 
                              onClick={handleSendOTP} 
                              disabled={isSendingOtp || !phoneNumber}
                              className="bg-green-600 hover:bg-green-700 text-white h-12 px-4 sm:px-8 font-black rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95 w-full sm:w-auto"
                            >
                              {isSendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify via WhatsApp"}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 bg-green-900/20 text-green-500 rounded-2xl border border-green-500/30 shadow-sm animate-in zoom-in-95">
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
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 bg-white/80 p-5 rounded-2xl border border-gray-200 shadow-xl">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="otp" className="text-xs font-black text-[#CD5C5C] uppercase tracking-widest">Security Code</Label>
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin text-[#CD5C5C]" />
                              <span className="text-[10px] text-[#CD5C5C] font-black italic">Waiting for input...</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input 
                              id="otp" 
                              value={otpInput} 
                              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))} 
                              placeholder="0000"
                              maxLength={4}
                              className="flex-1 tracking-[0.8em] text-center font-black text-3xl h-16 border-gray-300 rounded-xl bg-white text-zinc-900 shadow-inner focus:ring-0"
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
                              className="text-xs text-gray-500 hover:text-[#CD5C5C] transition-colors font-black uppercase tracking-tighter flex items-center gap-1"
                            >
                              <LucideIcons.ArrowLeft className="w-3 h-3" /> Change Number
                            </button>
                            <button 
                              type="button" 
                              onClick={handleSendOTP}
                              className="text-xs text-[#CD5C5C] hover:underline font-black uppercase tracking-tighter"
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
            )}
            </div>
          </div>

            <div className="sticky bottom-0 z-20 bg-white/98 border-t border-gray-200 p-4 sm:p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] shrink-0 backdrop-blur-md">
              {!showReviewForm ? (
                <Button 
                  type="button"
                  onClick={() => {
                    setShowReviewForm(true);
                    setTimeout(() => {
                      document.getElementById('review-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="w-full h-14 text-lg font-black rounded-2xl shadow-xl transition-all active:scale-95 bg-[#CD5C5C] hover:bg-[#CD5C5C]/90 text-white shadow-[0_0_20px_rgba(205,92,92,0.4)]"
                >
                  <div className="flex items-center justify-center gap-2">
                    POST REVIEW
                    <LucideIcons.MessageSquarePlus className="w-5 h-5" />
                  </div>
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={(e) => {
                    const form = (e.currentTarget.parentElement?.previousElementSibling as HTMLElement)?.querySelector('form');
                    if (form) form.requestSubmit();
                  }}
                  disabled={isSubmitting || !isVerified} 
                  className={`w-full h-14 text-lg font-black rounded-2xl shadow-xl transition-all active:scale-95 ${
                    isVerified 
                      ? "bg-[#CD5C5C] hover:bg-[#CD5C5C]/90 text-white shadow-black/20" 
                      : "bg-white text-gray-500 cursor-not-allowed shadow-none"
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
              )}
            </div>
          </DialogContent>
      </Dialog>
    </section>
  );
};
